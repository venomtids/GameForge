import { makeNode, type Node3D } from "./model";
import { jellyPreset } from "./jelly-presets";
import { actorDefaults, deformDefaults } from "./features06";
export const prefab06Names = {
  humanoidPlayer: "Jogador articulado · opção 2",
  ragdoll: "Ragdoll físico",
  jelly: "Gelatina física · corpo macio",
  jellyPlayer: "Jogador de gelatina · articulado e jogável",
  jellyPlatform: "Plataforma de gelatina · elástica",
  botPatrol: "Bot · patrulha",
  botFollow: "Bot · seguir",
  botAttack: "Bot · atacar",
  spinReady: "Pronto · girar",
  floatReady: "Pronto · flutuar",
  walkReady: "Pronto · ir e voltar",
};
export type Prefab06 = keyof typeof prefab06Names;
export function prefab06(kind: Prefab06): Node3D[] {
  const actor = { ...actorDefaults, humanoid: true };
  if (kind === "humanoidPlayer")
    return [
      makeNode("box", {
        name: "Jogador articulado",
        position: [0, 2, 0],
        scale: [0.8, 1.8, 0.65],
        physics: "dynamic",
        behavior: "player",
        mass: 15,
        restitution: 0,
        speed: 6,
        actor,
        color: "#69a6ad",
      }),
    ];
  if (kind === "jellyPlayer")
    return [
      makeNode("box", {
        name: "Jogador de gelatina",
        position: [0, 2, 0],
        scale: [0.86, 1.8, 0.7],
        physics: "dynamic",
        behavior: "player",
        mass: 12,
        restitution: 0,
        friction: 0,
        speed: 6.2,
        color: "#75e5bd",
        actor: { ...actor, skin: "#9cf5d2" },
        deform: {
          ...deformDefaults,
          type: "jelly",
          ...jellyPreset("soft"),
          volume: 0.9,
        },
      }),
    ];
  if (kind === "jellyPlatform")
    return [
      makeNode("box", {
        name: "Plataforma de gelatina",
        position: [0, 0.5, 0],
        scale: [4, 1, 4],
        physics: "static",
        mass: 24,
        restitution: 0.08,
        friction: 0.75,
        color: "#91dab2",
        deform: {
          ...deformDefaults,
          type: "jelly",
          ...jellyPreset("balanced"),
          stiffness: 58,
          damping: 2.2,
        },
      }),
    ];
  if (kind === "ragdoll")
    return [
      makeNode("box", {
        name: "Ragdoll físico",
        position: [0, 3, 0],
        scale: [0.8, 1.8, 0.65],
        physics: "dynamic",
        mass: 12,
        actor,
        color: "#bf8976",
        deform: { ...deformDefaults, type: "ragdoll" },
      }),
    ];
  if (kind === "jelly")
    return [
      makeNode("box", {
        name: "Gelatina física",
        position: [0, 3, 0],
        scale: [1.6, 1.6, 1.6],
        physics: "dynamic",
        mass: 4,
        restitution: 0.1,
        color: "#85d7af",
        deform: { ...deformDefaults, ...jellyPreset("soft"), type: "jelly" },
      }),
    ];
  if (kind.startsWith("bot")) {
    const mode =
      kind === "botPatrol"
        ? "patrol"
        : kind === "botFollow"
          ? "follow"
          : "attack";
    return [
      makeNode("box", {
        name: prefab06Names[kind],
        position: [3, 2, 0],
        scale: [0.8, 1.8, 0.65],
        physics: "dynamic",
        mass: 12,
        restitution: 0,
        speed: 2,
        color:
          mode === "attack"
            ? "#d17d74"
            : mode === "follow"
              ? "#d3bb72"
              : "#819fcd",
        actor: { ...actor, bot: mode, health: 40 },
        script: {
          language: "javascript",
          enabled: false,
          source:
            '// Ative para controlar o bot por código.\nfunction start() { engine.bot(self.id, "' +
            mode +
            '"); }\nfunction update(dt, time, input) {\n  if (input.pressed.b) engine.bot(self.id, "follow");\n  if (input.pressed.n) engine.bot(self.id, "patrol");\n  if (input.pressed.k) engine.damage(self.id, 100);\n}',
        },
      }),
    ];
  }
  if (kind === "spinReady")
    return [
      makeNode("box", {
        name: "Girar · pronto",
        behavior: "rotate",
        speed: 1,
        color: "#d5b784",
      }),
    ];
  if (kind === "floatReady")
    return [
      makeNode("sphere", {
        name: "Flutuar · pronto",
        behavior: "float",
        speed: 2,
        amplitude: 0.6,
        color: "#86b8d1",
      }),
    ];
  return [
    makeNode("box", {
      name: "Ir e voltar · script editável",
      color: "#a79dd0",
      script: {
        language: "javascript",
        enabled: true,
        source:
          "let origem;\nfunction start() { origem = self.x; }\nfunction update(dt, time, input) { self.x = origem + Math.sin(time) * 3; }",
      },
    }),
  ];
}
