import { prefab06Names, prefab06, type Prefab06 } from "./prefabs06";
import { prefab07Names, prefab07, type Prefab07 } from "./prefabs07";
import { terrainPatch } from "./design";
import { extraNames, extraPrefab, type ExtraPrefab } from "./catalog";
import {
  makeNode,
  createProject,
  uid,
  type Node3D,
  type Project,
} from "./model";
import { platforms } from "./parkour-level";
export const prefabNames = {
  ...prefab06Names,
  ...prefab07Names,
  ...extraNames,
  stairs: "Escada",
  bridge: "Ponte",
  checkpoint: "Checkpoint",
  finish: "Chegada",
  hazard: "Zona de dano",
  player: "Jogador",
};
export type Prefab = keyof typeof prefabNames;
export function prefab(kind: Prefab): Node3D[] {
  if (kind in prefab07Names) return prefab07(kind as Prefab07);
  if (kind in prefab06Names) return prefab06(kind as Prefab06);
  if (kind in extraNames) return extraPrefab(kind as ExtraPrefab);
  if (kind === "player")
    return [
      makeNode("box", {
        name: "Jogador",
        position: [0, 1.2, 0],
        scale: [0.6, 1.7, 0.6],
        physics: "dynamic",
        behavior: "player",
        speed: 5.4,
        restitution: 0,
        color: "#eabf82",
      }),
    ];
  if (kind === "checkpoint")
    return [
      makeNode("cylinder", {
        name: "Checkpoint",
        position: [0, 0.08, 0],
        scale: [2.7, 0.12, 2.7],
        behavior: "checkpoint",
        color: "#6be5c1",
      }),
    ];
  if (kind === "finish")
    return [
      makeNode("box", {
        name: "Chegada",
        position: [0, 1.5, 0],
        scale: [3, 3, 0.15],
        behavior: "finish",
        color: "#e9ba77",
      }),
    ];
  if (kind === "hazard")
    return [
      makeNode("box", {
        name: "Zona de dano",
        position: [0, 0.2, 0],
        scale: [4, 0.4, 4],
        behavior: "hazard",
        color: "#e9796f",
      }),
    ];
  const parent = makeNode("group", {
      name: prefabNames[kind],
      position: [0, 0, 0],
    }),
    nodes = [parent];
  const count = kind === "stairs" ? 6 : 5;
  for (let i = 0; i < count; i++)
    nodes.push(
      makeNode("box", {
        name: kind === "stairs" ? `Degrau ${i + 1}` : `Vão ${i + 1}`,
        parent: parent.id,
        position: [0, kind === "stairs" ? 0.2 + i * 0.4 : 0, -i * 1.2],
        scale: [3, kind === "stairs" ? 0.4 : 0.25, 1.2],
        physics: "static",
        color: "#bdcbbd",
        restitution: 0,
      }),
    );
  return nodes;
}
export function parkourProject(): Project {
  const nodes: Node3D[] = [];
  platforms.forEach((p, i) => {
    nodes.push(
      makeNode("box", {
        id: `platform-${i}`,
        name: `${String(i + 1).padStart(2, "0")} · ${p.finish ? "Chegada" : p.checkpoint ? "Base segura" : "Plataforma"}`,
        position: [p.x, p.y - 0.45, p.z],
        scale: [p.w, 0.9, p.d],
        physics: "static",
        color: p.checkpoint ? "#527e7f" : "#c7c6b2",
        restitution: 0,
      }),
    );
    nodes.push(
      makeNode("box", {
        name: `Borda ${i + 1}`,
        position: [p.x, p.y + 0.018, p.z - p.d / 2 + 0.1],
        scale: [p.w - 0.12, 0.035, 0.13],
        color: p.checkpoint ? "#80edd3" : "#ee9878",
        locked: true,
      }),
    );
    if (p.crystal)
      nodes.push(
        makeNode("sphere", {
          id: `crystal-${i}`,
          name: "Cristal",
          position: [p.x, p.y + 1.15, p.z],
          scale: [0.48, 0.72, 0.48],
          behavior: "collectible",
          color: "#89eacf",
        }),
      );
    if (p.checkpoint && i > 0)
      nodes.push(
        makeNode("cylinder", {
          id: `checkpoint-${i}`,
          name: `Checkpoint ${[5, 9, 14].indexOf(i) + 1}`,
          position: [p.x, p.y + 0.035, p.z + 0.6],
          scale: [2.7, 0.06, 2.7],
          behavior: "checkpoint",
          color: "#77dabc",
        }),
      );
  });
  const last = platforms[platforms.length - 1];
  for (const side of [-1, 1])
    nodes.push(
      makeNode("box", {
        name: "Portal • Coluna",
        position: [last.x + side * 2, last.y + 1.7, last.z - 1.5],
        scale: [0.3, 3.4, 0.3],
        color: "#f2b77a",
      }),
    );
  nodes.push(
    makeNode("box", {
      name: "Portal • Travessa",
      position: [last.x, last.y + 3.3, last.z - 1.5],
      scale: [4.3, 0.3, 0.3],
      color: "#f2b77a",
    }),
  );
  nodes.push(
    makeNode("cylinder", {
      name: "Final do percurso",
      position: [last.x, last.y + 0.04, last.z - 1.3],
      scale: [3.5, 0.06, 2.7],
      behavior: "finish",
      color: "#f2b77a",
    }),
  );
  nodes.push(
    ...prefab("player").map((n) => ({
      ...n,
      id: "parkour-player",
      position: [0, 1.1, 1.8] as [number, number, number],
    })),
  );
  return {
    format: "gameforge",
    version: 7,
    name: "Skyline • Parkour FPS",
    activeScene: "skyline",
    scenes: [{ id: "skyline", name: "Skyline · 20 plataformas", nodes }],
    settings: { background: "#526c7e", gravity: -9.81, gameCamera: "first" },
  };
}
export function scriptingProject(): Project {
  const p = createProject();
  p.name = "Laboratório Lua + JavaScript";
  p.scenes[0].name = "Scripts em ação";
  p.scenes[0].nodes = [
    makeNode("box", {
      name: "Base",
      position: [0, -0.2, 0],
      scale: [12, 0.4, 10],
      physics: "static",
      color: "#506a60",
    }),
    makeNode("box", {
      name: "Cubo • Lua",
      position: [-2, 1, 0],
      color: "#7fb7ed",
      script: {
        language: "lua",
        enabled: true,
        source:
          "-- Lua 5.3 via Fengari\nfunction update(dt, time, input)\n  self.ry = self.ry + dt * 50\n  self.y = 1.5 + math.sin(time) * 0.5\nend",
      },
    }),
    makeNode("sphere", {
      name: "Esfera • JavaScript",
      position: [2, 1, 0],
      color: "#e7ba80",
      script: {
        language: "javascript",
        enabled: true,
        source:
          "function update(dt, time, input) {\n  self.y = 1.5 + Math.cos(time) * 0.5;\n  self.rx += dt * 40;\n}",
      },
    }),
  ];
  return p;
}
export function emptyProject() {
  const p = createProject();
  p.name = "Projeto vazio";
  p.scenes = [{ id: uid(), name: "Cena principal", nodes: [] }];
  p.activeScene = p.scenes[0].id;
  return p;
}

