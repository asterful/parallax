import type { LoaderFunctionArgs } from "react-router";
import { spawn } from "child_process";
import { Readable } from "stream";
import fs from "fs";

// Initialize cookies once on container boot if provided
if (process.env.YOUTUBE_COOKIES_BASE64 && !fs.existsSync("/tmp/cookies.txt")) {
  try {
    const decodedCookies = Buffer.from(process.env.YOUTUBE_COOKIES_BASE64, "base64").toString("utf-8");
    fs.writeFileSync("/tmp/cookies.txt", decodedCookies);
  } catch (err) {
    console.error("Failed to decode and write YouTube cookies:", err);
  }
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const videoId = params.videoId;
  if (!videoId) {
    return new Response("Missing videoId", { status: 400 });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  
  const ytDlpArgs = [
    "-m", "yt_dlp",
    "--js-runtimes", "node",
    "--extractor-args", "youtubepot-bgutilhttp:base_url=http://bgutil-ytdlp-pot-provider.railway.internal:4416",
    "--extractor-args", "youtube:player_client=mweb",
    "-f", "ba/b",
    "-o", "-",
    videoUrl,
  ];

  // Include cookies if available
  if (fs.existsSync("/tmp/cookies.txt")) {
    ytDlpArgs.splice(2, 0, "--cookies", "/tmp/cookies.txt");
  }

  const ytdlp = spawn(pythonCmd, ytDlpArgs);

  // Kill the python process immediately if the user disconnects/navigates away
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
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
};