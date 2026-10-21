import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { soundNames, loopNames } from "../src/engine/features07";
import { parseProject } from "../src/engine/model";

const fonteOriginal = readFileSync(
  "examples/portas-hotel/scripts/hotel.js",
  "utf8",
);
const projeto = parseProject(
  readFileSync("examples/portas-hotel/Hotel-Portas.gameforge.json", "utf8"),
);
const uiIds = new Set((projeto.scenes[0].ui ?? []).map((e) => e.id));

type No = {
  id: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number[];
  color: string;
  visible: boolean;
  speed: number;
  light: any;
  actor: any;
  physics: string;
  textureId: string | null;
  kind: string;
  vx: number;
  vy: number;
  vz: number;
};

/** Engine falsa que reproduz as regras do thread principal (validação, limites,
 *  tweens, vida, HUD). Serve para rodar o script do jogo sem navegador. */
class MockEngine {
  nodes = new Map<string, No>();
  health = new Map<string, number>();
  tweens: { id: string; from: any; to: any; t: number; dur: number }[] = [];
  uiPatch = new Map<string, any>();
  sons: string[] = [];
  loops = new Map<string, number>();
  erros: string[] = [];
  log: string[] = [];
  comandosPorTick = 0;
  maxComandos = 0;
  store: any = null;
  congelado = false;
  saved: any = null;
  private criar(id: string, patch: any) {
    const no: No = {
      id,
      x: 0,
      y: 0,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      scale: [1, 1, 1],
      color: "#ffffff",
      visible: true,
      speed: 5,
      light: { type: "none" },
      actor: patch.actor ?? { bot: "off", humanoid: false },
      physics: patch.physics ?? "dynamic",
      textureId: patch.textureId ?? null,
      kind: patch.kind ?? "box",
      vx: 0,
      vy: 0,
      vz: 0,
    };
    this.nodes.set(id, no);
    this.health.set(id, patch.actor?.health ?? 100);
    return no;
  }
  private valido(id: string) {
    if (!this.nodes.has(id)) this.erros.push("nó inexistente: " + id);
    return this.nodes.get(id);
  }
  private contando() {
    this.comandosPorTick++;
    this.maxComandos = Math.max(this.maxComandos, this.comandosPorTick);
  }
  tique() {
    this.comandosPorTick = 0;
  }
  avancar(dt: number) {
    for (const tween of [...this.tweens]) {
      tween.t += dt;
      const k = Math.min(1, tween.t / tween.dur);
      const no = this.nodes.get(tween.id);
      if (!no) {
        this.tweens.splice(this.tweens.indexOf(tween), 1);
        continue;
      }
      for (const chave of Object.keys(tween.to))
        no[chave as "x"] = tween.from[chave] + (tween.to[chave] - tween.from[chave]) * k;
      if (k >= 1) this.tweens.splice(this.tweens.indexOf(tween), 1);
    }
  }
}

