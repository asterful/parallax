import type { LoaderFunctionArgs } from "react-router";
import { execFile } from "child_process";
import { promisify } from "util";

const execFilePromise = promisify(execFile);

export interface SearchItem {
  type: "video" | "playlist";
  id: string;
  title: string;
  uploader?: string;
  trackCount?: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();

  if (!query) return Response.json({ results: [] });

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const execOptions = {
    maxBuffer: 10 * 1024 * 1024,
    signal: request.signal,
  };

  try {
    const isUrl = query.startsWith("http://") || query.startsWith("https://") || query.includes("youtu");

    if (isUrl) {
      const isPlaylistUrl = query.includes("list=");

      if (isPlaylistUrl) {
        const playlistIdMatch = query.match(/list=([a-zA-Z0-9_-]+)/);
        const playlistId = playlistIdMatch ? playlistIdMatch[1] : null;

        if (!playlistId) return Response.json({ results: [] });

        const { stdout } = await execFilePromise(
          pythonCmd,
          ["-m", "yt_dlp", "--flat-playlist", "-J", `https://www.youtube.com/playlist?list=${playlistId}`],
          execOptions
        );

        const data = JSON.parse(stdout || "{}");

        return Response.json({
          results: [
            {
              type: "playlist",
              id: playlistId,
              title: data.title || "Pasted Playlist",
              uploader: data.uploader || data.channel || "YouTube",
              trackCount: data.playlist_count || data.entries?.length || 0,
            },
          ],
        });
      } else {
        const { stdout } = await execFilePromise(pythonCmd, ["-m", "yt_dlp", "-J", query], execOptions);
        const data = JSON.parse(stdout || "{}");

        if (!data.id) return Response.json({ results: [] });

        return Response.json({
          results: [
            {
              type: "video",
              id: data.id,
              title: data.title || "Pasted Video",
              uploader: data.uploader || data.channel || "YouTube",
            },
          ],
        });
      }
    }

    const playlistUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAw%3D%3D`;

    const [videoRes, playlistRes] = await Promise.all([
      execFilePromise(pythonCmd, ["-m", "yt_dlp", "--flat-playlist", "-J", `ytsearch5:${query}`], execOptions).catch(
        () => ({ stdout: "{}" })
      ),
      execFilePromise(
        pythonCmd,
        ["-m", "yt_dlp", "--flat-playlist", "--playlist-end", "3", "-J", playlistUrl],
        execOptions
      ).catch(() => ({ stdout: "{}" })),
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

    return Response.json({ results });
  } catch (error: any) {
    if (error.name === "AbortError") return Response.json({ results: [] }, { status: 499 });
    console.error("Search Error:", error.message);
    return Response.json({ results: [] }, { status: 500 });
  }
};