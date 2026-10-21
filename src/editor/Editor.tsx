import { STUDIO_VERSION } from "../engine/version";
import { serializeProject } from "../engine/serialization";
import AnimationPanel from "./AnimationPanel";
import CommandPalette, { type StudioCommand } from "./CommandPalette";
import ProjectLibrary from "./ProjectLibrary";
import MultiSelectionPanel, {
  type SelectionAction,
} from "./MultiSelectionPanel";
import {
  ResizeHandle,
  useStudioPreferences,
  type RenderQuality,
} from "./StudioLayout";
import { useDialog } from "./useDialog";
import { auroraProject, templateProject } from "../engine/studio08-templates";
import { rememberProject } from "../engine/project-library";
import {
  alignSelection,
  distributeSelection,
  duplicateSelection,
  groupSelection,
  selectedBranchIds,
  translateSelection,
  ungroupSelection,
} from "../engine/editor-operations";
import TerrainPanel from "./TerrainPanel";
import { generateTerrain } from "../engine/terrain06";
import ActorPanel from "./ActorPanel";
import LightPanel from "./LightPanel";
import { baseMap } from "../engine/maps";
import PixelPanel from "./PixelPanel";
import UIPanel from "./UIPanel";
import WorldPanel from "./WorldPanel";
import { sculptSurface } from "../engine/surfaces";
import type { VoxelConfig } from "../engine/studio-model";
import { cellIndex } from "../engine/VoxelVolume";
import DesignPanel from "./DesignPanel";
import {
  defaultBrush,
  terrainPatch,
  brushTerrain,
  arrangeChildren,
  type Brush,
} from "../engine/design";
import { category } from "../engine/catalog";
import { controlDefaults, controlFields } from "../engine/model";
import {
  Suspense,
  lazy,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Box,
  Circle,
  Triangle,
  Cylinder,
  Folder,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Eye,
  EyeOff,
  Save,
  FolderOpen,
  Undo2,
  Redo2,
  Play,
  Pause,
  Square,
  Move,
  Rotate3D,
  Scaling,
  Magnet,
  Grid3X3,
  Maximize,
  Trash2,
  Copy,
  Code2,
  Terminal,
  Package,
  X,
  Check,
  FileJson,
  Download,
  Settings2,
  Info,
  Camera,
  Layers3,
  MousePointer2,
  HelpCircle,
  RefreshCw,
  ArrowUpRight,
  Monitor,
  Lock,
  Unlock,
  Anchor,
  Shield,
  Compass,
  Command,
  Film,
  FolderKanban,
  PanelLeft,
  PanelRight,
  Gauge,
  Sun,
  LayoutDashboard,
} from "lucide-react";
const ScriptPanel = lazy(() => import("./ScriptPanel"));
import {
  parkourProject,
  studioProject,
  scriptingProject,
  prefab,
  prefabNames,
  type Prefab,
} from "../engine/templates";
import { cameraModes, type CameraMode } from "../engine/model";
import Viewport, { ViewportAPI, Tool } from "./Viewport";
import {
  Project,
  Node3D,
  Kind,
  Behavior,
  Vec3,
  History,
  activeScene,
  behaviorNames,
  canParent,
  clone,
  createProject,
  descendants,
  kindNames,
  makeNode,
  parseProject,
  uid,
} from "../engine/model";
import { exportGame, readProject, saveProject } from "../engine/io";
const STORAGE = "gameforge.project.v6";
let sessionHistory: History<Project> | null = null;
let desktopBootstrap: Promise<string | null> | null = null;
let desktopInitialized = false;
const kindIcons = {
  box: Box,
  sphere: Circle,
  cylinder: Cylinder,
  cone: Triangle,
  group: Folder,
  wedge: Triangle,
  capsule: Cylinder,
  torus: Circle,
  arch: Box,
  rock: Circle,
  star: Triangle,
  terrain: Layers3,
};
function initial() {
  try {
    const raw =
      localStorage.getItem(STORAGE) ??
      localStorage.getItem("gameforge.project.v5") ??
      localStorage.getItem("gameforge.project.v4") ??
      localStorage.getItem("gameforge.project.v3") ??
      localStorage.getItem("gameforge.project.v2");
    if (raw) return parseProject(raw);
  } catch {}
  return auroraProject();
}
function Field({
  value,
  onChange,
  type = "number",
  label,
  min,
  max,
  step = 0.1,
}: {
  value: string | number;
  onChange: (v: any) => void;
  type?: string;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const cancel = useRef(false);
  const [draft, setDraft] = useState(String(value));
  const synchronized = useRef(String(value));
  useEffect(() => {
    const incoming = String(value);
    // A delayed mount effect must not erase text typed immediately on opening.
    if (incoming !== synchronized.current) {
      synchronized.current = incoming;
      setDraft(incoming);
    }
  }, [value]);
  const commit = (text: string) => {
    if (cancel.current) {
      cancel.current = false;
      return;
    }
    if (type === "number") {
      const n = Number(text);
      if (text.trim() && Number.isFinite(n))
        onChange(Math.max(min ?? -10000, Math.min(max ?? 10000, n)));
      else setDraft(String(value));
    } else onChange(text.slice(0, 100));
  };
  return (
    <input
      aria-label={label}
      type={type}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancel.current = true;
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
    />
  );
}
function IconButton({
  children,
  title,
  onClick,
  active,
  disabled,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Section({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="inspector-section">
      <button className="section-heading" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {icon}
        {title}
      </button>
      {open && <div className="section-content">{children}</div>}
    </section>
  );
}
interface Log {
  text: string;
  time: string;
  error?: boolean;
}
export default function Editor() {
  const history = useRef<History<Project> | null>(null);
  if (!history.current) {
    sessionHistory ??= new History(initial());
    history.current = sessionHistory;
  }
  const [project, setProject] = useState(history.current.current);
  const [desktopReady, setDesktopReady] = useState(
    !window.gameforgeDesktop?.initialProject || desktopInitialized,
  );
  const desktopReadyRef = useRef(desktopReady);
  desktopReadyRef.current = desktopReady;
  const [selection, setSelection] = useState<string[]>([]);
  const selected = selection[selection.length - 1] ?? null;
  const setSelected = (id: string | null) => setSelection(id ? [id] : []);
  const select = (id: string | null, additive = false) => {
    if (!id) {
      if (!additive) setSelection([]);
      return;
    }
    setSelection((ids) =>
      additive
        ? ids.includes(id)
          ? ids.filter((i) => i !== id)
          : [...ids, id]
        : [id],
    );
  };
  const { preferences, setPreference, resetLayout } = useStudioPreferences();
  const [mobilePanel, setMobilePanel] = useState<"scene" | "inspector" | null>(
    null,
  );
  const [paletteOpen, setPaletteOpen] = useState(false),
    [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryThumbnail, setLibraryThumbnail] = useState<string>();
  const clipboard = useRef<Node3D[] | null>(null);
  const [consoleFilter, setConsoleFilter] = useState<"all" | "errors">("all");
  const [consoleSearch, setConsoleSearch] = useState("");
  const [cameraMode, setCameraMode] = useState<CameraMode>("perspective"),
    [colliders, setColliders] = useState(false),
    [space, setSpace] = useState<"world" | "local">("world"),
    [scriptsAllowed, setScriptsAllowed] = useState(false);
  const [selectedUI, setSelectedUI] = useState<string | null>(null);
  const [voxelBlock, setVoxelBlock] = useState(1);
  const [brush, setBrush] = useState<Brush>(defaultBrush);
  const [toolboxSearch, setToolboxSearch] = useState("");
  const [toolboxCategory, setToolboxCategory] = useState("Todos");
  const editCamera = useRef<CameraMode>("perspective");
  const editDock = useRef(true);
  const [tool, setTool] = useState<Tool>("translate"),
    [snap, setSnap] = useState(false),
    [grid, setGrid] = useState(false);
  const [playing, setPlaying] = useState(false),
    [paused, setPaused] = useState(false),
    [tab, setTab] = useState("assets");
  const [search, setSearch] = useState(""),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<
      "add" | "help" | "settings" | "new" | "trust" | null
    >(null),
    [dock, setDock] = useState(true);
  const [logs, setLogs] = useState<Log[]>([
    {
      text: "GameForge inicializado. Cena pronta para edição.",
      time: new Date().toLocaleTimeString("pt-BR"),
    },
  ]);
  const [stats, setStats] = useState({ fps: 0, calls: 0, resolution: 1 }),
    [saved, setSaved] = useState("Salvo localmente"),
    [toast, setToast] = useState("");
  const [behaviorJSON, setBehaviorJSON] = useState(""),
    [codeError, setCodeError] = useState("");
  const viewport = useRef<ViewportAPI>(null),
    file = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useDialog(modal !== null, () => setModal(null));
  const openLibrary = () => {
    setModal(null);
    setPaletteOpen(false);
    setLibraryThumbnail(viewport.current?.thumbnail());
    setLibraryOpen(true);
  };
  // Mutations, loads, undo and redo update this ref synchronously. A render of
  // an older React snapshot must never overwrite a newer edit while an IPC
  // save starts (notably on slow Windows renderers).
  const projectRef = useRef(project);
  useEffect(
    () => () => {
      try {
        localStorage.setItem(STORAGE, serializeProject(projectRef.current));
      } catch {}
      try {
        if (desktopReadyRef.current)
          void window.gameforgeDesktop
            ?.autosave?.(serializeProject(projectRef.current))
            .catch(() => {});
      } catch {
        /* Keep the browser autosave. */
      }
    },
    [],
  );
  const scene = activeScene(project),
    node = scene.nodes.find((n) => n.id === selected),
    editing = !playing;
  const selectionSet = useMemo(() => new Set(selection), [selection]);
  const selectedNodes = useMemo(
    () => scene.nodes.filter((n) => selectionSet.has(n.id)),
    [scene.nodes, selectionSet],
  );
  const deferredSearch = useDeferredValue(search),
    deferredToolboxSearch = useDeferredValue(toolboxSearch);
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Node3D[]>();
    for (const n of scene.nodes) {
      const list = map.get(n.parent) ?? [];
      list.push(n);
      map.set(n.parent, list);
    }
    return map;
  }, [scene.nodes]);
  const visibleSearchIds = useMemo(() => {
    if (!deferredSearch) return null;
    const byId = new Map(scene.nodes.map((n) => [n.id, n])),
      ids = new Set<string>();
    for (const n of scene.nodes) {
      if (
        !n.name.toLocaleLowerCase().includes(deferredSearch.toLocaleLowerCase())
      )
        continue;
      let id: string | null = n.id;
      while (id && !ids.has(id)) {
        ids.add(id);
        id = byId.get(id)?.parent ?? null;
      }
    }
    return ids;
  }, [scene.nodes, deferredSearch]);
  const log = (text: string, error = false) =>
    setLogs((l) => [
      ...l.slice(-149),
      {
        text,
        error: error || /\b(erro|error|falha|exception)\b/i.test(text),
        time: new Date().toLocaleTimeString("pt-BR"),
      },
    ]);
  const notify = (text: string, error = false) => {
    log(text, error);
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  function commit(next: Project) {
    if (playing) return;
    history.current!.commit(next);
    projectRef.current = next;
    setProject(next);
  }
  function mutate(fn: (p: Project) => void) {
    const next = clone(projectRef.current);
    fn(next);
    commit(next);
  }
  function update(id: string, patch: Partial<Node3D>) {
    if (scene.nodes.find((n) => n.id === id)?.locked && !("locked" in patch)) {
      notify("Nó bloqueado. Desbloqueie para editar.");
      return;
    }
    mutate((p) => {
      const s = activeScene(p);
      s.nodes = s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    });
  }
  function undo() {
    if (playing) return;
    const next = history.current!.undo();
    projectRef.current = next;
    setProject(next);
  }
  function redo() {
    if (playing) return;
    const next = history.current!.redo();
    projectRef.current = next;
    setProject(next);
  }
  function add(kind: Kind) {
    if (!editing) return;
    if (scene.nodes.length >= 500) {
      notify("Limite de 500 nós por cena.", true);
      return;
    }
    const n = makeNode(kind, {
      ...(kind === "terrain"
        ? {
            physics: "static" as const,
            position: [0, 0, 0] as Vec3,
            color: "#ffffff",
          }
        : {}),
      name: `${kindNames[kind]} ${scene.nodes.filter((n) => n.kind === kind).length + 1}`,
    });
    mutate((p) => activeScene(p).nodes.push(n));
    setSelected(n.id);
    setModal(null);
    log(`${n.name} adicionado à cena.`);
  }
  function remove() {
    if (!selection.length || !editing) return;
    const ids = selectedBranchIds(scene.nodes, selection);
    if (scene.nodes.some((n) => ids.has(n.id) && n.locked)) {
      notify("A seleção contém nós bloqueados. Desbloqueie antes de excluir.");
      return;
    }
    mutate((p) => {
      activeScene(p).nodes = activeScene(p).nodes.filter((n) => !ids.has(n.id));
      if (p.settings.playerId && ids.has(p.settings.playerId))
        delete p.settings.playerId;
    });
    setSelection([]);
    log(`${ids.size} objeto(s) removido(s). Desfaça com Ctrl+Z.`);
  }
  function duplicate() {
    if (!selection.length || !editing) return;
    let copies: Node3D[];
    try {
      copies = duplicateSelection(scene.nodes, selection);
    } catch (e) {
      notify(String(e), true);
      return;
    }
    if (scene.nodes.length + copies.length > 500) {
      notify("Limite de 500 nós por cena.", true);
      return;
    }
    mutate((p) => activeScene(p).nodes.push(...copies));
    const ids = new Set(copies.map((n) => n.id));
    setSelection(
      copies.filter((n) => !n.parent || !ids.has(n.parent)).map((n) => n.id),
    );
    notify(`${copies.length} objeto(s) duplicado(s).`);
  }
  function copySelection() {
    if (!selection.length) return;
    const ids = selectedBranchIds(scene.nodes, selection);
    clipboard.current = clone(scene.nodes.filter((n) => ids.has(n.id)));
    notify(`${ids.size} objeto(s) copiado(s). Ctrl+V para colar.`);
  }
  function pasteSelection() {
    if (!clipboard.current || !editing) return;
    const branch = clipboard.current,
      ids = new Set(branch.map((n) => n.id));
    const roots = branch
      .filter((n) => !n.parent || !ids.has(n.parent))
      .map((n) => n.id);
    let copies: Node3D[];
    try {
      copies = duplicateSelection(branch, roots);
    } catch (e) {
      notify(String(e), true);
      return;
    }
    if (scene.nodes.length + copies.length > 500) {
      notify("Limite de 500 nós por cena.", true);
      return;
    }
    for (const n of copies) {
      if (
        n.parent &&
        !copies.some((c) => c.id === n.parent) &&
        !scene.nodes.some((c) => c.id === n.parent)
      )
        n.parent = null;
      if (
        n.textureId &&
        !project.settings.textures?.some((t) => t.id === n.textureId)
      )
        n.textureId = null;
    }
    mutate((p) => activeScene(p).nodes.push(...copies));
    const copyIds = new Set(copies.map((n) => n.id));
    setSelection(
      copies
        .filter((n) => !n.parent || !copyIds.has(n.parent))
        .map((n) => n.id),
    );
    notify("Seleção colada.");
  }
  function selectionAction(
    action: SelectionAction,
    axis: 0 | 1 | 2 = 0,
    mode: "min" | "center" | "max" = "center",
    delta: Vec3 = [0, 0, 0],
  ) {
    if (!editing) return;
    if (action === "duplicate") {
      duplicate();
      return;
    }
    if (action === "delete") {
      remove();
      return;
    }
    try {
      let nextSelection: string[] | null = null;
      mutate((p) => {
        const ns = activeScene(p).nodes;
        if (action === "group") nextSelection = [groupSelection(ns, selection)];
        if (action === "ungroup") {
          const result = ungroupSelection(ns, selection);
          activeScene(p).nodes = result.nodes;
          nextSelection = result.selected;
        }
        if (action === "align") alignSelection(ns, selection, axis, mode);
        if (action === "distribute") distributeSelection(ns, selection, axis);
        if (action === "translate") translateSelection(ns, selection, delta);
      });
      if (nextSelection) setSelection(nextSelection);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), true);
    }
  }
  function patchSelection(patch: Partial<Node3D>) {
    mutate((p) => {
      activeScene(p).nodes = activeScene(p).nodes.map((n) =>
        selectionSet.has(n.id) && (!n.locked || "locked" in patch)
          ? { ...n, ...patch }
          : n,
      );
    });
  }
  async function save() {
    try {
      if (await saveProject(projectRef.current))
        notify(
          window.gameforgeDesktop
            ? "Projeto salvo em disco."
            : "Projeto JSON baixado.",
        );
    } catch (e) {
      notify(String(e), true);
    }
  }
  function load(p: Project) {
    clipboard.current = null;
    viewport.current?.previewAnimation(null);
    setScriptsAllowed(false);
    setMobilePanel(null);
    setCameraMode("perspective");
    setPlaying(false);
    setPaused(false);
    history.current!.commit(p);
    projectRef.current = p;
    setProject(p);
    setSelected(null);
    notify("Projeto aberto e validado.");
  }
  async function open() {
    try {
      if (window.gameforgeDesktop) {
        const result = await window.gameforgeDesktop.open();
        if (result.content) load(parseProject(result.content));
      } else file.current?.click();
    } catch (e) {
      notify(String(e), true);
    }
  }
  async function exportHTML() {
    try {
      if (await exportGame(project))
        notify(
          "Jogo HTML exportado. Funciona offline em um navegador com WebGL.",
        );
    } catch (e) {
      notify(String(e), true);
    }
  }
  function startPlay(allow: boolean) {
    setScriptsAllowed(allow);
    editCamera.current = cameraMode;
    setCameraMode(project.settings.gameCamera ?? "third");
    editDock.current = dock;
    setDock(false);
    setMobilePanel(null);
    setPlaying(true);
    setPaused(false);
    log(
      `Runtime ${STUDIO_VERSION} • WASD + Espaço • Shift corre • R retorna ao checkpoint • controles de toque em telas pequenas`,
    );
  }
  function togglePlay() {
    if (playing) {
      setPlaying(false);
      setPaused(false);
      setCameraMode(editCamera.current);
      setDock(editDock.current);
      log("Execução encerrada. Estado de edição restaurado.");
      return;
    }
    if (
      scene.nodes.some(
        (n) => n.script.enabled && n.script.language !== "none",
      ) &&
      !scriptsAllowed
    ) {
      setModal("trust");
      return;
    }
    startPlay(scriptsAllowed);
  }
  function addPrefab(kind: Prefab) {
    const nodes = prefab(kind);
    if (scene.nodes.length + nodes.length > 500) {
      notify("Limite de 500 nós.");
      return;
    }
    mutate((p) => {
      activeScene(p).nodes.push(...nodes);
      if (nodes[0].behavior === "player") p.settings.playerId = nodes[0].id;
    });
    setSelected(nodes[0].id);
    notify(`${prefabNames[kind]} inserido. Use o gizmo para posicionar.`);
  }
  function applyMaterial(id: string) {
    const branch = descendants(scene.nodes, id);
    mutate((p) => {
      for (const n of activeScene(p).nodes) {
        if (!branch.has(n.id) || n.locked || n.kind === "group") continue;
        let ancestor = n.parent,
          blocked = false;
        while (ancestor) {
          const a = activeScene(p).nodes.find((t) => t.id === ancestor);
          if (!a) break;
          if (a.locked) blocked = true;
          ancestor = a.parent;
        }
        if (!blocked) {
          n.color = brush.color;
          n.roughness = brush.roughness;
          n.metalness = brush.metalness;
        }
      }
    });
  }
  function designHit(id: string, point: Vec3) {
    if (!editing) return;
    const n = scene.nodes.find((n) => n.id === id);
    if (!n) return;
    if (brush.mode === "eyedropper") {
      setBrush({
        ...brush,
        color: n.color,
        roughness: n.roughness,
        metalness: n.metalness,
        mode: "paint",
      });
      return;
    }
    if (brush.mode === "paint") {
      applyMaterial(id);
      return;
    }
    if (n.surface) {
      if (n.locked) return;
      mutate((p) => {
        const surface = activeScene(p).nodes.find((t) => t.id === id)!.surface!;
        sculptSurface(surface, point, brush);
      });
      return;
    }
    if (!n.terrain) {
      notify("Clique em um bloco de terreno criado em Design.");
      return;
    }
    mutate((p) => {
      brushTerrain(activeScene(p).nodes, id, point, brush);
    });
  }
  function groupSelected() {
    selectionAction("group");
  }
  function parent(id: string, p: string | null) {
    if (!editing) return;
    if (!canParent(scene.nodes, id, p)) {
      notify("Não é possível criar um ciclo na hierarquia.", true);
      return;
    }
    update(id, { parent: p });
    log("Hierarquia atualizada. Transformações locais preservadas.");
  }
  useEffect(() => {
    if (!desktopReady) return;
    let canceled = false;
    setSaved("Salvando…");
    const timer = setTimeout(async () => {
      let local = false;
      try {
        const content = serializeProject(project);
        try {
          localStorage.setItem(STORAGE, content);
          local = true;
        } catch {
          /* IndexedDB/native autosave can still succeed. */
        }
        const writes = [rememberProject(project)];
        if (window.gameforgeDesktop?.autosave)
          writes.push(window.gameforgeDesktop.autosave(content));
        const result = await Promise.allSettled(writes);
        const success = local || result.some((r) => r.status === "fulfilled");
        if (!canceled) {
          setSaved(success ? "Salvo neste dispositivo" : "Falha no autosave");
          if (!success)
            notify(
              "Armazenamento local indisponível ou cheio. Salve em arquivo.",
              true,
            );
        }
      } catch (error) {
        if (!canceled) {
          setSaved("Falha no autosave");
          notify(String(error), true);
        }
      }
    }, 600);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [project, desktopReady]);
  useEffect(() => {
    const flush = () => {
      try {
        const content = serializeProject(projectRef.current);
        try {
          localStorage.setItem(STORAGE, content);
        } catch {
          /* Native fallback below. */
        }
        if (desktopReadyRef.current)
          window.gameforgeDesktop?.flushAutosave?.(content);
      } catch {
        /* Manual backups and IndexedDB are not cleared on failure. */
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);
  useEffect(() => {
    const desktop = window.gameforgeDesktop;
    if (!desktop) return;
    let mounted = true;
    const receive = (content: string) => {
      try {
        load(parseProject(content));
      } catch (e) {
        notify(String(e), true);
      }
    };
    const startProject = projectRef.current;
    const unsubscribe = desktop.onProject?.(receive);
    if (!desktopInitialized) {
      desktopBootstrap ??= desktop.initialProject?.() ?? Promise.resolve(null);
      void desktopBootstrap
        .then((content) => {
          if (mounted && content && projectRef.current === startProject)
            receive(content);
        })
        .catch((error) => {
          if (mounted) notify(String(error), true);
        })
        .finally(() => {
          if (mounted) {
            desktopInitialized = true;
            setDesktopReady(true);
          }
        });
    } else setDesktopReady(true);
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    const blur = () => {
      if (playing) setPaused(true);
    };
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, [playing]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    const ids = new Set(scene.nodes.map((n) => n.id));
    setSelection((current) => {
      const valid = current.filter((id) => ids.has(id));
      return valid.length === current.length ? current : valid;
    });
  }, [scene.id, scene.nodes]);
  useEffect(() => {
    if (node)
      setBehaviorJSON(
        JSON.stringify(
          {
            behavior: node.behavior,
            speed: node.speed,
            amplitude: node.amplitude,
          },
          null,
          2,
        ),
      );
    setCodeError("");
  }, [selected, node?.behavior, node?.speed, node?.amplitude]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const input = (e.target as HTMLElement).closest(
        "input,select,textarea,[contenteditable]",
      );
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal(null);
        setLibraryOpen(false);
        setPaletteOpen((v) => !v);
        return;
      }
      if (paletteOpen || libraryOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        if (!modal) togglePlay();
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        if (playing) togglePlay();
        return;
      }
      if (e.key === "Escape") {
        setModal(null);
        return;
      }
      if (input || modal || playing) return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === "z") {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        }
        if (k === "y") {
          e.preventDefault();
          redo();
        }
        if (k === "a") {
          e.preventDefault();
          setSelection(scene.nodes.filter((n) => n.visible).map((n) => n.id));
        }
        if (k === "c") {
          e.preventDefault();
          copySelection();
        }
        if (k === "v") {
          e.preventDefault();
          pasteSelection();
        }
        if (k === "g") {
          e.preventDefault();
          selectionAction(e.shiftKey ? "ungroup" : "group");
        }
        if (k === "n") {
          e.preventDefault();
          openLibrary();
        }
        if (k === "d") {
          e.preventDefault();
          duplicate();
        }
        if (k === "o") {
          e.preventDefault();
          void open();
        }
        return;
      }
      if (k === "delete") {
        e.preventDefault();
        remove();
      }
      if (k === "w") setTool("translate");
      if (k === "e") setTool("rotate");
      if (k === "r") setTool("scale");
      if (k === "f") viewport.current?.focus();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function renderTree(parentId: string | null, depth = 0): ReactNode {
    return (childrenByParent.get(parentId) ?? []).map((n) => {
      const children = childrenByParent.has(n.id),
        isCollapsed = collapsed.has(n.id),
        Icon = kindIcons[n.kind];
      if (visibleSearchIds && !visibleSearchIds.has(n.id)) return null;
      return (
        <div key={n.id}>
          <div
            className={`tree-row ${selectionSet.has(n.id) ? "selected" : ""} ${!n.visible ? "muted" : ""}`}
            role="treeitem"
            aria-selected={selectionSet.has(n.id)}
            aria-expanded={children ? !isCollapsed : undefined}
            tabIndex={
              selected === n.id || (!selected && scene.nodes[0]?.id === n.id)
                ? 0
                : -1
            }
            style={{ paddingLeft: 10 + depth * 15 }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                select(n.id, e.ctrlKey || e.metaKey || e.shiftKey);
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const rows = [
                  ...e.currentTarget
                    .closest(".scene-tree")!
                    .querySelectorAll<HTMLElement>('[role="treeitem"]'),
                ];
                rows[
                  Math.max(
                    0,
                    Math.min(
                      rows.length - 1,
                      rows.indexOf(e.currentTarget) +
                        (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  )
                ]?.focus();
              }
            }}
            draggable={editing && !n.locked}
            onDragStart={(e) =>
              e.dataTransfer.setData("text/gameforge-node", n.id)
            }
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const id = e.dataTransfer.getData("text/gameforge-node");
              if (id) parent(id, n.id);
            }}
            onClick={(e) => {
              e.currentTarget.focus({ preventScroll: true });
              select(n.id, e.ctrlKey || e.metaKey || e.shiftKey);
            }}
            onDoubleClick={() => {
              setSelected(n.id);
              setTimeout(() => viewport.current?.focus(), 0);
            }}
          >
            <button
              className="tree-chevron"
              aria-label={`Expandir ${n.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed((c) => {
                  const a = new Set(c);
                  a.has(n.id) ? a.delete(n.id) : a.add(n.id);
                  return a;
                });
              }}
            >
              {children ? (
                isCollapsed ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )
              ) : null}
            </button>
            <Icon
              size={14}
              className={
                n.behavior === "player"
                  ? "gold"
                  : n.behavior === "collectible"
                    ? "mint"
                    : ""
              }
            />
            <span>{n.name}</span>
            {n.locked && <Lock size={10} />}
            {n.physics === "dynamic" && (
              <span className="node-dot" title="Corpo dinâmico" />
            )}
            <button
              title={n.visible ? "Ocultar" : "Mostrar"}
              disabled={!editing}
              className="visibility"
              onClick={(e) => {
                e.stopPropagation();
                update(n.id, { visible: !n.visible });
              }}
            >
              {n.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          </div>
          {(!isCollapsed || deferredSearch) && renderTree(n.id, depth + 1)}
        </div>
      );
    });
  }
  function transformFields(
    key: "position" | "rotation" | "scale",
    label: string,
  ) {
    return (
      <div className="transform-field">
        <label>{label}</label>
        <div className="vector-inputs">
          {["X", "Y", "Z"].map((axis, i) => (
            <div key={axis} className={`vector vector-${axis.toLowerCase()}`}>
              <span>{axis}</span>
              <Field
                label={`${label} ${axis}`}
                value={Math.round(node![key][i] * 1000) / 1000}
                min={key === "scale" ? 0.01 : -10000}
                max={key === "scale" ? 100 : 10000}
                step={key === "rotation" ? 5 : 0.1}
                onChange={(v: number) => {
                  const arr = [...node![key]] as Vec3;
                  arr[i] = v;
                  update(node!.id, { [key]: arr });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  const openPanel = (name: string) => {
    setTab(name);
    setDock(true);
    setMobilePanel(null);
  };
  const commands: StudioCommand[] = [
    {
      id: "projects",
      title: "Meus projetos e templates",
      group: "Projeto",
      shortcut: "Ctrl N",
      icon: <FolderKanban size={16} />,
      disabled: !editing,
      run: () => {
        setModal(null);
        openLibrary();
      },
    },
    {
      id: "new",
      title: "Novo projeto",
      group: "Projeto",
      icon: <Plus size={16} />,
      disabled: !editing,
      run: openLibrary,
    },
    {
      id: "open",
      title: "Abrir arquivo de projeto",
      group: "Projeto",
      shortcut: "Ctrl O",
      icon: <FolderOpen size={16} />,
      disabled: !editing,
      run: () => void open(),
    },
    {
      id: "save",
      title: "Salvar projeto em arquivo",
      group: "Projeto",
      shortcut: "Ctrl S",
      icon: <Save size={16} />,
      run: () => void save(),
    },
    {
      id: "export",
      title: "Exportar jogo HTML offline",
      group: "Projeto",
      icon: <Download size={16} />,
      run: () => void exportHTML(),
    },
    {
      id: "settings",
      title: "Configurações do projeto",
      group: "Projeto",
      icon: <Settings2 size={16} />,
      disabled: !editing,
      run: () => setModal("settings"),
    },
    {
      id: "undo",
      title: "Desfazer alteração",
      group: "Editar",
      shortcut: "Ctrl Z",
      icon: <Undo2 size={16} />,
      disabled: !editing || !history.current!.past.length,
      run: undo,
    },
    {
      id: "redo",
      title: "Refazer alteração",
      group: "Editar",
      shortcut: "Ctrl Shift Z",
      icon: <Redo2 size={16} />,
      disabled: !editing || !history.current!.future.length,
      run: redo,
    },
    {
      id: "duplicate",
      title: "Duplicar seleção",
      group: "Editar",
      shortcut: "Ctrl D",
      icon: <Copy size={16} />,
      disabled: !editing || !selection.length,
      run: duplicate,
    },
    {
      id: "copy",
      title: "Copiar seleção",
      group: "Editar",
      shortcut: "Ctrl C",
      icon: <Copy size={16} />,
      disabled: !selection.length,
      run: copySelection,
    },
    {
      id: "paste",
      title: "Colar seleção",
      group: "Editar",
      shortcut: "Ctrl V",
      icon: <Copy size={16} />,
      disabled: !editing || !clipboard.current,
      run: pasteSelection,
    },
    {
      id: "group",
      title: "Agrupar seleção em modelo",
      group: "Editar",
      shortcut: "Ctrl G",
      icon: <Folder size={16} />,
      disabled: !editing || !selection.length,
      run: groupSelected,
    },
    {
      id: "ungroup",
      title: "Desagrupar modelo",
      group: "Editar",
      shortcut: "Ctrl Shift G",
      icon: <FolderOpen size={16} />,
      disabled: !editing || !selectedNodes.some((n) => n.kind === "group"),
      run: () => selectionAction("ungroup"),
    },
    {
      id: "delete",
      title: "Excluir seleção",
      group: "Editar",
      shortcut: "Delete",
      icon: <Trash2 size={16} />,
      disabled: !editing || !selection.length,
      run: remove,
    },
    {
      id: "focus",
      title: "Enquadrar seleção na câmera",
      group: "Visualizar",
      shortcut: "F",
      icon: <Maximize size={16} />,
      run: () => viewport.current?.focus(),
    },
    {
      id: "play",
      title: playing ? "Parar jogo" : "Executar jogo",
      group: "Testar",
      shortcut: playing ? "F8" : "F5",
      icon: <Play size={16} />,
      run: togglePlay,
    },
    ...(
      [
        ["animation", "Editor de animação e keyframes", <Film size={16} />],
        [
          "toolbox",
          `Toolbox · ${Object.keys(prefabNames).length} modelos prontos`,
          <Package size={16} />,
        ],
        ["scripts", "Editor de scripts Lua e JavaScript", <Code2 size={16} />],
        ["terrain", "Esculpir e pintar terreno", <Layers3 size={16} />],
        ["ui", "Criar interface 2D do jogo", <LayoutDashboard size={16} />],
        ["pixels", "Pixel Studio · texturas", <Grid3X3 size={16} />],
        ["world", "Mundo · céu, áudio e sombras", <Compass size={16} />],
        ["console", "Console e mensagens", <Terminal size={16} />],
      ] as [string, string, ReactNode][]
    ).map(([id, title, icon]) => ({
      id,
      title,
      group: "Ferramentas",
      icon,
      run: () => openPanel(id),
    })),
    {
      id: "box",
      title: "Adicionar cubo",
      group: "Inserir",
      icon: <Box size={16} />,
      disabled: !editing,
      run: () => add("box"),
    },
    {
      id: "sphere",
      title: "Adicionar esfera",
      group: "Inserir",
      icon: <Circle size={16} />,
      disabled: !editing,
      run: () => add("sphere"),
    },
    {
      id: "player",
      title: "Adicionar personagem articulado",
      group: "Inserir",
      icon: <MousePointer2 size={16} />,
      disabled: !editing,
      run: () => addPrefab("humanoidPlayer"),
    },
    {
      id: "reset-layout",
      title: "Restaurar layout e preferências",
      group: "Visualizar",
      icon: <RefreshCw size={16} />,
      run: () => {
        resetLayout();
        setDock(true);
        setMobilePanel(null);
      },
    },
    {
      id: "help",
      title: "Ajuda e atalhos",
      group: "Studio",
      icon: <HelpCircle size={16} />,
      run: () => setModal("help"),
    },
  ];
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  useEffect(() => {
    const execute = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id === "palette") {
        setModal(null);
        setLibraryOpen(false);
        setPaletteOpen((v) => !v);
        return;
      }
      const command = commandsRef.current.find((c) => c.id === id);
      if (command && !command.disabled) command.run();
    };
    window.addEventListener("gameforge:command", execute);
    return () => window.removeEventListener("gameforge:command", execute);
  }, []);
  const layoutStyle = {
    "--left-panel": `${preferences.explorer ? preferences.leftWidth : 0}px`,
    "--left-rail": preferences.explorer ? "5px" : "0px",
    "--right-panel": `${preferences.inspector ? preferences.rightWidth : 0}px`,
    "--right-rail": preferences.inspector ? "5px" : "0px",
    "--dock-height": `${preferences.dockHeight}px`,
  } as CSSProperties;
  return (
    <div
      className={`editor-root ${preferences.explorer ? "" : "explorer-hidden"} ${preferences.inspector ? "" : "inspector-hidden"}`}
      data-mobile-panel={mobilePanel ?? "viewport"}
      style={layoutStyle}
    >
      <div className="project-bar">
        <div className="project-identity">
          <span className="project-symbol">
            <Layers3 size={18} />
          </span>
          <div>
            <strong>{project.name}</strong>
            <span>
              Projeto local <i /> {project.scenes.length} cena
              {project.scenes.length > 1 ? "s" : ""}
            </span>
          </div>
          <IconButton
            title="Configurações do projeto"
            onClick={() => setModal("settings")}
            disabled={!editing}
          >
            <ChevronDown size={14} />
          </IconButton>
        </div>
        <div className="project-actions">
          <button
            className="text-button projects-button"
            aria-label="Meus projetos"
            onClick={openLibrary}
            disabled={!editing}
          >
            <FolderKanban size={15} />
            <span>Projetos</span>
          </button>
          <button
            className="text-button"
            onClick={() => setModal("new")}
            disabled={!editing}
          >
            <Plus size={14} />
            Novo
          </button>
          <button className="text-button" onClick={open} disabled={!editing}>
            <FolderOpen size={15} />
            Abrir
          </button>
          <button className="text-button" onClick={save}>
            <Save size={15} />
            Salvar<span className="keycap">Ctrl S</span>
          </button>
          <span className="divider" />
          <button className="export-button" onClick={exportHTML}>
            <Download size={14} />
            Exportar jogo
            <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
      <div
        className="mobile-workspace-nav"
        role="toolbar"
        aria-label="Painéis do editor"
      >
        <button
          className={mobilePanel === "scene" ? "active" : ""}
          onClick={() =>
            setMobilePanel((p) => (p === "scene" ? null : "scene"))
          }
        >
          <Layers3 size={14} /> Cena
        </button>
        <button
          className={!mobilePanel ? "active" : ""}
          onClick={() => setMobilePanel(null)}
        >
          <Box size={14} /> Viewport
        </button>
        <button
          className={mobilePanel === "inspector" ? "active" : ""}
          onClick={() =>
            setMobilePanel((p) => (p === "inspector" ? null : "inspector"))
          }
        >
          <Settings2 size={14} /> Inspetor
        </button>
        <button
          onClick={() => {
            setDock((v) => !v);
            setMobilePanel(null);
          }}
        >
          <Package size={14} /> Recursos
        </button>
      </div>
      <div className="editor-workspace">
        {mobilePanel && (
          <button
            className="mobile-panel-backdrop"
            aria-label="Fechar painel lateral"
            onClick={() => setMobilePanel(null)}
          />
        )}
        <aside className="scene-panel">
          <div className="panel-heading">
            <div>
              <Layers3 size={14} />
              EXPLORADOR
            </div>
            <IconButton
              title="Adicionar nó"
              onClick={() => setModal("add")}
              disabled={!editing}
            >
              <Plus size={16} />
            </IconButton>
          </div>
          <div className="scene-picker">
            <select
              aria-label="Cena ativa"
              value={project.activeScene}
              disabled={!editing}
              onChange={(e) => {
                mutate((p) => (p.activeScene = e.target.value));
                setSelected(null);
              }}
            >
              {project.scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <IconButton
              title="Nova cena vazia"
              disabled={!editing || project.scenes.length >= 20}
              onClick={() => {
                const id = uid();
                mutate((p) => {
                  p.scenes.push({
                    id,
                    name: `Cena ${p.scenes.length + 1}`,
                    nodes: [],
                  });
                  p.activeScene = id;
                });
                setSelected(null);
              }}
            >
              <Plus size={14} />
            </IconButton>
          </div>
          <div className="search-box">
            <Search size={13} />
            <input
              placeholder="Buscar nós…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar nós"
            />
            <span>⌕</span>
          </div>
          <div className="scene-tree" role="tree" aria-label="Objetos da cena">
            <div
              className="tree-root"
              onClick={() => setSelected(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/gameforge-node");
                if (id) parent(id, null);
              }}
            >
              <ChevronDown size={12} />
              <Layers3 size={14} />
              <strong>World</strong>
              <span className="tag">3D</span>
            </div>
            {renderTree(null)}
            {scene.nodes.length === 0 && (
              <div className="empty-state">
                <Box size={30} />
                <strong>Sua cena começa aqui</strong>
                <span>Adicione um nó para criar seu mundo.</span>
                <button className="primary" onClick={() => setModal("add")}>
                  Adicionar nó
                </button>
              </div>
            )}
          </div>
          <div className="tree-footer">
            <span>
              {selection.length > 1
                ? `${selection.length} selecionados`
                : `${scene.nodes.length} objetos`}
            </span>
            <div>
              <IconButton
                title="Duplicar selecionado · Ctrl+D"
                disabled={!node || !editing}
                onClick={duplicate}
              >
                <Copy size={13} />
              </IconButton>
              <IconButton
                title="Excluir selecionado · Delete"
                disabled={!node || !editing}
                onClick={remove}
              >
                <Trash2 size={13} />
              </IconButton>
            </div>
          </div>
          <div className="scene-tip">
            <span className="tip-icon">
              <MousePointer2 size={15} />
            </span>
            <p>
              Construa sua próxima ideia.
              <small>Arraste nós para organizar a hierarquia.</small>
            </p>
          </div>
        </aside>
        <ResizeHandle
          label="Largura do explorador"
          value={preferences.leftWidth}
          min={180}
          max={360}
          direction={1}
          onChange={(v) => setPreference("leftWidth", v)}
        />
        <main className="center-panel">
          <div className="scene-tabbar">
            <div className="scene-tab">
              <Box size={13} />
              {scene.name}
              <span className="tab-dot" />
            </div>
            <div className="scene-tab-right">
              <IconButton
                title="Mostrar ou ocultar explorador"
                active={preferences.explorer}
                onClick={() => setPreference("explorer", !preferences.explorer)}
              >
                <PanelLeft size={14} />
              </IconButton>
              <IconButton
                title="Mostrar ou ocultar inspetor"
                active={preferences.inspector}
                onClick={() =>
                  setPreference("inspector", !preferences.inspector)
                }
              >
                <PanelRight size={14} />
              </IconButton>
              <IconButton
                title="Buscar comandos · Ctrl+K"
                onClick={() => setPaletteOpen(true)}
              >
                <Command size={14} />
              </IconButton>
              <span>3D</span>
              <button onClick={() => setModal("help")} title="Ajuda e atalhos">
                <HelpCircle size={14} />
              </button>
            </div>
          </div>
          <div className="viewport-toolbar">
            <div className="tool-group">
              <IconButton
                title="Mover · W"
                active={tool === "translate"}
                onClick={() => setTool("translate")}
                disabled={!editing}
              >
                <Move size={16} />
              </IconButton>
              <IconButton
                title="Rotacionar · E"
                active={tool === "rotate"}
                onClick={() => setTool("rotate")}
                disabled={!editing}
              >
                <Rotate3D size={16} />
              </IconButton>
              <IconButton
                title="Escalar · R"
                active={tool === "scale"}
                onClick={() => setTool("scale")}
                disabled={!editing}
              >
                <Scaling size={16} />
              </IconButton>
              <span className="divider" />
              <IconButton
                title={`Snap · ${preferences.translationSnap} m / ${preferences.rotationSnap}°`}
                active={snap}
                onClick={() => setSnap(!snap)}
              >
                <Magnet size={15} />
              </IconButton>
              <IconButton
                title="Mostrar grade"
                active={grid}
                onClick={() => setGrid(!grid)}
              >
                <Grid3X3 size={15} />
              </IconButton>
            </div>
            <div className="play-controls">
              <button
                className={`play-button ${playing ? "running" : ""}`}
                title="Executar / parar · F5"
                onClick={togglePlay}
              >
                {playing ? (
                  <Square size={12} fill="currentColor" />
                ) : (
                  <Play size={13} fill="currentColor" />
                )}
                {playing ? "Parar" : "Executar"}
                <span>F5</span>
              </button>
              <IconButton
                title="Pausar simulação"
                active={paused}
                disabled={!playing}
                onClick={() => setPaused(!paused)}
              >
                <Pause size={14} />
              </IconButton>
            </div>
            <div className="tool-group">
              <IconButton
                title="Alternar espaço local/global"
                onClick={() => setSpace(space === "world" ? "local" : "world")}
                active={space === "local"}
              >
                <Compass size={15} />
              </IconButton>
              <IconButton
                title="Enquadrar seleção · F"
                onClick={() => viewport.current?.focus()}
              >
                <Maximize size={14} />
              </IconButton>
              <IconButton
                title="Capturar viewport"
                onClick={() => {
                  const url = viewport.current?.screenshot();
                  if (url) {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "gameforge-cena.png";
                    a.click();
                  }
                }}
              >
                <Camera size={14} />
              </IconButton>
            </div>
          </div>
          <div className="modebar">
            <label>
              <Camera size={12} />
              <select
                aria-label="Vista da câmera"
                value={cameraMode}
                onChange={(e) => setCameraMode(e.target.value as CameraMode)}
              >
                {Object.entries(cameraModes).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <span className="modebar-space">
              {space === "world" ? "Global" : "Local"}
            </span>
            <div className="modebar-actions">
              <IconButton
                title="Prévia do céu do jogo"
                active={preferences.previewSky}
                onClick={() =>
                  setPreference("previewSky", !preferences.previewSky)
                }
              >
                <Sun size={14} />
              </IconButton>
              <IconButton
                title="Visualizar colisores (AABB)"
                active={colliders}
                onClick={() => setColliders(!colliders)}
              >
                <Shield size={14} />
              </IconButton>
              <IconButton
                title="Ancorar / soltar peça"
                active={node?.physics === "static"}
                disabled={
                  !editing || !node || node.locked || node.kind === "group"
                }
                onClick={() =>
                  node &&
                  update(node.id, {
                    physics: node.physics === "static" ? "dynamic" : "static",
                  })
                }
              >
                <Anchor size={14} />
              </IconButton>
              <IconButton
                title="Bloquear / desbloquear nó"
                active={node?.locked}
                disabled={!editing || !node}
                onClick={() =>
                  node && update(node.id, { locked: !node.locked })
                }
              >
                {node?.locked ? <Lock size={14} /> : <Unlock size={14} />}
              </IconButton>
              <IconButton
                title="Agrupar nó selecionado"
                disabled={
                  !editing || !node || node.locked || scene.nodes.length >= 500
                }
                onClick={groupSelected}
              >
                <Folder size={14} />
              </IconButton>
              {playing && (
                <IconButton
                  title="Voltar ao checkpoint · R"
                  onClick={() => viewport.current?.respawn()}
                >
                  <RefreshCw size={14} />
                </IconButton>
              )}
            </div>
          </div>
          <div className="viewport-wrap">
            <Viewport
              ref={viewport}
              selection={selection}
              quality={preferences.quality}
              previewSky={preferences.previewSky}
              snapSteps={{
                translation: preferences.translationSnap,
                rotation: preferences.rotationSnap,
                scale: preferences.scaleSnap,
              }}
              brushMode={
                ["design", "terrain"].includes(tab) ? brush.mode : "select"
              }
              brush={brush}
              onTerrainCommit={(id, surface) =>
                mutate((p) => {
                  const n = activeScene(p).nodes.find((n) => n.id === id);
                  if (n && !n.locked) n.surface = surface;
                })
              }
              onDesignHit={designHit}
              onSetPaused={setPaused}
              onContextAction={(action) => {
                if (action === "duplicate") duplicate();
                if (action === "delete") remove();
                if (action === "focus") viewport.current?.focus();
                if (action === "add") setModal("add");
                if (action === "group") groupSelected();
                if (action === "ungroup") selectionAction("ungroup");
              }}
              onVoxelEdit={(cell, type) => {
                if (!editing || !scene.voxel) return;
                mutate((p) => {
                  const v = activeScene(p).voxel!;
                  const [x, y, z] = cell;
                  if (
                    x >= 0 &&
                    x < v.size &&
                    y >= 0 &&
                    y < 24 &&
                    z >= 0 &&
                    z < v.size
                  )
                    v.blocks[cellIndex(x, y, z, v.size)] = type;
                });
              }}
              voxelBlock={voxelBlock}
              cameraMode={cameraMode}
              colliders={colliders}
              space={space}
              scriptsAllowed={scriptsAllowed}
              onPause={() => setPaused(true)}
              data={scene}
              settings={project.settings}
              selected={selected}
              tool={tool}
              snap={snap}
              grid={grid}
              playing={playing}
              paused={paused}
              onSelect={select}
              onTransform={update}
              onLog={log}
              onStats={(fps, calls, resolution) =>
                setStats({ fps, calls, resolution })
              }
            />
            {playing && <div className="play-border" />}
            {!playing && selection.length > 1 && (
              <div className="selection-summary">
                <Layers3 size={13} />
                <strong>{selection.length} selecionados</strong>
                <span>Ctrl+G agrupar</span>
                <button
                  onClick={() => setSelection([])}
                  aria-label="Limpar seleção"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
          {dock && (
            <ResizeHandle
              label="Altura do painel de ferramentas"
              value={preferences.dockHeight}
              min={140}
              max={Math.min(600, Math.max(200, innerHeight * 0.55))}
              direction={-1}
              vertical
              onChange={(v) => setPreference("dockHeight", v)}
            />
          )}
          <div
            className={`bottom-dock ${dock ? "" : "closed"} ${["animation", "scripts", "design", "toolbox", "pixels", "ui", "world", "terrain"].includes(tab) ? "scripts-open" : ""}`}
          >
            <div className="dock-tabs">
              <button
                className={tab === "assets" ? "active" : ""}
                onClick={() => {
                  setTab("assets");
                  setDock(true);
                }}
              >
                <Package size={14} />
                Recursos<span className="counter">5</span>
              </button>
              <button
                className={tab === "console" ? "active" : ""}
                onClick={() => {
                  setTab("console");
                  setDock(true);
                }}
              >
                <Terminal size={14} />
                Console<span className="counter">{logs.length}</span>
              </button>
              <button
                className={tab === "behavior" ? "active" : ""}
                onClick={() => {
                  setTab("behavior");
                  setDock(true);
                }}
              >
                <Code2 size={14} />
                Comportamento
              </button>
              <button
                className={tab === "scripts" ? "active" : ""}
                onClick={() => {
                  setTab("scripts");
                  setDock(true);
                }}
              >
                <Code2 size={14} />
                Scripts
              </button>
              <button
                className={tab === "design" ? "active" : ""}
                onClick={() => {
                  setTab("design");
                  setDock(true);
                }}
              >
                Design & pintura
              </button>
              {(
                [
                  ["pixels", "Pixel Studio"],
                  ["ui", "Interface 2D"],
                  ["world", "Mundo"],
                  ["terrain", "Terreno"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => {
                    setTab(key);
                    setDock(true);
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                className={tab === "toolbox" ? "active" : ""}
                onClick={() => {
                  setTab("toolbox");
                  setDock(true);
                }}
              >
                <Package size={14} />
                Toolbox
              </button>
              <button
                className={tab === "animation" ? "active" : ""}
                onClick={() => openPanel("animation")}
              >
                <Film size={14} /> Animação
                <span className="new-feature-dot" />
              </button>
              <div className="dock-spacer" />
              {tab === "console" && (
                <IconButton title="Limpar console" onClick={() => setLogs([])}>
                  <Trash2 size={13} />
                </IconButton>
              )}
              <IconButton
                title={dock ? "Recolher painel" : "Expandir painel"}
                onClick={() => setDock(!dock)}
              >
                {dock ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </IconButton>
            </div>
            {dock && tab === "animation" && (
              <AnimationPanel
                node={node}
                disabled={!editing || !!node?.locked}
                playing={playing}
                onChange={(animation) => node && update(node.id, { animation })}
                onPreview={(time) => viewport.current?.previewAnimation(time)}
              />
            )}
            {dock && tab === "scripts" && (
              <Suspense
                fallback={
                  <div className="empty-inline" role="status">
                    Preparando o editor de scripts…
                  </div>
                }
              >
                <ScriptPanel
                  scope={project.scenes[0].id}
                  node={node}
                  disabled={!editing || !!node?.locked}
                  onApply={(script) => {
                    if (node) {
                      update(node.id, { script });
                      notify(
                        "Script aplicado. Execute a cena; erros aparecem no Console.",
                      );
                    }
                  }}
                />
              </Suspense>
            )}
            {dock && tab === "design" && (
              <DesignPanel
                brush={brush}
                onBrush={setBrush}
                node={node}
                disabled={!editing}
                onApply={() => {
                  if (node) applyMaterial(node.id);
                }}
                onArrange={(axis, spread) => {
                  if (node)
                    mutate((p) =>
                      arrangeChildren(
                        activeScene(p).nodes,
                        node.id,
                        axis,
                        spread,
                      ),
                    );
                }}
                onSmoothTerrain={() => {
                  const n = makeNode("terrain", {
                    name: "Terreno contínuo",
                    position: [0, 0, 0],
                    physics: "static",
                    color: "#ffffff",
                  });
                  if (scene.nodes.length >= 500) return;
                  mutate((p) => activeScene(p).nodes.push(n));
                  setSelected(n.id);
                }}
                onTerrain={() => {
                  const nodes = terrainPatch();
                  if (scene.nodes.length + nodes.length > 500) {
                    notify("Limite de 500 nós.");
                    return;
                  }
                  mutate((p) => {
                    activeScene(p).nodes.push(...nodes);
                    if (nodes[0].behavior === "player")
                      p.settings.playerId = nodes[0].id;
                  });
                  setSelected(nodes[0].id);
                  notify("Terreno criado. Escolha um pincel e clique no solo.");
                }}
              />
            )}
            {dock && tab === "pixels" && (
              <PixelPanel
                textures={project.settings.textures ?? []}
                disabled={!editing}
                canObject={!!node && !node.locked}
                canUI={
                  !!selectedUI && !!scene.ui?.some((e) => e.id === selectedUI)
                }
                onAdd={(t) =>
                  mutate((p) => {
                    (p.settings.textures ??= []).push(t);
                  })
                }
                onCommit={(t) =>
                  mutate((p) => {
                    p.settings.textures = (p.settings.textures ?? []).map(
                      (a) => (a.id === t.id ? t : a),
                    );
                  })
                }
                onAttach={(id, target) => {
                  if (target === "object" && node)
                    update(node.id, { textureId: id, color: "#ffffff" });
                  if (target === "ui")
                    mutate((p) => {
                      const e = activeScene(p).ui?.find(
                        (e) => e.id === selectedUI,
                      );
                      if (e) e.textureId = id;
                    });
                }}
              />
            )}
            {dock && tab === "ui" && (
              <UIPanel
                elements={scene.ui ?? []}
                textures={project.settings.textures ?? []}
                selected={selectedUI}
                onSelect={setSelectedUI}
                disabled={!editing}
                onChange={(elements) =>
                  mutate((p) => {
                    activeScene(p).ui = elements;
                  })
                }
              />
            )}
            {dock && tab === "terrain" && (
              <TerrainPanel
                brush={brush}
                onBrush={setBrush}
                node={node}
                disabled={!editing || !!node?.locked}
                onCreate={(options) => {
                  if (scene.nodes.length >= 500) {
                    notify("Limite de 500 nós.");
                    return;
                  }
                  const n = makeNode("terrain", {
                    name: "Terreno · " + options.preset,
                    position: [0, 0, 0],
                    scale: [1, 1, 1],
                    physics: "static",
                    terrain: true,
                    restitution: 0,
                    color: "#ffffff",
                    surface: generateTerrain(options),
                  });
                  mutate((p) => activeScene(p).nodes.push(n));
                  setSelected(n.id);
                  setBrush({ ...brush, mode: "raise" });
                }}
                onGenerate={(options) => {
                  if (node?.surface)
                    update(node.id, { surface: generateTerrain(options) });
                }}
              />
            )}
            {dock && tab === "world" && (
              <WorldPanel
                settings={project.settings}
                scene={scene}
                block={voxelBlock}
                onBlock={setVoxelBlock}
                disabled={!editing}
                onSettings={(settings) =>
                  mutate((p) => {
                    p.settings = settings;
                  })
                }
                onVoxel={(v: VoxelConfig) =>
                  mutate((p) => {
                    activeScene(p).voxel = v;
                  })
                }
              />
            )}
            {dock && tab === "toolbox" && (
              <div className="toolbox-panel">
                <header className="toolbox-search">
                  <strong>
                    {Object.keys(prefabNames).length} modelos · luz, personagens
                    e gelatina
                  </strong>
                  <input
                    aria-label="Buscar no Toolbox"
                    placeholder="Buscar modelo…"
                    value={toolboxSearch}
                    onChange={(e) => setToolboxSearch(e.target.value)}
                  />
                  <select
                    aria-label="Categoria do Toolbox"
                    value={toolboxCategory}
                    onChange={(e) => setToolboxCategory(e.target.value)}
                  >
                    {[
                      "Todos",
                      "Construção",
                      "Natureza",
                      "Decoração",
                      "Jogabilidade",
                      "Iluminação",
                      "Personagens e física",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </header>
                <div>
                  {Object.entries(prefabNames)
                    .filter(
                      ([key, label]) =>
                        (toolboxCategory === "Todos" ||
                          category(key) === toolboxCategory) &&
                        label
                          .toLocaleLowerCase()
                          .includes(deferredToolboxSearch.toLocaleLowerCase()),
                    )
                    .map(([key, label]) => (
                      <button
                        key={key}
                        disabled={!editing}
                        onClick={() => addPrefab(key as Prefab)}
                      >
                        <Box size={23} />
                        <strong>{label}</strong>
                        <small>
                          {["checkpoint", "finish", "hazard"].includes(key)
                            ? "Sensor de jogo"
                            : category(key)}
                        </small>
                      </button>
                    ))}
                </div>
              </div>
            )}
            {dock && tab === "assets" && (
              <div className="assets-content">
                <div className="asset-folders">
                  <strong>
                    <ChevronDown size={12} />
                    <Folder size={13} />
                    res://
                  </strong>
                  <span className="active">
                    <ChevronRight size={12} />
                    <Box size={13} />
                    Primitivas
                  </span>
                  <button
                    onClick={() => {
                      setTab("behavior");
                    }}
                  >
                    <Code2 size={13} />
                    Comportamentos
                  </button>
                  <small>Recursos internos</small>
                </div>
                <div className="asset-library">
                  <div className="asset-breadcrumb">
                    res:// <ChevronRight size={10} /> primitivas{" "}
                    <span>Clique para adicionar à cena</span>
                  </div>
                  <div className="asset-cards">
                    {(Object.keys(kindNames) as Kind[]).map((k) => {
                      const Icon = kindIcons[k];
                      return (
                        <button
                          key={k}
                          className="asset-card"
                          disabled={!editing}
                          onClick={() => add(k)}
                        >
                          <div className={`asset-art art-${k}`}>
                            <Icon size={31} strokeWidth={1.15} />
                          </div>
                          <span>{kindNames[k]}</span>
                          <small>{k === "group" ? "Node3D" : "Mesh3D"}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {dock && tab === "console" && (
              <div className="console-wrap">
                <div className="console-filter">
                  <Search size={13} />
                  <input
                    aria-label="Buscar no console"
                    placeholder="Filtrar mensagens…"
                    value={consoleSearch}
                    onChange={(e) => setConsoleSearch(e.target.value)}
                  />
                  <button
                    className={consoleFilter === "all" ? "active" : ""}
                    onClick={() => setConsoleFilter("all")}
                  >
                    Todas ({logs.length})
                  </button>
                  <button
                    className={consoleFilter === "errors" ? "active" : ""}
                    onClick={() => setConsoleFilter("errors")}
                  >
                    Erros ({logs.filter((l) => l.error).length})
                  </button>
                  <span>Últimas 150 mensagens</span>
                </div>
                <div
                  className="console-content"
                  role="log"
                  aria-label="Mensagens do runtime"
                >
                  {!logs.some(
                    (l) =>
                      (consoleFilter === "all" || l.error) &&
                      l.text
                        .toLocaleLowerCase()
                        .includes(consoleSearch.toLocaleLowerCase()),
                  ) && (
                    <p className="muted">Nenhuma mensagem para este filtro.</p>
                  )}
                  {logs
                    .filter(
                      (l) =>
                        (consoleFilter === "all" || l.error) &&
                        l.text
                          .toLocaleLowerCase()
                          .includes(consoleSearch.toLocaleLowerCase()),
                    )
                    .map((l, i) => (
                      <div key={i} className={l.error ? "log-error" : ""}>
                        <time>{l.time}</time>
                        {l.error ? <Info size={12} /> : <Check size={12} />}
                        <span>{l.text}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {dock && tab === "behavior" && (
              <div className="behavior-dock">
                {node ? (
                  <>
                    <textarea
                      aria-label="Configuração JSON de comportamento"
                      spellCheck={false}
                      disabled={!editing}
                      value={behaviorJSON}
                      onChange={(e) => setBehaviorJSON(e.target.value)}
                    />
                    <div>
                      <strong>
                        <Code2 size={14} />
                        {node.name}.behavior.json
                      </strong>
                      <p>
                        Componente declarativo executado pelo runtime. Não
                        executa JavaScript arbitrário.
                      </p>
                      <button
                        disabled={!editing}
                        className="primary"
                        onClick={() => {
                          try {
                            const v = JSON.parse(behaviorJSON);
                            if (
                              !Object.keys(behaviorNames).includes(
                                v.behavior,
                              ) ||
                              !Number.isFinite(v.speed) ||
                              v.speed < 0 ||
                              v.speed > 100 ||
                              !Number.isFinite(v.amplitude) ||
                              v.amplitude < 0 ||
                              v.amplitude > 100
                            )
                              throw new Error(
                                "Use behavior válido, speed e amplitude entre 0 e 100.",
                              );
                            update(node.id, {
                              behavior: v.behavior,
                              speed: v.speed,
                              amplitude: v.amplitude,
                            });
                            setCodeError("");
                            notify(
                              "Comportamento aplicado. Execute a cena para testar.",
                            );
                          } catch (e) {
                            setCodeError(String(e));
                          }
                        }}
                      >
                        <Check size={13} />
                        Aplicar componente
                      </button>
                      {codeError && (
                        <small className="error-text">{codeError}</small>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-inline">
                    <Code2 size={22} />
                    Selecione um nó para editar seu comportamento.
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
        <ResizeHandle
          label="Largura do inspetor"
          value={preferences.rightWidth}
          min={240}
          max={420}
          direction={-1}
          onChange={(v) => setPreference("rightWidth", v)}
        />
        <aside className="inspector">
          <div className="panel-heading">
            <div>
              <Settings2 size={14} />
              INSPECTOR
            </div>
            <span className="subtle">{node ? "Node3D" : "World"}</span>
          </div>
          {selection.length > 1 ? (
            <MultiSelectionPanel
              nodes={selectedNodes}
              disabled={!editing}
              onAction={selectionAction}
              onPatch={patchSelection}
            />
          ) : node ? (
            <>
              <div className="node-heading">
                <span className="node-icon">
                  {(() => {
                    const Icon = kindIcons[node.kind];
                    return <Icon size={22} />;
                  })()}
                </span>
                <div>
                  <strong>{node.name}</strong>
                  <small>
                    {kindNames[node.kind]} ·{" "}
                    {node.physics === "dynamic" ? "RigidBody3D" : "Node3D"}
                  </small>
                </div>
                <IconButton
                  title="Duplicar nó"
                  onClick={duplicate}
                  disabled={!editing}
                >
                  <Copy size={14} />
                </IconButton>
              </div>
              {playing && (
                <div className="inspector-notice">
                  Pare a execução para editar.
                </div>
              )}
              <button
                className="node-animation-link"
                onClick={() => openPanel("animation")}
              >
                <Film size={14} />
                {node.animation
                  ? `Animação · ${node.animation.name}`
                  : "Adicionar animação"}
                <ChevronRight size={13} />
              </button>
              <fieldset
                disabled={!editing || node.locked}
                className="inspector-fields"
              >
                <ActorPanel
                  node={node}
                  disabled={!editing || node.locked}
                  onChange={(v) => update(node.id, v)}
                  primary={
                    (project.settings.playerId ??
                      scene.nodes.find((n) => n.behavior === "player")?.id) ===
                    node.id
                  }
                  onPrimary={() =>
                    mutate((p) => {
                      p.settings.playerId = node.id;
                    })
                  }
                />
                <LightPanel
                  node={node}
                  disabled={!editing || node.locked}
                  onChange={(v) => update(node.id, v)}
                />
                <Section title="Nó" icon={<Box size={13} />}>
                  <label className="property">
                    <span>Nome</span>
                    <Field
                      type="text"
                      label="Nome do nó"
                      value={node.name}
                      onChange={(v: string) =>
                        update(node.id, { name: v || "Node" })
                      }
                    />
                  </label>
                  <label className="property">
                    <span>Pai</span>
                    <select
                      value={node.parent ?? ""}
                      onChange={(e) => parent(node.id, e.target.value || null)}
                    >
                      <option value="">World (raiz)</option>
                      {scene.nodes
                        .filter(
                          (n) =>
                            n.id !== node.id &&
                            canParent(scene.nodes, node.id, n.id),
                        )
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="property">
                    <span>Visível</span>
                    <input
                      type="checkbox"
                      checked={node.visible}
                      onChange={(e) =>
                        update(node.id, { visible: e.target.checked })
                      }
                    />
                  </label>
                </Section>
                <Section title="Transformação" icon={<Move size={13} />}>
                  <div className="section-subtitle">
                    ESPAÇO LOCAL{" "}
                    <button
                      title="Restaurar transformações"
                      onClick={() =>
                        update(node.id, {
                          position: [0, 0, 0],
                          rotation: [0, 0, 0],
                          scale: [1, 1, 1],
                        })
                      }
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                  {transformFields("position", "Posição")}
                  {transformFields("rotation", "Rotação °")}
                  {transformFields("scale", "Escala")}
                </Section>
                {node.kind !== "group" && (
                  <Section title="Material" icon={<Circle size={13} />}>
                    <label className="property">
                      <span>Cor base</span>
                      <div className="color-field">
                        <input
                          aria-label="Cor base"
                          type="color"
                          value={node.color}
                          onChange={(e) =>
                            update(node.id, { color: e.target.value })
                          }
                        />
                        <span>{node.color.toUpperCase()}</span>
                      </div>
                    </label>
                    <label className="property">
                      <span>Rugosidade</span>
                      <Field
                        value={node.roughness}
                        label="Rugosidade"
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v: number) =>
                          update(node.id, { roughness: v })
                        }
                      />
                    </label>
                    <label className="property">
                      <span>Metálico</span>
                      <Field
                        value={node.metalness}
                        label="Metálico"
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v: number) =>
                          update(node.id, { metalness: v })
                        }
                      />
                    </label>
                  </Section>
                )}
                {node.kind !== "group" && (
                  <Section title="Física" icon={<Layers3 size={13} />}>
                    <label className="property">
                      <span>Corpo</span>
                      <select
                        aria-label="Tipo de corpo"
                        value={node.physics}
                        onChange={(e) =>
                          update(node.id, {
                            physics: e.target.value as Node3D["physics"],
                          })
                        }
                      >
                        <option value="none">Sem colisão</option>
                        <option value="static">Estático</option>
                        <option value="dynamic">Dinâmico</option>
                      </select>
                    </label>
                    {node.physics !== "none" && (
                      <>
                        <label className="property">
                          <span>Massa (kg)</span>
                          <Field
                            value={node.mass}
                            label="Massa"
                            min={0.01}
                            max={10000}
                            onChange={(v: number) =>
                              update(node.id, { mass: v })
                            }
                          />
                        </label>
                        <label className="property">
                          <span>Atrito</span>
                          <Field
                            value={node.friction}
                            label="Atrito"
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={(v: number) =>
                              update(node.id, { friction: v })
                            }
                          />
                        </label>
                        <label className="property">
                          <span>Restituição</span>
                          <Field
                            value={node.restitution}
                            label="Restituição"
                            min={0}
                            max={1}
                            onChange={(v: number) =>
                              update(node.id, { restitution: v })
                            }
                          />
                        </label>
                        <p className="field-hint">
                          Colisor:{" "}
                          {node.kind === "sphere"
                            ? "esfera envolvente"
                            : "caixa envolvente"}
                          . Física em passo fixo configurável (padrão 120 Hz).
                        </p>
                      </>
                    )}
                  </Section>
                )}
                <Section title="Comportamento" icon={<Code2 size={13} />}>
                  <label className="property">
                    <span>Componente</span>
                    <select
                      aria-label="Comportamento"
                      value={node.behavior}
                      onChange={(e) => {
                        const behavior = e.target.value as Behavior;
                        update(node.id, {
                          behavior,
                          ...(behavior === "player"
                            ? { physics: "dynamic" as const, speed: 5 }
                            : {}),
                          ...(behavior === "collectible"
                            ? { physics: "none" as const }
                            : {}),
                        });
                      }}
                    >
                      {Object.entries(behaviorNames).map(([v, t]) => (
                        <option value={v} key={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  {node.behavior !== "none" && (
                    <>
                      <label className="property">
                        <span>Velocidade</span>
                        <Field
                          value={node.speed}
                          label="Velocidade"
                          min={0}
                          max={100}
                          onChange={(v: number) =>
                            update(node.id, { speed: v })
                          }
                        />
                      </label>
                      {node.behavior === "float" && (
                        <label className="property">
                          <span>Amplitude</span>
                          <Field
                            value={node.amplitude}
                            label="Amplitude"
                            min={0}
                            max={100}
                            onChange={(v: number) =>
                              update(node.id, { amplitude: v })
                            }
                          />
                        </label>
                      )}
                      <p className="field-hint">
                        {node.behavior === "player"
                          ? "WASD ou setas + Espaço. Um jogador ativo por cena."
                          : node.behavior === "collectible"
                            ? "Coletado ao se aproximar do jogador. Não bloqueia a passagem."
                            : "Animação ativa ao executar. Use sem corpo físico."}
                      </p>
                    </>
                  )}
                </Section>
              </fieldset>
              <div className="inspector-node-id">
                ID {node.id.slice(0, 8)} <Check size={11} />
              </div>
            </>
          ) : (
            <>
              <div className="world-card">
                <div className="world-card-icon">
                  <Layers3 size={31} />
                </div>
                <span className="eyebrow">SEU MUNDO, SUAS REGRAS</span>
                <h3>
                  Uma ideia.
                  <br />
                  Infinitas possibilidades.
                </h3>
                <p>Selecione um objeto na cena para começar a editar.</p>
                <button
                  className="outline-button"
                  onClick={() => setModal("add")}
                  disabled={!editing}
                >
                  <Plus size={14} />
                  Adicionar nó
                </button>
              </div>
              <Section title="Ambiente" icon={<Settings2 size={13} />}>
                <label className="property">
                  <span>Fundo</span>
                  <input
                    type="color"
                    value={project.settings.background}
                    disabled={!editing}
                    onChange={(e) =>
                      mutate((p) => (p.settings.background = e.target.value))
                    }
                  />
                </label>
                <label className="property">
                  <span>Gravidade</span>
                  <Field
                    value={project.settings.gravity}
                    label="Gravidade"
                    min={-100}
                    max={100}
                    onChange={(v: number) =>
                      mutate((p) => (p.settings.gravity = v))
                    }
                  />
                </label>
                <p className="field-hint">
                  Luz solar + ambiente. Sombras em tempo real.
                </p>
              </Section>
              <div className="quick-guide">
                <span>PRIMEIROS PASSOS</span>
                <p>
                  <i>1</i>Explore a cena em 3D
                </p>
                <p>
                  <i>2</i>Adicione e transforme nós
                </p>
                <p>
                  <i>3</i>Execute para testar sua ideia
                </p>
                <button onClick={() => setModal("help")}>
                  Ver atalhos e guia
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
      <footer className="status-bar">
        <div>
          <span className="live-dot" />
          <span>{playing ? "Runtime ativo" : saved}</span>
          <span className="status-separator" />
          {window.gameforgeDesktop ? <Monitor size={12} /> : <Box size={12} />}
          <span>
            {window.gameforgeDesktop ? "Desktop" : "Prévia web"} · v
            {STUDIO_VERSION}
          </span>
        </div>
        <div>
          <label className="quality-picker">
            <Gauge size={12} />
            <select
              aria-label="Qualidade da renderização"
              value={preferences.quality}
              onChange={(e) =>
                setPreference("quality", e.target.value as RenderQuality)
              }
            >
              <option value="auto">Auto</option>
              <option value="economy">Econômica</option>
              <option value="high">Alta</option>
            </select>
            <span>{Math.round(stats.resolution * 100)}%</span>
          </label>
          <span>{stats.fps} FPS</span>
          <span>{stats.calls} draw calls</span>
          <span className="status-separator" />
          <span>Three.js + Cannon</span>
          <IconButton
            title="Desfazer · Ctrl+Z"
            disabled={!editing || !history.current!.past.length}
            onClick={undo}
          >
            <Undo2 size={13} />
          </IconButton>
          <IconButton
            title="Refazer · Ctrl+Shift+Z"
            disabled={!editing || !history.current!.future.length}
            onClick={redo}
          >
            <Redo2 size={13} />
          </IconButton>
        </div>
      </footer>
      <input
        ref={file}
        type="file"
        accept=".json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f)
            try {
              load(await readProject(f));
            } catch (err) {
              notify(String(err), true);
            }
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <Info size={15} />
          <span>{toast}</span>
          <button onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {paletteOpen && (
        <CommandPalette
          commands={commands}
          onClose={() => setPaletteOpen(false)}
        />
      )}
      {libraryOpen && (
        <ProjectLibrary
          project={project}
          thumbnail={libraryThumbnail}
          onLoad={load}
          onOpen={open}
          onClose={() => setLibraryOpen(false)}
          onError={(text) => notify(text, true)}
        />
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-dialog-title"
            tabIndex={-1}
          >
            <div className="modal-heading">
              <h2 id="studio-dialog-title">
                {modal === "add"
                  ? "Adicionar nó"
                  : modal === "help"
                    ? "Seu próximo mundo começa aqui"
                    : modal === "settings"
                      ? "Configurações do projeto"
                      : modal === "trust"
                        ? "Permitir scripts deste projeto?"
                        : "Criar projeto"}
              </h2>
              <IconButton title="Fechar" onClick={() => setModal(null)}>
                <X size={18} />
              </IconButton>
            </div>
            {modal === "trust" && (
              <>
                <p>
                  Este projeto contém código Lua ou JavaScript. Scripts executam
                  em um Worker com limite de tempo, mas não são uma sandbox
                  auditada. Execute somente código de confiança.
                </p>
                <div className="help-note">
                  <Code2 size={18} />
                  <p>
                    Revise o código na aba Scripts antes de permitir. A
                    permissão não é salva no arquivo nem concedida
                    automaticamente ao abrir projetos.
                  </p>
                </div>
                <div className="row-buttons">
                  <button
                    className="primary"
                    onClick={() => {
                      setModal(null);
                      startPlay(true);
                    }}
                  >
                    Permitir e executar
                  </button>
                  <button
                    className="outline-button"
                    onClick={() => {
                      setModal(null);
                      startPlay(false);
                    }}
                  >
                    Executar sem scripts
                  </button>
                </div>
              </>
            )}
            {modal === "add" && (
              <>
                <p>
                  Escolha uma primitiva. Configure sua aparência e comportamento
                  no inspector.
                </p>
                <div className="add-options">
                  {(Object.keys(kindNames) as Kind[]).map((k) => {
                    const Icon = kindIcons[k];
                    return (
                      <button onClick={() => add(k)} key={k}>
                        <Icon size={25} />
                        <div>
                          <strong>{kindNames[k]}</strong>
                          <span>
                            {k === "group"
                              ? "Organize os nós da cena"
                              : "Malha 3D · material editável"}
                          </span>
                        </div>
                        <Plus size={16} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {modal === "help" && (
              <>
                <p>
                  Um Studio independente inspirado no fluxo de criação do
                  Roblox: objetos, modelos, scripts e testes em um só lugar.
                  Seus projetos ficam no seu dispositivo.
                </p>
                <div className="shortcut-grid">
                  {[
                    ["Ctrl + K", "Buscar qualquer comando"],
                    ["Ctrl / Shift + clique", "Selecionar vários objetos"],
                    ["Ctrl + G / Shift + G", "Agrupar / desagrupar"],
                    ["Ctrl + C / V", "Copiar / colar seleção"],
                    ["Ctrl + N", "Biblioteca de projetos"],
                    ["W / E / R", "Mover / girar / escalar"],
                    ["F", "Enquadrar seleção"],
                    ["Ctrl + D", "Duplicar ramo"],
                    ["Delete", "Excluir nó e filhos"],
                    ["Ctrl + Z", "Desfazer"],
                    ["Ctrl + Shift + Z", "Refazer"],
                    ["Ctrl + S / O", "Salvar / abrir projeto"],
                    ["F5 / F8", "Executar / parar"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <kbd>{k}</kbd>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="help-note">
                  <Info size={17} />
                  <p>
                    No parkour, use WASD, Espaço e Shift para alcançar os 8
                    cristais e a chegada. O botão Exportar jogo gera um HTML
                    offline da cena ativa. Os jogos originais ficam na aba
                    Jogos.
                  </p>
                </div>
                <p className="field-hint">
                  Limites desta versão: malhas e interfaces 2D simples, colisão
                  discreta sem CCD, sem importação de modelos, editor 2D,
                  GDScript, Luau, multiplayer ou animações de esqueleto.
                  Keyframes animam transformações de objetos. Confira o README
                  para o roteiro.
                </p>
              </>
            )}
            {modal === "settings" && (
              <>
                <label className="modal-field">
                  Nome do projeto
                  <Field
                    type="text"
                    value={project.name}
                    onChange={(v: string) =>
                      mutate((p) => (p.name = v || "Sem título"))
                    }
                  />
                </label>
                <label className="modal-field">
                  Nome da cena
                  <Field
                    type="text"
                    value={scene.name}
                    onChange={(v: string) =>
                      mutate((p) => (activeScene(p).name = v || "Cena"))
                    }
                  />
                </label>
                <label className="modal-field">
                  Câmera padrão ao executar
                  <select
                    aria-label="Câmera padrão do jogo"
                    value={project.settings.gameCamera ?? "third"}
                    onChange={(e) =>
                      mutate(
                        (p) =>
                          (p.settings.gameCamera = e.target
                            .value as CameraMode),
                      )
                    }
                  >
                    {Object.entries(cameraModes).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <details open className="control-settings">
                  <summary>Controles, câmera e precisão física</summary>
                  <p>
                    Salvos no projeto. A velocidade final combina o valor do
                    jogador com o multiplicador abaixo.
                  </p>
                  {controlFields.map(([key, label, min, max, step]) => (
                    <label key={key}>
                      {label}
                      <Field
                        label={label}
                        value={project.settings[key] ?? controlDefaults[key]}
                        min={min}
                        max={max}
                        step={step}
                        onChange={(v: number) =>
                          mutate((p) => {
                            p.settings[key] = Math.max(min, Math.min(max, v));
                          })
                        }
                      />
                    </label>
                  ))}
                </details>
                <details className="control-settings" open>
                  <summary>Preferências do Studio · neste dispositivo</summary>
                  {(
                    [
                      ["translationSnap", "Snap de movimento", 0.05, 10, 0.05],
                      ["rotationSnap", "Snap de rotação (graus)", 1, 90, 1],
                      ["scaleSnap", "Snap de escala", 0.01, 1, 0.01],
                    ] as const
                  ).map(([key, label, min, max, step]) => (
                    <label key={key}>
                      {label}
                      <Field
                        label={label}
                        value={preferences[key]}
                        min={min}
                        max={max}
                        step={step}
                        onChange={(value: number) => setPreference(key, value)}
                      />
                    </label>
                  ))}
                  <p>
                    Arraste as bordas dos painéis ou use as setas com a borda
                    focada. Em telas pequenas, alterne entre Cena, Viewport e
                    Inspetor.
                  </p>
                  <button className="outline-button" onClick={resetLayout}>
                    Restaurar preferências
                  </button>
                </details>
                <div className="help-note">
                  <Save size={18} />
                  <p>
                    O autosave fica neste navegador/aplicativo. Use Salvar para
                    manter um arquivo de backup portátil.
                  </p>
                </div>
                <button
                  className="danger-button"
                  disabled={project.scenes.length < 2}
                  onClick={() => {
                    mutate((p) => {
                      p.scenes = p.scenes.filter((s) => s.id !== p.activeScene);
                      p.activeScene = p.scenes[0].id;
                    });
                    setSelected(null);
                    setModal(null);
                  }}
                >
                  Excluir cena ativa
                </button>
                <button className="primary" onClick={() => setModal(null)}>
                  Concluir
                </button>
              </>
            )}
            {modal === "new" && (
              <>
                <p>
                  O projeto atual será substituído. Você pode desfazer com
                  Ctrl+Z ou salvar uma cópia antes de continuar.
                </p>
                <div className="new-project-options">
                  <button
                    onClick={() => {
                      load(auroraProject());
                      setModal(null);
                    }}
                  >
                    <Box size={25} />
                    <strong>Ilha Aurora</strong>
                    <span>Mundo flutuante · cristais · personagem</span>
                  </button>
                  <button
                    onClick={() => {
                      load(templateProject("jelly"));
                      setModal(null);
                    }}
                  >
                    <Package size={25} />
                    <strong>Jelly Jump</strong>
                    <span>Parkour de gelatina · jogador articulado</span>
                  </button>
                  <button
                    onClick={() => {
                      load(templateProject("animation"));
                      setModal(null);
                      openPanel("animation");
                    }}
                  >
                    <Film size={25} />
                    <strong>Motion Lab</strong>
                    <span>Keyframes e plataforma móvel</span>
                  </button>
                  <button
                    onClick={() => {
                      load(parkourProject());
                      setModal(null);
                    }}
                  >
                    <Move size={25} />
                    <strong>Skyline · Parkour FPS</strong>
                    <span>20 plataformas · 3 checkpoints · 8 cristais</span>
                  </button>
                  <button
                    onClick={() => {
                      load(scriptingProject());
                      setModal(null);
                    }}
                  >
                    <Code2 size={25} />
                    <strong>Lua + JavaScript</strong>
                    <span>Dois exemplos executáveis</span>
                  </button>
                  <button
                    onClick={() => {
                      load(studioProject());
                      setModal(null);
                      setTab("design");
                      setDock(true);
                    }}
                  >
                    <strong>Ateliê 0.4</strong>
                    <small>Terreno, novos modelos, Lua e física</small>
                  </button>
                  {(["grass", "hills", "shapes"] as const).map((kind, i) => (
                    <button
                      key={kind}
                      onClick={() => {
                        load(baseMap(kind));
                        setModal(null);
                      }}
                    >
                      <strong>
                        {
                          [
                            "Gramado e céu",
                            "Colinas contínuas",
                            "Formas avançadas",
                          ][i]
                        }
                      </strong>
                      <small>Mapa-base editável · 0.5</small>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      load(createProject());
                      setModal(null);
                    }}
                  >
                    <Layers3 size={25} />
                    <strong>Ilha dos cristais</strong>
                    <span>Cena de exemplo jogável</span>
                  </button>
                  <button
                    onClick={() => {
                      const p = createProject();
                      p.name = "Projeto sem título";
                      p.scenes[0].name = "Cena principal";
                      p.scenes[0].nodes = [];
                      load(p);
                      setModal(null);
                    }}
                  >
                    <FileJson size={25} />
                    <strong>Projeto vazio</strong>
                    <span>Uma tela em branco</span>
                  </button>
                </div>
                <button className="text-button" onClick={save}>
                  <Save size={14} />
                  Salvar projeto atual primeiro
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