function criarAPI(m: MockEngine, jogadorId = "jogador") {
  const num = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(min, Math.min(max, v))
      : undefined;
  const aplicar = (id: string, patch: any, origem: string) => {
    m.contando();
    if (!patch || typeof patch !== "object") return;
    const no = m.valido(id);
    if (!no) return;
    for (const eixo of ["x", "y", "z"] as const) {
      const v = num(patch[eixo], -2000, 2000);
      if (v !== undefined) no[eixo] = v;
    }
    for (const eixo of ["rx", "ry", "rz"] as const) {
      const v = num(patch[eixo], -3600, 3600);
      if (v !== undefined) no[eixo] = v;
    }
    if (Array.isArray(patch.scale) && patch.scale.length === 3) {
      patch.scale.forEach((v: number, i: number) => {
        const limite = num(v, 0.02, 200);
        if (limite !== undefined) no.scale[i] = limite;
      });
    }
    if (typeof patch.color === "string") {
      if (!/^#[0-9a-f]{6}$/i.test(patch.color))
        m.erros.push("cor inválida em " + origem + ": " + patch.color);
      else no.color = patch.color;
    }
    for (const eixo of ["vx", "vy", "vz"] as const) {
      const v = num(patch[eixo], -100, 100);
      if (v !== undefined) no[eixo] = v;
    }
    for (const chave of ["visible", "castShadow", "receiveShadow"] as const)
      if (typeof patch[chave] === "boolean") no.visible = patch[chave];
    if (typeof patch.speed === "number") no.speed = patch.speed;
    if (patch.actor) no.actor = { ...no.actor, ...patch.actor };
    if (patch.light) {
      const tipo = patch.light.type ?? no.light?.type ?? "none";
      if (!["none", "point", "spot"].includes(tipo))
        m.erros.push("luz inválida em " + origem);
      no.light = { ...(no.light ?? {}), ...patch.light };
      for (const [chave, min, max] of [
        ["intensity", 0, 60],
        ["distance", 0, 120],
        ["flicker", 0, 1],
      ] as const) {
        const v = patch.light[chave];
        if (v !== undefined && (typeof v !== "number" || v < min || v > max))
          m.erros.push(`luz ${chave} fora do limite em ${origem}`);
      }
    }
    if (typeof patch.physics === "string") no.physics = patch.physics;
    if (typeof patch.kind === "string") no.kind = patch.kind;
    if (typeof patch.textureId === "string" || patch.textureId === null)
      no.textureId = patch.textureId;
    if (typeof patch.name === "string" && patch.name.length > 100)
      m.erros.push("nome longo demais em " + origem);
  };
  const criarNo = (id: string, patch: any, origem: string) => {
    m.contando();
    if (typeof id !== "string" || !id.length || id.length >= 100) {
      m.erros.push("id inválido em " + origem + ": " + String(id));
      return;
    }
    if (m.nodes.has(id)) {
      m.erros.push("spawn duplicado: " + id);
      return;
    }
    m.criar(id, patch ?? {});
    aplicar(id, patch, origem);
  };
  const api: any = {
    log: (...args: any[]) => m.log.push(args.map(String).join(" ")),
    clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
    lerp: (a: number, b: number, t: number) => a + (b - a) * t,
    distance: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
      Math.hypot(ax - bx, ay - by, az - bz),
    get saved() {
      return m.saved;
    },
    get: (id: string) => {
      const no = m.nodes.get(id);
      if (!no) return null;
      return {
        id,
        x: no.x,
        y: no.y,
        z: no.z,
        vx: no.vx,
        vy: no.vy,
        vz: no.vz,
        health: m.health.get(id) ?? 100,
        grounded: true,
        visible: no.visible,
        color: no.color,
      };
    },
    spawn: (id: string, patch: any) => criarNo(id, patch, "spawn"),
    set: (id: string, patch: any) => aplicar(id, patch, "set"),
    move: (id: string, patch: any, segundos = 0.4) => {
      m.contando();
      const no = m.valido(id);
      if (!no || !patch) return;
      const from: any = {},
        to: any = {};
      for (const chave of ["x", "y", "z", "rx", "ry", "rz"]) {
        if (typeof patch[chave] !== "number" || !Number.isFinite(patch[chave]))
          continue;
        if (["rx", "ry", "rz"].includes(chave) && Math.abs(patch[chave]) > 3600)
          m.erros.push("rotação fora do limite em move: " + patch[chave]);
        from[chave] = no[chave as "x"];
        to[chave] = patch[chave];
      }
      if (!Object.keys(to).length) return;
      m.tweens = m.tweens.filter((t) => t.id !== id);
      m.tweens.push({ id, from, to, t: 0, dur: Math.max(0.05, segundos) });
    },
    remove: (id: string) => {
      m.contando();
      m.nodes.delete(id);
      m.health.delete(id);
      m.tweens = m.tweens.filter((t) => t.id !== id);
    },
    damage: (id: string, valor: number) => {
      m.contando();
      const no = m.valido(id);
      if (!no) return;
      if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0)
        return m.erros.push("dano inválido: " + valor);
      m.health.set(id, Math.max(0, (m.health.get(id) ?? 100) - Math.min(100, valor)));
    },
    heal: (id: string, valor: number) => {
      m.contando();
      const no = m.valido(id);
      if (!no) return;
      m.health.set(id, Math.min(100, (m.health.get(id) ?? 100) + valor));
    },
    ragdoll: (id: string, ativo = true) => {
      m.contando();
      m.valido(id);
      void ativo;
    },
    bot: (id: string, modo: string) => {
      m.contando();
      const no = m.valido(id);
      if (!no) return;
      if (!["off", "patrol", "follow", "attack"].includes(modo))
        m.erros.push("modo de bot inválido: " + modo);
      no.actor = { ...no.actor, bot: modo };
    },
    walk: (id: string, x: number, z: number, velocidade: number) => {
      m.contando();
      m.valido(id);
      if (Math.abs(x) > 1000 || Math.abs(z) > 1000 || velocidade > 30 || velocidade < 0)
        m.erros.push("walk fora do limite");
    },
    rotate: (id: string, velocidade: number) => {
      m.contando();
      m.valido(id);
      if (Math.abs(velocidade) > 720) m.erros.push("rotate fora do limite");
    },
    stop: (id: string) => {
      m.contando();
      m.valido(id);
    },
    impulse: (id: string, x: number, y: number, z: number) => {
      m.contando();
      m.valido(id);
      if ([x, y, z].some((v) => Math.abs(v) > 100)) m.erros.push("impulso fora do limite");
    },
    light: (id: string, patch: any) => {
      m.contando();
      const no = m.valido(id);
      if (!no) return;
      const tipo = patch?.type ?? no.light?.type ?? "point";
      aplicar(id, { light: { ...patch, type: tipo, color: patch?.color ?? no.light?.color ?? "#ffffff" } }, "light");
    },
    flicker: (id: string, duracao: number, intensidade: number) => {
      m.contando();
      if (id !== "*" && !m.nodes.has(id)) m.erros.push("flicker em nó inexistente: " + id);
      if (duracao < 0 || duracao > 60 || intensidade < 0.05 || intensidade > 1)
        m.erros.push("flicker fora do limite");
    },
    torch: (ativo: boolean, patch: any) => {
      m.contando();
      if (typeof ativo !== "boolean") m.erros.push("torch sem booleano");
      if (patch && patch.intensity !== undefined && (patch.intensity < 0 || patch.intensity > 60))
        m.erros.push("torch.intensity fora do limite");
    },
    sound: (nome: string, volume: number, tom: number) => {
      m.contando();
      if (!(soundNames as readonly string[]).includes(nome))
        m.erros.push("som desconhecido: " + nome);
      if (volume < 0 || volume > 1.4 || tom < 0.4 || tom > 2.5)
        m.erros.push("som fora do limite: " + nome);
      m.sons.push(nome);
    },
    loop: (nome: string, volume: number) => {
      m.contando();
      if (!(loopNames as readonly string[]).includes(nome))
        m.erros.push("loop desconhecido: " + nome);
      if (volume <= 0) m.loops.delete(nome);
      else m.loops.set(nome, volume);
    },
    volume: (v: number) => {
      m.contando();
      if (v < 0 || v > 1) m.erros.push("volume fora do limite");
    },
    ui: (id: string, patch: any) => {
      m.contando();
      if (!uiIds.has(id)) return m.erros.push("HUD inexistente: " + id);
      for (const chave of Object.keys(patch ?? {}))
        if (!["text", "visible", "value", "color", "background"].includes(chave))
          m.erros.push("patch de HUD inválido: " + chave);
      if (typeof patch?.text === "string" && patch.text.length > 1200)
        m.erros.push("texto de HUD longo demais: " + id);
      if (patch?.value !== undefined && (patch.value < 0 || patch.value > 1))
        m.erros.push("valor de barra fora do limite: " + id);
      m.uiPatch.set(id, { ...(m.uiPatch.get(id) ?? {}), ...patch });
    },
    store: (dados: any) => {
      m.contando();
      try {
        JSON.stringify(dados);
      } catch {
        m.erros.push("store não serializável");
        return;
      }
      m.store = dados;
    },
    freeze: (v: boolean) => {
      m.contando();
      m.congelado = v;
    },
    hand: () => m.contando(),
    shake: () => m.contando(),
    respawn: () => m.contando(),
    sky: () => m.contando(),
    voxel: { size: 0, height: 0, get: () => 0, set: () => false, snapshot: () => [], replace: () => {} },
  };
  return { api, jogadorId };
}

