import lua from "fengari/src/lua.js";
import lauxlib from "fengari/src/lauxlib.js";
import core from "fengari/src/fengaricore.js";
import base from "fengari/src/lbaselib.js";
import math from "fengari/src/lmathlib.js";
import string from "fengari/src/lstrlib.js";
import table from "fengari/src/ltablib.js";
import utf8 from "fengari/src/lutf8lib.js";
const { to_luastring, to_jsstring } = core;
const lualib = { ...base, ...math, ...string, ...table, ...utf8 };
// No Node or DOM APIs are exposed. Main thread accepts only bounded numeric/color patches.
const send = globalThis.postMessage.bind(globalThis);
const actors = new Map<
  string,
  {
    state: Record<string, any>;
    run: (dt: number, time: number, input: Record<string, boolean>) => void;
    close?: () => void;
  }
>();
let logs: string[] = [];
let commands: any[] = [];
let sceneStates: Record<string, any> = {};
let volume: any = null;
const push = (command: any) => {
  if (commands.length >= 256)
    throw new Error("Limite de 256 comandos por tick.");
  commands.push(command);
};
function gameAPI(id: string, saved: any) {
  const index = (x: number, y: number, z: number) =>
    x + volume.size * (z + volume.size * y);
  const valid = (x: number, y: number, z: number) =>
    volume &&
    [x, y, z].every(Number.isInteger) &&
    x >= 0 &&
    x < volume.size &&
    z >= 0 &&
    z < volume.size &&
    y >= 0 &&
    y < volume.height;
  return Object.freeze({
    ...helpers,
    saved,
    walk: (id: string, x: number, z: number, speed: number) =>
      push({ type: "walk", id, x, z, speed }),
    rotate: (id: string, speed: number) => push({ type: "rotate", id, speed }),
    stop: (id: string) => push({ type: "stop", id }),
    bot: (id: string, mode: string) => push({ type: "bot", id, mode }),
    light: (id: string, patch: any) => push({ type: "light", id, patch }),
    flicker: (id: string, duration = 2, amount = 0.6) =>
      push({ type: "flicker", id, duration, amount }),
    torch: (enabled = true, patch: any = null) =>
      push({ type: "torch", enabled, patch }),
    /** objeto segurado na mao livre (view model) */
    hand: (kind = "nenhum", seconds = 0) =>
      push({ type: "hand", kind: String(kind), seconds }),
    /** tremor de camera (impacto, susto, passo pesado) */
    shake: (amount = 0.5, seconds = 0.4) =>
      push({ type: "shake", amount, seconds }),
    sound: (name: string, volume = 1, pitch = 1) =>
      push({ type: "sound", name, volume, pitch }),
    loop: (name: string, volume = 1) => push({ type: "loop", name, volume }),
    volume: (value: number) => push({ type: "volume", value }),
    move: (id: string, patch: any, seconds = 0.4) =>
      push({ type: "move", id, patch, seconds }),
    damage: (id: string, amount: number) =>
      push({ type: "damage", id, amount }),
    heal: (id: string, amount: number) => push({ type: "heal", id, amount }),
    ragdoll: (id: string, enabled = true) =>
      push({ type: "ragdoll", id, enabled }),
    impulse: (id: string, x: number, y: number, z: number) =>
      push({ type: "impulse", id, x, y, z }),
    get: (id: string) => (sceneStates[id] ? { ...sceneStates[id] } : null),
    set: (id: string, patch: any) => push({ type: "set", id, patch }),
    spawn: (id: string, patch: any) => push({ type: "spawn", id, patch }),
    remove: (id: string) => push({ type: "remove", id }),
    ui: (id: string, patch: any) => push({ type: "ui", id, patch }),
    respawn: () => push({ type: "respawn" }),
    freeze: (value: boolean) => push({ type: "freeze", value }),
    sky: (elevation: number, azimuth: number) =>
      push({ type: "sky", elevation, azimuth }),
    store: (data: any) => {
      const text = JSON.stringify(data);
      if (text.length > 500000) throw new Error("Save excede 500 KB.");
      push({ type: "store", id, text });
    },
    voxel: Object.freeze({
      size: volume?.size ?? 0,
      height: volume?.height ?? 0,
      get: (x: number, y: number, z: number) =>
        valid(x, y, z) ? volume.blocks[index(x, y, z)] : 0,
      set: (x: number, y: number, z: number, block: number) => {
        if (
          !valid(x, y, z) ||
          !Number.isInteger(block) ||
          block < 0 ||
          block > volume.palette.length
        )
          return false;
        volume.blocks[index(x, y, z)] = block;
        push({ type: "voxel", cell: [x, y, z], block });
        return true;
      },
      snapshot: () => (volume ? [...volume.blocks] : []),
      replace: (blocks: number[]) => {
        if (
          !volume ||
          !Array.isArray(blocks) ||
          blocks.length !== volume.blocks.length ||
          blocks.some(
            (v) => !Number.isInteger(v) || v < 0 || v > volume.palette.length,
          )
        )
          throw new Error("Volume salvo incompatível.");
        volume.blocks = [...blocks];
        push({ type: "voxelReset", blocks });
      },
    }),
  });
}
const log = (...args: any[]) => {
  if (logs.length < 8)
    logs.push(args.map((a) => String(a).slice(0, 200)).join(" "));
};
const data = (L: any, value: any) => {
  if (typeof value === "number") lua.lua_pushnumber(L, value);
  else if (typeof value === "boolean") lua.lua_pushboolean(L, value);
  else if (typeof value === "string")
    lua.lua_pushstring(L, to_luastring(value));
  else if (value && typeof value === "object") {
    lua.lua_newtable(L);
    for (const [k, v] of Object.entries(value)) {
      data(L, v);
      lua.lua_setfield(L, -2, to_luastring(k));
    }
  } else lua.lua_pushnil(L);
};
/** Converte tabelas Lua simples (números/textos/booleanos) em objetos JS validados no thread principal. */
const readTable = (L: any, index: number): any => {
  const value: any = {};
  lua.lua_pushnil(L);
  while (lua.lua_next(L, index < 0 ? index - 1 : index) !== 0) {
    const key = lua.lua_type(L, -2) === lua.LUA_TSTRING
      ? to_jsstring(lua.lua_tostring(L, -2))
      : String(lua.lua_tonumber(L, -2));
    const type = lua.lua_type(L, -1);
    if (type === lua.LUA_TNUMBER) value[key] = lua.lua_tonumber(L, -1);
    else if (type === lua.LUA_TSTRING)
      value[key] = to_jsstring(lua.lua_tostring(L, -1));
    else if (type === lua.LUA_TBOOLEAN) value[key] = !!lua.lua_toboolean(L, -1);
    lua.lua_pop(L, 1);
  }
  return value;
};
const readError = (L: any) => {
  const text = lua.lua_tostring(L, -1);
  const result = text ? to_jsstring(text) : "Erro Lua";
  lua.lua_pop(L, 1);
  return result;
};
function createLua(source: string, state: Record<string, any>, nodeId = "") {
  const L = lauxlib.luaL_newstate();
  for (const [name, open] of [
    ["_G", lualib.luaopen_base],
    ["math", lualib.luaopen_math],
    ["string", lualib.luaopen_string],
    ["table", lualib.luaopen_table],
    ["utf8", lualib.luaopen_utf8],
  ] as const) {
    lauxlib.luaL_requiref(L, to_luastring(name), open, 1);
    lua.lua_pop(L, 1);
  }
  for (const k of ["dofile", "loadfile", "load", "collectgarbage"]) {
    lua.lua_pushnil(L);
    lua.lua_setglobal(L, to_luastring(k));
  }
  const print = (l: any) => {
    const arr = [];
    for (let i = 1; i <= lua.lua_gettop(l); i++) {
      const s = lauxlib.luaL_tolstring(l, i);
      arr.push(to_jsstring(s));
      lua.lua_pop(l, 1);
    }
    log(...arr);
    return 0;
  };
  lua.lua_pushjsfunction(L, print);
  lua.lua_setglobal(L, to_luastring("print"));
  lua.lua_newtable(L);
  lua.lua_pushjsfunction(L, print);
  lua.lua_setfield(L, -2, to_luastring("log"));
  lua.lua_setglobal(L, to_luastring("engine"));
  // Lua counterparts for programmable actors; same validated command bridge as JS.
  lua.lua_getglobal(L, to_luastring("engine"));
  for (const name of [
    "bot",
    "damage",
    "heal",
    "ragdoll",
    "impulse",
    "walk",
    "rotate",
    "stop",
    "light",
    "flicker",
    "torch",
    "sound",
    "loop",
    "volume",
    "move",
    "set",
    "spawn",
    "remove",
    "ui",
    "freeze",
    "respawn",
    "sky",
    "shake",
    "hand",
  ]) {
    lua.lua_pushjsfunction(L, (l: any) => {
      if (name === "freeze")
        return (
          push({
            type: "freeze",
            value:
              lua.lua_gettop(l) < 1 ? true : !!lua.lua_toboolean(l, 1),
          }),
          0
        );
      if (name === "respawn") return (push({ type: "respawn" }), 0);
      if (name === "sky")
        return (
          push({
            type: "sky",
            elevation: lauxlib.luaL_checknumber(l, 1),
            azimuth: lauxlib.luaL_checknumber(l, 2),
          }),
          0
        );
      if (name === "shake")
        return (
          push({
            type: "shake",
            amount: lauxlib.luaL_optnumber(l, 1, 0.5),
            seconds: lauxlib.luaL_optnumber(l, 2, 0.4),
          }),
          0
        );
      if (name === "hand")
        return (
          push({
            type: "hand",
            kind: to_jsstring(lauxlib.luaL_optstring(l, 1, "nenhum")),
            seconds: lauxlib.luaL_optnumber(l, 2, 0),
          }),
          0
        );
      const id = to_jsstring(lauxlib.luaL_checkstring(l, 1));
      if (name === "walk")
        push({
          type: "walk",
          id,
          x: lauxlib.luaL_checknumber(l, 2),
          z: lauxlib.luaL_checknumber(l, 3),
          speed: lauxlib.luaL_checknumber(l, 4),
        });
      if (name === "rotate")
        push({ type: "rotate", id, speed: lauxlib.luaL_checknumber(l, 2) });
      if (name === "stop") push({ type: "stop", id });
      if (name === "bot")
        push({
          type: "bot",
          id,
          mode: to_jsstring(lauxlib.luaL_checkstring(l, 2)),
        });
      if (name === "damage")
        push({ type: "damage", id, amount: lauxlib.luaL_checknumber(l, 2) });
      if (name === "heal")
        push({ type: "heal", id, amount: lauxlib.luaL_checknumber(l, 2) });
      if (name === "ragdoll")
        push({
          type: "ragdoll",
          id,
          enabled: lua.lua_gettop(l) < 2 ? true : !!lua.lua_toboolean(l, 2),
        });
      if (name === "impulse")
        push({
          type: "impulse",
          id,
          x: lauxlib.luaL_checknumber(l, 2),
          y: lauxlib.luaL_checknumber(l, 3),
          z: lauxlib.luaL_checknumber(l, 4),
        });
      if (name === "light")
        push({ type: "light", id, patch: readTable(l, 2) });
      if (name === "flicker")
        push({
          type: "flicker",
          id,
          duration: lauxlib.luaL_optnumber(l, 2, 2),
          amount: lauxlib.luaL_optnumber(l, 3, 0.6),
        });
      if (name === "torch")
        push({
          type: "torch",
          enabled: lua.lua_gettop(l) < 2 ? true : !!lua.lua_toboolean(l, 2),
          patch: lua.lua_gettop(l) < 3 ? null : readTable(l, 3),
        });
      if (name === "sound")
        push({
          type: "sound",
          name: to_jsstring(lauxlib.luaL_checkstring(l, 2)),
          volume: lauxlib.luaL_optnumber(l, 3, 1),
          pitch: lauxlib.luaL_optnumber(l, 4, 1),
        });
      if (name === "loop")
        push({
          type: "loop",
          name: to_jsstring(lauxlib.luaL_checkstring(l, 2)),
          volume: lauxlib.luaL_optnumber(l, 3, 1),
        });
      if (name === "volume")
        push({ type: "volume", value: lauxlib.luaL_checknumber(l, 2) });
      if (name === "move")
        push({
          type: "move",
          id,
          patch: readTable(l, 2),
          seconds: lauxlib.luaL_optnumber(l, 3, 0.4),
        });
      if (name === "set") push({ type: "set", id, patch: readTable(l, 2) });
      if (name === "spawn") push({ type: "spawn", id, patch: readTable(l, 2) });
      if (name === "remove") push({ type: "remove", id });
      if (name === "ui") push({ type: "ui", id, patch: readTable(l, 2) });
      return 0;
    });
    lua.lua_setfield(L, -2, to_luastring(name));
  }
  lua.lua_pop(L, 1);
  /* leitura de estado e save: mesmas regras do JavaScript */
  lua.lua_getglobal(L, to_luastring("engine"));
  lua.lua_pushjsfunction(L, (l: any) => {
    const id = to_jsstring(lauxlib.luaL_checkstring(l, 1)),
      state = sceneStates[id];
    if (!state) {
      lua.lua_pushnil(L);
      return 1;
    }
    data(L, state);
    return 1;
  });
  lua.lua_setfield(L, -2, to_luastring("get"));
  lua.lua_pushjsfunction(L, (l: any) => {
    const text = JSON.stringify(readTable(l, 1));
    if (text.length > 500000)
      lauxlib.luaL_error(l, to_luastring("Save excede 500 KB."));
    push({ type: "store", id: nodeId, text });
    return 0;
  });
  lua.lua_setfield(L, -2, to_luastring("store"));
  lua.lua_pop(L, 1);
  const budget = () =>
    lua.lua_sethook(
      L,
      (l: any) =>
        lauxlib.luaL_error(
          l,
          to_luastring("Limite de 50.000 instruções por atualização excedido."),
        ),
      lua.LUA_MASKCOUNT,
      50000,
    );
  const helperSource = `
function engine.clamp(v, a, b) return math.max(a, math.min(b, v)) end
function engine.torchOn(enabled, patch) return engine.torch(enabled, patch) end
function engine.lerp(a, b, t) return a + (b - a) * t end
function engine.distance(ax, ay, az, bx, by, bz) return math.sqrt((ax-bx)^2+(ay-by)^2+(az-bz)^2) end
`;
  lauxlib.luaL_loadstring(L, to_luastring(helperSource));
  lua.lua_pcall(L, 0, 0, 0);
  data(L, state);
  lua.lua_setglobal(L, to_luastring("self"));
  budget();
  if (
    lauxlib.luaL_loadstring(L, to_luastring(source)) !== lua.LUA_OK ||
    lua.lua_pcall(L, 0, 0, 0) !== lua.LUA_OK
  ) {
    const e = readError(L);
    lua.lua_close(L);
    throw new Error(e);
  }
  let started = false;
  return {
    close: () => lua.lua_close(L),
    run: (dt: number, time: number, input: Record<string, boolean>) => {
      budget();
      lua.lua_getglobal(L, to_luastring("self"));
      if (!lua.lua_istable(L, -1)) {
        lua.lua_pop(L, 1);
        throw new Error("self deve continuar sendo uma tabela.");
      }
      for (const [key, value] of Object.entries(state)) {
        data(L, value);
        lua.lua_setfield(L, -2, to_luastring(key));
      }
      lua.lua_pop(L, 1);
      if (!started) {
        started = true;
        lua.lua_getglobal(L, to_luastring("start"));
        if (lua.lua_isfunction(L, -1)) {
          if (lua.lua_pcall(L, 0, 0, 0) !== lua.LUA_OK)
            throw new Error(readError(L));
        } else lua.lua_pop(L, 1);
      }
      lua.lua_getglobal(L, to_luastring("update"));
      if (!lua.lua_isfunction(L, -1)) {
        lua.lua_pop(L, 1);
        throw new Error("Defina function update(dt, time, input).");
      }
      lua.lua_pushnumber(L, dt);
      lua.lua_pushnumber(L, time);
      data(L, input);
      if (lua.lua_pcall(L, 3, 0, 0) !== lua.LUA_OK)
        throw new Error(readError(L));
      lua.lua_getglobal(L, to_luastring("self"));
      if (!lua.lua_istable(L, -1)) {
        lua.lua_pop(L, 1);
        throw new Error("self deve continuar sendo uma tabela.");
      }
      for (const k of Object.keys(state)) {
        lua.lua_getfield(L, -1, to_luastring(k));
        const t = lua.lua_type(L, -1);
        if (t === lua.LUA_TNUMBER) state[k] = lua.lua_tonumber(L, -1);
        else if (t === lua.LUA_TSTRING)
          state[k] = to_jsstring(lua.lua_tostring(L, -1));
        else if (t === lua.LUA_TBOOLEAN) state[k] = lua.lua_toboolean(L, -1);
        lua.lua_pop(L, 1);
      }
      lua.lua_pop(L, 1);
    },
  };
}
const helpers = Object.freeze({
  log,
  clamp: (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v)),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  distance: (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
  ) => Math.hypot(ax - bx, ay - by, az - bz),
});
const handler = (event: MessageEvent) => {
  const msg = event.data;
  logs = [];
  commands = [];
  if (msg.type === "init") {
    for (const a of actors.values()) a.close?.();
    actors.clear();
    volume = msg.volume ?? null;
    sceneStates = msg.states ?? {};
    for (const n of msg.nodes.slice(0, 32))
      try {
        const state = { ...n.state };
        const actor =
          n.language === "lua"
            ? createLua(n.source, state, n.id)
            : {
                run: new Function(
                  "self",
                  "engine",
                  `"use strict";\n${n.source}\n;if(typeof update!=="function")throw new Error("Defina function update(dt, time, input).");let started=false;return (dt,time,input)=>{if(!started){started=true;if(typeof start==="function")start();}update(dt,time,input);};`,
                )(state, gameAPI(n.id, n.saved ?? null)),
              };
        actors.set(n.id, { state, ...actor });
      } catch (e) {
        log(`${n.name}: ${String(e)}`);
      }
    send({ type: "ready", logs, commands });
    return;
  }
  if (msg.type === "tick") {
    sceneStates = msg.states ?? {};
    const patches = [];
    for (const n of msg.nodes) {
      const a = actors.get(n.id);
      if (!a) continue;
      Object.assign(a.state, n.state);
      try {
        a.run(msg.dt, msg.time, msg.input);
        const changed = Object.fromEntries(
          Object.entries(a.state).filter(
            ([k, v]) => k in n.state && v !== n.state[k],
          ),
        );
        patches.push({ id: n.id, state: changed });
      } catch (e) {
        log(`${n.name}: ${String(e)}`);
        a.close?.();
        actors.delete(n.id);
      }
    }
    send({ type: "result", patches, logs, commands });
  }
};
globalThis.addEventListener("message", handler);
// Reduce available capabilities. This is not a formally audited hostile-code sandbox.
for (const key of [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "Worker",
  "SharedWorker",
  "importScripts",
  "BroadcastChannel",
  "indexedDB",
  "caches",
  "setTimeout",
  "setInterval",
  "postMessage",
  "close",
]) {
  try {
    Object.defineProperty(globalThis, key, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  } catch {}
}
