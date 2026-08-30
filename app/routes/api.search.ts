import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
const YT_DLP_CMD = "python -m yt_dlp";

export interface SearchItem {
  type: "video" | "playlist";
  id: string;
  title: string;
  uploader?: string;
  trackCount?: number;
}

export const loader = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();

  if (!query) return { results: [] };

  try {
    const isUrl = query.startsWith("http://") || query.startsWith("https://") || query.includes("youtu");

    // ==========================================
    // 1. DIRECT URL HANDLING
    // ==========================================
    if (isUrl) {
      const isPlaylistUrl = query.includes("list=");

      if (isPlaylistUrl) {
        // Extract playlist ID from URL
        const playlistIdMatch = query.match(/list=([a-zA-Z0-9_-]+)/);
        const playlistId = playlistIdMatch ? playlistIdMatch[1] : null;

        if (!playlistId) return { results: [] };

        const cmd = `${YT_DLP_CMD} --flat-playlist -J "https://www.youtube.com/playlist?list=${playlistId}"`;
        const { stdout } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024 });
        const data = JSON.parse(stdout || "{}");

        return {
          results: [
            {
              type: "playlist",
              id: playlistId,
              title: data.title || "Pasted Playlist",
              uploader: data.uploader || data.channel || "YouTube",
              trackCount: data.playlist_count || data.entries?.length || 0,
            },
          ],
        };
      } else {
        // Single Video URL
        const cmd = `${YT_DLP_CMD} -J "${query}"`;
        const { stdout } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024 });
        const data = JSON.parse(stdout || "{}");

        if (!data.id) return { results: [] };

        return {
          results: [
            {
              type: "video",
              id: data.id,
              title: data.title || "Pasted Video",
              uploader: data.uploader || data.channel || "YouTube",
            },
          ],
        };
      }
    }

    // ==========================================
    // 2. TEXT QUERY SEARCH
    // ==========================================
    const sanitizedQuery = query.replace(/["\\]/g, "");

    const videoCmd = `${YT_DLP_CMD} --flat-playlist -J "ytsearch5:${sanitizedQuery}"`;
    const playlistUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAw%3D%3D`;
    const playlistCmd = `${YT_DLP_CMD} --flat-playlist --playlist-end 3 -J "${playlistUrl}"`;

    const [videoRes, playlistRes] = await Promise.all([
      execPromise(videoCmd, { maxBuffer: 10 * 1024 * 1024 }).catch(() => ({ stdout: "{}" })),
      execPromise(playlistCmd, { maxBuffer: 10 * 1024 * 1024 }).catch(() => ({ stdout: "{}" })),
    ]);

    const videoData = JSON.parse(videoRes.stdout || "{}");
    const playlistData = JSON.parse(playlistRes.stdout || "{}");

    const results: SearchItem[] = [];

    if (Array.isArray(videoData.entries)) {
      for (const entry of videoData.entries) {
        if (entry?.id) {
          results.push({
            type: "video",
            id: entry.id,
            title: entry.title || "Unknown Video",
            uploader: entry.uploader || entry.channel || "Unknown Channel",
          });
        }
      }
    }

    if (Array.isArray(playlistData.entries)) {
      for (const entry of playlistData.entries) {
        if (entry?.id) {
          results.push({
            type: "playlist",
            id: entry.id,
            title: entry.title || "Unknown Playlist",
            uploader: entry.uploader || entry.channel || "Unknown Channel",
            trackCount: entry.playlist_count || entry.entries?.length || 0,
          });
        }
      }
    }

    return { results };
  } catch (error: any) {
    console.error("Search Error:", error.message);
    return Response.json({ results: [] }, { status: 500 });
  }
};