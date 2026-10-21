import { serializeProject } from "./serialization";
import { parseProject, type Project } from "./model";
export interface LibraryEntry {
  id: string;
  name: string;
  updatedAt: number;
  scenes: number;
  nodes: number;
  content: string;
  thumbnail?: string;
}
export interface ProjectSnapshot {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  content: string;
}
const DB_NAME = "gameforge-studio-library";
let connection: Promise<IDBDatabase> | undefined;
function database() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "Biblioteca indisponível. Salve seu projeto em um arquivo JSON.",
        ),
      );
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("projects", { keyPath: "id" });
      request.result.createObjectStore("snapshots", { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
    request.onerror = () => {
      connection = undefined;
      reject(
        request.error ??
          new Error("Não foi possível abrir a biblioteca local."),
      );
    };
    request.onblocked = () => {
      connection = undefined;
      reject(
        new Error("Feche outras abas do Studio para atualizar a biblioteca."),
      );
    };
  });
  return connection;
}
function request<T>(r: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function completed(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(
        tx.error ?? new Error("Armazenamento local cheio ou indisponível."),
      );
  });
}
export const projectId = (project: Project) => project.scenes[0].id;
export async function listProjects(): Promise<LibraryEntry[]> {
  const db = await database();
  const entries = await request<LibraryEntry[]>(
    db.transaction("projects", "readonly").objectStore("projects").getAll(),
  );
  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function rememberProject(project: Project, thumbnail?: string) {
  const db = await database();
  const tx = db.transaction("projects", "readwrite"),
    done = completed(tx),
    store = tx.objectStore("projects");
  const existing = await request<LibraryEntry[]>(store.getAll()),
    old = existing.find((e) => e.id === projectId(project));
  const entry: LibraryEntry = {
    id: projectId(project),
    name: project.name,
    updatedAt: Math.max(Date.now(), ...existing.map((e) => e.updatedAt + 1)),
    scenes: project.scenes.length,
    nodes: project.scenes.reduce((sum, s) => sum + s.nodes.length, 0),
    content: serializeProject(project),
    ...(thumbnail || old?.thumbnail
      ? { thumbnail: thumbnail ?? old?.thumbnail }
      : {}),
  };
  store.put(entry);
  const entries = [entry, ...existing.filter((e) => e.id !== entry.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  let bytes = 0;
  for (let i = 0; i < entries.length; i++) {
    bytes +=
      entries[i].content.length * 2 + (entries[i].thumbnail?.length ?? 0) * 2;
    if (i >= 12 || (bytes > 40_000_000 && i > 0)) store.delete(entries[i].id);
  }
  await done;
}
export async function removeProject(id: string) {
  const db = await database(),
    tx = db.transaction(["projects", "snapshots"], "readwrite"),
    done = completed(tx);
  tx.objectStore("projects").delete(id);
  const snapshots = await request<ProjectSnapshot[]>(
    tx.objectStore("snapshots").getAll(),
  );
  snapshots
    .filter((s) => s.projectId === id)
    .forEach((s) => tx.objectStore("snapshots").delete(s.id));
  await done;
}
export async function listSnapshots(
  project: Project,
): Promise<ProjectSnapshot[]> {
  const db = await database();
  const entries = await request<ProjectSnapshot[]>(
    db.transaction("snapshots", "readonly").objectStore("snapshots").getAll(),
  );
  return entries
    .filter((e) => e.projectId === projectId(project))
    .sort((a, b) => b.createdAt - a.createdAt);
}
export async function createSnapshot(project: Project, name = "Versão manual") {
  const db = await database(),
    tx = db.transaction("snapshots", "readwrite"),
    done = completed(tx),
    store = tx.objectStore("snapshots");
  const existing = await request<ProjectSnapshot[]>(store.getAll());
  const snapshot: ProjectSnapshot = {
    id: crypto.randomUUID(),
    projectId: projectId(project),
    name: name.slice(0, 80),
    createdAt: Math.max(Date.now(), ...existing.map((s) => s.createdAt + 1)),
    content: serializeProject(project),
  };
  store.put(snapshot);
  const all = [snapshot, ...existing].sort((a, b) => b.createdAt - a.createdAt);
  const counts = new Map<string, number>();
  let bytes = 0;
  all.forEach((s, i) => {
    const count = (counts.get(s.projectId) ?? 0) + 1;
    counts.set(s.projectId, count);
    bytes += s.content.length * 2;
    if (count > 5 || i >= 25 || (bytes > 60_000_000 && i > 0))
      store.delete(s.id);
  });
  await done;
  return snapshot;
}
export const restoreEntry = (entry: LibraryEntry | ProjectSnapshot) =>
  parseProject(entry.content);
