import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  MenuItemConstructorOptions,
  shell,
} from "electron";
import { existsSync, promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import {
  cleanupProjectExtractions,
  readProjectPackage,
  writeProjectPackage,
} from "./projectPackage";

app.setName("HINANA STUDIO ECO");
app.setAppUserModelId("studio.hinana.eco");

const packagedFfmpegPath = require("ffmpeg-static") as string;
const ffmpegPath = app.isPackaged
  ? packagedFfmpegPath.replace("app.asar", "app.asar.unpacked")
  : packagedFfmpegPath;

let mainWindow: BrowserWindow | null = null;
let currentProjectPath: string | null = null;
const recentFile = () => path.join(app.getPath("userData"), "recent-projects.json");

const getRecentProjects = async () => {
  try {
    const items = JSON.parse(await fs.readFile(recentFile(), "utf8")) as string[];
    return items.filter(existsSync).slice(0, 8);
  } catch {
    return [];
  }
};

const rememberProject = async (filePath: string) => {
  const items = await getRecentProjects();
  const next = [filePath, ...items.filter((item) => item !== filePath)].slice(0, 8);
  await fs.mkdir(path.dirname(recentFile()), { recursive: true });
  await fs.writeFile(recentFile(), JSON.stringify(next, null, 2), "utf8");
};

const iconPath = () => {
  const candidates = [
    path.join(process.resourcesPath, "HinanaStudioEcoIcon.png"),
    path.join(app.getAppPath(), "HinanaStudioEcoIcon.png"),
  ];
  return candidates.find(existsSync);
};

const send = (action: string) => mainWindow?.webContents.send("menu:action", action);

const installMenu = () => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "파일",
      submenu: [
        { label: "새 프로젝트", accelerator: "CmdOrCtrl+N", click: () => send("new") },
        { label: "프로젝트 열기", accelerator: "CmdOrCtrl+O", click: () => send("open") },
        { type: "separator" },
        { label: "오디오 가져오기", accelerator: "CmdOrCtrl+I", click: () => send("import") },
        { type: "separator" },
        { label: "저장", accelerator: "CmdOrCtrl+S", click: () => send("save") },
        { label: "다른 이름으로 저장", accelerator: "CmdOrCtrl+Shift+S", click: () => send("saveAs") },
        { type: "separator" },
        { label: "오디오 내보내기…", accelerator: "CmdOrCtrl+E", click: () => send("export") },
        { type: "separator" },
        { role: "quit", label: "종료" },
      ],
    },
    {
      label: "편집",
      submenu: [
        { label: "실행 취소", accelerator: "CmdOrCtrl+Z", click: () => send("undo") },
        { label: "다시 실행", accelerator: "CmdOrCtrl+Shift+Z", click: () => send("redo") },
        { type: "separator" },
        { label: "복사", accelerator: "CmdOrCtrl+C", click: () => send("copy") },
        { label: "붙여넣기", accelerator: "CmdOrCtrl+V", click: () => send("paste") },
        { label: "복제", accelerator: "CmdOrCtrl+D", click: () => send("duplicate") },
        { type: "separator" },
        { label: "재생 헤드에서 분할", accelerator: "S", click: () => send("split") },
        { label: "선택 삭제", accelerator: "Delete", click: () => send("delete") },
        { label: "리플 삭제", accelerator: "Shift+Delete", click: () => send("rippleDelete") },
      ],
    },
    {
      label: "보기",
      submenu: [
        { role: "reload", label: "새로고침" },
        { role: "toggleDevTools", label: "개발자 도구" },
        { type: "separator" },
        { role: "togglefullscreen", label: "전체 화면" },
      ],
    },
    {
      label: "도움말",
      submenu: [
        {
          label: "HINANA STUDIO ECO 정보",
          click: () => send("about"),
        },
      ],
    },
  ];
  if (process.platform === "darwin") {
    template.unshift({
      label: app.name,
      submenu: [
        {
          label: "HINANA STUDIO ECO 정보",
          click: () => send("about"),
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit", label: "HINANA STUDIO ECO 종료" },
      ],
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: "#171819",
    title: "HINANA STUDIO ECO",
    icon: iconPath(),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    titleBarOverlay:
      process.platform === "darwin"
        ? undefined
        : { color: "#0d0f13", symbolColor: "#a9adb7", height: 58 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  } else {
    void mainWindow.loadURL("http://localhost:5173");
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

ipcMain.handle("audio:select", async () => {
  const result = await dialog.showOpenDialog({
    title: "오디오 파일 가져오기",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "오디오 파일",
        extensions: ["wav", "mp3", "m4a", "aac", "ogg", "flac", "opus", "aif", "aiff"],
      },
      { name: "모든 파일", extensions: ["*"] },
    ],
  });
  if (result.canceled) return [];
  return result.filePaths.map((filePath) => ({
    path: filePath,
    name: path.basename(filePath),
  }));
});

ipcMain.handle("audio:read", async (_event, filePath: string) => {
  const data = await fs.readFile(filePath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
});

ipcMain.handle("project:save", async (_event, data: string) => {
  if (!currentProjectPath) {
    const result = await dialog.showSaveDialog({
      title: "Eco 프로젝트 저장",
      defaultPath: "새 프로젝트.heco",
      filters: [{ name: "HINANA ECO 프로젝트", extensions: ["heco"] }],
    });
    if (result.canceled || !result.filePath) return null;
    currentProjectPath = result.filePath;
  }
  await writeProjectPackage(currentProjectPath, data, app.getVersion());
  await rememberProject(currentProjectPath);
  return currentProjectPath;
});

ipcMain.handle("project:new", () => {
  currentProjectPath = null;
  return true;
});

ipcMain.handle("project:save-as", async (_event, data: string) => {
  const result = await dialog.showSaveDialog({
    title: "Eco 프로젝트를 다른 이름으로 저장",
    defaultPath: currentProjectPath || "새 프로젝트.heco",
    filters: [{ name: "HINANA ECO 프로젝트", extensions: ["heco"] }],
  });
  if (result.canceled || !result.filePath) return null;
  currentProjectPath = result.filePath;
  await writeProjectPackage(currentProjectPath, data, app.getVersion());
  await rememberProject(currentProjectPath);
  return currentProjectPath;
});

ipcMain.handle("project:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "Eco 프로젝트 열기",
    properties: ["openFile"],
    filters: [{ name: "HINANA ECO 프로젝트", extensions: ["heco"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  currentProjectPath = result.filePaths[0];
  await rememberProject(currentProjectPath);
  return {
    path: currentProjectPath,
    data: await readProjectPackage(currentProjectPath),
  };
});

ipcMain.handle("project:recent", () => getRecentProjects());

ipcMain.handle("project:open-recent", async (_event, filePath: string) => {
  if (!existsSync(filePath)) throw new Error("프로젝트 파일을 찾을 수 없습니다.");
  currentProjectPath = filePath;
  await rememberProject(filePath);
  return { path: filePath, data: await readProjectPackage(filePath) };
});

ipcMain.handle("project:backup", async (_event, data: string) => {
  if (!currentProjectPath)
    throw new Error("먼저 프로젝트를 저장한 뒤 백업을 생성하세요.");
  const backupDirectory = path.join(
    path.dirname(currentProjectPath),
    "HINANA ECO Backups",
  );
  await fs.mkdir(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const parsed = path.parse(currentProjectPath);
  const backupPath = path.join(backupDirectory, `${parsed.name}-${stamp}.heco`);
  await writeProjectPackage(backupPath, data, app.getVersion());
  return backupPath;
});

ipcMain.handle("audio:relink", async () => {
  const result = await dialog.showOpenDialog({
    title: "원본 오디오 다시 연결",
    properties: ["openFile"],
    filters: [
      {
        name: "오디오 파일",
        extensions: ["wav", "mp3", "m4a", "aac", "ogg", "flac", "opus", "aif", "aiff"],
      },
    ],
  });
  return result.canceled ? null : result.filePaths[0] || null;
});

ipcMain.handle(
  "recording:save",
  async (_event, data: ArrayBuffer, suggestedName: string) => {
    const directory = path.join(app.getPath("userData"), "Recordings");
    await fs.mkdir(directory, { recursive: true });
    const safeName = path.basename(suggestedName).replace(/[<>:"/\\|?*]/g, "-");
    const outputPath = path.join(directory, safeName);
    await fs.writeFile(outputPath, Buffer.from(data));
    return outputPath;
  },
);

const encodeMp3 = (
  wavData: ArrayBuffer,
  outputPath: string,
  bitrate: number,
) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "wav",
        "-i",
        "pipe:0",
        "-map_metadata",
        "-1",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        `${bitrate}k`,
        "-y",
        outputPath,
      ],
      { windowsHide: true },
    );
    let errorText = "";
    child.stderr.on("data", (chunk) => {
      errorText = (errorText + String(chunk)).slice(-8000);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            errorText.trim() || `MP3 인코더가 종료 코드 ${code}로 종료되었습니다.`,
          ),
        );
    });
    child.stdin.on("error", reject);
    child.stdin.end(Buffer.from(wavData));
  });

ipcMain.handle(
  "audio:export",
  async (
    _event,
    raw: ArrayBuffer,
    suggestedName: string,
    format: "wav" | "mp3",
    requestedBitrate: number,
  ) => {
    const extension = format === "mp3" ? "mp3" : "wav";
    const bitrate = [128, 192, 256, 320].includes(requestedBitrate)
      ? requestedBitrate
      : 320;
    const result = await dialog.showSaveDialog({
      title: format === "mp3" ? "MP3 오디오 내보내기" : "WAV 오디오 내보내기",
      defaultPath: suggestedName.replace(/\.[^.]+$/, `.${extension}`),
      filters: [
        {
          name: format === "mp3" ? "MP3 Audio" : "Wave Audio",
          extensions: [extension],
        },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    if (format === "mp3") {
      try {
        await encodeMp3(raw, result.filePath, bitrate);
      } catch (error) {
        await fs.unlink(result.filePath).catch(() => {});
        throw error;
      }
    } else {
      await fs.writeFile(result.filePath, Buffer.from(raw));
    }
    return result.filePath;
  },
);

ipcMain.handle("file:reveal", (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle("external:open", async (_event, rawUrl: string) => {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("지원하지 않는 외부 링크입니다.");
  await shell.openExternal(url.toString());
  return true;
});

app.whenReady().then(() => {
  installMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", cleanupProjectExtractions);
