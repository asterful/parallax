import type { LoaderFunctionArgs } from "react-router";
import { spawn } from "child_process";
import { Readable } from "stream";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const videoId = params.videoId;
  if (!videoId) {
    return new Response("Missing videoId", { status: 400 });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  
  const ytdlp = spawn(pythonCmd, [
    "-m", "yt_dlp",
    "-f", "bestaudio[ext=m4a]/bestaudio",
    "-o", "-",
    videoUrl,
  ]);

  // Kill the process immediately if the user disconnects
  if (request.signal) {
    request.signal.addEventListener("abort", () => {
      if (!ytdlp.killed) {
        ytdlp.kill("SIGTERM");
      }
    });
  }

  const stream = Readable.toWeb(ytdlp.stdout) as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": "audio/mp4",
      "Cache-Control": "no-cache",
    },
  });
};