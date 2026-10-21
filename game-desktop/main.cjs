// Projeto "Procedural Platformer" — app desktop minimal Electron.
const { app, BrowserWindow } = require("electron");
const path = require("node:path");

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.whenReady().then(() => {
    const win = new BrowserWindow({
      width: 1280,
      height: 720,
      minWidth: 480,
      minHeight: 420,
      title: "Procedural Platformer",
      backgroundColor: "#526c7e",
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: false,
        nodeIntegration: false,
        spellcheck: false,
      },
    });
    win.loadFile(path.join(__dirname, "game.html"));
    win.on("closed", () => app.quit());
  });
  app.on("window-all-closed", () => app.quit());
}
