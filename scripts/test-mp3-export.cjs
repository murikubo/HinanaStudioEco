const { spawn } = require("child_process");
const fs = require("fs");
const fsp = fs.promises;
const os = require("os");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");

const createSineWave = () => {
  const sampleRate = 48000;
  const seconds = 1;
  const samples = sampleRate * seconds;
  const channels = 2;
  const dataSize = samples * channels * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let index = 0; index < samples; index++) {
    const sample = Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 0.35;
    const pcm = Math.round(sample * 0x7fff);
    buffer.writeInt16LE(pcm, offset);
    buffer.writeInt16LE(pcm, offset + 2);
    offset += 4;
  }
  return buffer;
};

const run = (args, stdin) =>
  new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let errorText = "";
    child.stderr.on("data", (chunk) => {
      errorText += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(errorText || `FFmpeg exited with ${code}`)),
    );
    if (stdin) child.stdin.end(stdin);
  });

(async () => {
  const testDirectory = await fsp.mkdtemp(
    path.join(os.tmpdir(), "hinana-eco-mp3-test-"),
  );
  try {
    const output = path.join(testDirectory, "encoded.mp3");
    await run(
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "wav",
        "-i",
        "pipe:0",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "320k",
        "-y",
        output,
      ],
      createSineWave(),
    );
    await run([
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      output,
      "-f",
      "null",
      "-",
    ]);
    const stat = await fsp.stat(output);
    if (stat.size <= 1024) throw new Error("Encoded MP3 is unexpectedly small.");
    console.log(`MP3 encode/decode passed: ${stat.size} bytes`);
  } finally {
    await fsp.rm(testDirectory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
