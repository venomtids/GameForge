import type { ScriptLanguage } from "./model";
import {
  commandNames as baseNames,
  commandTemplate as baseTemplate,
} from "./commands06";
export const command07Names = {
  lightOn: "Acender luz do nó",
  lightOff: "Apagar luz do nó",
  lightFlicker: "Luz piscando",
  torch: "Lanterna do jogador",
  sound: "Tocar um som",
  loop: "Som em repetição",
  move: "Mover suavemente",
} as const;
export const commandNames = { ...baseNames, ...command07Names };
type BaseKey = keyof typeof baseNames;
export type CommandKey = keyof typeof commandNames;
const js: Record<keyof typeof command07Names, string> = {
  lightOn: `// Acende a luz deste nó (precisa de uma luz configurada no Inspetor).\nfunction start() {\n  engine.light(self.id, { type: "point", enabled: true, intensity: 10, distance: 20 });\n}\n\nfunction update(dt, time, input) {\n  if (input.pressed.e) engine.light(self.id, { intensity: 4 });\n}`,
  lightOff: `// Apaga e reacende a luz deste nó.\nfunction update(dt, time, input) {\n  if (input.pressed.e) engine.light(self.id, { enabled: false });\n  if (input.pressed.q) engine.light(self.id, { enabled: true, intensity: 10 });\n}`,
  lightFlicker: `// Pisca por alguns segundos (3 s, intensidade 0,7).\nfunction update(dt, time, input) {\n  if (input.pressed.e) engine.flicker(self.id, 3, 0.7);\n}`,
  torch: `// Lanterna presa à câmera do jogador.\nfunction start() { engine.torch(true, { intensity: 26, distance: 30, angle: 34 }); }\n\nfunction update(dt, time, input) {\n  if (input.pressed.f) engine.torch(false);\n  if (input.pressed.t) engine.torch(true);\n}`,
  sound: `// Sons disponíveis: porta.abrir, porta.bater, gaveta, item, moeda, rugido, screech, coracao, tremor, vento...\nfunction update(dt, time, input) {\n  if (input.pressed.e) engine.sound("porta.abrir", 1, 1);\n}`,
  loop: `// Camadas em repetição: vento, drone, coracao, tambores, passos.figura, alarme. Volume 0 para.\nfunction start() { engine.loop("vento", 0.5); }\n\nfunction update(dt, time, input) {\n  if (input.pressed.e) engine.loop("vento", 0);\n}`,
  move: `// Move suavemente até o destino em 2 segundos (tween da engine).\nfunction update(dt, time, input) {\n  if (input.pressed.e) engine.move(self.id, { x: self.x + 4, y: self.y + 2 }, 2);\n}`,
};
const lua: Record<keyof typeof command07Names, string> = {
  lightOn: `-- Acende a luz deste nó (configure o tipo de luz no Inspetor).\nfunction start()\n  engine.light(self.id, { type = "point", enabled = true, intensity = 10, distance = 20 })\nend\n\nfunction update(dt, time, input)\n  if input.pressed.e then engine.light(self.id, { intensity = 4 }) end\nend`,
  lightOff: `-- Apaga e reacende a luz deste nó.\nfunction update(dt, time, input)\n  if input.pressed.e then engine.light(self.id, { enabled = false }) end\n  if input.pressed.q then engine.light(self.id, { enabled = true, intensity = 10 }) end\nend`,
  lightFlicker: `-- Pisca por 3 segundos.\nfunction update(dt, time, input)\n  if input.pressed.e then engine.flicker(self.id, 3, 0.7) end\nend`,
  torch: `-- Lanterna presa à câmera do jogador.\nfunction start() engine.torch(true, { intensity = 26, distance = 30, angle = 34 }) end\n\nfunction update(dt, time, input)\n  if input.pressed.f then engine.torch(false) end\n  if input.pressed.t then engine.torch(true) end\nend`,
  sound: `-- Toca um som sintetizado uma vez.\nfunction update(dt, time, input)\n  if input.pressed.e then engine.sound("porta.abrir", 1, 1) end\nend`,
  loop: `-- Camada em repetição; volume 0 interrompe.\nfunction start() engine.loop("vento", 0.5) end\n\nfunction update(dt, time, input)\n  if input.pressed.e then engine.loop("vento", 0) end\nend`,
  move: `-- Move suavemente até o destino em 2 segundos.\nfunction update(dt, time, input)\n  if input.pressed.e then engine.move(self.id, { x = self.x + 4, y = self.y + 2 }, 2) end\nend`,
};
export function commandTemplate(key: CommandKey, language: ScriptLanguage) {
  if (key in command07Names) {
    const name = key as keyof typeof command07Names;
    if (language === "lua") return lua[name];
    if (language === "javascript") return js[name];
    return `-- ${command07Names[name]}\n-- Escolha Lua 5.3 ou JavaScript para receber o modelo pronto.`;
  }
  return baseTemplate(key as BaseKey, language);
}
