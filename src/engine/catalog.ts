import { makeNode, type Kind, type Node3D, type Vec3 } from "./model";
export const extraNames = {
  wall: "Parede",
  doorway: "Parede com porta",
  window: "Janela",
  arch: "Arco",
  column: "Coluna",
  ramp: "Rampa",
  platform: "Plataforma larga",
  tower: "Torre",
  house: "Casa",
  roof: "Telhado",
  fence: "Cerca",
  gate: "Portão",
  road: "Estrada",
  sidewalk: "Calçada",
  crossroad: "Cruzamento",
  barrier: "Barreira",
  tree: "Árvore",
  pine: "Pinheiro",
  palm: "Palmeira",
  bush: "Arbusto",
  rock: "Rocha",
  rockCluster: "Rochas agrupadas",
  flower: "Flor",
  mushroom: "Cogumelo",
  bench: "Banco",
  table: "Mesa",
  chair: "Cadeira",
  crate: "Caixote",
  barrel: "Barril",
  lamp: "Poste decorativo",
  sign: "Placa",
  fountain: "Fonte decorativa",
  coin: "Moeda coletável",
  crystal: "Cristal coletável",
  bounceBall: "Bola elástica",
  domino: "Dominó físico",
  target: "Alvo decorativo",
  spikes: "Espinhos de dano",
  stepping: "Pedras de travessia",
  spiral: "Escada em espiral",
};
export type ExtraPrefab = keyof typeof extraNames;
export function category(k: string) {
  if (
    [
      "lampCeiling",
      "lampFlicker",
      "lampCorridor",
      "spotlight",
      "npcHumanoid",
    ].includes(k)
  )
    return "Iluminação";
  if (
    [
      "humanoidPlayer",
      "ragdoll",
      "jelly",
      "jellyPlayer",
      "jellyPlatform",
      "botPatrol",
      "botFollow",
      "botAttack",
      "spinReady",
      "floatReady",
      "walkReady",
    ].includes(k)
  )
    return "Personagens e física";
  if (
    [
      "tree",
      "pine",
      "palm",
      "bush",
      "rock",
      "rockCluster",
      "flower",
      "mushroom",
    ].includes(k)
  )
    return "Natureza";
  if (
    [
      "bench",
      "table",
      "chair",
      "crate",
      "barrel",
      "lamp",
      "sign",
      "fountain",
    ].includes(k)
  )
    return "Decoração";
  if (
    [
      "coin",
      "crystal",
      "bounceBall",
      "domino",
      "target",
      "spikes",
      "stepping",
      "spiral",
      "player",
      "checkpoint",
      "finish",
      "hazard",
    ].includes(k)
  )
    return "Jogabilidade";
  return "Construção";
}
export function extraPrefab(kind: ExtraPrefab): Node3D[] {
  const root = makeNode("group", {
    name: extraNames[kind],
    position: [0, 0, 0],
  });
  const ns = [root];
  const part = (
    shape: Kind,
    p: Vec3,
    s: Vec3,
    color = "#b5c6c4",
    patch: Partial<Node3D> = {},
  ) => {
    const n = makeNode(shape, {
      name: extraNames[kind] + " · " + ns.length,
      parent: root.id,
      position: p,
      scale: s,
      color,
      physics: "static",
      restitution: 0,
      ...patch,
    });
    ns.push(n);
    return n;
  };
  const b = (p: Vec3, s: Vec3, c?: string, patch: Partial<Node3D> = {}) =>
    part("box", p, s, c, patch);
  const wood = "#98704e",
    leaf = "#538763",
    stone = "#899397";
  switch (kind) {
    case "wall":
      b([0, 1.5, 0], [6, 3, 0.3]);
      break;
    case "doorway":
      b([-2, 1.5, 0], [2, 3, 0.3]);
      b([2, 1.5, 0], [2, 3, 0.3]);
      b([0, 2.75, 0], [2, 0.5, 0.3]);
      break;
    case "window":
      b([0, 0.5, 0], [5, 1, 0.3]);
      b([0, 2.8, 0], [5, 0.4, 0.3]);
      for (const x of [-2, 2]) b([x, 1.8, 0], [1, 1.6, 0.3]);
      b([0, 1.8, 0], [0.12, 1.6, 0.2], wood);
      break;
    case "arch":
      for (const x of [-2, 2]) b([x, 1.5, 0], [0.6, 3, 0.8]);
      for (let i = 0; i < 7; i++) {
        const a = (i * Math.PI) / 6;
        b([2 * Math.cos(a), 3 + 2 * Math.sin(a), 0], [1, 0.55, 0.8], stone, {
          rotation: [0, 0, (a * 180) / Math.PI + 90],
        });
      }
      break;
    case "column":
      part("cylinder", [0, 2, 0], [0.7, 4, 0.7]);
      b([0, 0.15, 0], [1.2, 0.3, 1.2]);
      b([0, 4.15, 0], [1.2, 0.3, 1.2]);
      break;
    case "ramp":
      b([0, 1, 0], [4, 0.3, 6], stone, { rotation: [-18, 0, 0] });
      break;
    case "platform":
      b([0, 0.25, 0], [7, 0.5, 5]);
      break;
    case "tower":
      for (let y = 0; y < 4; y++) {
        b([0, y * 2 + 0.15, 0], [4, 0.3, 4]);
        for (const x of [-1.7, 1.7])
          for (const z of [-1.7, 1.7]) b([x, y * 2 + 1, z], [0.3, 2, 0.3]);
      }
      break;
    case "house":
      b([0, 0.15, 0], [6, 0.3, 6]);
      b([0, 1.7, -2.8], [6, 3, 0.3]);
      for (const x of [-2.8, 2.8]) b([x, 1.7, 0], [0.3, 3, 6]);
      for (const x of [-2, 2]) b([x, 1.7, 2.8], [2, 3, 0.3]);
      b([0, 3, 2.8], [2, 0.4, 0.3]);
      for (const x of [-1.5, 1.5])
        b([x, 3.7, 0], [3.5, 0.3, 6.5], "#a56953", {
          rotation: [0, 0, x < 0 ? 25 : -25],
        });
      break;
    case "roof":
      for (const x of [-1.5, 1.5])
        b([x, 1, 0], [3.5, 0.25, 6], "#a56953", {
          rotation: [0, 0, x < 0 ? 25 : -25],
        });
      break;
    case "fence":
      for (let x = -3; x <= 3; x++) b([x, 0.9, 0], [0.15, 1.8, 0.15], wood);
      for (const y of [0.45, 1.3]) b([0, y, 0], [6, 0.15, 0.15], wood);
      break;
    case "gate":
      for (const x of [-2, 2]) b([x, 1.5, 0], [0.4, 3, 0.4], wood);
      b([0, 2.8, 0], [4.5, 0.3, 0.4], wood);
      b([0, 0.9, 0], [3.5, 1.6, 0.15], wood);
      break;
    case "road":
      b([0, 0.05, 0], [6, 0.1, 10], "#424e56");
      for (const z of [-3, 0, 3]) b([0, 0.11, z], [0.12, 0.02, 1.5], "#e9d295");
      break;
    case "sidewalk":
      b([0, 0.2, 0], [2, 0.4, 10]);
      for (let z = -4; z < 5; z++)
        b([0.85, 0.44, z], [0.3, 0.08, 0.9], "#eee1bb");
      break;
    case "crossroad":
      b([0, 0.05, 0], [10, 0.1, 10], "#424e56");
      for (const x of [-4, 4])
        for (let z = -2; z <= 2; z++)
          b([x, 0.11, z], [1.5, 0.02, 0.4], "#eee1bb");
      break;
    case "barrier":
      for (const x of [-1.7, 1.7]) b([x, 0.5, 0], [0.3, 1, 1], stone);
      b([0, 1, 0], [4, 0.8, 0.3], "#e0a64e");
      break;
    case "tree":
      part("cylinder", [0, 1.2, 0], [0.45, 2.4, 0.45], wood);
      part("sphere", [0, 3, 0], [3, 3, 3], leaf, { physics: "none" });
      break;
    case "pine":
      part("cylinder", [0, 1, 0], [0.4, 2, 0.4], wood);
      for (let i = 0; i < 3; i++)
        part(
          "cone",
          [0, 1.7 + i * 0.8, 0],
          [2.8 - i * 0.6, 2, 2.8 - i * 0.6],
          leaf,
          { physics: "none" },
        );
      break;
    case "palm":
      part("cylinder", [0, 2, 0], [0.4, 4, 0.4], wood);
      for (let i = 0; i < 6; i++)
        b([0, 4, 0], [0.6, 0.15, 4], leaf, {
          rotation: [15, i * 60, 0],
          physics: "none",
        });
      break;
    case "bush":
      for (const x of [-0.7, 0, 0.7])
        part("sphere", [x, 0.6, 0], [1.4, 1.2, 1.4], leaf, { physics: "none" });
      break;
    case "rock":
      part("sphere", [0, 0.7, 0], [2, 1.4, 1.7], stone);
      break;
    case "rockCluster":
      for (let i = 0; i < 5; i++)
        part(
          "sphere",
          [Math.cos(i * 2) * 1.3, 0.4 + i * 0.08, Math.sin(i * 2)],
          [1.2, 0.8 + i * 0.16, 1],
          stone,
        );
      break;
    case "flower":
      part("cylinder", [0, 0.5, 0], [0.08, 1, 0.08], leaf, { physics: "none" });
      for (let i = 0; i < 6; i++)
        part(
          "sphere",
          [Math.cos(i) * 0.25, 1, Math.sin(i) * 0.25],
          [0.35, 0.12, 0.35],
          "#e79ba4",
          { physics: "none" },
        );
      part("sphere", [0, 1.04, 0], [0.2, 0.15, 0.2], "#f8d284", {
        physics: "none",
      });
      break;
    case "mushroom":
      part("cylinder", [0, 0.4, 0], [0.25, 0.8, 0.25], "#ede1c9");
      part("sphere", [0, 0.85, 0], [1.2, 0.5, 1.2], "#c15b57");
      break;
    case "bench":
      b([0, 0.65, 0], [3, 0.2, 0.8], wood);
      b([0, 1.2, -0.4], [3, 0.9, 0.15], wood);
      for (const x of [-1, 1]) b([x, 0.3, 0], [0.2, 0.6, 0.7]);
      break;
    case "table":
      b([0, 1.2, 0], [3, 0.2, 2], wood);
      for (const x of [-1.2, 1.2])
        for (const z of [-0.7, 0.7]) b([x, 0.6, z], [0.2, 1.2, 0.2], wood);
      break;
    case "chair":
      b([0, 0.65, 0], [1, 0.15, 1], wood);
      b([0, 1.2, -0.45], [1, 1.1, 0.15], wood);
      for (const x of [-0.4, 0.4])
        for (const z of [-0.4, 0.4]) b([x, 0.3, z], [0.12, 0.6, 0.12], wood);
      break;
    case "crate":
      b([0, 0.65, 0], [1.3, 1.3, 1.3], wood, { physics: "dynamic", mass: 8 });
      break;
    case "barrel":
      part("cylinder", [0, 0.7, 0], [1, 1.4, 1], wood, {
        physics: "dynamic",
        mass: 5,
      });
      break;
    case "lamp":
      part("cylinder", [0, 2, 0], [0.18, 4, 0.18], "#4b5664");
      part("sphere", [0, 4, 0], [0.65, 0.65, 0.65], "#ffe5a0", {
        physics: "none",
        roughness: 0.1,
      });
      break;
    case "sign":
      b([0, 0.8, 0], [0.15, 1.6, 0.15], wood);
      b([0, 1.8, 0], [2, 1, 0.12], "#4c8f9b");
      break;
    case "fountain":
      part("cylinder", [0, 0.2, 0], [4, 0.4, 4], stone);
      part("cylinder", [0, 0.42, 0], [3.5, 0.05, 3.5], "#66c4df", {
        physics: "none",
        roughness: 0.1,
      });
      part("cylinder", [0, 1, 0], [0.4, 1.5, 0.4], stone);
      part("sphere", [0, 1.9, 0], [0.7, 0.7, 0.7], "#66c4df", {
        physics: "none",
      });
      break;
    case "coin":
      part("cylinder", [0, 1, 0], [0.6, 0.12, 0.6], "#f4c768", {
        physics: "none",
        behavior: "collectible",
        metalness: 0.8,
      });
      break;
    case "crystal":
      part("sphere", [0, 1, 0], [0.6, 1, 0.6], "#76e8d1", {
        physics: "none",
        behavior: "collectible",
        metalness: 0.5,
      });
      break;
    case "bounceBall":
      part("sphere", [0, 3, 0], [1, 1, 1], "#e78886", {
        physics: "dynamic",
        restitution: 0.9,
        mass: 1,
      });
      break;
    case "domino":
      for (let i = 0; i < 7; i++)
        b([0, 1.2, -i * 0.85], [1, 2.4, 0.22], i % 2 ? "#d3b68f" : "#506f8a", {
          physics: "dynamic",
          mass: 2,
        });
      break;
    case "target":
      b([0, 1, 0], [0.2, 2, 0.2], wood);
      part("cylinder", [0, 2, 0], [1.6, 0.12, 1.6], "#c56059", {
        rotation: [90, 0, 0],
      });
      part("cylinder", [0, 2, 0.08], [0.7, 0.04, 0.7], "#f1deac", {
        rotation: [90, 0, 0],
      });
      break;
    case "spikes":
      for (let x = -1; x <= 1; x++)
        for (let z = -1; z <= 1; z++)
          part("cone", [x, 0.5, z], [0.7, 1, 0.7], "#d07670", {
            physics: "none",
            behavior: "hazard",
          });
      break;
    case "stepping":
      for (let i = 0; i < 6; i++)
        part(
          "cylinder",
          [Math.sin(i) * 0.8, 0.1 + i * 0.15, -i * 2],
          [1.5, 0.4, 1.5],
          stone,
        );
      break;
    case "spiral":
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        b(
          [Math.cos(a) * 2, 0.2 + i * 0.3, Math.sin(a) * 2],
          [1.8, 0.2, 1.2],
          stone,
          { rotation: [0, (-a * 180) / Math.PI, 0] },
        );
      }
      break;
  }
  return ns;
}