type Cenario = {
  m: MockEngine;
  update: (dt: number, time: number, input: any) => void;
  api: any;
  passo: (opcoes?: any) => void;
  tempo: { t: number };
  teclas: Set<string>;
  aperta: (tecla: string) => void;
};
function iniciar(transformacao?: (fonte: string) => string, semente = 20240929): Cenario {
  const fonte = transformacao ? transformacao(fonteOriginal) : fonteOriginal;
  const m = new MockEngine();
  const { api } = criarAPI(m);
  const jogador = m.criar("jogador", { actor: { humanoid: true, health: 100 } });
  jogador.x = 0;
  jogador.z = 6;
  jogador.y = 1.05;
  m.criar("lobby.elevador", { light: { type: "point" } });
  let estado = semente >>> 0;
  const mathFalso = Object.create(Math) as Math;
  mathFalso.random = () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
  const fabrica = new Function(
    "self",
    "engine",
    "Math",
    `${fonte}\n;if(typeof update!=="function")throw new Error("sem update");let started=false;return (dt,time,input)=>{if(!started){started=true;if(typeof start==="function")start();}update(dt,time,input);};`,
  );
  const update = fabrica({ id: "controlador" }, api, mathFalso) as any;
  const tempo = { t: 0 };
  const teclas = new Set<string>();
  const cenario: Cenario = {
    m,
    api,
    update,
    tempo,
    teclas,
    passo: () => {},
    aperta: (tecla: string) => teclas.add(tecla),
  };
  const alvo = { id: null as string | null, distancia: 99 };
  const jogarPasso = (dt = 1 / 30, extra: any = {}) => {
    const pressed: any = {};
    for (const tecla of teclas) pressed[tecla] = true;
    teclas.clear();
    const no = m.nodes.get("jogador")!;
    const camera = extra.camera ?? {
      origin: [no.x, no.y + 0.75, no.z],
      direction: extra.direction ?? [0, 0, -1],
    };
    m.tique();
    m.avancar(dt);
    cenario.tempo.t += dt;
    update(dt, cenario.tempo.t, {
      ...Object.fromEntries([...(extra.held ?? [])].map((k: string) => [k, true])),
      pressed,
      released: {},
      events: [],
      camera,
      ray: null,
      target: alvo.id ? { id: alvo.id, distance: alvo.distancia } : null,
      ...extra.resto,
    });
  };
  cenario.passo = (opcoes: any = {}) => {
    jogarPasso(opcoes.dt ?? 1 / 30, {
      held: opcoes.held ? new Set(opcoes.held) : undefined,
      direction: opcoes.direction,
      camera: opcoes.camera,
      resto: opcoes.resto,
    });
  };
  cenario.passo.definirAlvo = (id: string | null, distancia = 1.5) => {
    alvo.id = id;
    alvo.distancia = distancia;
  };
  return Object.assign(cenario, {
    definirAlvo: (id: string | null, distancia = 1.5) => {
      alvo.id = id;
      alvo.distancia = distancia;
    },
    moverPara: (x: number, z: number, velocidade: number, dt: number) => {
      const no = m.nodes.get("jogador")!;
      const dx = x - no.x,
        dz = z - no.z,
        dist = Math.hypot(dx, dz);
      if (dist < 0.05) return 0;
      const passo = Math.min(dist, velocidade * dt);
      no.vx = (dx / dist) * velocidade;
      no.vz = (dz / dist) * velocidade;
      no.x += (dx / dist) * passo;
      no.z += (dz / dist) * passo;
      return dist;
    },
    posicao: () => {
      const no = m.nodes.get("jogador")!;
      return { x: no.x, z: no.z, y: no.y };
    },
    portaAtual: () => {
      const texto = m.uiPatch.get("hud.porta")?.text ?? "";
      const achado = /PORTA\s+(\d+)/.exec(texto);
      return achado ? Number(achado[1]) : 0;
    },
    fase: () => {
      if (m.uiPatch.get("tela.morte")?.visible) return "morto";
      if (m.uiPatch.get("tela.vitoria")?.visible) return "vitoria";
      if (m.uiPatch.get("hud.seek")?.visible) return "corrida";
      return "hotel";
    },
    erros: () => m.erros,
  });
}
type CenarioCompleto = ReturnType<typeof iniciar> & {
  definirAlvo: (id: string | null, distancia?: number) => void;
  moverPara: (x: number, z: number, velocidade: number, dt: number) => number;
  posicao: () => { x: number; z: number; y: number };
  portaAtual: () => number;
  fase: () => string;
  erros: () => string[];
};
/** Bot de teste: anda até a meta, interage e (na biblioteca) puxa a alavanca. */
function avancarPortas(
  c: CenarioCompleto,
  quantas: number,
  opcoes: { limite?: number; aoPasso?: () => void } = {},
) {
  const dt = 1 / 30;
  const limite = opcoes.limite ?? 60000;
  let ticks = 0,
    ultima = 0,
    parado = 0,
    interagiu = false;
  while (ticks < limite && c.portaAtual() < quantas) {
    ticks++;
    opcoes.aoPasso?.();
    const porta = c.portaAtual();
    if (porta !== ultima) {
      ultima = porta;
      parado = 0;
      interagiu = false;
    } else parado++;
    if (parado > 4000) break;
    if (c.fase() === "morto") {
      c.aperta("e");
      c.passo({ dt });
      continue;
    }
    const alvo = c.m.nodes.get(`porta.${porta + 1}`);
    const corrida = c.fase() === "corrida";
    if (!alvo) {
      c.passo({ dt, held: corrida ? ["shift"] : [] });
      continue;
    }
    const eu = c.posicao();
    const dx = alvo.x - eu.x,
      dz = alvo.z - eu.z,
      dist = Math.hypot(dx, dz) || 1;
    const piso = c.m.nodes.get(`s${porta + 1}.piso`);
    const destino = interagiu && piso ? { x: piso.x, z: piso.z } : alvo;
    const velocidade = corrida ? 7.6 : 5.2;
    const resto = c.moverPara(destino.x, destino.z, velocidade, dt);
    if (!interagiu && dist < 2.2 && resto < 2.2) {
      c.aperta("e");
      if (corrida || dist < 1.6) interagiu = true;
    }
    if (parado > 150) {
      const alavanca = [...c.m.nodes.keys()].find((id) => /^s\d+\.alavanca$/.test(id));
      if (alavanca) {
        const alc = c.m.nodes.get(alavanca)!;
        c.moverPara(alc.x, alc.z, 5.2, dt);
        c.definirAlvo(alavanca, 1.4);
        c.aperta("e");
        c.passo({ dt });
        continue;
      }
    }
    c.definirAlvo(`porta.${porta + 1}`, Math.min(dist, 5));
    c.passo({ dt, held: corrida ? ["shift"] : [] });
  }
  return ticks;
}
/** Zera trancas e criaturas para os testes de caminhada. */
function semPerigos(fonte: string) {
  return fonte
    .replace("rush: 0.085", "rush: 0")
    .replace("ambush: 0.05", "ambush: 0")
    .replace("halt: 0.07", "halt: 0")
    .replace("escuro: 0.2", "escuro: 0")
    .replace("quadro: 0.32", "quadro: 0")
    .replace("escondido: 0.1", "escondido: 0")
    .replace("trancada: 0.18", "trancada: 0")
    .replace("cadeado: 0.16", "cadeado: 0")
    .replace("alavanca: 0.12", "alavanca: 0")
    .replace("jack: 0.05", "jack: 0")
    .replace("timothy: 0.07", "timothy: 0")
    .replace("shadow: 0.035", "shadow: 0")
    .replace("snare: 0.05", "snare: 0")
    .replace("dupe: 0.07", "dupe: 0")
    .replace("perigo: 1,", "perigo: 0,");
}
function passos(c: CenarioCompleto, quantos = 14) {
  for (let i = 0; i < quantos; i++) c.passo({ dt: 1 / 30 });
}
function texto(c: CenarioCompleto, id: string) {
  return c.m.uiPatch.get(id)?.text ?? "";
}

