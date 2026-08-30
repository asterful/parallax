import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

const YT_DLP_CMD = "python -m yt_dlp";

export interface Track {
  id: string;
  title: string;
  uploader?: string;
}

export const loader = async ({ params }: { params: { playlistId?: string } }) => {
  const playlistId = params.playlistId;
  if (!playlistId) return Response.json({ tracks: [] }, { status: 400 });

  try {
    const cmd = `${YT_DLP_CMD} --flat-playlist -J "https://www.youtube.com/playlist?list=${playlistId}"`;
    const { stdout } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024 });
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
    console.error("Playlist Fetch Error:", error.message);
    return Response.json({ tracks: [] }, { status: 500 });
  }
};