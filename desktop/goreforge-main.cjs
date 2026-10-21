/**
 * GORE FORGE — aplicativo de desktop (Electron).
 *
 * O jogo é um arquivo HTML autossuficiente (`goreforge.html`), então este
 * processo principal faz só o que precisa: abre a janela, guarda o tamanho
 * dela, libera o mouse para o FPS (pointer lock), fecha tudo que não é o jogo
 * e deixa o F11 trabalhar. Nenhum `node_modules` de desenvolvimento e nenhum
 * IPC de arquivos entram aqui: a página é local e não fala com a rede.
 *
 * Desenvolvimento:   electron . --dev   (carrega http://127.0.0.1:5173/goreforge.html)
 * Produção:          electron .         (carrega os recursos embutidos)
 */
const { app, BrowserWindow, Menu, dialog, screen, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const dev = process.argv.includes("--dev");
const ENDERECO_DEV = "http://127.0.0.1:5173/goreforge.html";
const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Onde o jogo está: recurso empacotado, pasta do app ou repositório (dev). */
function localizarJogo() {
  const candidatos = [
    process.resourcesPath
      ? path.join(process.resourcesPath, "goreforge.html")
      : null,
    path.resolve(__dirname, "../goreforge.html"),
    path.resolve(__dirname, "../entregas/goreforge.html"),
    path.resolve(__dirname, "../../entregas/goreforge.html"),
  ].filter(Boolean);
  for (const candidato of candidatos)
    if (fs.existsSync(candidato)) return candidato;
  return candidatos[0] ?? "";
}

const arquivoEstado = () => path.join(app.getPath("userData"), "janela.json");

/** Restaura a janela só se ela ainda couber em algum monitor. */
function lerEstado() {
  let salvo;
  try {
    salvo = JSON.parse(fs.readFileSync(arquivoEstado(), "utf8"));
  } catch {
    return { width: 1280, height: 760 };
  }
  if (
    !salvo ||
    ![salvo.x, salvo.y, salvo.width, salvo.height].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) ||
    salvo.width < 480 ||
    salvo.height < 420
  )
    return { width: 1280, height: 760 };
  const visivel = screen.getAllDisplays().some((tela) => {
    const area = tela.workArea;
    return (
      salvo.x < area.x + area.width - 80 &&
      salvo.y < area.y + area.height - 80 &&
      salvo.x + salvo.width > area.x + 80 &&
      salvo.y + salvo.height > area.y + 80
    );
  });
  return visivel
    ? salvo
    : {
        width: Math.max(480, salvo.width),
        height: Math.max(420, salvo.height),
      };
}

function salvarEstado(janela) {
  if (!janela || janela.isDestroyed()) return;
  try {
    const caixa = janela.getNormalBounds();
    fs.writeFileSync(
      arquivoEstado(),
      JSON.stringify({ ...caixa, maximized: janela.isMaximized() }),
    );
  } catch {
    /* sem estado salvo: a próxima abertura usa o padrão */
  }
}

let janela = null;
let documentoConfiavel = null;

function criarJanela() {
  const estado = lerEstado();
  const jogo = localizarJogo();
  janela = new BrowserWindow({
    ...estado,
    minWidth: 480,
    minHeight: 420,
    show: false,
    title: "GORE FORGE",
    backgroundColor: "#0b0d10",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../packaging/gameforge.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      backgroundThrottling: false, // o loop do jogo continua a 60 Hz fora de foco
    },
  });

  if (estado.maximized) janela.maximize();
  janela.once("ready-to-show", () => janela.show());

  // o jogo é a única coisa que esta janela pode carregar
  documentoConfiavel = dev
    ? ENDERECO_DEV
    : `file://${jogo.replace(/\\/g, "/")}`;
  janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  janela.webContents.on("will-navigate", (evento) => evento.preventDefault());

  // FPS precisa do mouse preso; o resto é negado
  janela.webContents.session.setPermissionRequestHandler(
    (_conteudo, permissao, responder) =>
      responder(permissao === "pointerLock" || permissao === "fullscreen"),
  );
  janela.webContents.session.setPermissionCheckHandler(
    (_conteudo, permissao) =>
      permissao === "pointerLock" || permissao === "fullscreen",
  );

  // cabeçalho de segurança igual em dev e produção (a página é local)
  janela.webContents.session.webRequest.onHeadersReceived((detalhes, seguir) =>
    seguir({
      responseHeaders: {
        ...detalhes.responseHeaders,
        "Content-Security-Policy": [
          dev
            ? CSP.replace(
                "connect-src 'self'",
                "connect-src 'self' ws://127.0.0.1:5173 ws://localhost:5173",
              )
            : CSP,
        ],
      },
    }),
  );

  // F11 = tela cheia; o jogo continua com as teclas dele
  janela.webContents.on("before-input-event", (_evento, entrada) => {
    if (entrada.type === "keyDown" && entrada.key === "F11")
      janela.setFullScreen(!janela.isFullScreen());
  });

  janela.on("close", () => salvarEstado(janela));
  janela.on("closed", () => {
    janela = null;
  });

  if (dev) void janela.loadURL(ENDERECO_DEV);
  else void janela.loadFile(jogo);
}

function montarMenu() {
  const modelo = [
    {
      label: "Jogo",
      submenu: [
        {
          label: "Reiniciar o pátio",
          accelerator: "CmdOrCtrl+R",
          click: () => janela?.webContents.reload(),
        },
        {
          label: "Tela cheia",
          accelerator: "F11",
          click: () => janela?.setFullScreen(!janela.isFullScreen()),
        },
        { type: "separator" },
        { label: "Sair", accelerator: "Alt+F4", role: "quit" },
      ],
    },
    {
      label: "Ajuda",
      submenu: [
        {
          label: "Controles",
          click: () =>
            dialog.showMessageBox(janela, {
              type: "info",
              title: "GORE FORGE — controles",
              message: "W A S D andar · Shift correr · Ctrl/C agachar · Q dash",
              detail:
                "Space pular (duplo no ar) · G noclip · V 1ª/3ª pessoa\n" +
                "Botão esquerdo atirar · Botão direito mirar (ADS) · 1..9 armas · 0 ferramentas\n" +
                "Tab menu de spawn · Esc pausa e ajustes · F5 reiniciar · H esconder HUD · M som\n" +
                "Todos os controles também estão em Esc > Ajuda.",
              noLink: true,
              buttons: ["Fechar"],
            }),
        },
        {
          label: "Abrir o leia-me",
          click: () => {
            const leia =
              (process.resourcesPath &&
                path.join(process.resourcesPath, "LEIA-ME.txt")) ||
              path.resolve(
                __dirname,
                "../packaging/LEIA-ME-GOREFORGE-WINDOWS.txt",
              );
            if (fs.existsSync(leia)) void shell.openPath(leia);
          },
        },
        { type: "separator" },
        {
          label: `Versão ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ];
  if (dev)
    modelo.push({
      label: "Desenvolvimento",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { role: "togglefullscreen" },
      ],
    });
  Menu.setApplicationMenu(Menu.buildFromTemplate(modelo));
}

app.setAppUserModelId("com.gameforge.goreforge");

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (!janela) return;
    if (janela.isMinimized()) janela.restore();
    janela.focus();
  });
  app.whenReady().then(() => {
    montarMenu();
    criarJanela();
    app.on("activate", () => {
      if (!BrowserWindow.getAllWindows().length) criarJanela();
    });
  });
  app.on("window-all-closed", () => app.quit());
}