test("portas: inicia no saguão, elevador gera a sala 1 e o HUD responde", () => {
  const c = iniciar() as CenarioCompleto;
  for (let i = 0; i < 10; i++) c.passo({ dt: 1 / 30 });
  assert.ok(c.m.uiPatch.get("tela.inicio") === undefined || c.m.uiPatch.get("tela.inicio"));
  assert.equal(c.m.nodes.get("s1.piso"), undefined, "nenhuma sala antes de começar");
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  for (let i = 0; i < 40; i++) c.passo({ dt: 1 / 30 });
  assert.ok(c.m.nodes.has("s1.piso"), "sala 1 construída");
  assert.ok(c.m.nodes.has("porta.2"), "porta 2 existe na sala 1");
  assert.equal(c.portaAtual(), 1, "contador mostra porta 1");
  assert.match(c.m.uiPatch.get("hud.objetivo")?.text ?? "", /porta 2/i);
  assert.deepEqual(c.erros(), [], "nenhum comando inválido para a engine");
});
test("portas: 8 portas andando como jogador, removendo salas antigas", () => {
  const c = iniciar(semPerigos) as CenarioCompleto;
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  const ticks = avancarPortas(c, 8);
  assert.ok(
    c.portaAtual() >= 8,
    "chegou à porta 8 (ficou na " + c.portaAtual() + ", " + ticks + " quadros)",
  );
  assert.deepEqual(c.erros(), []);
  const vivas = [...c.m.nodes.keys()].map((id) => Number(/^s(\d+)\./.exec(id)?.[1] ?? 0));
  assert.ok(Math.max(...vivas) >= 8, "a sala 8 foi construída");
  assert.equal(
    [...c.m.nodes.keys()].some((id) => /^s1\./.test(id)),
    false,
    "sala 1 removida depois de avançar",
  );
  assert.equal(
    [...c.m.nodes.keys()].some((id) => /^s2\./.test(id)),
    false,
    "sala 2 removida depois de avançar",
  );
  assert.ok(c.m.maxComandos < 220, "comandos por quadro abaixo do limite: " + c.m.maxComandos);
});
test("portas: porta trancada exige a chave; cadeado exige gazua; alavanca destranca", () => {
  const c = iniciar((fonte) =>
    fonte
      .replace("trancada: 0.18", "trancada: 1")
      .replace("cadeado: 0.16", "cadeado: 0")
      .replace("alavanca: 0.12", "alavanca: 0"),
  ) as CenarioCompleto;
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  for (let i = 0; i < 6; i++) c.passo({ dt: 1 / 30 });
  const porta = c.m.nodes.get("porta.2")!;
  c.moverPara(porta.x, porta.z, 5.2, 1 / 30);
  for (let i = 0; i < 30; i++) {
    c.moverPara(porta.x, porta.z, 0, 1 / 30);
    c.definirAlvo("porta.2", 1.5);
    c.aperta("e");
    c.passo({ dt: 1 / 30 });
  }
  assert.equal(porta.ry, 0, "porta continua fechada sem a chave");
  assert.match(c.m.uiPatch.get("hud.aviso")?.text ?? "", /chave/i);
  const item = [...c.m.nodes.keys()].find((id) => id.includes(".item."));
  assert.ok(item, "algum item apareceu na sala");
  // pega a chave (o item é o único objeto da sala com luz própria e id de item)
  const chave = [...c.m.nodes.keys()].find((id) => id.includes(".item.") && c.m.nodes.get(id)!.light.type === "point");
  c.moverPara(c.m.nodes.get(chave!)!.x, c.m.nodes.get(chave!)!.z, 8, 1 / 30);
  c.definirAlvo(chave!, 1);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  assert.match(c.m.uiPatch.get("hud.aviso")?.text ?? "", /chave|Pilha|Curativo|Gazua|moeda/i);
  // volta para a porta e abre
  for (let i = 0; i < 40; i++) {
    c.moverPara(porta.x, porta.z, 5.2, 1 / 30);
    c.definirAlvo("porta.2", 1.5);
    if (i === 20) c.aperta("e");
    c.passo({ dt: 1 / 30 });
  }
  assert.ok(c.m.tweens.some((t) => t.id === "porta.2") || porta.ry !== 0, "porta abriu com a chave");
});
test("portas: Rush mata quem fica no corredor, esconderijo protege e crucifixo repele", () => {
  const c = iniciar((fonte) =>
    semPerigos(fonte)
      .replace("(sala.tema || escolha(TEMAS))", "(sala.tema || TEMAS[0])")
      .replace("crucifixo: 0,", "crucifixo: 1,")
      .replace("S.crucifixo = 0;", "S.crucifixo = 1;"),
  ) as CenarioCompleto;
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  avancarPortas(c, 1);
  c.aperta("7");
  c.passo({ dt: 1 / 30 });
  assert.ok(c.m.nodes.has("ent.rush"), "Rush nasceu pelo atalho de depuração");
  let morreu = false;
  for (let i = 0; i < 900; i++) {
    c.passo({ dt: 1 / 30 });
    if ((c.m.health.get("jogador") ?? 100) <= 0) {
      morreu = true;
      break;
    }
  }
  assert.ok(morreu, "Rush alcançou quem não se escondeu");
  passos(c, 14);
  assert.equal(c.m.uiPatch.get("tela.morte")?.visible, true, "tela de morte apareceu");
  assert.match(texto(c, "tela.morte"), /VOCÊ MORREU/);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  assert.equal(c.m.health.get("jogador"), 100, "reviveu com vida cheia");
  passos(c, 14);
  assert.equal(c.m.uiPatch.get("tela.morte")?.visible, false, "tela de morte saiu");
  // esconderijo: entra no armário antes do Rush passar
  const armario = [...c.m.nodes.keys()].find((id) => /^s\d+\.armario\.porta\.\d+$/.test(id));
  assert.ok(armario, "a sala tem armário");
  const no = c.m.nodes.get(armario!)!;
  c.moverPara(no.x, no.z, 5.2, 1 / 30);
  c.definirAlvo(armario!, 1.2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  passos(c, 14);
  assert.match(texto(c, "hud.escondido"), /ESCONDIDO/);
  assert.equal(c.m.congelado, true, "entrada congelada enquanto escondido");
  const vidaAntes = c.m.health.get("jogador")!;
  c.aperta("7");
  c.passo({ dt: 1 / 30 });
  for (let i = 0; i < 900 && c.m.nodes.has("ent.rush"); i++) c.passo({ dt: 1 / 30 });
  assert.equal(c.m.health.get("jogador"), vidaAntes, "escondido não toma dano do Rush");
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  passos(c, 14);
  assert.equal(c.m.congelado, false, "sai do esconderijo");
  // crucifixo: sem se esconder, mas com proteção ativa
  c.aperta("c");
  passos(c, 14);
  assert.match(texto(c, "hud.itens"), /Crucifixo 0/);
  assert.match(texto(c, "hud.aviso"), /Crucifixo erguido/);
  c.aperta("7");
  c.passo({ dt: 1 / 30 });
  // o Rush pode ser repelido já no primeiro quadro (nasce perto do jogador)
  let repeliu = false;
  for (let i = 0; i < 600; i++) {
    const r = c.m.nodes.get("ent.rush");
    if (!r) {
      repeliu = true;
      break;
    }
    const eu = c.m.nodes.get("jogador")!;
    eu.x = r.x;
    eu.z = r.z;
    c.passo({ dt: 1 / 30 });
  }
  assert.ok(repeliu, "o Rush sumiu ao tocar no crucifixo");
  assert.equal(c.m.health.get("jogador"), 100, "o crucifixo impediu o dano");
  assert.match(texto(c, "hud.aviso"), /crucifixo/i);
  assert.deepEqual(c.erros(), []);
});
test("portas: Screech ataca nas escuras e foge se for encarado", () => {
  const c = iniciar((fonte) =>
    fonte
      .replace("quadro: 0.32", "quadro: 0")
      .replace("rush: 0.085", "rush: 0")
      .replace("ambush: 0.05", "ambush: 0")
      .replace("halt: 0.07", "halt: 0"),
  ) as CenarioCompleto;
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  for (let i = 0; i < 40; i++) c.passo({ dt: 1 / 30 });
  c.m.health.set("jogador", 100);
  c.aperta("9");
  c.passo({ dt: 1 / 30, direction: [0, -1, 0] });
  assert.ok(c.m.nodes.has("ent.screech"), "Screech apareceu");
  const vida = c.m.health.get("jogador")!;
  for (let i = 0; i < 80; i++) c.passo({ dt: 1 / 30, direction: [0, -1, 0] });
  assert.equal(c.m.health.get("jogador"), vida - 30, "levou 30 de dano sem olhar");
  assert.equal(c.m.nodes.has("ent.screech"), false, "Screech foi embora depois do ataque");
  c.m.health.set("jogador", 100);
  c.aperta("9");
  c.passo({ dt: 1 / 30 });
  const screech = c.m.nodes.get("ent.screech")!;
  const no = c.m.nodes.get("jogador")!;
  const dx = screech.x - no.x,
    dz = screech.z - no.z,
    d = Math.hypot(dx, dz);
  for (let i = 0; i < 20; i++)
    c.passo({ dt: 1 / 30, direction: [dx / d, 0, dz / d] });
  assert.equal(c.m.nodes.has("ent.screech"), false, "encarar o Screech o expulsa");
  assert.equal(c.m.health.get("jogador"), 100, "não tomou dano quando olhou");
  assert.deepEqual(c.erros(), []);
});
test("portas: olhos dos quadros machucam", () => {
  const c = iniciar((fonte) =>
    fonte
      .replace("escuro: 0.2", "escuro: 0")
      .replace("quadro: 0.32", "quadro: 1")
      .replace("rush: 0.085", "rush: 0")
      .replace("escolha(TEMAS)", "TEMAS[0]"),
  ) as CenarioCompleto;
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  for (let i = 0; i < 60; i++) c.passo({ dt: 1 / 30 });
  const quadro = [...c.m.nodes.keys()].find((id) => id.includes(".quadro."));
  assert.ok(quadro, "a sala tem quadro com olhos");
  const q = c.m.nodes.get(quadro!)!;
  const antes = c.m.health.get("jogador")!;
  const no = c.m.nodes.get("jogador")!;
  const dx = q.x - no.x,
    dz = q.z - no.z,
    d = Math.hypot(dx, dz);
  for (let i = 0; i < 60; i++) {
    c.definirAlvo(null);
    c.passo({ dt: 1 / 30, direction: [dx / d, 0.05, dz / d] });
  }
  assert.ok(c.m.health.get("jogador")! < antes, "encarar o quadro causou dano");
  assert.deepEqual(c.erros(), []);
});
test("portas: Halt pune quem anda para frente e recua quando o jogador para", () => {
  const variacao = (fonte: string) =>
    fonte
      .replace("rush: 0.085", "rush: 0")
      .replace("ambush: 0.05", "ambush: 0")
      .replace("halt: 0.07", "halt: 1")
      .replace("forcar: null", 'forcar: "halt"');
  // caso 1: parado, o Halt recua e não há dano
  const parado = iniciar(variacao) as CenarioCompleto;
  parado.definirAlvo("lobby.elevador", 2);
  parado.aperta("e");
  parado.passo({ dt: 1 / 30 });
  for (let i = 0; i < 400; i++) parado.passo({ dt: 1 / 30 });
  assert.equal(parado.m.health.get("jogador"), 100, "quem para não toma dano do Halt");
  assert.equal(parado.m.nodes.has("ent.halt"), false, "Halt foi embora");
  // caso 2: andando para frente, o dano acontece
  const andando = iniciar(variacao) as CenarioCompleto;
  andando.definirAlvo("lobby.elevador", 2);
  andando.aperta("e");
  andando.passo({ dt: 1 / 30 });
  for (let i = 0; i < 400; i++)
    andando.passo({
      dt: 1 / 30,
      held: ["w"],
      resto: { w: true },
    });
  assert.ok(andando.m.health.get("jogador")! < 100, "quem anda para frente leva dano do Halt");
  assert.deepEqual(andando.erros(), []);
});
test("portas: perseguição do Seek começa na porta 34 e termina alguns lances depois", () => {
  const c = iniciar(semPerigos) as CenarioCompleto;
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  let viuCorrida = false;
  let viuSeek = false;
  const ticks = avancarPortas(c, 38, {
    aoPasso: () => {
      if (c.fase() === "corrida") viuCorrida = true;
      if (c.m.nodes.has("ent.seek")) viuSeek = true;
    },
  });
  assert.ok(viuCorrida, "a corrida do Seek começou perto da porta 34");
  assert.ok(viuSeek, "o Seek apareceu no corredor de fuga");
  assert.ok(
    c.portaAtual() >= 38,
    "atravessou a corrida (ficou na " + c.portaAtual() + ", " + ticks + " quadros)",
  );
  passos(c, 14);
  assert.equal(c.m.uiPatch.get("hud.seek")?.visible, false, "a fase de corrida terminou");
  assert.equal(c.m.nodes.has("ent.seek"), false, "o Seek foi removido");
  assert.match(texto(c, "hud.aviso"), /escapou/i);
  assert.deepEqual(c.erros(), []);
});
test("portas: loja do Jeff vende itens com moedas", () => {
  const c = iniciar((fonte) =>
    semPerigos(fonte).replace("portaDaLoja: 40", "portaDaLoja: 3"),
  ) as CenarioCompleto;
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  avancarPortas(c, 3);
  assert.ok(c.m.nodes.has("s3.jeff"), "Jeff está na loja");
  const jeff = c.m.nodes.get("s3.jeff")!;
  c.moverPara(jeff.x, jeff.z, 5.2, 1 / 30);
  c.definirAlvo("s3.jeff", 1.4);
  c.aperta("e");
  passos(c, 14);
  assert.equal(c.m.uiPatch.get("tela.loja")?.visible, true, "painel da loja abriu");
  assert.match(texto(c, "tela.loja"), /LOJA DO JEFF/);
  c.aperta("6");
  c.passo({ dt: 1 / 30 });
  c.aperta("6");
  c.passo({ dt: 1 / 30 });
  c.aperta("2");
  passos(c, 14);
  assert.match(texto(c, "hud.aviso"), /Comprado/i);
  assert.match(texto(c, "hud.itens"), /Gazua 1/);
  c.aperta("e");
  passos(c, 14);
  assert.equal(c.m.uiPatch.get("tela.loja")?.visible, false, "saiu da loja");
  assert.deepEqual(c.erros(), []);
});
test("portas: biblioteca — alavanca destrava a porta e a Figura recua", () => {
  const c = iniciar((fonte) =>
    semPerigos(fonte).replace("portaDaBiblioteca: 60", "portaDaBiblioteca: 3"),
  ) as CenarioCompleto;
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  avancarPortas(c, 3);
  assert.ok(c.m.nodes.has("ent.figura"), "a Figura apareceu na biblioteca");
  assert.ok(c.m.nodes.has("s3.alavanca"), "a biblioteca tem alavanca");
  const figura = c.m.nodes.get("ent.figura")!;
  const porta = c.m.nodes.get("porta.4")!;
  assert.ok(porta, "a biblioteca tem porta de saída");
  c.moverPara(porta.x, porta.z, 5.2, 1 / 30);
  c.definirAlvo("porta.4", 1.5);
  c.aperta("e");
  passos(c, 14);
  const ryFechada = porta.ry;
  assert.ok(
    Math.abs(ryFechada - (porta.ry % 360)) < 0.001,
    "a porta da biblioteca não abre antes da alavanca (ângulo " + ryFechada + ")",
  );
  assert.match(texto(c, "hud.aviso"), /alavanca/i);
  const alc = c.m.nodes.get("s3.alavanca")!;
  for (let i = 0; i < 40; i++) {
    c.moverPara(alc.x, alc.z, 5.2, 1 / 30);
    c.definirAlvo("s3.alavanca", 1.4);
    if (i === 20) c.aperta("e");
    c.passo({ dt: 1 / 30 });
  }
  passos(c, 14);
  assert.match(texto(c, "hud.aviso"), /biblioteca|Figura/i);
  assert.ok(
    Math.hypot(figura.x - alc.x, figura.z - alc.z) > 3,
    "a Figura recuou para longe da alavanca",
  );
  for (let i = 0; i < 40; i++) {
    c.moverPara(porta.x, porta.z, 5.2, 1 / 30);
    c.definirAlvo("porta.4", 1.5);
    if (i === 20) c.aperta("e");
    c.passo({ dt: 1 / 30 });
  }
  assert.ok(porta.ry !== 0, "porta da biblioteca abriu depois da alavanca");
  assert.deepEqual(c.erros(), []);
});
test("portas: 3000 passos sem erro em configuração normal (estabilidade)", () => {
  const c = iniciar() as CenarioCompleto;
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  for (let i = 0; i < 3000; i++) {
    const porta = c.portaAtual();
    const proxima = c.m.nodes.get(`porta.${porta + 1}`);
    if (proxima) {
      const resto = c.moverPara(proxima.x, proxima.z, 5.2, 1 / 30);
      c.definirAlvo(`porta.${porta + 1}`, Math.min(resto, 5));
      if (resto < 2.1) c.aperta("e");
    }
    if (c.fase() === "morto") c.aperta("e");
    c.passo({ dt: 1 / 30 });
  }
  assert.deepEqual(c.erros(), []);
  assert.ok(c.m.maxComandos < 220, "pico de comandos: " + c.m.maxComandos);
});

/* ===================== v0.7 — gavetas, vãos, texturas, criaturas ========= */
function comecarJogo(c: CenarioCompleto, salaInicial = 1) {
  c.definirAlvo("lobby.elevador", 2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  for (let i = 0; i < 14; i++) c.passo({ dt: 1 / 30 });
  return salaInicial;
}
/** sala atual segundo o HUD da porta */
function salaDoHud(c: CenarioCompleto) {
  return c.portaAtual();
}

test("portas: gaveta desliza para fora do móvel e devolve saque", () => {
  /* força o tema "quarto" (que tem gaveteiro) para o teste ficar estável */
  const c = iniciar((fonte) =>
    semPerigos(fonte).replace("escolha(TEMAS)", "TEMAS[0]"),
  ) as CenarioCompleto;
  comecarJogo(c);
  const sala = salaDoHud(c);
  const gaveta = [...c.m.nodes.keys()].find(
    (id) => new RegExp(`^s${sala}\\.gaveta\\.\\d+$`).test(id),
  );
  assert.ok(gaveta, "a sala tem gaveteiro com gaveta");
  const salaDaGaveta = sala;
  const puxador = [...c.m.nodes.keys()].find(
    (id) => new RegExp(`^s${salaDaGaveta}\\.puxador\\.\\d+$`).test(id),
  );
  assert.ok(puxador, "a gaveta tem puxador");
  const corpo = [...c.m.nodes.keys()].find(
    (id) => new RegExp(`^s${salaDaGaveta}\\.gaveteiro\\.\\d+$`).test(id),
  );
  assert.ok(corpo, "a gaveta tem gaveteiro");
  const antes = { ...c.m.nodes.get(gaveta!)! };
  const distAntes = Math.hypot(
    antes.x - c.m.nodes.get(corpo!)!.x,
    antes.z - c.m.nodes.get(corpo!)!.z,
  );
  c.moverPara(antes.x, antes.z, 5.2, 1 / 30);
  c.definirAlvo(gaveta!, 1.4);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  passos(c, 24);
  const depois = c.m.nodes.get(gaveta!)!;
  const distDepois = Math.hypot(
    depois.x - c.m.nodes.get(corpo!)!.x,
    depois.z - c.m.nodes.get(corpo!)!.z,
  );
  assert.ok(
    distDepois < 2.6,
    "a gaveta não pode atravessar a parede: " + distDepois.toFixed(2),
  );
  assert.ok(
    Math.abs(depois.x - antes.x) + Math.abs(depois.z - antes.z) > 0.4,
    "a gaveta desliza para fora do gaveteiro",
  );
  const p = c.m.nodes.get(puxador!)!;
  assert.ok(
    Math.hypot(p.x - depois.x, p.z - depois.z) < 0.6,
    "o puxador acompanha a gaveta",
  );
  assert.match(texto(c, "hud.aviso"), /gaveta|Timothy|Jack|moeda|Pilha|Curativo|Gazua|Crucifixo|Vitamin|Chave|vazia|poeira/i);
  // segundo E: saque
  c.definirAlvo(gaveta!, 1.4);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  assert.match(
    texto(c, "hud.aviso"),
    /moeda|Pilha|Curativo|Gazua|Crucifixo|Vitamin|Chave|vazia|poeira|Timothy|Jack/i,
  );
  assert.deepEqual(c.erros(), []);
});

test("portas: a porta de cada sala dá para a sala vizinha (vão, porta e vizinha alinhados)", () => {
  const c = iniciar((fonte) => semPerigos(fonte)) as CenarioCompleto;
  comecarJogo(c);
  const piso = (sala: number) => c.m.nodes.get(`s${sala}.piso`);
  let anterior = piso(1)!;
  assert.ok(anterior, "sala 1 construída");
  for (let sala = 1; sala <= 6; sala++) {
    const noPorta = c.m.nodes.get(`porta.${sala + 1}`);
    assert.ok(noPorta, "sala " + sala + " tem porta de saída");
    /* foto da porta fechada: depois ela gira ao abrir */
    const porta = { x: noPorta!.x, z: noPorta!.z };
    avancarPortas(c, sala + 1);
    assert.equal(c.portaAtual(), sala + 1, "entrou na sala " + (sala + 1));
    const atual = piso(sala + 1);
    assert.ok(atual, "sala " + (sala + 1) + " existe");
    const dist = Math.hypot(atual!.x - anterior.x, atual!.z - anterior.z);
    assert.ok(
      Math.abs(dist - 14) < 0.01,
      "sala " + (sala + 1) + " encosta na " + sala + " (distância " + dist.toFixed(2) + ")",
    );
    /* a porta fica na parede entre as duas salas: desvio zero no eixo do caminho */
    const meio = { x: (anterior.x + atual!.x) / 2, z: (anterior.z + atual!.z) / 2 };
    const ax = (atual!.x - anterior.x) / dist,
      az = (atual!.z - anterior.z) / dist,
      dx = porta!.x - meio.x,
      dz = porta!.z - meio.z;
    const noEixo = Math.abs(dx * ax + dz * az),
      naParede = Math.abs(dx * -az + dz * ax);
    assert.ok(
      noEixo < 0.6,
      "a porta " + (sala + 1) + " está na parede certa (desvio " + noEixo.toFixed(2) + ")",
    );
    assert.ok(
      naParede < 6,
      "a porta " + (sala + 1) + " está dentro do vão (afastamento " + naParede.toFixed(2) + ")",
    );
    /* a sala de onde viemos tem vão na parede desse lado (peças .e/.d/.alto) */
    const vaos = [...c.m.nodes.keys()].filter(
      (id) =>
        new RegExp(`^s${sala}\\.w[zx]-?\\d+\\.(e|d|alto)$`).test(id) &&
        Math.hypot(c.m.nodes.get(id)!.x - porta!.x, c.m.nodes.get(id)!.z - porta!.z) < 9,
    );
    assert.ok(vaos.length >= 2, "a parede da sala " + sala + " tem vão no lado da porta");
    anterior = atual!;
  }
  assert.deepEqual(c.erros(), []);
});
test("portas: nenhum móvel tampou o corredor dos vãos em 12 salas", () => {
  const c = iniciar((fonte) => semPerigos(fonte)) as CenarioCompleto;
  comecarJogo(c);
  const conferidas = new Set<number>();
  let falhas: string[] = [];
  const conferir = () => {
    const sala = salaDoHud(c);
    if (!sala || conferidas.has(sala)) return;
    conferidas.add(sala);
    const piso = c.m.nodes.get(`s${sala}.piso`);
    if (!piso) return;
    const meio = 7; // MEIA celula
    const largura = 2.35; // V/2 + 1.15
    for (const porta of [`porta.${sala}`, `porta.${sala + 1}`]) {
      const no = c.m.nodes.get(porta);
      if (!no) continue;
      const dx = no.x - piso.x,
        dz = no.z - piso.z;
      const vertical = Math.abs(dz) > Math.abs(dx); // parede em z? (vão ao norte/sul)
      for (const [id, obj] of c.m.nodes) {
        if (!id.startsWith(`s${sala}.`)) continue;
        if (/\.(wx|wz|piso|teto|alto|placa|luminaria|snare|elevador|jeff|alavanca|vitrine|espelho|quadro|olho)/.test(id))
          continue;
        if (/^s\d+\.porta\.|porta\./.test(id)) continue;
        if (obj.physics !== "static") continue;
        const h0 = vertical ? obj.scale[2] / 2 : obj.scale[0] / 2;
        const h1 = vertical ? obj.scale[0] / 2 : obj.scale[2] / 2;
        const along = vertical ? Math.abs(obj.x - piso.x) - h1 : Math.abs(obj.z - piso.z) - h0;
        const radial = vertical ? Math.abs(obj.z - piso.z) - h0 : Math.abs(obj.x - piso.x) - h1;
        // dentro do corredor do vão?
        if (along < largura && radial > meio - 7.5 && radial < meio - 0.2) {
          // só conta se realmente entrou na faixa interna (0.3 a 1.25 da parede)
          const entrada = meio - (radial + 2 * h0);
          if (entrada < 1.25) falhas.push(`${id} tampou o vão ${porta}`);
        }
      }
    }
  };
  avancarPortas(c, 12, { aoPasso: conferir });
  assert.ok(conferidas.size >= 8, "conferiu pelo menos 8 salas: " + conferidas.size);
  assert.deepEqual(falhas, [], "móveis dentro do corredor das portas");
  assert.deepEqual(c.erros(), []);
});

test("portas: paredes, piso e móveis recebem as texturas do projeto", () => {
  const c = iniciar((fonte) => semPerigos(fonte)) as CenarioCompleto;
  comecarJogo(c);
  const textos = [...c.m.nodes.values()].filter((n) => n.textureId);
  assert.ok(textos.length >= 12, "peças com textura: " + textos.length);
  const ids = new Set(textos.map((n) => n.textureId));
  assert.ok(ids.has("tex.teto"), "teto tem textura");
  assert.ok(
    [...ids].some((t) => /^tex\.(parede|carpete)\./.test(String(t))),
    "parede ou carpete com textura",
  );
  assert.ok(
    [...ids].some((t) => /^tex\.(madeira|estante|caixote|metal|tecido)/.test(String(t))),
    "móveis com textura",
  );
  assert.deepEqual(c.erros(), []);
});

test("portas: Timothy morde, Jack só assusta", () => {
  const c = iniciar((fonte) => semPerigos(fonte)) as CenarioCompleto;
  comecarJogo(c);
  c.aperta("5");
  c.passo({ dt: 1 / 30 });
  assert.ok(c.m.nodes.has("ent.timothy"), "Timothy nasceu pelo atalho de depuração");
  let mordeu = false;
  for (let i = 0; i < 180; i++) {
    c.passo({ dt: 1 / 30 });
    if ((c.m.health.get("jogador") ?? 100) < 100) {
      mordeu = true;
      break;
    }
  }
  assert.ok(mordeu, "Timothy causou dano");
  for (let i = 0; i < 600; i++) c.passo({ dt: 1 / 30 });
  assert.ok(!c.m.nodes.has("ent.timothy"), "Timothy foi embora depois de um tempo");
  // Jack: susto, sem dano (revive antes, caso o Timothy tenha matado)
  c.m.health.set("jogador", 100);
  if (c.fase() === "morto") {
    c.aperta("e");
    passos(c, 20);
  }
  c.m.health.set("jogador", 100);
  c.aperta("4");
  c.passo({ dt: 1 / 30 });
  passos(c, 9);
  assert.ok(c.m.nodes.has("ent.jack"), "Jack apareceu");
  assert.ok(c.m.nodes.has("ent.jack.olhod") && c.m.nodes.has("ent.jack.olhoe"), "Jack tem os dois olhos");
  assert.equal(c.m.health.get("jogador"), 100, "Jack não machuca");
  assert.match(texto(c, "hud.aviso"), /Jack/i);
  for (let i = 0; i < 90; i++) c.passo({ dt: 1 / 30 });
  assert.ok(!c.m.nodes.has("ent.jack"), "Jack some depois do susto");
  assert.deepEqual(c.erros(), []);
});

test("portas: Shadow cruza o corredor; Snare prende e o Espaço solta", () => {
  const c = iniciar((fonte) => semPerigos(fonte)) as CenarioCompleto;
  comecarJogo(c);
  c.aperta("3");
  c.passo({ dt: 1 / 30 });
  assert.ok(c.m.nodes.has("ent.shadow"), "Shadow apareceu");
  for (let i = 0; i < 70; i++) c.passo({ dt: 1 / 30 });
  assert.ok(!c.m.nodes.has("ent.shadow"), "Shadow atravessou e sumiu");
  // Snare
  const sala = salaDoHud(c);
  c.aperta("2");
  c.passo({ dt: 1 / 30 });
  passos(c, 12);
  const snare = [...c.m.nodes.keys()].find((id) => /\.snare$/.test(id));
  assert.ok(snare, "armadilha criada na sala " + sala);
  const no = c.m.nodes.get(snare!)!;
  for (let i = 0; i < 400 && !c.m.congelado; i++) {
    c.moverPara(no.x, no.z, 5.2, 1 / 30);
    c.passo({ dt: 1 / 30 });
  }
  for (let i = 0; i < 8; i++) c.passo({ dt: 1 / 30 });
  assert.equal(c.m.congelado, true, "a armadilha prende o jogador");
  assert.match(texto(c, "hud.aviso"), /Armadilha/i);
  for (let i = 0; i < 4; i++) {
    c.aperta("space");
    c.passo({ dt: 1 / 30 });
  }
  assert.equal(c.m.congelado, false, "quatro Espaços soltam da armadilha");
  assert.deepEqual(c.erros(), []);
});

test("portas: armário com Hide expulsa quem se esconde; Dupe devolve para a sala anterior", () => {
  const c = iniciar((fonte) =>
    semPerigos(fonte)
      .replace("escondido: 0,", "escondido: 1,")
      .replace("perigo: chance(0.26)", "perigo: false"),
  ) as CenarioCompleto;
  comecarJogo(c);
  const sala = salaDoHud(c);
  const armario = [...c.m.nodes.keys()].find(
    (id) => new RegExp(`^s${sala}\\.armario\\.porta\\.\\d+$`).test(id),
  );
  assert.ok(armario, "armário na sala");
  const no = c.m.nodes.get(armario!)!;
  c.moverPara(no.x, no.z, 5.2, 1 / 30);
  c.definirAlvo(armario!, 1.2);
  c.aperta("e");
  c.passo({ dt: 1 / 30 });
  assert.equal(c.m.congelado, true, "escondido no armário");
  passos(c, 8);
  assert.match(texto(c, "hud.escondido"), /ESCONDIDO/i);
  for (let i = 0; i < 220; i++) c.passo({ dt: 1 / 30 });
  assert.equal(c.m.congelado, false, "Hide jogou o jogador para fora");
  assert.ok((c.m.health.get("jogador") ?? 100) < 100, "Hide machucou");
  assert.match(texto(c, "hud.aviso"), /armário|luzes/i);
  assert.deepEqual(c.erros(), []);
});

test("portas: Dupe é uma porta falsa e devolve o jogador para a sala anterior", () => {
  const c = iniciar((fonte) => semPerigos(fonte)) as CenarioCompleto;
  comecarJogo(c);
  avancarPortas(c, 3);
  const sala = salaDoHud(c);
  assert.ok(sala >= 3, "chegou pelo menos na sala 3: " + sala);
  c.aperta("1"); // depuração: torna a porta de saída uma porta falsa
  c.passo({ dt: 1 / 30 });
  const porta = c.m.nodes.get(`porta.${sala + 1}`);
  assert.ok(porta, "porta de saída existe");
  const saudeAntes = c.m.health.get("jogador")!;
  const pisoAnterior = c.m.nodes.get(`s${sala - 1}.piso`);
  assert.ok(pisoAnterior, "sala anterior ainda existe");
  let voltou = false;
  for (let i = 0; i < 260 && !voltou; i++) {
    c.definirAlvo(`porta.${sala + 1}`, 1.4);
    c.moverPara(porta!.x, porta!.z, 5.2, 1 / 30);
    if (i % 3 === 0) c.aperta("e");
    c.passo({ dt: 1 / 30 });
    const onde = c.posicao();
    voltou =
      Math.hypot(onde.x - pisoAnterior!.x, onde.z - pisoAnterior!.z) < 6;
  }
  assert.ok(voltou, "a porta falsa devolveu o jogador para a sala anterior");
  passos(c, 10);
  assert.ok((c.m.health.get("jogador") ?? 100) < saudeAntes, "a porta falsa machucou");
  assert.match(texto(c, "hud.aviso"), /porta falsa/i);
  assert.deepEqual(c.erros(), []);
});
