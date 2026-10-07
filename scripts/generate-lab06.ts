import { writeFileSync, mkdirSync } from "node:fs";
import { createProject, makeNode, parseProject } from "../src/engine/model";
import { prefab06 } from "../src/engine/prefabs06";
import { generateTerrain, terrainDefaults } from "../src/engine/terrain06";
import { shadowDefaults } from "../src/engine/features06";
const p = createProject();
p.name = "Laboratório · GameForge 0.6";
p.settings.gameCamera = "first";
p.settings.shadows = { ...shadowDefaults, coverage: 40 };
p.settings.sky = {
  enabled: true,
  clouds: true,
  sunElevation: 42,
  sunAzimuth: 32,
};
const actor = prefab06("humanoidPlayer")[0];
actor.id = "jogador";
actor.position = [0, 2, 8];
p.settings.playerId = actor.id;
const rag = prefab06("ragdoll")[0];
rag.id = "ragdoll";
rag.position = [-4, 3, -2];
rag.rotation = [0, 0, 20];
const jelly = prefab06("jelly")[0];
jelly.id = "gelatina";
jelly.position = [-2, 3, -4];
const patrol = prefab06("botPatrol")[0];
patrol.id = "patrulha";
patrol.position = [6, 2, -8];
patrol.actor.radius = 2.5;
const follow = prefab06("botFollow")[0];
follow.id = "amigo";
follow.position = [-6, 2, 2];
const attack = prefab06("botAttack")[0];
attack.id = "oponente";
attack.position = [8, 2, -4];
attack.actor.detection = 8;
attack.actor.damage = 10;
const spin = prefab06("spinReady")[0];
spin.position = [3, 1, -3];
const controller = makeNode("group", {
  name: "Controles do laboratório · JavaScript",
  id: "controles",
  script: {
    language: "javascript",
    enabled: true,
    source: `// Código deste projeto, editável no painel Scripts. Não é um modo fixo da engine.
function start() { engine.log("G: impulso na gelatina | J: ragdoll do jogador | K: derrubar o bot | B/N: seguir/patrulhar | R: renascer"); }
function update(dt, time, input) {
  if (input.pressed.g) engine.impulse("gelatina", 1, 10, 0);
  if (input.pressed.j) engine.damage("jogador", 100);
  if (input.pressed.k) engine.damage("oponente", 100);
  if (input.pressed.b) engine.bot("patrulha", "follow");
  if (input.pressed.n) engine.bot("patrulha", "patrol");
}`,
  },
});
p.scenes = [
  {
    id: "laboratorio",
    name: "Pátio de testes",
    nodes: [
      makeNode("box", {
        id: "piso",
        name: "Piso de testes",
        position: [0, -0.5, 0],
        scale: [32, 1, 32],
        physics: "static",
        color: "#889487",
        restitution: 0,
      }),
      actor,
      rag,
      jelly,
      patrol,
      follow,
      attack,
      spin,
      controller,
      makeNode("terrain", {
        name: "Terreno para esculpir",
        position: [28, 0, 0],
        surface: generateTerrain({
          ...terrainDefaults,
          size: 24,
          resolution: 65,
        }),
        physics: "static",
        terrain: true,
        color: "#ffffff",
      }),
      makeNode("box", {
        name: "Parede · teste de sombra",
        position: [1, 1, -7],
        scale: [5, 2, 0.6],
        physics: "static",
        color: "#b3b2a4",
      }),
    ],
  },
];
p.activeScene = "laboratorio";
mkdirSync("examples/laboratorio06", { recursive: true });
writeFileSync(
  "examples/laboratorio06/Laboratorio-0.6.gameforge.json",
  JSON.stringify(parseProject(JSON.stringify(p)), null, 2),
);
