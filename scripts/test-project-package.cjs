const crypto = require("crypto");
const fs = require("fs");
const fsp = fs.promises;
const os = require("os");
const path = require("path");
const projectPackage = require("../dist-electron/projectPackage.js");

const hashFile = (filePath) =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

(async () => {
  const testDirectory = await fsp.mkdtemp(
    path.join(os.tmpdir(), "hinana-eco-package-test-"),
  );
  try {
    const source = path.join(testDirectory, "source-audio.wav");
    const target = path.join(testDirectory, "roundtrip.heco");
    const legacyTarget = path.join(testDirectory, "legacy.heco");
    await fsp.writeFile(source, crypto.randomBytes(128 * 1024));
    const project = {
      formatVersion: 1,
      name: "package-test",
      sampleRate: 48000,
      bpm: 120,
      tracks: [{ id: "track-1", name: "audio" }],
      clips: [
        { id: "clip-1", trackId: "track-1", path: source },
        { id: "clip-2", trackId: "track-1", path: source },
      ],
    };
    await projectPackage.writeProjectPackage(
      target,
      JSON.stringify(project),
      "test",
    );
    const reopened = JSON.parse(
      await projectPackage.readProjectPackage(target),
    );
    const result = {
      embeddedAudioCount: reopened.package.embeddedAudioCount,
      clipCount: reopened.clips.length,
      deduplicated: reopened.clips[0].path === reopened.clips[1].path,
      audioMatches: hashFile(source) === hashFile(reopened.clips[0].path),
    };
    if (
      result.embeddedAudioCount !== 1 ||
      result.clipCount !== 2 ||
      !result.deduplicated ||
      !result.audioMatches
    )
      throw new Error(`Package round-trip failed: ${JSON.stringify(result)}`);
    await fsp.writeFile(legacyTarget, JSON.stringify(project), "utf8");
    const legacy = JSON.parse(
      await projectPackage.readProjectPackage(legacyTarget),
    );
    if (legacy.name !== project.name || legacy.clips[0].path !== source)
      throw new Error("Legacy JSON project compatibility failed.");
    console.log(`Package round-trip passed: ${JSON.stringify(result)}`);
  } finally {
    projectPackage.cleanupProjectExtractions();
    await fsp.rm(testDirectory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
