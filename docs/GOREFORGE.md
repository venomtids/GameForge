# GORE FORGE · jogo de demonstração da engine

Sandbox de física em primeira pessoa no estilo **GoreBox**, construído **sobre a engine 0.8.3**
(jelly physics, volume tetraédrico, contato com malha deformada, braços/modelo em primeira pessoa,
qualidade adaptativa). O objetivo é servir de prova de esforço: esticar a física e o desenho da
engine até o limite, com um jogo inteiro — armas, NPCs, explosões, gore, destruição — e uma UI 2D
extremamente deformável, toda dirigida por dados.

- **Entrada do jogo:** [`src/goreforge.ts`](../src/goreforge.ts) · **página:** [`goreforge.html`](../goreforge.html)
- **Runtime (cola de tudo):** [`src/goreforge/runtime/GameRuntime.ts`](../src/goreforge/runtime/GameRuntime.ts)
- **Como abrir:** `npm run dev` → `http://localhost:5173/goreforge.html`
- **Testes:** `npm test` (unitários, inclui `tests/goreforge.test.ts`) e
  `npm run test:goreforge` (navegador real, mostra física/gore/HUD vivos)

---

## 1. Estrutura de arquivos

```
goreforge.html                        página do jogo (splash + entrada)
src/goreforge.ts                      entrada: cria o GameRuntime, captura o mouse, expõe window.goreforge

src/goreforge/
├── arena.ts                          PÁTIO DA FORJA: cena completa em dados (props, torres, gelatina,
│                                     NPCs) + metadados (zonas, destrutíveis, spawn do jogador)
├── goreforge.css                     casca (reset, splash); TODO o resto vem do tema em CSS vars
├── config/
│   ├── settings.ts                   GameSettings + validação/limites + presets de gore + persistência
│   ├── theme.ts                      4 temas + métricas/deformação + validação + serialização p/ CSS vars
│   ├── weapons.ts                    arsenal: ferrolho, F-90, vespa, escopeta, estaca, lança-chamas,
│   │                                 canhão de gelatina, cabra + FERRAMENTAS (gravar/dissolver/solda/clonar)
│   │                                 + modelo de primeira pessoa (peças) + balística (dano por distância)
│   └── spawnables.ts                 catálogo do menu de spawn (gelatina, caixas, explosivos, veículos,
│                                     bonecos, NPCs, cenário) com hp/material/chunks/explosivo/peso
├── game/
│   ├── context.ts                    GameContext (serviços compartilhados) + UIHost (contrato da UI)
│   ├── state.ts                      GameStore: vida, munição, arma, placar, recordes, favoritos, temas
│   ├── util.ts                       clamp/damp/rng determinístico/projeção p/ tela/formatação
│   ├── input.ts                      teclado + mouse + roda + toque com "bordas" por quadro
│   ├── player.ts                     controlador FPS: walk/sprint/slide/dash/pulo duplo/coyote/noclip,
│   │                                 dano, morte, respawn e "câmera suja" (bob, lean, mergulho, FOV)
│   ├── viewmodel.ts                  modelo de arma em primeira pessoa (camada 1, memoizado, ADS/recuo)
│   ├── combat.ts                     hitscan/projétil/corpo a corpo, zonas de acerto, recuo, recarga,
│   │                                 projéteis com rastro e detonação
│   ├── tools.ts                      ferramentas de física: fisgun, dissolver, solda, clonar
│   ├── fx.ts                         partículas (aditivas/suaves), traçantes, estilhaços, luzes, explosões
│   ├── decals.ts                     marcas de impacto/sangue/queimado/vidro com pool reciclado
│   ├── destruction.ts                fratura de props em estilhaços físicos + explosões em cadeia
│   ├── gibs.ts                       gore: sangue, desmembramento em ragdoll REAL, corpos explodidos
│   └── spawner.ts                    cria TUDO pelo comando `spawn` da engine (NPC, gelatina, props),
│                                     orçamento de corpos, clones, cápsulas e pedaços
├── ui/
│   ├── uikit.ts                      "UI kit ultra-deformável": árvore de dados → DOM, tema por
│   │                                 variáveis CSS, deformação por widget, atualização por `bind`
│   ├── hud.ts                        HUD modular (painéis + overlay: mira dinâmica, killfeed, avisos,
│   │                                 números de dano, tela de morte) e os presets de layout
│   ├── spawnmenu.ts                  menu de spawn (abas por categoria, busca, favoritos, escala/empurrão)
│   └── pause.ts                      pausa + editor de jogo/interface/dados (tema, HUD, gore, JSON)
└── runtime/
    └── GameRuntime.ts                loop, ordem dos sistemas, hotkeys e a tradução ação-de-UI → jogo
```

