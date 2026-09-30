const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  screen,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const {
  atomicWrite,
  atomicWriteSync,
  readProjectFile,
  projectArgument,
  validWindowState,
  MAX_PROJECT_BYTES,
} = require("./storage.cjs");
const dev = process.argv.includes("--dev");
let mainWindow,
  rendererDocumentURL = null,
  rendererReady = false,
  pendingProject = projectArgument(process.argv.slice(1));
let lastProjectDirectory,
  dialogBusy = false,
  autosaveQueue = Promise.resolve(),
  autosaveGeneration = 0;
const entry = path.resolve(__dirname, "../dist/index.html");
const trusted = (event) => {
  // Chromium canonicalizes Windows 8.3 paths, case and file URLs differently from Node.
  // Bind IPC to the first document OUR loadFile loaded, not a reconstructed URL.
  // All subsequent navigation and popup windows are denied below.
  const expected = dev ? "http://127.0.0.1:5173/" : rendererDocumentURL;
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    !expected ||
    !event.senderFrame ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame ||
    event.senderFrame.url.split(/[?#]/)[0] !== expected
  )
    throw new Error("Origem IPC inválida");
};
const sendCommand = (command) => {
  mainWindow?.webContents.send("studio:command", command);
};
const showProject = async (filename) => {
  if (!mainWindow || !rendererReady) {
    pendingProject = filename;
    return;
  }
  try {
    const content = await readProjectFile(filename);
    if (!mainWindow?.isDestroyed())
      mainWindow.webContents.send("project:loaded", content);
  } catch (error) {
    if (!mainWindow?.isDestroyed())
      await dialog
        .showMessageBox(mainWindow, {
          type: "error",
          title: "Não foi possível abrir",
          message: error.message,
        })
        .catch(() => {});
  }
};
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, args) => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
    const project = projectArgument(args);
    if (project) void showProject(project);
  });
  app.on("open-file", (event, filename) => {
    event.preventDefault();
    void showProject(filename);
  });
  app
    .whenReady()
    .then(async () => {
      const statePath = path.join(app.getPath("userData"), "window-state.json");
      const autosavePath = path.join(
        app.getPath("userData"),
        "autosave.gameforge.json",
      );
      let previous;
      try {
        previous = JSON.parse(await fs.readFile(statePath, "utf8"));
      } catch {
        /* First launch. */
      }
      const state = validWindowState(previous, screen.getAllDisplays());
      mainWindow = new BrowserWindow({
        ...state,
        minWidth: 480,
        minHeight: 420,
        show: false,
        title: "GameForge Studio",
        backgroundColor: "#151b22",
        icon: path.join(__dirname, "../dist/gameforge.png"),
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          spellcheck: false,
        },
      });
      if (state.maximized) mainWindow.maximize();
      mainWindow.once("ready-to-show", () => mainWindow.show());
      mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      mainWindow.webContents.once("did-navigate", (_event, url) => {
        if (!dev && new URL(url).protocol === "file:")
          rendererDocumentURL = url.split(/[?#]/)[0];
      });
      mainWindow.webContents.on("will-navigate", (event) =>
        event.preventDefault(),
      );
      mainWindow.webContents.session.setPermissionRequestHandler(
        (_wc, permission, callback) => callback(permission === "pointerLock"),
      );
      mainWindow.webContents.session.setPermissionCheckHandler(
        (_wc, permission) => permission === "pointerLock",
      );
      mainWindow.webContents.session.webRequest.onHeadersReceived(
        (details, callback) =>
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              "Content-Security-Policy": [
                dev
                  ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:5173 ws://localhost:5173; object-src 'none'; base-uri 'self'"
                  : "default-src 'self'; script-src 'self' 'unsafe-eval'; worker-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'",
              ],
            },
          }),
      );
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: "Arquivo",
            submenu: [
              {
                label: "Projetos e templates",
                accelerator: "CmdOrCtrl+N",
                click: () => sendCommand("projects"),
              },
              {
                label: "Abrir projeto…",
                accelerator: "CmdOrCtrl+O",
                click: () => sendCommand("open"),
              },
              {
                label: "Salvar em arquivo…",
                accelerator: "CmdOrCtrl+S",
                click: () => sendCommand("save"),
              },
              {
                label: "Exportar jogo HTML…",
                click: () => sendCommand("export"),
              },
              { type: "separator" },
              { label: "Configurações", click: () => sendCommand("settings") },
              { label: "Sair", role: "quit" },
            ],
          },
          {
            label: "Criar",
            submenu: [
              { label: "Adicionar cubo", click: () => sendCommand("box") },
              {
                label: "Adicionar personagem",
                click: () => sendCommand("player"),
              },
              { label: "Toolbox", click: () => sendCommand("toolbox") },
              { label: "Scripts", click: () => sendCommand("scripts") },
              { label: "Animações", click: () => sendCommand("animation") },
              { label: "Terreno", click: () => sendCommand("terrain") },
            ],
          },
          {
            label: "Exibir",
            submenu: [
              {
                label: "Buscar comandos",
                accelerator: "CmdOrCtrl+K",
                click: () => sendCommand("palette"),
              },
              {
                label: "Restaurar layout",
                click: () => sendCommand("reset-layout"),
              },
              { role: "togglefullscreen", label: "Tela cheia" },
              ...(dev
                ? [
                    {
                      role: "toggleDevTools",
                      label: "Ferramentas de desenvolvimento",
                    },
                  ]
                : []),
            ],
          },
          {
            label: "Ajuda",
            submenu: [
              { label: "Guia e atalhos", click: () => sendCommand("help") },
              { label: "Sobre o GameForge", click: () => sendCommand("about") },
            ],
          },
        ]),
      );
      mainWindow.on("close", () => {
        const bounds = mainWindow.getNormalBounds();
        // Small synchronous state write at shutdown; project data is saved separately and atomically.
        try {
          require("node:fs").writeFileSync(
            statePath,
            JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }),
          );
        } catch {
          /* Window bounds are optional. */
        }
      });
      ipcMain.handle("project:initial", async (event) => {
        trusted(event);
        rendererReady = true;
        if (pendingProject) {
          const filename = pendingProject;
          pendingProject = null;
          return readProjectFile(filename);
        }
        try {
          return await readProjectFile(autosavePath);
        } catch {
          try {
            return await readProjectFile(autosavePath + ".bak");
          } catch {
            return null;
          }
        }
      });
      ipcMain.handle("project:autosave", async (event, content) => {
        trusted(event);
        if (
          typeof content !== "string" ||
          Buffer.byteLength(content) > MAX_PROJECT_BYTES
        )
          throw new Error("Autosave excede 8 MB.");
        const generation = ++autosaveGeneration;
        const job = autosaveQueue
          .catch(() => {})
          .then(() =>
            atomicWrite(
              autosavePath,
              content,
              false,
              () => generation === autosaveGeneration,
            ),
          );
        autosaveQueue = job;
        await job;
      });
      ipcMain.on("project:flush", (event, content) => {
        try {
          trusted(event);
          if (
            typeof content !== "string" ||
            Buffer.byteLength(content) > MAX_PROJECT_BYTES
          )
            throw new Error("Autosave excede 8 MB.");
          ++autosaveGeneration;
          atomicWriteSync(autosavePath, content, true);
          event.returnValue = { ok: true };
        } catch (error) {
          event.returnValue = { ok: false, error: error.message };
        }
      });
      ipcMain.handle("project:open", async (event) => {
        trusted(event);
        if (dialogBusy) return { canceled: true };
        dialogBusy = true;
        try {
          const examples = path.join(
            app.isPackaged
              ? process.resourcesPath
              : path.resolve(__dirname, "../examples"),
            app.isPackaged ? "Projetos" : "studio08",
          );
          const fallback = await fs
            .access(examples)
            .then(() => examples)
            .catch(() => app.getPath("documents"));
          const result = await dialog.showOpenDialog(mainWindow, {
            defaultPath: lastProjectDirectory ?? fallback,
            filters: [
              { name: "Projeto GameForge", extensions: ["json", "gameforge"] },
            ],
            properties: ["openFile"],
          });
          if (result.canceled || !result.filePaths[0])
            return { canceled: true };
          lastProjectDirectory = path.dirname(result.filePaths[0]);
          return {
            canceled: false,
            content: await readProjectFile(result.filePaths[0]),
          };
        } finally {
          dialogBusy = false;
        }
      });
      ipcMain.handle("file:save", async (event, content, suggested, kind) => {
        trusted(event);
        if (
          typeof content !== "string" ||
          Buffer.byteLength(content) > 16_000_000 ||
          !["project", "html", "lua", "javascript"].includes(kind) ||
          typeof suggested !== "string" ||
          suggested.length > 200
        )
          throw new Error("Arquivo inválido");
        if (
          kind === "project" &&
          Buffer.byteLength(content) > MAX_PROJECT_BYTES
        )
          throw new Error("Limite de projeto: 8 MB.");
        if (dialogBusy) return { canceled: true };
        dialogBusy = true;
        try {
          const extensions = {
            project: ["json", "gameforge"],
            html: ["html"],
            lua: ["lua"],
            javascript: ["js"],
          };
          const names = {
            project: "Projeto GameForge",
            html: "Jogo HTML",
            lua: "Script Lua",
            javascript: "Script JavaScript",
          };
          const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: path.join(
              lastProjectDirectory ?? app.getPath("documents"),
              path.basename(suggested),
            ),
            filters: [{ name: names[kind], extensions: extensions[kind] }],
          });
          if (result.canceled || !result.filePath) return { canceled: true };
          await atomicWrite(result.filePath, content, kind === "project");
          if (kind === "project")
            lastProjectDirectory = path.dirname(result.filePath);
          return { canceled: false, path: result.filePath };
        } finally {
          dialogBusy = false;
        }
      });
      if (dev) await mainWindow.loadURL("http://127.0.0.1:5173/");
      else await mainWindow.loadFile(entry);
    })
    .catch((error) => {
      dialog.showErrorBox("GameForge Studio", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
}
