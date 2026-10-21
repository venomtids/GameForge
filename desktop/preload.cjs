const { contextBridge, ipcRenderer } = require("electron");
function subscribe(channel, callback) {
  if (typeof callback !== "function") throw new TypeError("Callback inválido");
  const listener = (_event, value) => {
    if (typeof value === "string") callback(value);
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
contextBridge.exposeInMainWorld("gameforgeDesktop", {
  platform: process.platform,
  open: () => ipcRenderer.invoke("project:open"),
  save: (content, suggested, kind) =>
    ipcRenderer.invoke("file:save", content, suggested, kind),
  autosave: (content) => ipcRenderer.invoke("project:autosave", content),
  initialProject: () => ipcRenderer.invoke("project:initial"),
  onProject: (callback) => subscribe("project:loaded", callback),
  onCommand: (callback) => subscribe("studio:command", callback),
  flushAutosave: (content) => {
    const result = ipcRenderer.sendSync("project:flush", content);
    if (!result?.ok)
      throw new Error(result?.error ?? "Falha ao salvar antes de fechar.");
  },
});