Fora de `src/goreforge/`, a mudança de engine que o jogo precisou:

| Arquivo | Mudança |
| --- | --- |
| [`src/engine/World.ts`](../src/engine/World.ts) | `PlayerStepContext` + `World.playerStep`: um jogo pode assumir o passo do jogador (o caminho antigo continua idêntico quando não há hook). `World.lastDamage` registra o último dano aplicado pela engine (bots, explosões) para jogos com vida própria não perderem o ataque ao reescrever `World.health` — ver `game/player.ts#update` |
| [`src/engine/Audio.ts`](../src/engine/Audio.ts) | ~55 receitas de combate/foley/UI (tiro, impacto por material, gelatina, gibs, explosões, passos, menu) |
| [`src/engine/features07.ts`](../src/engine/features07.ts) | `lightDefaults`/`torchDefaults` e `soundNames` exportados |

---

## 2. O que o jogo exercita da engine (e onde)

| Recurso da engine 0.8.3 | Onde aparece |
| --- | --- |
| **Jelly physics** (`JellyMesh`/`JellyCage`, mola por vértice, tetraedros com volume assinado) | 6 rigs no pátio + NPCs de gelatina; `spawnables.ts` cria novos por tiro/menu (`jelly-cube`, `jelly-man`, …) |
| **Contato com malha deformada** | piso elástico com plataformas, queda de 12 m na torre e rebote no `World.reboundFromJelly` |
| **Ragdoll articulado** (`PhysicalRig`) | NPCs: queda, atropelamento e **desmembramento real** (`gibs.ts` remove as juntas do membro) |
| **Cannon-es** | ~1.400 configs possíveis, 74 corpos dinâmicos no pátio, impulsos radiais, juntas, atrito |
| **Texturas por código** (`PixelTexture`) | piso de concreto, demarcação, piso de gore, grades, metais, madeira |
| **Som procedural** (`Audio.ts`) | receitas novas por material/superfície, passos por velocidade, arma, gore |
| **Câmera e braços em 1ª pessoa** | `CameraRig` (base) + `game/viewmodel.ts` (modelo da arma na camada 1, sem z-fighting) |
| **Qualidade adaptativa** (`AdaptiveResolution`) | ligada ao ajuste `quality` (auto/economia/alta) do menu |

---

## 3. Como o jogo se liga (fluxo de um quadro)

```
requestAnimationFrame
  ├─ lê entradas (Input: bordas do teclado/mouse)          ← hotkeys de arma, ferramenta, pausa, HUD
  ├─ combat.update / tools.update                          ← usa World.command("spawn"/"impulse"/…)
  ├─ world.update(dt, keys, yaw)                           ← física fixa + PlayerStepContext → player.step()
  ├─ player.update    (vida/morte/regen)
  ├─ fx / decals / destruction.update
  ├─ world.refresh + rig.update                            ← engine posiciona a câmera no corpo do jogador
  ├─ player.applyCameraFeel + viewmodel.update             ← bob, mergulho, recuo, ADS
  ├─ configureLighting (sombras seguem o jogador)
  ├─ hud.update(dt, fps)                                   ← flush por `bind`, mira, killfeed, avisos
  └─ rig.render (2 passadas: mundo + modelo em 1ª pessoa)
```

