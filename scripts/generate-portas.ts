import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import {
  createProject,
  makeNode,
  parseProject,
  type Node3D,
  type Project,
} from "../src/engine/model";
import { actorDefaults } from "../src/engine/features06";
import { shadowDefaults } from "../src/engine/features06";
import { torchDefaults } from "../src/engine/features07";
import type { UIElement } from "../src/engine/studio-model";
import { portasTextures } from "./portas-textures";
import { readFileSync as lerArquivo } from "node:fs";
const luaFonte = lerArquivo("examples/portas-hotel/scripts/vigia.lua", "utf8");
const fonte = readFileSync("examples/portas-hotel/scripts/hotel.js", "utf8");
function ui(
  id: string,
  name: string,
  kind: UIElement["kind"],
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<UIElement> = {},
): UIElement {
  return {
    id,
    name,
    kind,
    text,
    x,
    y,
    w,
    h,
    color: "#e9e2d2",
    background: "#00000000",
    fontSize: 18,
    textureId: null,
    binding: "none",
    action: "none",
    screen: "playing",
    visible: true,
    ...extra,
  };
}
const p: Project = createProject();
p.name = "PORTAS · Hotel das 100 Portas";
p.settings = {
  ...p.settings,
  background: "#04060a",
  gravity: -9.81,
  gameCamera: "first",
  shadows: {
    ...shadowDefaults,
    enabled: false,
    sunPower: 0.04,
    ambientPower: 0.14,
    coverage: 60,
  },
  torch: { ...torchDefaults, enabled: false },
  volume: 0.9,
  textureTile: 1.5,
  textures: portasTextures(),
  moveMultiplier: 1,
  sprintMultiplier: 1.5,
  jumpSpeed: 6.2,
  mouseSensitivity: 1.6,
  fov: 84,
  physicsHz: 120,
  solverIterations: 15,
};
const PISO = "#3b332c";
const PAREDE = "#494137";
const METAL = "#2b3238";
const luz = (intensidade: number, distancia: number, cor: string, flicker = 0) => ({
  type: "point" as const,
  enabled: true,
  color: cor,
  intensity: intensidade,
  distance: distancia,
  decay: 1.5,
  angle: 52,
  penumbra: 0.35,
  shadows: false,
  flicker,
  flickerSpeed: 6,
});
const lobby: Node3D[] = [
  makeNode("box", { id: "lobby.piso", name: "Piso do saguão", position: [0, -0.2, 0], scale: [26, 0.4, 22], color: PISO, physics: "static", friction: 0.7 }),
  makeNode("box", { id: "lobby.teto", name: "Teto do saguão", position: [0, 4.6, 0], scale: [26, 0.4, 22], color: "#1c1916", physics: "static" }),
  makeNode("box", { id: "lobby.parede.n", name: "Parede norte", position: [0, 2.3, -11], scale: [26, 4.6, 0.5], color: PAREDE, physics: "static" }),
  makeNode("box", { id: "lobby.parede.s", name: "Parede sul", position: [0, 2.3, 11], scale: [26, 4.6, 0.5], color: PAREDE, physics: "static" }),
  makeNode("box", { id: "lobby.parede.l", name: "Parede leste", position: [13, 2.3, 0], scale: [0.5, 4.6, 22], color: PAREDE, physics: "static" }),
  makeNode("box", { id: "lobby.parede.o", name: "Parede oeste", position: [-13, 2.3, 0], scale: [0.5, 4.6, 22], color: PAREDE, physics: "static" }),
  makeNode("box", {
    id: "lobby.elevador",
    textureId: "tex.elevador",
    name: "Elevador · começar",
    position: [0, 1.55, -10],
    scale: [4.2, 3.1, 0.6],
    color: METAL,
    metalness: 0.55,
    roughness: 0.45,
    physics: "static",
    light: luz(7, 14, "#bfe2ff"),
  }),
  makeNode("box", { id: "lobby.elevador.aro", name: "Aro dourado do elevador", position: [0, 1.55, -10.4], scale: [5.2, 3.5, 0.25], color: "#8d7440", metalness: 0.7, roughness: 0.35, physics: "static" }),
  makeNode("box", { id: "lobby.letreiro", name: "Letreiro PORTAS", position: [0, 3.9, -10.5], scale: [7.5, 1.1, 0.2], color: "#ffffff", textureId: "tex.lousa", metalness: 0.5, roughness: 0.3, physics: "static", light: luz(4, 10, "#ffe1a8") }),
  makeNode("box", { id: "lobby.balcao", name: "Balcão da recepção", position: [-7.5, 0.55, 2.5], scale: [7, 1.1, 1.1], color: "#ffffff", textureId: "tex.madeira.escura", physics: "static" }),
  makeNode("box", { id: "lobby.tapete", name: "Tapete", position: [0, 0.03, 1], scale: [10, 0.06, 6], color: "#ffffff", textureId: "tex.tapete", physics: "static", friction: 0.9 }),
  makeNode("box", { id: "lobby.banco", name: "Banco", position: [8.5, 0.3, 4], scale: [3.4, 0.6, 1.1], color: "#4a3b2b", physics: "static" }),
  makeNode("box", { id: "lobby.lampada.l", name: "Lâmpada do saguão", position: [-8, 4.3, -7], scale: [0.7, 0.16, 0.7], color: "#ffffff", textureId: "tex.lampada", physics: "none", light: luz(8, 20, "#ffe4bb", 0.05) }),
  makeNode("box", { id: "lobby.lampada.r", name: "Lâmpada do saguão", position: [8, 4.3, -7], scale: [0.7, 0.16, 0.7], color: "#ffffff", textureId: "tex.lampada", physics: "none", light: luz(8, 20, "#ffe4bb", 0.05) }),
  makeNode("box", { id: "lobby.lampada.c", name: "Lâmpada do saguão", position: [0, 4.3, 6], scale: [0.7, 0.16, 0.7], color: "#ffffff", textureId: "tex.lampada", physics: "none", light: luz(7, 18, "#ffe4bb", 0.08) }),
];
const planta = (id: string, x: number, z: number): Node3D[] => [
  makeNode("cylinder", { id: id + ".vaso", name: "Vaso", position: [x, 0.35, z], scale: [1.1, 0.7, 1.1], color: "#7a4d3a", physics: "static" }),
  makeNode("cone", { id: id + ".folhas", name: "Planta", position: [x, 1.35, z], scale: [1.4, 1.7, 1.4], color: "#3d6b4a", physics: "none" }),
];
const jogador = makeNode("box", {
  id: "jogador",
  name: "Jogador",
  position: [0, 1.05, 6],
  scale: [0.8, 1.8, 0.65],
  color: "#5c7280",
  roughness: 0.7,
  physics: "dynamic",
  behavior: "player",
  mass: 15,
  restitution: 0,
  speed: 5.2,
  actor: {
    ...actorDefaults,
    humanoid: true,
    skin: "#c9a789",
    ragdollOnDeath: true,
    health: 100,
  },
});
const controlador = makeNode("group", {
  id: "controlador",
  name: "Controlador · Hotel das 100 Portas (JavaScript)",
  position: [0, 8, 0],
  visible: false,
  script: { language: "javascript", enabled: true, source: fonte },
});
/* o mesmo jogo também carrega um script em Lua: rádio de perigo e estatísticas */
const vigia = makeNode("group", {
  id: "vigia",
  name: "Vigia · rádio de perigo (Lua 5.3)",
  position: [0, 9, 0],
  visible: false,
  script: { language: "lua", enabled: true, source: luaFonte },
});
p.settings.playerId = "jogador";
p.scenes = [
  {
    id: "hotel",
    name: "Hotel · 100 portas",
    nodes: [...lobby, ...planta("lobby.planta.l", -11.5, -8), ...planta("lobby.planta.r", 11.5, -8), jogador, controlador, vigia],
    ui: [
      ui("hud.porta", "Contador de portas", "text", "PORTA  0 / 100", 33, 2, 34, 6, { fontSize: 26, color: "#f3e6c4" }),
      ui("hud.moedas", "Moedas", "text", "MOEDAS  0", 77, 2, 21, 5, { fontSize: 18, color: "#f2c85a" }),
      ui("hud.vida", "Vida", "bar", "VIDA  100", 3, 88, 26, 5, { fontSize: 15, color: "#c8503f", background: "#00000099" }),
      ui("hud.bateria", "Lanterna", "bar", "LANTERNA  100%", 3, 94, 26, 5, { fontSize: 15, color: "#e5c65f", background: "#00000099" }),
      ui("hud.itens", "Inventário", "text", "Gazua 0 · Curativo 0 · Crucifixo 0", 3, 80, 54, 6, { fontSize: 15, color: "#cfd8d2" }),
      ui("hud.objetivo", "Objetivo", "text", "Encontre a porta 2", 3, 74, 54, 6, { fontSize: 15, color: "#9fd3c0" }),
      ui("hud.prompt", "Comando da mira", "text", "", 24, 66, 52, 5, { fontSize: 19, color: "#f7f1de", background: "#000000aa" }),
      ui("hud.aviso", "Mensagem", "text", "", 16, 11, 68, 8, { fontSize: 20, color: "#ffd9a0", background: "#00000080" }),
      ui("hud.perigo", "Alerta de entidade", "text", "", 30, 21, 40, 9, { fontSize: 36, color: "#ff6a55" }),
      ui("hud.seek", "Aviso de perseguição", "text", "", 30, 30, 40, 10, { fontSize: 44, color: "#ff4f3a" }),
      ui("hud.escondido", "Aviso de esconderijo", "text", "", 28, 78, 44, 5, { fontSize: 19, color: "#bcd8c8", background: "#00000099" }),
      ui("hud.dano", "Flashes de dano", "panel", "", 0, 0, 100, 100, { visible: false, background: "#7d141066" }),
      ui("hud.radio", "Rádio de perigo (Lua)", "text", "", 2, 88, 40, 6, { fontSize: 17, color: "#cfe0d0", background: "#00000099" }),
      ui(
        "tela.inicio",
        "Tela inicial",
        "panel",
        "PORTAS\nHotel das 100 Portas\n\nWASD andar · Shift correr · Espaço pular · E interagir\nF lanterna · Q curativo · G vitaminas · C crucifixo · R voltar\n\nEntre no elevador (E) para começar.\nRush e Ambush: esconda-se no armário quando as luzes piscarem.\nScreech: olhe para ele. Eyes: não encare os quadros.\nSeek: corra sem parar. Figure: faça silêncio.\nA loja do Jeff fica na porta 40 · a biblioteca na 60.",
        12,
        18,
        76,
        62,
        { fontSize: 20, color: "#efe7d6", background: "#04060ad9" },
      ),
      ui("tela.morte", "Tela de morte", "panel", "", 22, 26, 56, 46, { visible: false, fontSize: 24, color: "#ffd5cd", background: "#180404ee" }),
      ui("tela.vitoria", "Tela de vitória", "panel", "", 22, 26, 56, 44, { visible: false, fontSize: 24, color: "#d8ffe8", background: "#04120cee" }),
      ui("tela.loja", "Loja do Jeff", "panel", "", 26, 16, 48, 66, { visible: false, fontSize: 20, color: "#ffeecb", background: "#0c0f12f0" }),
    ],
  },
];
p.activeScene = "hotel";
const validado = parseProject(JSON.stringify(p));
mkdirSync("examples/portas-hotel", { recursive: true });
writeFileSync(
  "examples/portas-hotel/Hotel-Portas.gameforge.json",
  JSON.stringify(validado, null, 2),
);
writeFileSync(
  "/home/user/Portas-Hotel-100-Portas.gameforge.json",
  JSON.stringify(validado, null, 2),
);
console.log(
  "Projeto gerado:",
  validado.scenes[0].nodes.length,
  "nós ·",
  validado.scenes[0].ui?.length,
  "elementos de HUD · script",
  fonte.length,
  "caracteres",
);
