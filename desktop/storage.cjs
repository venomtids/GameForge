const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const MAX_PROJECT_BYTES = 8_000_000;
function projectArgument(args) {
  return (
    args.find(
      (arg) =>
        typeof arg === "string" &&
        !arg.startsWith("--") &&
        /\.(?:json|gameforge)(?:\.bak)?$/i.test(arg),
    ) ?? null
  );
}
async function readProjectFile(filename) {
  if (
    typeof filename !== "string" ||
    filename.includes("\0") ||
    !/\.(?:json|gameforge)(?:\.bak)?$/i.test(filename)
  )
    throw new Error("Escolha um arquivo .gameforge.json ou .gameforge.");
  const file = path.resolve(filename),
    stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > MAX_PROJECT_BYTES)
    throw new Error("Limite de projeto: 8 MB.");
  const content = await fs.readFile(file, "utf8");
  if (Buffer.byteLength(content) > MAX_PROJECT_BYTES)
    throw new Error("Limite de projeto: 8 MB.");
  return content;
}
/** Never truncate an existing file. Flush and rename a unique sibling, keeping one backup. */
async function atomicWrite(
  filename,
  content,
  backup = false,
  shouldWrite = () => true,
) {
  const temp = `${filename}.${process.pid}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(filename), { recursive: true });
  let handle;
  try {
    handle = await fs.open(temp, "wx", 0o600);
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    if (!shouldWrite()) return;
    if (backup) {
      try {
        await fs.copyFile(filename, `${filename}.bak`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    // No await between the generation check and commit: a synchronous shutdown
    // flush must never be overwritten by an already-in-flight asynchronous rename.
    if (shouldWrite()) require("node:fs").renameSync(temp, filename);
  } finally {
    await handle?.close().catch(() => {});
    await fs.unlink(temp).catch(() => {});
  }
}
function atomicWriteSync(filename, content, backup = false) {
  const sync = require("node:fs"),
    temp = `${filename}.${process.pid}.${randomUUID()}.tmp`;
  let fd;
  try {
    sync.mkdirSync(path.dirname(filename), { recursive: true });
    fd = sync.openSync(temp, "wx", 0o600);
    sync.writeFileSync(fd, content, "utf8");
    sync.fsyncSync(fd);
    sync.closeSync(fd);
    fd = undefined;
    if (backup && sync.existsSync(filename))
      sync.copyFileSync(filename, `${filename}.bak`);
    sync.renameSync(temp, filename);
  } finally {
    if (fd !== undefined) sync.closeSync(fd);
    try {
      sync.unlinkSync(temp);
    } catch {
      /* Renamed successfully. */
    }
  }
}
function validWindowState(value, displays) {
  if (!value || !Number.isFinite(value.width) || !Number.isFinite(value.height))
    return { width: 1480, height: 920 };
  const width = Math.max(480, Math.min(3840, Math.round(value.width))),
    height = Math.max(420, Math.min(2160, Math.round(value.height)));
  const bounds = { width, height };
  if (
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    displays.some((display) => {
      const r = display.workArea;
      return (
        value.x + width > r.x + 80 &&
        value.x < r.x + r.width - 80 &&
        value.y + height > r.y + 80 &&
        value.y < r.y + r.height - 80
      );
    })
  )
    Object.assign(bounds, { x: value.x, y: value.y });
  return { ...bounds, maximized: value.maximized === true };
}
module.exports = {
  atomicWrite,
  atomicWriteSync,
  readProjectFile,
  projectArgument,
  validWindowState,
  MAX_PROJECT_BYTES,
};
