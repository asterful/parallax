import { execFile } from "child_process"; // 1. Changed exec to execFile
import { promisify } from "util";

const execFilePromise = promisify(execFile); // 2. Promisify execFile

export interface Track {
  id: string;
  title: string;
  uploader?: string;
}

export const loader = async ({ params, request }: { params: { playlistId?: string }; request?: Request }) => {
  const playlistId = params.playlistId;
  if (!playlistId) return Response.json({ tracks: [] }, { status: 400 });

  try {
    const pythonCmd = process.platform === "win32" ? "python" : "python3";

    // 3. Replaced string command with safe array arguments
    const { stdout } = await execFilePromise(
      pythonCmd,
      ["-m", "yt_dlp", "--flat-playlist", "-J", `https://www.youtube.com/playlist?list=${playlistId}`],
      { 
        maxBuffer: 10 * 1024 * 1024,
        signal: request?.signal // Kills process if user cancels
      }
    );
    
    const data = JSON.parse(stdout || "{}");

    const tracks: Track[] = (data.entries || [])
      .filter((e: any) => e && e.id && e.title)
      .map((e: any) => ({
        id: e.id,
        title: e.title,
        uploader: e.uploader || e.channel || "Unknown",
      }));

    return { tracks, playlistTitle: data.title };
  } catch (error: any) {
    if (error.name === "AbortError") return Response.json({ tracks: [] }, { status: 499 });
    console.error("Playlist Fetch Error:", error.message);
    return Response.json({ tracks: [] }, { status: 500 });
  }
};