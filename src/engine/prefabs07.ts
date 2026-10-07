import { makeNode, type Node3D } from "./model";
import { actorDefaults } from "./features06";
import { lightDefaults } from "./features07";
export const prefab07Names = {
  lampCeiling: "Lâmpada de teto",
  lampFlicker: "Lâmpada piscante",
  lampCorridor: "Luz de corredor",
  spotlight: "Holofote",
  npcHumanoid: "NPC humanoide alto",
} as const;
export type Prefab07 = keyof typeof prefab07Names;
export function prefab07(kind: Prefab07): Node3D[] {
  if (kind === "lampCeiling")
    return [
      makeNode("box", {
        name: "Lâmpada de teto",
        position: [0, 3.4, 0],
        scale: [0.5, 0.14, 0.5],
        color: "#f6e6c0",
        roughness: 0.35,
        light: {
          ...lightDefaults,
          type: "point",
          intensity: 11,
          distance: 22,
          decay: 1.4,
        },
      }),
    ];
  if (kind === "lampFlicker")
    return [
      makeNode("box", {
        name: "Lâmpada piscante",
        position: [0, 3.4, 0],
        scale: [0.5, 0.14, 0.5],
        color: "#f0dcae",
        roughness: 0.4,
        light: {
          ...lightDefaults,
          type: "point",
          intensity: 12,
          distance: 24,
          flicker: 0.55,
          flickerSpeed: 11,
        },
      }),
    ];
  if (kind === "lampCorridor")
    return [
      makeNode("box", {
        name: "Luz de corredor",
        position: [0, 3.1, 0],
        scale: [1.6, 0.1, 0.34],
        color: "#e8dcc0",
        light: {
          ...lightDefaults,
          type: "point",
          intensity: 7,
          distance: 16,
          decay: 1.7,
          color: "#ffe9c4",
        },
      }),
    ];
  if (kind === "spotlight")
    return [
      makeNode("cylinder", {
        name: "Holofote",
        position: [0, 4, 0],
        scale: [0.45, 0.6, 0.45],
        color: "#8f9aa3",
        metalness: 0.5,
        light: {
          ...lightDefaults,
          type: "spot",
          intensity: 24,
          distance: 40,
          angle: 32,
          penumbra: 0.35,
          decay: 1.2,
        },
      }),
    ];
  return [
    makeNode("box", {
      name: "NPC humanoide",
      position: [2, 2, 0],
      scale: [1, 2.4, 0.8],
      physics: "dynamic",
      mass: 20,
      restitution: 0,
      speed: 2,
      color: "#3a4550",
      actor: { ...actorDefaults, humanoid: true, skin: "#8d7f72" },
    }),
  ];
}
