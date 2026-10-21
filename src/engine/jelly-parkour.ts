import { createProject, makeNode, type Node3D, type Project } from "./model";
import { prefab06 } from "./prefabs06";

/** Centers are reachable using the shipped controller, including at 30 FPS.
 * y is the unloaded top surface. All eleven landing surfaces are elastic. */
export const jellyPlatforms: {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  checkpoint?: boolean;
  crystal?: boolean;
  boost?: boolean;
  finish?: boolean;
}[] = [
  { x: 0, y: 0, z: 0, w: 8, d: 8 },
  { x: 0, y: 0.25, z: -6, w: 4, d: 4 },
  { x: 1.5, y: 0.65, z: -10, w: 3.8, d: 3.8, crystal: true },
  { x: -1.2, y: 1, z: -14, w: 3.8, d: 3.8 },
  { x: 0, y: 1.35, z: -18, w: 6, d: 6, checkpoint: true, crystal: true },
  { x: 0.5, y: 1.55, z: -23, w: 4, d: 4, boost: true },
  { x: 2.7, y: 2.05, z: -28, w: 4.4, d: 4.4, crystal: true },
  { x: -0.4, y: 2.25, z: -32.5, w: 4, d: 4 },
  { x: -2.5, y: 2.6, z: -37, w: 6, d: 6, checkpoint: true },
  { x: -1, y: 2.85, z: -42, w: 3.5, d: 5, crystal: true },
  { x: 1.3, y: 3, z: -47, w: 8, d: 7, finish: true, crystal: true },
];
export function jellyParkourProject(): Project {
  const p = createProject(),
    nodes: Node3D[] = [];
  p.name = "Jelly Jump · Parkour de gelatina";
  p.scenes[0].id = p.activeScene = "jelly-jump";
  p.scenes[0].name = "Jelly Jump · 11 ilhas elásticas";
  p.settings.background = "#465d7e";
  p.settings.sky = {
    enabled: true,
    clouds: true,
    sunElevation: 36,
    sunAzimuth: 135,
  };
  p.settings.gameCamera = "third";
  p.settings.jumpSpeed = 7.5;
  p.settings.physicsHz = 120;
  p.settings.solverIterations = 18;
  p.settings.shadows = {
    enabled: true,
    filter: "soft",
    resolution: 1024,
    coverage: 32,
    intensity: 0.65,
    bias: -0.0003,
    normalBias: 0.025,
    softness: 2,
    sunPower: 2.4,
    ambientPower: 1.5,
    follow: true,
  };
  const colors = ["#90e7bd", "#f5b6d4", "#afa7ee", "#87d9eb"];
  let checkpoint = 0;
  jellyPlatforms.forEach((stage, i) => {
    const platform = prefab06("jellyPlatform")[0];
    platform.id = `jelly-stage-${i}`;
    platform.name = `${String(i + 1).padStart(2, "0")} · ${stage.boost ? "Gelatina de impulso" : stage.finish ? "Chegada açucarada" : stage.checkpoint ? "Base segura de gelatina" : "Ilha de gelatina"}`;
    platform.position = [stage.x, stage.y - 0.6, stage.z];
    platform.scale = [stage.w, 1.2, stage.d];
    platform.color = stage.boost
      ? "#ffd08a"
      : stage.checkpoint
        ? "#91efc4"
        : colors[i % colors.length];
    platform.restitution = stage.boost ? 0.85 : 0.05;
    nodes.push(platform);
    // Decorative plinth, deliberately no collider or extra active elastic rig.
    nodes.push(
      makeNode("box", {
        name: `Base cristalina ${i + 1}`,
        position: [stage.x, stage.y - 1.3, stage.z],
        scale: [stage.w * 0.86, 0.2, stage.d * 0.86],
        color: "#526888",
        physics: "none",
        roughness: 0.25,
        metalness: 0.25,
      }),
    );
    if (stage.crystal)
      nodes.push(
        makeNode("sphere", {
          id: `jelly-crystal-${i}`,
          name: `Doce de luz ${i + 1}`,
          position: [stage.x, stage.y + 1, stage.z],
          scale: [0.5, 0.7, 0.5],
          behavior: "collectible",
          color: "#ffe5a0",
        }),
      );
    if (stage.checkpoint) {
      checkpoint++;
      nodes.push(
        makeNode("cylinder", {
          id: `jelly-checkpoint-${checkpoint}`,
          name: `Checkpoint ${checkpoint} · Jelly Jump`,
          position: [stage.x, stage.y + 0.015, stage.z],
          scale: [2.5, 0.03, 2.5],
          color: "#b1ffe1",
          behavior: "checkpoint",
        }),
      );
    }
    if (stage.boost || stage.checkpoint || i === 0 || stage.finish)
      for (const side of [-1, 1])
        nodes.push(
          makeNode("sphere", {
            name: stage.boost ? "Bolha de impulso" : "Bolha de açúcar",
            position: [
              stage.x + side * (stage.w / 2 - 0.45),
              stage.y + 0.38,
              stage.z,
            ],
            scale: [0.45, 0.6, 0.45],
            color: platform.color,
            physics: "none",
            roughness: 0.15,
            metalness: 0.15,
          }),
        );
  });
  const last = jellyPlatforms[jellyPlatforms.length - 1];
  for (const side of [-1, 1])
    nodes.push(
      makeNode("capsule", {
        name: "Portal · pilar de açúcar",
        position: [last.x + side * 2, last.y + 1.4, last.z - 1.5],
        scale: [0.45, 2.5, 0.45],
        color: "#f5bcdf",
        roughness: 0.2,
      }),
    );
  nodes.push(
    makeNode("torus", {
      name: "Portal · arco de chegada",
      position: [last.x, last.y + 2.7, last.z - 1.5],
      scale: [3.2, 2.1, 0.4],
      color: "#ffe3ab",
      roughness: 0.2,
    }),
    makeNode("cylinder", {
      id: "jelly-finish",
      name: "Chegada · cinco doces de luz",
      position: [last.x, last.y + 0.02, last.z - 1.2],
      scale: [3, 0.04, 3],
      color: "#ffe0a1",
      behavior: "finish",
    }),
  );
  const player = prefab06("jellyPlayer")[0];
  player.id = "jelly-player";
  player.position = [0, 1.4, 1.5];
  nodes.push(player);
  p.settings.playerId = player.id;
  p.scenes[0].nodes = nodes;
  return p;
}
