import { STUDIO_VERSION } from "./engine/version";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Box,
  Gamepad2,
  FlaskConical,
  BookOpen,
  Monitor,
  ChevronRight,
  Hexagon,
  Command,
} from "lucide-react";
import Editor from "./editor/Editor";
const LegacyApp = lazy(() => import("./legacy/LegacyApp"));
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="app-error">
        <Box size={42} />
        <h2>Não foi possível iniciar esta área</h2>
        <p>{this.state.error}</p>
        <p>
          Seu projeto salvo localmente foi preservado. Tente recarregar ou ative
          a aceleração de hardware.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Recarregar aplicativo
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [area, setArea] = useState<"editor" | "jogos" | "testes">("editor"),
    [about, setAbout] = useState(false);
  useEffect(
    () =>
      window.gameforgeDesktop?.onCommand?.((id) => {
        if (id === "about") {
          setAbout(true);
          return;
        }
        setArea("editor");
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent("gameforge:command", { detail: id }),
            ),
          0,
        );
      }),
    [],
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setArea("editor");
          }}
        >
          <div className="brand-icon">
            <Hexagon size={23} />
            <span />
          </div>
          <strong>
            gameforge<span>STUDIO</span>
          </strong>
          <span className="version-badge">{STUDIO_VERSION}</span>
        </a>
        <nav className="main-nav">
          <button
            className={area === "editor" ? "active" : ""}
            onClick={() => setArea("editor")}
          >
            <Box size={15} />
            Editor
          </button>
          <button
            className={area === "jogos" ? "active" : ""}
            onClick={() => setArea("jogos")}
          >
            <Gamepad2 size={16} />
            Jogos
          </button>
          <button
            className={area === "testes" ? "active" : ""}
            onClick={() => setArea("testes")}
          >
            <FlaskConical size={15} />
            Laboratório
          </button>
        </nav>
        <div className="header-right">
          <span className="desktop-label">
            <Monitor size={13} />
            {window.gameforgeDesktop ? "Electron · Desktop" : "Local-first"}
          </span>
          <button
            className="quick-command"
            title="Buscar comandos · Ctrl+K"
            aria-label="Buscar comandos"
            onClick={() => {
              setArea("editor");
              setTimeout(
                () =>
                  window.dispatchEvent(
                    new CustomEvent("gameforge:command", { detail: "palette" }),
                  ),
                0,
              );
            }}
          >
            <Command size={13} />
            <span>Buscar comandos…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button className="docs-button" onClick={() => setAbout(!about)}>
            <BookOpen size={14} />
            <span>Sobre</span>
          </button>
          <div className="avatar">GF</div>
        </div>
      </header>
      <ErrorBoundary>
        {area === "editor" ? (
          <Editor />
        ) : (
          <Suspense
            fallback={
              <div className="loading-screen">
                <div className="loading-orb" />
                <h3>Preparando o laboratório…</h3>
                <p>Carregando os jogos da sua base original.</p>
              </div>
            }
          >
            <div className="legacy-container" key={area}>
              <div className="legacy-intro">
                <div>
                  <span className="eyebrow">
                    {area === "jogos"
                      ? "PLAYGROUND"
                      : "EXPERIMENTOS INTERATIVOS"}
                  </span>
                  <h2>
                    {area === "jogos"
                      ? "Ideias que você pode jogar."
                      : "Um espaço para experimentar."}
                  </h2>
                  <p>
                    {area === "jogos"
                      ? "Seus quatro modos originais, preservados em um só lugar."
                      : "Xadrez simplificado, simulação de gravidade e construção voxel."}
                  </p>
                </div>
                <div className="legacy-intro-badge">
                  <Gamepad2 size={32} />
                  <span>
                    GAMEFORGE
                    <br />
                    LAB
                  </span>
                </div>
              </div>
              <LegacyApp initialTab={area} />
            </div>
          </Suspense>
        )}
      </ErrorBoundary>
      {about && (
        <div className="about-popover">
          <button
            className="close-about"
            aria-label="Fechar sobre"
            onClick={() => setAbout(false)}
          >
            ×
          </button>
          <Hexagon size={27} />
          <h3>GameForge Studio {STUDIO_VERSION}</h3>
          <p>
            Seu estúdio independente de criação: editor 3D, física, Lua e
            JavaScript, terreno, interfaces, keyframes e projetos locais. Base
            em React, Three.js e Cannon-es.
          </p>
          <p>
            Interface adaptável, qualidade gráfica automática e aplicativo
            desktop com Electron. Consulte o README para instalar no Windows e
            recompilar.
          </p>
          <small>
            Não afiliado ao Roblox. Sem multiplayer, Luau ou serviços em nuvem.
          </small>
          <button
            className="outline-button"
            onClick={() => {
              setArea("editor");
              setAbout(false);
            }}
          >
            Voltar ao editor <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
