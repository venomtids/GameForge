import test from "node:test";
import assert from "node:assert/strict";
import { arenaProject, ARENA_HALF } from "../src/goreforge/arena";
import {
  goreforgeDefaults,
  goreLevels,
  gorePresetPatch,
  loadSettings,
  saveSettings,
  validateSettings,
  SETTINGS_KEY,
  type GameSettings,
} from "../src/goreforge/config/settings";
import {
  serializeTheme,
  themes,
  themeIds,
  themeVariables,
  validateTheme,
} from "../src/goreforge/config/theme";
import { quickSlots, tools, weapons, weaponFor, damageAtRange, effectiveSpread } from "../src/goreforge/config/weapons";
import {
  searchSpawnables,
  spawnCategories,
  spawnUnitCount,
  spawnWeight,
  spawnableFor,
  spawnables,
} from "../src/goreforge/config/spawnables";
import { GameStore } from "../src/goreforge/game/state";
import { decodeProject, encodeProject, MAX_PROJECT_BYTES } from "../src/engine/serialization";
import { parseProject } from "../src/engine/model";
import { hudLayouts } from "../src/goreforge/ui/hud";

/** Storage falso para testar persistência sem navegador. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
  } as Storage;
}

test("ajustes: padrões válidos, validação defensiva e persistência", () => {
  const defaults = loadSettings(memoryStorage());
  assert.equal(defaults.quality, goreforgeDefaults.quality);
  assert.ok(defaults.maxHealth > 0 && defaults.walkSpeed > 0);

  const hostile = validateSettings({
    walkSpeed: "rápido",
    maxHealth: Number.NaN,
    gore: "banana",
    quality: 42,
    maxDecals: -999,
    npcLimit: 1e9,
  });
  assert.equal(typeof hostile.walkSpeed, "number");
  assert.ok(Number.isFinite(hostile.maxHealth) && hostile.maxHealth > 0);
  assert.ok(["off", "light", "full", "insane"].includes(hostile.gore));
  assert.ok(["auto", "economy", "high"].includes(hostile.quality));
  assert.ok(hostile.maxDecals >= 0);
  assert.ok(hostile.npcLimit <= 64);

  const storage = memoryStorage();
  assert.ok(saveSettings({ ...defaults, walkSpeed: 9.5, gore: "insane" }, storage));
  assert.ok(storage.getItem(SETTINGS_KEY));
  const reloaded = loadSettings(storage);
  assert.equal(reloaded.walkSpeed, 9.5);
  assert.equal(reloaded.gore, "insane");
});

test("temas: catálogo, variáveis CSS e ida-e-volta em JSON", () => {
  assert.ok(themeIds.length >= 4);
  for (const id of themeIds) {
    const theme = themes[id];
    assert.equal(theme.id, id);
    const vars = themeVariables(theme);
    assert.ok(vars["--gf-accent"], `${id} sem cor de destaque`);
    assert.ok(vars["--gf-radius"] && vars["--gf-gap"]);
    assert.ok(vars["--gf-font-size"]);
    const round = validateTheme(JSON.parse(serializeTheme(theme)), themes.ferro);
    assert.equal(round.id, theme.id);
    assert.equal(round.metrics.radius, theme.metrics.radius);
  }
  const patched = validateTheme({ metrics: { radius: 999, gap: -5 } }, themes.ferro);
  assert.ok(patched.metrics.radius <= 64 && patched.metrics.gap >= 0);
});

test("armas: catálogo coerente, munição e curvas de dano", () => {
  const ids = Object.keys(weapons);
  assert.ok(ids.length >= 10);
  for (const id of ids) {
    const spec = weaponFor(id);
    assert.equal(spec.id, id);
    assert.ok(spec.name && spec.icon && spec.description);
    assert.ok(spec.magazine >= 0 && spec.reserve >= 0);
    assert.ok(spec.range > 0 && spec.recoil.recovery > 0);
    assert.ok(spec.view.parts.length > 0, `${id} sem modelo de primeira pessoa`);
    assert.ok(spec.view.parts.every((p) => p.shape && p.size.length === 3 && p.pos.length === 3));
    assert.ok(spec.sfx.fire && spec.sfx.reload);
    if (spec.kind !== "tool") assert.ok(spec.damage > 0, `${id} sem dano`);
  }
  for (const id of quickSlots) assert.ok(weapons[id], `slot rápido aponta para arma inexistente: ${id}`);
  for (const id of tools) assert.equal(weaponFor(id).kind, "tool", `${id} deveria ser ferramenta`);

  const rifle = weaponFor("f90");
  assert.ok(damageAtRange(rifle, 0) >= damageAtRange(rifle, rifle.range));
  const moving = effectiveSpread(rifle, { moving: true, airborne: true, ads: false, crouched: false });
  const still = effectiveSpread(rifle, { moving: false, airborne: false, ads: true, crouched: true });
  assert.ok(moving > still);
});

test("menu de spawn: ids únicos, categorias e busca por tags", () => {
  const seen = new Set<string>();
  for (const item of spawnables) {
    assert.ok(!seen.has(item.id), `item duplicado: ${item.id}`);
    seen.add(item.id);
    assert.ok((spawnCategories as readonly string[]).includes(item.category), `categoria desconhecida: ${item.category}`);
    assert.ok(item.patch.kind, `${item.id} sem ` + "`kind`");
    assert.ok(item.hp >= 0 && item.chunks >= 0);
    assert.ok(spawnUnitCount(item) >= 1);
    assert.ok(spawnWeight(item) > 0);
    assert.ok(item.tags.length > 0);
  }
  const barrel = spawnableFor("barrel");
  assert.equal(barrel.category, "Explosivos");
  assert.ok(barrel.explosive && barrel.explosive.radius > 0);
  const found = searchSpawnables("gelatina");
  assert.ok(found.length >= 3);
  assert.ok(searchSpawnables("").length === spawnables.length);
  assert.equal(spawnableFor("nao-existe").id, spawnables[0].id);
});

test("pátio: projeto serializa abaixo do limite e metadados apontam para nós reais", () => {
  const { project, meta } = arenaProject();
  const encoded = encodeProject(project);
  assert.ok(encoded.length < MAX_PROJECT_BYTES, "projeto do pátio passou do limite de exportação");
  const round = parseProject(decodeProject(encoded));
  assert.equal(round.name, project.name);
  assert.equal(round.scenes[0].nodes.length, project.scenes[0].nodes.length);

  const ids = new Set(project.scenes[0].nodes.map((n) => n.id));
  assert.ok(ids.has(meta.playerId), "jogador ausente da cena");
  for (const id of Object.keys(meta.breakables)) assert.ok(ids.has(id), `destrutível órfão: ${id}`);
  for (const id of meta.npcs) assert.ok(ids.has(id), `NPC órfão: ${id}`);
  for (const id of meta.jellies) assert.ok(ids.has(id), `gelatina órfã: ${id}`);
  assert.ok(meta.jellies.length <= 12, "a engine limita 12 rigs elásticos por cena");
  assert.ok(meta.zones.length >= 4);
  for (const zone of meta.zones) {
    assert.ok(Math.abs(zone.center[0]) <= ARENA_HALF + 12 && Math.abs(zone.center[2]) <= ARENA_HALF + 12);
    assert.ok(zone.radius > 0 && zone.hint.length > 8);
  }
  const player = project.scenes[0].nodes.find((n) => n.id === meta.playerId)!;
  assert.ok(player.actor.humanoid, "jogador deveria ser humanoide");
  assert.deepEqual(project.settings.gameCamera, "first");
  assert.equal(project.settings.playerId, meta.playerId);
});

test("HUD: presets de layout são dados completos e independentes do tema", () => {
  const ids = Object.keys(hudLayouts);
  assert.ok(ids.length >= 3);
  for (const id of ids) {
    const layout = hudLayouts[id];
    for (const key of ["vitals", "ammo", "slots", "zone", "diagnostics", "score"]) {
      const placement = layout[key as keyof typeof layout];
      assert.ok(placement, `${id} sem ${key}`);
      assert.ok(["tl", "tr", "bl", "br", "tc", "bc", "c"].includes(placement.anchor));
      assert.equal(typeof placement.dx, "string");
      assert.equal(typeof placement.dy, "string");
      assert.ok(placement.scale === undefined || placement.scale > 0);
    }
  }
});

test("loja de estado: munição, recarga, troca de arma e placar", () => {
  const store = new GameStore();
  store.resetLoadout();
  const rifle = weaponFor("f90");
  store.equip("f90");
  assert.equal(store.weapon, "f90");
  const ammo = store.ammoOf("f90");
  assert.equal(ammo.mag, rifle.magazine);

  assert.ok(store.consume("f90"));
  assert.equal(store.ammoOf("f90").mag, rifle.magazine - 1);
  while (store.consume("f90")) {
    /* esvazia o pente */
  }
  assert.equal(store.ammoOf("f90").mag, 0);
  const reserveBefore = store.ammoOf("f90").reserve;
  assert.ok(store.reload("f90"));
  assert.equal(store.ammoOf("f90").mag, rifle.magazine);
  assert.equal(store.ammoOf("f90").reserve, reserveBefore - rifle.magazine);
  assert.equal(store.reload("f90"), false, "pente cheio não recarrega de novo");

  const before = store.weapon;
  store.cycleWeapon(1);
  assert.notEqual(store.weapon, before);
  store.cycleWeapon(-1);
  assert.equal(store.weapon, before);

  store.markHit(true);
  assert.ok(store.hitMarker > 0);
  assert.equal(store.ammoOf("f90").mag, rifle.magazine);
  store.markPlayerHit(1.2);
  assert.ok(store.hitDirection.life > 0);
  store.shots = 4;
  store.hits = 3;
  store.addKill(true, "FUZIL F-90", "Caçador", 12.5);
  const stats = store.stats();
  assert.equal(stats.kills, 1);
  assert.equal(stats.headshots, 1);
  assert.equal(stats.accuracy, 75);
  assert.ok(store.bestRecord.kills >= 1, "recorde local deveria acompanhar os abates");

  store.applySettings({ gore: "insane", shake: 120 });
  assert.equal(store.settings.gore, "insane");
  assert.ok(store.settings.shake <= 8, "ajustes fora da faixa deveriam ser fixados");
  const theme = { ...themes.ferro, id: "ferro" };
  store.applyTheme(theme);
  assert.equal(store.theme.id, "ferro");
});

test("gore: presets são dados e escalam sangue/decalques/desmembramento", () => {
  assert.deepEqual(goreLevels, ["off", "light", "full", "insane"]);
  let previousBlood = -1;
  let previousDecals = -1;
  let previousGibThreshold = Infinity;
  for (const level of goreLevels) {
    const patch = gorePresetPatch(level);
    const merged: GameSettings = validateSettings({ ...goreforgeDefaults, ...patch });
    assert.equal(merged.gore, level);
    assert.ok(merged.bloodAmount >= previousBlood, "sangue deveria crescer com o nível");
    assert.ok(merged.maxDecals >= previousDecals, "decalques deveriam crescer com o nível");
    assert.ok(merged.gibThreshold <= previousGibThreshold, "limiar de estilhaço deveria cair");
    previousBlood = merged.bloodAmount;
    previousDecals = merged.maxDecals;
    previousGibThreshold = merged.gibThreshold;
  }
  assert.equal(gorePresetPatch("off").dismember, false);
  assert.equal(gorePresetPatch("insane").dismember, true);
  assert.equal(validateSettings({ ...goreforgeDefaults, ...gorePresetPatch("insane") }).bloodAmount, 2.8);
});
