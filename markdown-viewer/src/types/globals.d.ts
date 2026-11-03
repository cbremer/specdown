// Ambient declarations for the globals the native shells inject into the page.
//
// The Electron preload (desktop/preload.js) exposes `window.specdown`, and the
// iOS WKWebView injects `window.iosNative` / `window.webkit` plus a set of
// callbacks the Swift side invokes. None of these exist on the standard DOM
// `Window`, so they are declared here for the type-checker. This file is the
// canonical description of the web ↔ native bridge contract.

export {};

/** Payload delivered by the desktop shell when a file is opened or changes. */
interface SpecdownFileData {
  annotationSource?: {
    authorityId: string;
    sourceToken: string;
    requiresReconnect?: boolean;
  } | null;
  filename: string;
  content: string;
  filePath: string;
}

/** Main-issued receipt exists only for a newly delivered desktop open. */
interface SpecdownFileOpenData extends SpecdownFileData {
  workspaceId?: string;
  openReceipt: string;
}

/** On-disk metadata for a file, returned by the desktop shell for the File
 * info sheet. Times are epoch milliseconds; `owner` is a best-effort username
 * (or null when it can't be resolved, e.g. another user or on Windows). */
interface SpecdownFileMetadata {
  filePath: string;
  size: number;
  birthtimeMs: number;
  mtimeMs: number;
  owner: string | null;
}

/** One persisted tab descriptor sent to the desktop shell's session store. */
interface SpecdownSessionTab {
  filePath: string | null;
  filename: string;
}

/** A single markdown file discovered when scanning a workspace folder. */
interface SpecdownWorkspaceFile {
  path: string;
  relPath: string;
  name: string;
}

/** The scanned workspace folder delivered by the desktop shell. */
interface SpecdownWorkspace {
  id: string;
  generation: number;
  root: string;
  files: SpecdownWorkspaceFile[];
}

/** The desktop (Electron) bridge exposed on `window.specdown` by the preload. */
interface SpecdownOpenFailure {
  id: string;
  filename: string;
  message: string;
  canForget: boolean;
}

interface SpecdownDesktopBridge {
  isDesktop?: boolean;
  /** Shell OS (Node `process.platform`): 'darwin' | 'win32' | 'linux'. */
  platform?: string;
  /** 'mas' for the Mac App Store build, 'direct' for the DMG/ZIP download. */
  distribution?: 'mas' | 'direct';
  readBookmarkedFile?: (
    filePath: string
  ) => Promise<SpecdownFileOpenData | null>;
  requestFileOpen?: () => void;
  requestOpenPath?: (filePath: string) => void;
  requestOpenFolder?: () => void;
  requestOpenRelative?: (fromPath: string, href: string, id: string) => void;
  requestWorkspaceFile?: (filePath: string, id: string) => void;
  requestCloseWorkspace?: () => void;
  onWorkspaceClosed?: (cb: (info: { generation: number }) => void) => void;
  onWorkspaceOpened?: (cb: (workspace: SpecdownWorkspace) => void) => void;
  watchFile?: (filePath: string) => void;
  unwatchFile?: (filePath: string) => void;
  requestRefreshFile?: (filePath: string) => void;
  /** Fetch on-disk metadata for the File info sheet (request/response IPC). */
  getFileMetadata?: (
    filePath: string
  ) => Promise<SpecdownFileMetadata | null> | SpecdownFileMetadata | null;
  getPathForFile?: (file: File) => string;
  /** Mac App Store build: a by-path open had no sandbox access. */
  onFileAccessNeeded?: (
    cb: (info: { filePath: string; filename: string }) => void
  ) => void;
  /** Re-grant access to a file through the open panel, then open it. */
  onFileOpenFailed?: (callback: (info: SpecdownOpenFailure) => void) => void;
  onFileOpenRecoveryResolved?: (
    callback: (info: { id: string }) => void
  ) => void;
  resolveFileOpenFailure?: (request: {
    id: string;
    action: 'locate' | 'forget' | 'dismiss';
  }) => Promise<boolean>;
  requestGrantAccess?: (filePath: string) => void;
  openDroppedPath?: (absPath: string) => void;
  onFileOpened?: (cb: (fileData: SpecdownFileOpenData) => void) => void;
  reportFileOpenResult?: (receipt: string, accepted: boolean) => void;
  onCloseTab?: (cb: () => void) => void;
  onFileChanged?: (
    cb: (fileData: SpecdownFileData) => void | Promise<void>
  ) => void;
  onTriggerPrint?: (cb: () => void) => void;
  /** Export a standalone printable HTML document to a PDF file. */
  exportPdf?: (payload: { title: string; html: string }) => void;
  onTriggerExportPdf?: (cb: () => void) => void;
  onTriggerSearch?: (cb: () => void) => void;
  onSetVisualTheme?: (cb: (themeId: string) => void) => void;
  notifyVisualTheme?: (themeId: string) => void;
  notifyVisualThemeCatalog?: (
    catalog: ReadonlyArray<{ id: string; label: string; icon?: string }>
  ) => void;
  onApplyCustomCss?: (cb: (cssContent: string) => void) => void;
  saveSession?: (tabs: SpecdownSessionTab[]) => void;
  onUpdateDownloaded?: (cb: (info: { version?: string }) => void) => void;
  restartToUpdate?: () => void;
}

/** A single WKScriptMessageHandler bridge on the iOS side. */
interface WebkitMessageHandler {
  postMessage: (message: unknown) => void;
}

declare global {
  interface Window {
    /** Electron preload bridge (desktop only). */
    specdown?: SpecdownDesktopBridge;
    /** Truthy inside the iOS/iPadOS WKWebView shell. */
    iosNative?: boolean;
    /** App Store marketing version (e.g. "1.0"), injected by the iOS shell. */
    specdownAppVersion?: string;
    /** Set by the app; called by the iOS shell to show a native file error. */
    specdownShowError?: (message: string) => void;
    /** WKWebView message-handler namespace (iOS only). */
    webkit?: {
      messageHandlers?: {
        specdown?: WebkitMessageHandler;
      };
    };
    /** Synchronously returns whether a native document passed preflight and opened. */
    specdownReloadImages?: (token: string) => void;
    specdownLoadNativeDocument?: (content: string, filename: string, nativeDocument: {id: string, expectedToken?: string, deliveryID?: string}) => {accepted: boolean, token: string, openIDs: string[]};
    loadFileContent?: (content: string, filename: string, nativeDocument?: {id: string, expectedToken?: string, deliveryID?: string}) => boolean;
    /** Set by the app; called by the iOS shell to switch theme. */
    setTheme?: (theme: string) => void;
    /** Set by the app; called by the iOS shell on layout-class changes. */
    setIOSLayoutMode?: (mode: string) => void;
  }

  // Under the Jest harness a global `mermaid` mock stands in for the dynamic
  // import; in production it is undefined until the engine is loaded.
  // eslint-disable-next-line no-var
  var mermaid: unknown | undefined;

  // Vite `define` inlines this as true | false. Undeclared under the Jest
  // eval harness — htmlDocumentsEnabled() uses typeof first.
  const __HTML_DOCUMENTS_ENABLED__: boolean | undefined;
}