Toda a interface conversa com o jogo por **uma tabela de ações** (`GameRuntime.dispatch`):
os menus só emitem strings (`"spawn"`, `"set-gore"`, `"theme-metric-radius"`, `"hud-layout"`, …) e o
runtime decide o que isso significa. Isso mantém `ui/` sem nenhuma regra de física.

---

## 4. Os quatro pedidos, um por um

### 4.1 Jogabilidade estilo GoreBox (sandbox FPS)

- **Primeira pessoa** com modelo de arma visível, ADS, recuo, recarga e troca por 1–9 / roda do mouse.
- **Movimento rápido**: caminhada, corrida, agachar, **escorregão** (Shift+Ctrl), **dash** com
  pulo duplo, coyote time, controle no ar, noclip.
- **Armas** (`config/weapons.ts`): pistola, fuzil, metralhadora, escopeta (8 balotes, desmembra),
  arpão, lança-chamas, canhão de gelatina (cria corpos macios novos), martelo.
- **Ferramentas de física**: Gravador (segura/arremessa QUALQUER corpo dinâmico), Dissolvedor,
  Solda (transforma prop em estático), Duplicador (clona o que está na mira).
- **Menu de spawn** (Tab): 30 itens em 7 categorias + abas de armas/ferramentas/favoritos,
  busca por tag, favoritos (Shift+clique), escala e empurrão do que é criado, horda e cenário.

### 4.2 Física avançada e deformação extrema

- Prop de gelatina **deforma a malha nos vértices** (molas+volume) e volta ao repouso — verificado
  no teste de navegador medindo o deslocamento real da geometria.
- NPCs são **ragdolls articulados**: ao morrer viram corpo mole; membros podem ser **arrancados**
  (as juntas daquele corpo são removidas da simulação — nada de animação falsa).
- **Destruição**: props têm `hp`/material/chunks; a fratura vira estilhaços dinâmicos com impulso
  para fora, som por material e marcas no cenário. Explosivos detonam **em cadeia** com impulso radial
  calculado sobre todos os corpos e atenuação por oclusão.
- **Gore**: sangue em partículas + poças persistentes (scale-limited), estilhaços de carne,
  cabeça/membros arrancados e corpos estourados quando a força passa do limiar.

### 4.3 Gráficos, texturas, materiais e efeitos

- Texturas geradas por código na própria engine (pixel-art coerente com o gênero).
- 4 famílias de partículas + traçantes + cápsulas + fumaça + fogo + faíscas + poeira + carne
  (`game/fx.ts`, pools fixos, sem alocação por tiro).
- Marcas de impacto por material com vida útil e pooling (`game/decals.ts`).
- Pós-processo nativo do tema: **scanlines e vinheta** ligadas aos sliders da UI, tremor de câmera,
  hit-stop visual, números de dano projetados e indicador direcional de dano.

### 4.4 UI 2D ultra-deformável (menu e HUD)

- **Tudo é dado + tema**: cores/métricas/deformação vivem em `config/theme.ts` e são publicadas como
  variáveis CSS (`--gf-*`). Trocar de tema **não reconstrói nada** — só reescreve variáveis.
- **Deformação por widget**: achatar ao clicar, ímã no hover, oscilação elástica de entrada dos
  painéis, scanlines/vinheta — todos com intensidade controlada por slider.
- **HUD = presets de layout** (`hudLayouts`): clássico, compacto, minimalista e tático mudam
  posições/escala de vida, munição, slots, zona, diagnóstico e placar (tecla **B** cicla).
- **Modular de verdade**: qualquer painel novo é uma entrada em `UINode[]`; os valores chegam por
  `flush({ bind: {...} })` (HUD) ou por ações (menus).
- **Editor embutido** (Esc → Interface/Dados): mexa em raio, espaçamento, escala, borda, blur, fonte,
  letras, brilho, deformação… ou **cole/baixe o tema em JSON** e aplique a quente.

---

## 5. Estendendo o jogo (dados, não código)

**Uma arma nova** — uma entrada em `config/weapons.ts`:

