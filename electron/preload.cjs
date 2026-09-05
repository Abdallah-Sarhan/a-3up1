const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ward39Desktop", {
  exportDiagnostics: () => ipcRenderer.invoke("ward39:export-diagnostics"),
  reportError: (message) => ipcRenderer.send("ward39:renderer-error", String(message).slice(0, 2000)),
  heartbeat: (area) => ipcRenderer.send("ward39:heartbeat", String(area).slice(0, 80)),
  recordInteraction: (kind) => ipcRenderer.send("ward39:interaction", String(kind).slice(0, 120)),
  completeInputTest: () => ipcRenderer.invoke("ward39:input-test-complete"),
  getRuntimeInfo: () => ipcRenderer.invoke("ward39:runtime-info"),
});