const { app, BrowserWindow, dialog, ipcMain, net, protocol } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const explicitCompatibility = process.argv.includes("--compatibility-mode");
const explicitStandard = process.argv.includes("--standard-mode");
const compatibilityByName = /compatib/i.test(path.basename(process.execPath));
const MODE = explicitStandard ? "standard" : explicitCompatibility || compatibilityByName ? "compatibility" : "standard";

// Keep the two rendering paths genuinely independent. The standard package
// uses Chromium defaults; the compatibility package opts into software only.
if (MODE === "compatibility") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion,UseEcoQoSForBackgroundProcess");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const ROOT = path.join(__dirname, "..", "dist-electron");
const INDEX = path.join(ROOT, "electron.html");
const INPUT_TEST = path.join(__dirname, "input-test.html");
const DIAGNOSTIC_NAME = "Ward39-input-diagnostics.txt";
const TEST_MARKER = `input-test-${MODE}.ok`;
let mainWindow;
let lastHeartbeat = Date.now();
let lastArea = "startup";
let recoveryStarted = false;
let watchdog;

function diagnosticPaths() {
  return [
    path.join(app.getPath("userData"), DIAGNOSTIC_NAME),
    path.join(app.getPath("documents"), DIAGNOSTIC_NAME),
  ];
}

function recordDiagnostic(message) {
  const safe = String(message).replace(/[\r\n]+/g, " ").slice(0, 2000);
  for (const file of diagnosticPaths()) {
    try {
      fs.appendFileSync(file, `${new Date().toISOString()} mode=${MODE} ${safe}\n`);
    } catch {
      // Diagnostics must never interrupt patient data entry.
    }
  }
}

function resolveRequest(url) {
  const { pathname } = new URL(url);
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.join(ROOT, rel || "electron.html");
  if (!file.startsWith(ROOT)) return INDEX;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return INDEX;
  return file;
}

function testPassed() {
  return fs.existsSync(path.join(app.getPath("userData"), TEST_MARKER));
}

function loadApplication(win) {
  lastArea = "application";
  lastHeartbeat = Date.now();
  return win.loadURL("app://ward39/electron.html");
}

function switchModeAndRelaunch(reason) {
  if (recoveryStarted) return;
  recoveryStarted = true;
  recordDiagnostic(`automatic recovery: ${reason}; lastArea=${lastArea}; silenceMs=${Date.now() - lastHeartbeat}`);
  const nextArg = MODE === "standard" ? "--compatibility-mode" : "--standard-mode";
  const args = process.argv.slice(1).filter((arg) => arg !== "--compatibility-mode" && arg !== "--standard-mode");
  app.relaunch({ args: [...args, nextArg, "--recovery-attempt"] });
  app.exit(0);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 950,
    minWidth: 1000,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#f4f8f9",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  mainWindow = win;
  recordDiagnostic(`window created; Electron=${process.versions.electron}; Chrome=${process.versions.chrome}; Windows=${process.getSystemVersion()}`);

  win.webContents.on("render-process-gone", (_event, details) => {
    recordDiagnostic(`renderer stopped: ${details.reason}; exitCode=${details.exitCode}`);
    if (!process.argv.includes("--recovery-attempt")) switchModeAndRelaunch("renderer stopped");
  });
  win.on("unresponsive", () => {
    recordDiagnostic(`window unresponsive; lastArea=${lastArea}`);
    if (!process.argv.includes("--recovery-attempt")) switchModeAndRelaunch("window unresponsive");
  });
  win.on("responsive", () => recordDiagnostic("window responsive again"));
  win.webContents.on("did-fail-load", (_event, code, description) => recordDiagnostic(`page load failed: ${code}; ${description}`));

  if (testPassed()) void loadApplication(win);
  else {
    lastArea = "self-test";
    void win.loadFile(INPUT_TEST);
  }
}

app.whenReady().then(() => {
  protocol.handle("app", (request) => net.fetch(pathToFileURL(resolveRequest(request.url)).toString()));

  ipcMain.handle("ward39:runtime-info", () => `Mode: ${MODE} · Electron ${process.versions.electron} · Windows ${process.getSystemVersion()}`);
  ipcMain.handle("ward39:input-test-complete", async () => {
    try {
      fs.writeFileSync(path.join(app.getPath("userData"), TEST_MARKER), new Date().toISOString(), "utf8");
    } catch (error) {
      recordDiagnostic(`could not save input-test marker: ${error}`);
    }
    recordDiagnostic("input self-test completed successfully");
    if (mainWindow && !mainWindow.isDestroyed()) await loadApplication(mainWindow);
    return true;
  });
  ipcMain.handle("ward39:export-diagnostics", async () => {
    const result = await dialog.showSaveDialog({
      title: "حفظ تقرير تشخيص Ward 39",
      defaultPath: path.join(app.getPath("documents"), DIAGNOSTIC_NAME),
      filters: [{ name: "Text file", extensions: ["txt", "log"] }],
    });
    if (result.canceled || !result.filePath) return false;
    let events = "No events were recorded.\n";
    try { events = fs.readFileSync(diagnosticPaths()[0], "utf8"); } catch {}
    fs.writeFileSync(result.filePath, `Ward 39 desktop diagnostics\nMode: ${MODE}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nWindows: ${process.getSystemVersion()}\nNo patient data is included.\n\n${events}`, "utf8");
    return true;
  });
  ipcMain.on("ward39:renderer-error", (_event, message) => recordDiagnostic(`renderer error: ${message}`));
  ipcMain.on("ward39:heartbeat", (_event, area) => {
    lastHeartbeat = Date.now();
    lastArea = String(area).slice(0, 80);
  });
  ipcMain.on("ward39:interaction", (_event, kind) => {
    lastHeartbeat = Date.now();
    recordDiagnostic(`interaction: ${kind}`);
  });

  watchdog = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isFocused()) return;
    const silence = Date.now() - lastHeartbeat;
    if (silence > 10000 && !process.argv.includes("--recovery-attempt")) {
      switchModeAndRelaunch(`heartbeat stopped for ${silence}ms`);
    }
  }, 2500);

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  if (watchdog) clearInterval(watchdog);
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});