```ts
minhaArma: {
  id: "minhaArma", name: "Trilha Pesada", short: "TRILHA", icon: "🚀",
  category: "pesada", description: "Explode onde bate.",
  kind: "projectile", tool: null, auto: false, rpm: 90,
  magazine: 4, reserve: 16, reload: 2.4, damage: 120, pellets: 1,
  spread: 0, moveSpread: 0.2, adsSpread: 0, range: 90, falloff: 0.4,
  recoil: { kick: 0.9, pitch: 0.05, yaw: 0.02, recovery: 9 },
  projectile: { speed: 42, radius: 0.22, gravity: 0.4, explode: { radius: 7, force: 26, damage: 120 } },
  gore: { blood: 1, gib: 1, dismember: 0.6 },
  // a posição é SEMPRE relativa ao enquadramento comum (viewmodelBase):
  view: { scale: 1, hip: [0, -0.02, 0], ads: [0, -0.03, -0.02], muzzle: [0, 0.05, -0.5], eject: [0.05, 0.04, 0.1], kick: 1.4,
          parts: [ { shape: "box", size: [0.1, 0.12, 0.5], pos: [0, 0, -0.2], color: "#3b4149" } ] },
  adsFov: 62, shake: 1.2, tracer: "#ffd166",
  sfx: { fire: "tiro.pesado", reload: "recarregar", empty: "clique", equip: "equipar" },
  slot: 3,
}
```

**Um item de spawn novo** — uma entrada em `config/spawnables.ts` (o `patch` é o mesmo
`applyNodePatch`/`spawn` da engine, então aceita `deform`, `actor`, `bot`, `textureId`, …):

```ts
{
  id: "gelatina-torre", name: "Torre de gelatina", icon: "🍮", category: "Gelatina",
  description: "Empilha e desaba.", tags: ["gelatina", "torre"],
  hp: 60, material: "gelatina", chunks: 10, weight: 3,
  patch: { ...jelly(0.5), kind: "box", name: "Torre de gelatina", scale: [1.2, 3.4, 1.2],
           color: "#6ff0c0", physics: "dynamic", mass: 14 },
}
```

**Um tema novo** — uma entrada em `config/theme.ts` com `colors`, `metrics` e `deform`; ele aparece
automaticamente na aba Interface do menu.

**Um layout de HUD novo** — uma entrada em `hudLayouts` (`ui/hud.ts`) dizendo âncora + deslocamento +
escala de cada painel. Nada mais muda.

---

## 6. Jogar sem servidor (arquivo único)

```bash
npm run build:goreforge   # gera entregas/goreforge.html (engine + jogo + UI embutidos)
npm run test:export:goreforge   # valida o arquivo abrindo por file:// num navegador real
```

`entregas/goreforge.html` é **autossuficiente** (~1 MB): dá dois cliques e o jogo abre offline —
física, gelatina, gore, menus e temas funcionando. Salve, mande por e-mail ou ponha num pendrive.
`entregas/goreforge-codigo.zip` traz o código-fonte completo do jogo junto.

## 7. Comandos

```bash
npm run dev             # servidor (http://localhost:5173/goreforge.html)
npm run build:goreforge # arquivo único offline em entregas/goreforge.html
npm test                # unitários (config, catálogos, pátio, estado, presets de gore)
npm run typecheck
npm run test:goreforge  # navegador: física rodando, gelatina deformando, fratura, tiros, tema ao vivo
npm run shots:goreforge # turnê com capturas em test-results/
```

### Limites conhecidos (honestos)

- **12 rigs elásticos/ragdolls por cena** — limite da engine; ao estourar, ela avisa e o corpo
  fica rígido. O menu mostra o contador no painel de diagnóstico.
- **Orçamento de corpos criados** (`npcLimit × 14`): ao passar, os destroços mais antigos são
  reciclados para a simulação não degradar.
- Partículas/marcas são pools fixos proporcionais ao ajuste `partículas`; o gore no máximo troca
  contagem por estabilidade.
- Sem multiplayer, sem FEM contínuo e sem CCD global — o mesmo escopo declarado em
  [docs/GELATINA-0.8.3.md](GELATINA-0.8.3.md).
