import { STUDIO_VERSION } from "../engine/version";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Box,
  Clock3,
  FolderOpen,
  History,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { studioTemplates, templateProject } from "../engine/studio08-templates";
import {
  createSnapshot,
  listProjects,
  listSnapshots,
  rememberProject,
  removeProject,
  restoreEntry,
  type LibraryEntry,
  type ProjectSnapshot,
} from "../engine/project-library";
import type { Project } from "../engine/model";
import { useDialog } from "./useDialog";
function TemplateArt({ kind }: { kind: string }) {
  return (
    <div className={`template-art art-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 240 112" fill="none">
        <path
          d="M25 89L120 35L215 89L120 143L25 89Z"
          fill="currentColor"
          opacity=".08"
        />
        {kind === "island" ? (
          <>
            <path d="M64 66L120 35L179 66L123 98L64 66Z" fill="#82bba1" />
            <path
              d="M64 66L123 98L179 66L159 95L123 111L86 95Z"
              fill="#4b716b"
            />
            <path
              d="M86 53L86 35M150 58L150 28"
              stroke="#b3a180"
              strokeWidth="4"
            />
            <path
              d="M86 15L71 46H101L86 15ZM150 4L132 43H168L150 4Z"
              fill="#a9d7ab"
            />
            <path
              d="M121 57V35C121 20 142 20 142 35V45"
              stroke="#ecd297"
              strokeWidth="6"
            />
            <path d="M102 71L111 56L121 71L111 85Z" fill="#a2eef0" />
          </>
        ) : kind === "jelly" ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <g
                key={i}
                transform={`translate(${42 + i * 38}, ${91 - i * 13})`}
              >
                <path
                  d="M0 -3Q0 -8 6 -11L20 -18Q25 -21 31 -17L42 -10Q47 -6 42 -2L25 8Q20 11 14 7Z"
                  fill={["#8ee6bd", "#f2b4d9", "#b1a2ed", "#ffd38e"][i]}
                  opacity=".9"
                />
                <path
                  d="M0 -3V5Q0 8 14 15L25 16L44 5V-4L25 8L14 7Z"
                  fill="#698cab"
                  opacity=".65"
                />
                <path
                  d="M9 -8L21 -15L31 -10"
                  stroke="white"
                  strokeWidth="2"
                  opacity=".5"
                />
              </g>
            ))}
            <g transform="translate(111 26)">
              <rect x="0" y="0" width="18" height="19" rx="7" fill="#b6f9d7" />
              <rect x="1" y="21" width="16" height="22" rx="6" fill="#8ee6bd" />
              <path
                d="M-2 25L-10 34M20 25L29 16M5 43L0 54M13 43L19 52"
                stroke="#8ee6bd"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M5 8V10M12 8V10"
                stroke="#315158"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          </>
        ) : kind === "obby" ? (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <g
                key={i}
                transform={`translate(${42 + i * 35}, ${88 - i * 13})`}
              >
                <path
                  d="M0 0L18 -10L38 0L20 11Z"
                  fill={i % 2 ? "#9ee0c3" : "#e6d6b4"}
                />
                <path d="M0 0V6L20 17V11M20 17L38 6V0" fill="#53716b" />
              </g>
            ))}
          </>
        ) : kind === "motion" ? (
          <>
            <ellipse
              cx="120"
              cy="57"
              rx="61"
              ry="24"
              stroke="#9ae0cf"
              strokeWidth="2"
              strokeDasharray="4 5"
            />
            <path d="M106 34L131 20L153 34V62L129 77L106 63Z" fill="#ddbc84" />
            <path
              d="M106 34L129 48L153 34M129 48V77"
              stroke="#a48055"
              strokeWidth="2"
            />
            <circle cx="59" cy="56" r="5" fill="#a2efcc" />
          </>
        ) : kind === "scripts" ? (
          <>
            <rect
              x="52"
              y="19"
              width="140"
              height="77"
              rx="7"
              fill="#223d37"
              stroke="#456e61"
            />
            <path
              d="M93 42L78 55L93 68M150 42L165 55L150 68M135 36L116 78"
              stroke="#a5dfb1"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        ) : kind === "empty" ? (
          <>
            <path
              d="M88 40L119 23L150 40V77L120 94L88 77Z"
              stroke="#778e91"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <path
              d="M88 40L120 59L150 40M120 59V94"
              stroke="#778e91"
              strokeDasharray="5 5"
            />
            <path d="M117 42V64M106 53H128" stroke="#a4cac0" strokeWidth="2" />
          </>
        ) : (
          <>
            <path d="M50 70L120 31L191 70L120 110L50 70Z" fill="#8ba997" />
            <path
              d="M66 70L121 39L177 70M84 80L137 50M101 90L155 60M68 60L138 99M87 50L157 88M103 40L176 78"
              stroke="#acc1b2"
              opacity=".65"
            />
            <path d="M117 63V44L129 37L141 44V63L129 71Z" fill="#dcbd8f" />
          </>
        )}
      </svg>
    </div>
  );
}
const date = (time: number) =>
  new Date(time).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function ProjectLibrary({
  project,
  thumbnail,
  onLoad,
  onOpen,
  onClose,
  onError,
}: {
  project: Project;
  thumbnail?: string;
  onLoad: (project: Project) => void;
  onOpen: () => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const ref = useDialog(true, onClose);
  const [entries, setEntries] = useState<LibraryEntry[]>([]),
    [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [snapshotName, setSnapshotName] = useState("");
  const refresh = async () => {
    setEntries(await listProjects());
    setSnapshots(await listSnapshots(project));
  };
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await rememberProject(project, thumbnail);
        const [e, s] = await Promise.all([
          listProjects(),
          listSnapshots(project),
        ]);
        if (mounted) {
          setEntries(e);
          setSnapshots(s);
        }
      } catch (e) {
        if (mounted) setError(String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const choose = async (next: Project, backup = false) => {
    setBusy(true);
    try {
      await rememberProject(project, thumbnail);
      if (backup) await createSnapshot(project, "Antes da restauração");
    } catch (e) {
      onError(String(e));
      if (backup) {
        setBusy(false);
        return;
      }
    }
    onLoad(next);
    onClose();
  };
  return (
    <div
      className="modal-backdrop library-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="project-library"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
        tabIndex={-1}
      >
        <header className="library-heading">
          <div className="library-logo">
            <Box size={19} /> GAMEFORGE <span>STUDIO {STUDIO_VERSION}</span>
          </div>
          <button onClick={onClose} aria-label="Fechar biblioteca">
            <X size={20} />
          </button>
        </header>
        <div className="library-hero">
          <div>
            <span className="eyebrow">DA PRIMEIRA IDEIA AO PRIMEIRO PLAY</span>
            <h2 id="library-title">
              Todo grande jogo
              <br />
              começa com você<span>.</span>
            </h2>
            <p>Escolha um ponto de partida. Construa um mundo só seu.</p>
          </div>
          <div className="hero-wirecube">
            <Box size={82} strokeWidth={0.8} />
            <span>CRIE. EXPERIMENTE. JOGUE.</span>
          </div>
        </div>
        <section className="library-section">
          <div className="library-section-title">
            <h3>
              <Plus size={16} /> Criar um projeto
            </h3>
            <span>
              {studioTemplates.length} pontos de partida · totalmente editáveis
            </span>
          </div>
          <div className="template-grid">
            {studioTemplates.map((t) => (
              <button
                key={t.id}
                className="template-card"
                disabled={busy}
                onClick={() => void choose(templateProject(t.id))}
              >
                <TemplateArt kind={t.art} />
                <div>
                  <span className="template-badge">{t.badge}</span>
                  <h4>
                    {t.name}
                    <ArrowUpRight size={14} />
                  </h4>
                  <p>{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="library-section">
          <div className="library-section-title">
            <h3>
              <Clock3 size={16} /> Continuar criando
            </h3>
            <div className="library-search">
              <Search size={14} />
              <input
                aria-label="Buscar projetos"
                placeholder="Buscar projeto…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                onClose();
                onOpen();
              }}
            >
              <FolderOpen size={14} /> Abrir arquivo
            </button>
          </div>
          {loading && (
            <p className="library-message">Carregando seus projetos…</p>
          )}
          {error && (
            <p className="library-message error">
              {error} O autosave e a exportação em arquivo continuam
              disponíveis.
            </p>
          )}
          {!loading && !error && (
            <div className="recent-grid">
              {entries
                .filter((e) =>
                  e.name
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
                )
                .map((entry) => (
                  <article className="recent-project" key={entry.id}>
                    <button
                      className="recent-open"
                      disabled={busy}
                      onClick={() => {
                        try {
                          void choose(restoreEntry(entry));
                        } catch (e) {
                          onError(String(e));
                        }
                      }}
                    >
                      {entry.thumbnail ? (
                        <img src={entry.thumbnail} alt="" />
                      ) : (
                        <div className="recent-placeholder">
                          <Box size={24} />
                        </div>
                      )}
                      <div>
                        <strong>{entry.name}</strong>
                        <small>
                          {entry.scenes} cena{entry.scenes > 1 ? "s" : ""} ·{" "}
                          {entry.nodes} objetos
                        </small>
                        <span>{date(entry.updatedAt)}</span>
                      </div>
                    </button>
                    <button
                      className="recent-delete"
                      aria-label={`Remover ${entry.name} da biblioteca`}
                      onClick={async () => {
                        if (
                          !confirm(
                            "Remover da biblioteca? Arquivos salvos em disco e a cena atual não serão apagados.",
                          )
                        )
                          return;
                        try {
                          await removeProject(entry.id);
                          await refresh();
                        } catch (e) {
                          onError(String(e));
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </article>
                ))}
              {!entries.some((e) =>
                e.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
              ) && (
                <p className="library-message">Nenhum projeto encontrado.</p>
              )}
            </div>
          )}
        </section>
        <section className="library-section library-versions">
          <div className="library-section-title">
            <h3>
              <History size={16} /> Versões de {project.name}
            </h3>
            <span>Até 5 cópias de segurança locais</span>
          </div>
          <div className="snapshot-create">
            <input
              aria-label="Nome da versão"
              placeholder="Ex.: antes de mudar o cenário"
              maxLength={80}
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
            />
            <button
              className="outline-button"
              disabled={busy || loading || !!error}
              onClick={async () => {
                setBusy(true);
                try {
                  await createSnapshot(
                    project,
                    snapshotName || "Versão manual",
                  );
                  setSnapshotName("");
                  await refresh();
                } catch (e) {
                  onError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <ShieldCheck size={14} /> Criar versão
            </button>
          </div>
          <div className="snapshot-list">
            {snapshots.map((s) => (
              <button
                key={s.id}
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      `Restaurar “${s.name}”? Uma versão da edição atual será criada antes da restauração.`,
                    )
                  ) {
                    try {
                      void choose(restoreEntry(s), true);
                    } catch (e) {
                      onError(String(e));
                    }
                  }
                }}
              >
                <History size={13} />
                <strong>{s.name}</strong>
                <time>{date(s.createdAt)}</time>
                <span>Restaurar ↗</span>
              </button>
            ))}
            {!snapshots.length && (
              <p>
                Crie uma versão antes de uma grande mudança. Ela fica separada
                do autosave.
              </p>
            )}
          </div>
        </section>
        <footer className="library-footer">
          <ShieldCheck size={14} />
          <span>
            Seus projetos ficam neste dispositivo. Salve em arquivo para
            transferir ou guardar um backup.
          </span>
          <span>Seus mundos. Neste dispositivo. Sem conta obrigatória.</span>
        </footer>
      </div>
    </div>
  );
}
