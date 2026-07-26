import {
  createReadStream,
  createWriteStream,
  existsSync,
  promises as fs,
} from "fs";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";

const PACKAGE_MAGIC = Buffer.from("HINANA-ECO-PKG1\n", "ascii");
const MAX_HEADER_SIZE = 16 * 1024 * 1024;
const extractionDirectories = new Set<string>();

type PackageAsset = {
  name: string;
  originalName: string;
  size: number;
  source: string;
};

const safeFileName = (value: string) =>
  value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "audio";

export const writeProjectPackage = async (
  targetPath: string,
  rawProject: string,
  appVersion: string,
) => {
  const project = JSON.parse(rawProject);
  const assets: PackageAsset[] = [];
  const sourceToAsset = new Map<string, PackageAsset>();

  const packagedClips: any[] = [];
  for (const clip of project.clips || []) {
    if (
      !clip.path ||
      String(clip.path).startsWith("bundle:") ||
      !existsSync(clip.path)
    ) {
      packagedClips.push(clip);
      continue;
    }
    const absoluteSource = path.resolve(clip.path);
    let asset = sourceToAsset.get(absoluteSource);
    if (!asset) {
      const stat = await fs.stat(absoluteSource);
      if (!stat.isFile()) {
        packagedClips.push(clip);
        continue;
      }
      const originalName = path.basename(absoluteSource);
      asset = {
        name: `assets/${String(assets.length + 1).padStart(4, "0")}-${safeFileName(originalName)}`,
        originalName,
        size: stat.size,
        source: absoluteSource,
      };
      sourceToAsset.set(absoluteSource, asset);
      assets.push(asset);
    }
    packagedClips.push({ ...clip, path: `bundle:${asset.name}` });
  }
  project.clips = packagedClips;

  project.package = {
    formatVersion: 1,
    app: "HINANA STUDIO ECO",
    appVersion,
    embeddedAudioCount: assets.length,
  };

  const projectBuffer = Buffer.from(JSON.stringify(project, null, 2), "utf8");
  const header = Buffer.from(
    JSON.stringify({
      formatVersion: 1,
      app: "HINANA STUDIO ECO",
      appVersion,
      projectSize: projectBuffer.length,
      assets: assets.map(({ source: _source, ...asset }) => asset),
    }),
    "utf8",
  );
  const headerSize = Buffer.alloc(4);
  headerSize.writeUInt32LE(header.length);
  const temporaryPath = `${targetPath}.writing-${process.pid}`;
  const backupPath = `${targetPath}.backup`;

  await fs.writeFile(
    temporaryPath,
    Buffer.concat([PACKAGE_MAGIC, headerSize, header, projectBuffer]),
  );
  for (const asset of assets) {
    await pipeline(
      createReadStream(asset.source),
      createWriteStream(temporaryPath, { flags: "a" }),
    );
  }

  const expectedSize =
    PACKAGE_MAGIC.length +
    headerSize.length +
    header.length +
    projectBuffer.length +
    assets.reduce((sum, asset) => sum + asset.size, 0);
  const written = await fs.stat(temporaryPath);
  if (written.size !== expectedSize) {
    await fs.unlink(temporaryPath).catch(() => {});
    throw new Error("프로젝트 패키지 검증에 실패했습니다.");
  }

  if (!existsSync(targetPath) && existsSync(backupPath))
    await fs.rename(backupPath, targetPath);
  await fs.unlink(backupPath).catch(() => {});
  const hadPrevious = existsSync(targetPath);
  if (hadPrevious) await fs.rename(targetPath, backupPath);
  try {
    await fs.rename(temporaryPath, targetPath);
    await fs.unlink(backupPath).catch(() => {});
  } catch (error) {
    if (!existsSync(targetPath) && existsSync(backupPath))
      await fs.rename(backupPath, targetPath).catch(() => {});
    await fs.unlink(temporaryPath).catch(() => {});
    throw error;
  }
};

export const readProjectPackage = async (filePath: string) => {
  const handle = await fs.open(filePath, "r");
  try {
    const prefix = Buffer.alloc(PACKAGE_MAGIC.length + 4);
    const prefixRead = await handle.read(prefix, 0, prefix.length, 0);
    if (
      prefixRead.bytesRead < prefix.length ||
      !prefix.subarray(0, PACKAGE_MAGIC.length).equals(PACKAGE_MAGIC)
    )
      return await fs.readFile(filePath, "utf8");

    const headerLength = prefix.readUInt32LE(PACKAGE_MAGIC.length);
    if (headerLength <= 0 || headerLength > MAX_HEADER_SIZE)
      throw new Error("올바르지 않은 HINANA ECO 프로젝트입니다.");
    const headerBuffer = Buffer.alloc(headerLength);
    await handle.read(headerBuffer, 0, headerLength, prefix.length);
    const headerData = JSON.parse(headerBuffer.toString("utf8"));
    const projectSize = Number(headerData.projectSize);
    if (!Number.isSafeInteger(projectSize) || projectSize <= 0)
      throw new Error("프로젝트 정보가 손상되었습니다.");

    let offset = prefix.length + headerLength;
    const projectBuffer = Buffer.alloc(projectSize);
    await handle.read(projectBuffer, 0, projectSize, offset);
    offset += projectSize;
    const project = JSON.parse(projectBuffer.toString("utf8"));
    const extractionDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "hinana-eco-project-"),
    );
    extractionDirectories.add(extractionDirectory);
    const extracted = new Map<string, string>();

    for (const asset of headerData.assets || []) {
      const size = Number(asset.size);
      if (!Number.isSafeInteger(size) || size < 0)
        throw new Error("프로젝트의 오디오 정보가 손상되었습니다.");
      const destination = path.join(
        extractionDirectory,
        safeFileName(path.basename(String(asset.name))),
      );
      if (size > 0) {
        await pipeline(
          createReadStream(filePath, {
            start: offset,
            end: offset + size - 1,
          }),
          createWriteStream(destination),
        );
      } else {
        await fs.writeFile(destination, "");
      }
      offset += size;
      extracted.set(String(asset.name), destination);
    }

    project.clips = (project.clips || []).map((clip: any) => {
      const storedPath = String(clip.path || "");
      if (!storedPath.startsWith("bundle:")) return clip;
      const resolved = extracted.get(storedPath.slice("bundle:".length));
      return resolved ? { ...clip, path: resolved } : clip;
    });
    return JSON.stringify(project);
  } finally {
    await handle.close();
  }
};

export const cleanupProjectExtractions = () => {
  for (const directory of extractionDirectories)
    void fs.rm(directory, { recursive: true, force: true }).catch(() => {});
  extractionDirectories.clear();
};
