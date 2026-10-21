import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { createProject, makeNode, parseProject } from "../src/engine/model";
import type {
  UIElement,
  PixelTexture,
  VoxelMaterial,
} from "../src/engine/studio-model";
const generator = readFileSync("examples/bosque-vivo/worldgen.js", "utf8"),
  code =
    generator + "\n" + readFileSync("examples/bosque-vivo/game.js", "utf8");
const blocks = vm.runInNewContext(
  generator + "\ncreateWorld(1729,32)",
  {},
  { timeout: 1000 },
) as number[];
const names = [
  "Rocha matriz",
  "Grama",
  "Terra",
  "Pedra",
  "Madeira",
  "Folhas / frutas",
  "Areia",
  "Água",
  "Tábuas",
  "Carvão",
  "Ferro",
  "Cristal",
  "Tocha",
  "Farol",
];
const colors = [
  "#3c4342",
  "#65964e",
  "#936546",
  "#919c9b",
  "#9d754c",
  "#567f4d",
  "#d5c087",
  "#5c9fb3",
  "#c29b63",
  "#51565b",
  "#b9977c",
  "#83cece",
  "#dfb45c",
  "#c8eebc",
];
const textures: PixelTexture[] = names.map((name, i) => {
  let seed = i + 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const base = colors[i]
    .slice(1)
    .match(/../g)!
    .map((s) => parseInt(s, 16));
  return {
    id: "block-texture-" + (i + 1),
    name,
    size: 16,
    pixels: Array.from({ length: 256 }, (_, p) => {
      let k = (rand() - 0.5) * 30;
      if (i === 4) k += p % 4 === 0 ? -25 : 10;
      if (i === 8) k += Math.floor(p / 16) % 5 === 0 ? -30 : 0;
      if (i === 9 && rand() < 0.2) k = -45;
      if (i === 10 && rand() < 0.18) return "#d2a785";
      if (i === 11 && rand() < 0.22) return "#b9ffff";
      if (i === 12)
        return p % 16 > 5 && p % 16 < 10
          ? Math.floor(p / 16) < 6
            ? "#ffe594"
            : "#836345"
          : "#00000000";
      if (i === 13 && p % 17 === 0) return "#fffbc9";
      return (
        "#" +
        base
          .map((v) =>
            Math.max(0, Math.min(255, Math.round(v + k)))
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")
      );
    }),
  };
});
const palette: VoxelMaterial[] = names.map((name, i) => ({
  name,
  color: colors[i],
  textureId: textures[i].id,
  solid: ![7, 12].includes(i),
}));
const p = createProject();
p.name = "Bosque Vivo · Sobrevivência";
p.activeScene = "bosque-vivo-world";
p.settings = {
  ...p.settings,
  gameCamera: "first",
  sky: { enabled: true, sunElevation: 35, sunAzimuth: 35, clouds: true },
  textures,
  mouseSensitivity: 1.5,
};
const ui: UIElement[] = [];
function element(
  id: string,
  kind: UIElement["kind"],
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  patch: Partial<UIElement> = {},
) {
  ui.push({
    id,
    name: id,
    kind,
    text,
    x,
    y,
    w,
    h,
    color: "#edf4e4",
    background: kind === "text" ? "#00000000" : "#172b24dd",
    fontSize: 14,
    textureId: null,
    binding: "none",
    action: kind === "button" ? "event" : "none",
    screen: "always",
    visible: true,
    ...patch,
  });
}
element("brand", "text", "BOSQUE VIVO", 3, 2, 35, 5, { fontSize: 21 });
element("life", "bar", "VIDA 20 / 20", 3, 8, 22, 4, { color: "#d78475" });
element("hunger", "bar", "FOME 20 / 20", 3, 13, 22, 4, { color: "#cfa957" });
element("time", "text", "DIA 1", 3, 18, 30, 4);
element(
  "objective",
  "text",
  "Colete madeira e construa seu abrigo.",
  63,
  3,
  34,
  11,
  { fontSize: 13 },
);
element("inventory", "button", "Mochila / receitas [E]", 73, 16, 24, 5, {
  fontSize: 12,
});
element(
  "message",
  "text",
  "Permita os scripts do projeto para jogar.",
  17,
  78,
  66,
  7,
  { fontSize: 14, background: "#14231bd0" },
);
element("mining", "bar", "Minerando…", 35, 70, 30, 4, {
  visible: false,
  color: "#8bb581",
});
for (let i = 0; i < 8; i++)
  element("slot-" + i, "button", String(i + 1), 15 + i * 9, 89, 8.5, 8, {
    fontSize: 11,
  });
element("menu-bg", "panel", "", 23, 22, 54, 54, { background: "#132820f5" });
element("menu-title", "text", "BOSQUE VIVO", 28, 25, 44, 7, { fontSize: 26 });
element(
  "menu-help",
  "text",
  "Permita scripts ao executar. Este jogo foi programado em JavaScript usando a engine.",
  28,
  34,
  44,
  23,
  { fontSize: 14 },
);
element("begin", "button", "Começar / continuar", 28, 59, 44, 5, {
  background: "#507548",
});
element("load", "button", "Carregar progresso local", 28, 65, 44, 4);
element(
  "new-world",
  "button",
  "Novo mundo (reiniciar execução)",
  28,
  70,
  44,
  4,
);
element("bag-bg", "panel", "", 8, 23, 84, 51, {
  visible: false,
  background: "#142920f5",
});
element("bag-title", "text", "MOCHILA & BANCADA", 11, 25, 45, 5, {
  visible: false,
  fontSize: 21,
});
element("bag-items", "text", "", 11, 32, 31, 30, {
  visible: false,
  fontSize: 14,
});
for (let i = 0; i < 7; i++)
  element(
    "craft-" + i,
    "button",
    "Receita " + (i + 1),
    45,
    27 + i * 5.7,
    44,
    5.3,
    { visible: false, fontSize: 12 },
  );
element("eat", "button", "Comer fruta [F]", 11, 62, 14, 6, {
  visible: false,
  fontSize: 12,
});
element("save", "button", "Salvar progresso", 26, 62, 16, 6, {
  visible: false,
  fontSize: 12,
});
element("bag-close", "button", "Voltar ao jogo [E]", 11, 68, 31, 4, {
  visible: false,
  fontSize: 12,
});
p.scenes = [
  {
    id: p.activeScene,
    name: "Bosque Vivo",
    ui,
    voxel: { size: 32, height: 24, blocks, palette },
    nodes: [
      makeNode("group", {
        id: "game-controller",
        name: "Controlador do jogo · JavaScript editável",
        position: [0, 0, 0],
        script: { language: "javascript", enabled: true, source: code },
      }),
      makeNode("box", {
        id: "survivor",
        name: "Sobrevivente · personagem",
        position: [16.5, 7, 18.5],
        scale: [0.6, 1.7, 0.6],
        color: "#ddb77b",
        physics: "dynamic",
        behavior: "player",
        speed: 5.5,
        restitution: 0,
      }),
    ],
  },
];
const parsed = parseProject(JSON.stringify(p));
writeFileSync(
  "examples/bosque-vivo/Bosque-Vivo-v0.5.gameforge.json",
  JSON.stringify(parsed, null, 2),
);
writeFileSync("examples/bosque-vivo/Controlador-completo.js", code);
console.log(
  "Bosque Vivo generated",
  code.length,
  "script chars,",
  blocks.filter(Boolean).length,
  "blocks,",
  ui.length,
  "editable UI elements.",
);
