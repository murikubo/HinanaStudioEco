/// <reference types="vite/client" />

interface Window {
  hinanaEco?: {
    platform: string;
    getFilePath(file: File): string;
    selectAudioFiles(): Promise<Array<{ path: string; name: string }>>;
    readAudio(path: string): Promise<ArrayBuffer>;
    newProject(): Promise<boolean>;
    saveProject(data: string, saveAs?: boolean): Promise<string | null>;
    openProject(): Promise<{ path: string; data: string } | null>;
    exportAudio(
      data: ArrayBuffer,
      suggestedName: string,
      format: "wav" | "mp3",
      mp3Bitrate: number,
    ): Promise<string | null>;
    revealFile(path: string): Promise<boolean>;
    openExternal(url: string): Promise<boolean>;
    onMenuAction(callback: (action: string) => void): () => void;
  };
}
