import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("hinanaEco", {
  platform: process.platform,
  getFilePath: (file: File) => webUtils.getPathForFile(file),
  selectAudioFiles: () => ipcRenderer.invoke("audio:select"),
  readAudio: (filePath: string) => ipcRenderer.invoke("audio:read", filePath),
  newProject: () => ipcRenderer.invoke("project:new"),
  saveProject: (data: string, saveAs = false) =>
    ipcRenderer.invoke(saveAs ? "project:save-as" : "project:save", data),
  openProject: () => ipcRenderer.invoke("project:open"),
  exportAudio: (
    data: ArrayBuffer,
    suggestedName: string,
    format: "wav" | "mp3",
    mp3Bitrate: number,
  ) =>
    ipcRenderer.invoke(
      "audio:export",
      data,
      suggestedName,
      format,
      mp3Bitrate,
    ),
  revealFile: (filePath: string) => ipcRenderer.invoke("file:reveal", filePath),
  openExternal: (url: string) => ipcRenderer.invoke("external:open", url),
  onMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: unknown, action: string) => callback(action);
    ipcRenderer.on("menu:action", listener);
    return () => ipcRenderer.removeListener("menu:action", listener);
  },
});