/** A compact, editable showcase for Studio 0.4. */
export function studioProject(): Project {
  const p = createProject();
  p.name = "Ateliê 0.4 · Design, Lua e física";
  p.scenes[0].name = "Ateliê interativo";
  const nodes = terrainPatch();
  for (const n of nodes.filter((n) => n.terrain)) {
    if (Math.abs(n.position[0]) < 2) {
      n.color = "#d8be84";
      n.roughness = 1;
    }
    if (n.position[0] < -3 && n.position[2] < -3) {
      const h = 1 + (Math.abs(n.position[0]) - 3) * 0.25;
      n.scale[1] = h;
      n.position[1] = h / 2;
    }
  }
  const place = (
    kind: Prefab,
    position: [number, number, number],
    scale = 1,
  ) => {
    const ns = prefab(kind);
    ns[0].position = position;
    ns[0].scale = [scale, scale, scale];
    nodes.push(...ns);
  };
  place("house", [3.8, 1, -3], 0.7);
  place("tree", [-5, 1, 2]);
  place("pine", [-5, 2.2, -5]);
  place("bench", [4, 1, 3], 0.8);
  place("flower", [-2, 1, 3]);
  place("barrel", [6, 1, 1]);
  place("bounceBall", [-3, 1, 0]);
  const player = prefab("player")[0];
  player.position = [0, 2.2, 5];
  player.speed = 7;
  nodes.push(player);
  nodes.push(
    makeNode("box", {
      name: "Escultura Lua · E muda a cor",
      position: [0, 2.1, -3],
      color: "#79d8bf",
      script: {
        language: "lua",
        enabled: true,
        source: `-- Estado customizado em self persiste durante a execução.
function start()
  self.baseY = self.y
  self.alternate = false
  engine.log("Ateliê: WASD, Shift, Espaço; E muda a cor da escultura.")
end

function update(dt, time, input)
  self.ry = self.ry + 50 * dt
  self.y = self.baseY + math.sin(time * 2) * 0.25
  if input.pressed.e then
    self.alternate = not self.alternate
    self.color = self.alternate and "#edac80" or "#79d8bf"
    engine.log("Cor alterada!")
  end
end`,
      },
    }),
  );
  p.scenes[0].nodes = nodes;
  p.settings.gameCamera = "first";
  return p;
}
