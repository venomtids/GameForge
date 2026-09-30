import { movementClip } from "./animation";
import { baseMap } from "./maps";
import {
  createProject,
  makeNode,
  type Node3D,
  type Project,
  type Vec3,
} from "./model";
import { prefab, parkourProject, scriptingProject } from "./templates";
export type StudioTemplate =
  | "aurora"
  | "baseplate"
  | "obby"
  | "animation"
  | "scripts"
  | "empty";
export const studioTemplates: {
  id: StudioTemplate;
  name: string;
  description: string;
  badge: string;
  art: string;
}[] = [
  {
    id: "aurora",
    name: "Ilha Aurora",
    description: "Explore, colete cristais e alcance o portal.",
    badge: "JOGO PRONTO",
    art: "island",
  },
  {
    id: "baseplate",
    name: "Baseplate",
    description: "Chão, céu e personagem. O resto é sua ideia.",
    badge: "COMECE AQUI",
    art: "baseplate",
  },
  {
    id: "obby",
    name: "Skyline Obby",
    description: "20 plataformas, checkpoints e desafios.",
    badge: "PARKOUR",
    art: "obby",
  },
  {
    id: "animation",
    name: "Motion Lab",
    description: "Keyframes, loops e uma plataforma móvel.",
    badge: "ANIMAÇÃO",
    art: "motion",
  },
  {
    id: "scripts",
    name: "Laboratório de scripts",
    description: "Exemplos editáveis de Lua e JavaScript.",
    badge: "PROGRAMAÇÃO",
    art: "scripts",
  },
  {
    id: "empty",
    name: "Projeto vazio",
    description: "Uma cena limpa para criar do seu jeito.",
    badge: "EM BRANCO",
    art: "empty",
  },
];
export function auroraProject(): Project {
  const p = createProject(),
    nodes: Node3D[] = [];
  p.name = "Ilha Aurora";
  p.scenes[0].name = "Aurora · Mundo principal";
  p.settings.background = "#344b60";
  p.settings.sky = {
    enabled: true,
    clouds: true,
    sunElevation: 44,
    sunAzimuth: 135,
  };
  p.settings.gameCamera = "third";
  p.settings.shadows = {
    enabled: true,
    filter: "soft",
    resolution: 1024,
    coverage: 35,
    intensity: 0.7,
    bias: -0.0003,
    normalBias: 0.02,
    softness: 2,
    sunPower: 2.5,
    ambientPower: 1.2,
    follow: true,
  };
  nodes.push(
    makeNode("cylinder", {
      name: "Aurora · ilha central",
      position: [0, -0.7, 0],
      scale: [18, 1.4, 18],
      color: "#679d7b",
      physics: "static",
      friction: 0.6,
    }),
  );
  nodes.push(
    makeNode("cylinder", {
      name: "Camada de pedra",
      position: [0, -1.65, 0],
      scale: [16.8, 1.2, 16.8],
      color: "#547485",
      roughness: 1,
    }),
  );
  nodes.push(
    makeNode("cone", {
      name: "Base da ilha flutuante",
      position: [0, -4.9, 0],
      rotation: [180, 0, 0],
      scale: [16, 6.6, 16],
      color: "#47606e",
      roughness: 1,
    }),
  );
  for (let i = 0; i < 7; i++) {
    const z = 5.3 - i * 1.5;
    nodes.push(
      makeNode("cylinder", {
        name: `Caminho · ${i + 1}`,
        position: [Math.sin(i * 0.6) * 0.7, 0.03, z],
        scale: [1.35, 0.09, 1.05],
        color: "#dfdcc1",
      }),
    );
  }
  const trees: Vec3[] = [
    [-5.5, 0, 1.5],
    [-5.5, 0, -4],
    [5.6, 0, -3.2],
    [5.5, 0, 3.8],
    [-3.5, 0, 5.5],
  ];
  trees.forEach((position, i) => {
    const group = makeNode("group", { name: `Pinheiro ${i + 1}`, position });
    const height = 1 + (i % 3) * 0.15;
    nodes.push(
      group,
      makeNode("cylinder", {
        name: "Tronco",
        parent: group.id,
        position: [0, 0.65, 0],
        scale: [0.4, 1.3, 0.4],
        color: "#8b7160",
        physics: "static",
      }),
      makeNode("cone", {
        name: "Copa inferior",
        parent: group.id,
        position: [0, 1.9 * height, 0],
        scale: [2.4, 2.7 * height, 2.4],
        color: i % 2 ? "#67b395" : "#4b947e",
      }),
      makeNode("cone", {
        name: "Copa superior",
        parent: group.id,
        position: [0, 2.8 * height, 0],
        scale: [1.7, 2.2 * height, 1.7],
        color: "#8ac8a0",
      }),
    );
  });
  for (const [i, position] of (
    [
      [-3.5, 0.6, -1],
      [3.5, 0.6, 1.5],
      [-4.2, 0.6, 3.5],
      [3.5, 0.6, -4],
    ] as Vec3[]
  ).entries())
    nodes.push(
      makeNode("star", {
        name: `Cristal ${i + 1}`,
        position,
        rotation: [0, 0, 15],
        scale: [0.65, 0.9, 0.65],
        color: "#8ee8ee",
        metalness: 0.4,
        roughness: 0.2,
        behavior: "collectible",
      }),
    );
  nodes.push(
    makeNode("arch", {
      name: "Portal · chegada",
      position: [0, 1.9, -5.8],
      scale: [3, 3.6, 0.65],
      color: "#dbbd80",
      metalness: 0.25,
      physics: "static",
    }),
    makeNode("torus", {
      name: "Energia do portal",
      position: [0, 1.8, -5.7],
      scale: [2.4, 2.8, 0.4],
      color: "#9befe0",
      roughness: 0.15,
      metalness: 0.6,
      behavior: "finish",
    }),
  );
  for (let i = 0; i < 5; i++)
    nodes.push(
      makeNode("rock", {
        name: `Pedra ${i + 1}`,
        position: [Math.cos(i * 1.2) * 7, 0.3, Math.sin(i * 1.2) * 7],
        scale: [1.1, 0.75, 0.9],
        color: "#9baea6",
        physics: "static",
      }),
    );
  const relic = makeNode("box", {
    name: "Relíquia · keyframes",
    position: [2.7, 1.8, -2.5],
    rotation: [15, 25, 15],
    scale: [0.6, 0.6, 0.6],
    color: "#dfb67a",
    metalness: 0.45,
  });
  relic.animation = movementClip(relic);
  nodes.push(relic);
  const player = prefab("humanoidPlayer")[0];
  player.name = "Explorador";
  player.position = [0, 1.2, 5.5];
  player.speed = 6;
  nodes.push(player);
  p.settings.playerId = player.id;
  p.scenes[0].nodes = nodes;
  return p;
}
export function templateProject(id: StudioTemplate): Project {
  if (id === "aurora") return auroraProject();
  if (id === "obby") return parkourProject();
  if (id === "scripts") return scriptingProject();
  const p = baseMap("grass");
  if (id === "empty") {
    p.name = "Projeto sem título";
    p.scenes[0].name = "Cena principal";
    p.scenes[0].nodes = [];
    delete p.settings.playerId;
    return p;
  }
  p.name = id === "animation" ? "Motion Lab" : "Meu novo mundo";
  p.scenes[0].name =
    id === "animation" ? "Experimentos de movimento" : "Baseplate";
  p.settings.gameCamera = "third";
  p.scenes[0].nodes[0].color = "#819b90";
  const player = prefab("humanoidPlayer")[0];
  player.position = [0, 1.5, 7];
  p.scenes[0].nodes[1] = player;
  p.settings.playerId = player.id;
  if (id === "animation") {
    const platform = makeNode("box", {
      name: "Plataforma móvel",
      position: [-3, 1, 0],
      scale: [3, 0.4, 3],
      color: "#84d7c5",
      physics: "static",
      friction: 0.7,
    });
    platform.animation = movementClip(platform);
    const sculpture = makeNode("torus", {
      name: "Anel animado",
      position: [3, 2, 0],
      scale: [2, 2, 2],
      color: "#d8b582",
      metalness: 0.6,
    });
    sculpture.animation = {
      ...movementClip(sculpture),
      frames: [
        {
          time: 0,
          position: [...sculpture.position],
          rotation: [0, 0, 0],
          scale: [2, 2, 2],
        },
        {
          time: 4,
          position: [...sculpture.position],
          rotation: [0, 360, 0],
          scale: [2, 2, 2],
        },
      ],
      interpolation: "linear",
    };
    p.scenes[0].nodes.push(platform, sculpture);
  }
  return p;
}
