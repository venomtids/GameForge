import type { ScriptLanguage } from "./model";
export const commandNames = {
  walk: "Andar numa direção",
  rotate: "Girar continuamente",
  patrol: "Patrulhar",
  follow: "Seguir jogador",
  attack: "Seguir e atacar",
  ragdoll: "Ativar ragdoll",
  impulse: "Aplicar impulso",
  stop: "Parar movimentos",
};
export function commandTemplate(
  key: keyof typeof commandNames,
  language: ScriptLanguage,
) {
  const calls = {
    walk: "engine.walk(self.id, 1, 0, 2)",
    rotate: "engine.rotate(self.id, 45)",
    patrol: 'engine.bot(self.id, "patrol")',
    follow: 'engine.bot(self.id, "follow")',
    attack: 'engine.bot(self.id, "attack")',
    ragdoll: "engine.ragdoll(self.id, true)",
    impulse: "engine.impulse(self.id, 0, 8, 0)",
    stop: "engine.stop(self.id)",
  };
  return language === "lua"
    ? `-- ${commandNames[key]} · parâmetros editáveis\nfunction start()\n  ${calls[key]}\nend\n\nfunction update(dt, time, input)\n  -- engine.stop(self.id) interrompe andar/girar/bot.\nend`
    : `// ${commandNames[key]} · parâmetros editáveis\nfunction start() {\n  ${calls[key]};\n}\n\nfunction update(dt, time, input) {\n  // engine.stop(self.id) interrompe andar/girar/bot.\n}`;
}
