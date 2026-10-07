import type { GameContext } from "../game/context";
import { UI, type UINode } from "./uikit";
import { serializeTheme, themeIds, themes, validateTheme } from "../config/theme";
import { hudLayouts } from "./hud";
import { goreforgeDefaults } from "../config/settings";

type Tab = "geral" | "jogo" | "interface" | "stats" | "ajuda" | "dados";

const TABS: Tab[] = ["geral", "jogo", "interface", "stats", "ajuda", "dados"];

const TIPS = [
  "Shift + Ctrl enquanto corre vira escorregão: ganha velocidade e passa por baixo de grades.",
  "Barris vermelhos detonam em cadeia. Mire no primeiro e deixe a física trabalhar.",
  "O Gravador (9) segura QUALQUER corpo dinâmico: prédio, NPC, gelatina e até caixote em chamas.",
  "Shift+clique em um item do menu de spawn favorita o item.",
  "A ferramenta Solda (0 cicla) transforma prop dinâmico em estático para montar cenário.",
  "Gelatina desmembra? Não — mas o corpo do NPC sim. Mire nas juntas com a escopeta.",
  "O Canhão de Gelatina (7) cria corpos macios NOVOS a cada tiro: ótimo para testar a deformação.",
  "Ajuste 'partículas' e 'marcas no cenário' para medir o custo real da destruição.",
];

/**
 * MENU DE PAUSA — também é o editor de jogo e de interface.
 *
 * A aba "Interface" edita o TEMA e o layout do HUD em tempo real (escrevendo
 * nas variáveis CSS), exporta/importa o tema como JSON e troca o preset de
 * layout. A aba "Dados" mostra/serializa a configuração inteira — é o "via
 * dados" do pedido: nada aqui exige recompilar para mudar a cara do jogo.
 */
export class PauseMenu {
  private ui: UI;
  private root = document.createElement("div");
  private tab: Tab = "geral";
  private lastSignature = "";
  open = false;

  constructor(
    private ctx: GameContext,
    host: HTMLElement,
    private action: (action: string, value: number | string, node: UINode) => void,
  ) {
    this.root.dataset.gfManaged = "1";
    this.root.dataset.gfPart = "pause-backdrop";
    this.root.style.cssText =
      "position:absolute;inset:0;display:none;place-items:center;pointer-events:auto;background:rgba(3,3,5,0.55);backdrop-filter:blur(3px)";
    host.append(this.root);
    this.ui = new UI(this.root, ctx.store.theme);
    this.ui.onAction((a, v, node) => this.action(a, v, node));
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    this.open = true;
    this.root.style.display = "grid";
    this.rebuild(true);
    this.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "ease-out" });
    this.ctx.world.audio.play("ui.abrir", 0.45, 0.9);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.root.style.display = "none";
    this.ctx.world.audio.play("ui.fechar", 0.45, 1);
  }

  setTheme(theme = this.ctx.store.theme) {
    this.ui.setTheme(theme);
  }

  /** Troca de aba por id (ação `pause-tab` vinda do UI kit). */
  setTab(tab: string) {
    if (!TABS.includes(tab as Tab)) return;
    if (this.tab === tab) return;
    this.tab = tab as Tab;
    this.rebuild(true);
  }

  /** Reconstrói a aba atual (chamado ao abrir e ao trocar de aba). */
  rebuild(force = false) {
    const store = this.ctx.store;
    const signature = `${this.tab}|${store.theme.id}|${JSON.stringify(store.theme.metrics)}|${JSON.stringify(store.theme.deform)}|${store.settings.hudLayout}|${store.settings.hudScale.toFixed(2)}|${store.settings.hudOpacity.toFixed(2)}|${this.signatureExtra()}`;
    if (!force && signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.ui.mount([this.tree()]);
    this.ui.markTab("pause-tabs", this.tab);
    if (this.tab === "dados") this.wireDataArea();
    if (this.tab === "interface") this.wireThemeArea();
  }

  private signatureExtra() {
    const store = this.ctx.store;
    return [
      store.settings.gore,
      store.settings.particles,
      store.settings.shake,
      store.settings.fov,
      store.settings.sensitivity,
      store.settings.maxDecals,
      store.settings.npcLimit,
      store.settings.doubleJump,
      store.settings.infiniteAmmo,
      store.settings.destruction,
      store.settings.dismember,
      store.settings.tracers,
      store.settings.damageNumbers,
      store.settings.viewmodel,
      store.settings.volume,
      store.godMode,
      store.noclip,
      store.spawnFavorites.length,
    ].join("|");
  }

  private slider(
    id: string,
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    action: string,
  ): UINode {
    return {
      id,
      type: "slider",
      text: label,
      value: Number(value.toFixed(3)),
      min,
      max,
      step,
      on: { change: action },
      bind: `bind-${id}`,
    };
  }

  private toggleNode(id: string, label: string, value: boolean, action: string): UINode {
    return {
      id,
      type: "toggle",
      text: label,
      value: value ? 1 : 0,
      on: { change: action },
    };
  }

  private button(id: string, label: string, action: string, value: string | number = "", icon?: string): UINode {
    return { id, type: "button", text: label, icon, on: { press: action }, value };
  }

  private tree(): UINode {
    return {
      id: "pause-panel",
      type: "panel",
      style: { width: "min(1020px, 95vw)", height: "min(660px, 88vh)", gap: "10px", pad: "14px" },
      children: [
        {
          id: "pause-head",
          type: "row",
          style: { align: "center", justify: "space-between" },
          children: [
            {
              id: "pause-title",
              type: "title",
              text: "GORE FORGE · SANDBOX DE DESTRUIÇÃO",
              style: { fontSize: "1.1em" },
            },
            this.button("pause-close", "Voltar ao jogo (Esc)", "resume", "", "▶"),
          ],
        },
        {
          id: "pause-tabs",
          type: "tabs",
          options: ["geral", "jogo", "interface", "stats", "ajuda", "dados"],
          on: { press: "pause-tab" },
        },
        this.bodyForTab(),
      ],
    };
  }

  private geralBody(): UINode {
    const store = this.ctx.store;
    return {
      id: "pause-body-content",
      type: "row",
      style: { flex: "1", gap: "12px", minHeight: "0", width: "100%" },
      children: [
        this.column("pause-geral-left", "Sessão", [
          this.button("geral-resume", "Continuar", "resume", "", "▶"),
          this.button("geral-restart", "Reiniciar pátio (F5)", "restart", "", "⟳"),
          this.button("geral-heal", "Curar e reabastecer", "heal", "", "✚"),
          this.button("geral-horde", "Soltar uma horda", "spawn-horde", "", "☠"),
          this.button("geral-arena", "Repor cenário destrutível", "spawn-arena", "", "🧱"),
          this.button("geral-clear", "Limpar objetos criados", "clear-spawned", "", "🗑"),
          this.toggleNode("geral-god", "Modo deus (imortal)", store.godMode, "toggle-god"),
          this.toggleNode("geral-noclip", "Noclip (atravessa o mapa)", store.noclip, "toggle-noclip"),
          this.toggleNode("geral-help", "Mostrar dicas no HUD", store.help, "toggle-help"),
        ]),
        this.column("pause-geral-right", "Estado do mundo", [
          { id: "geral-world", type: "label", text: this.summary(), bind: "geralSummary" },
          { id: "geral-tip", type: "label", text: TIPS[Math.floor(Math.random() * TIPS.length)], style: { fontSize: "0.85em", color: "var(--gf-accent)" } },
          { id: "geral-note", type: "label", text: "A física continua rodando com o menu aberto: você pode ver os corpos assentando enquanto ajusta o jogo.", style: { fontSize: "0.78em", color: "var(--gf-text-dim)" } },
        ]),
      ],
    };
  }

  private column(id: string, title: string, children: UINode[]): UINode {
    return {
      id,
      type: "panel",
      style: { flex: "1", gap: "7px", minWidth: "0", overflowY: "auto" },
      children: [
        { id: `${id}-title`, type: "title", text: title, style: { fontSize: "0.95em" } },
        ...children,
      ],
    };
  }

  /** Corpo da aba atual — cada aba é uma árvore de dados. */
  private bodyForTab(): UINode {
    const store = this.ctx.store;
    const settings = store.settings;
    const body = (children: UINode[]): UINode => ({
      id: "pause-body-content",
      type: "row",
      style: { flex: "1", gap: "12px", minHeight: "0", width: "100%" },
      children,
    });
    switch (this.tab) {
      case "geral":
        return this.geralBody();
      case "jogo":
        return body([
            this.column("pause-gameplay", "Movimento e combate", [
              this.slider("set-walk", "velocidade base", settings.walkSpeed, 2, 14, 0.1, "set-walkSpeed"),
              this.slider("set-sprint", "corrida", settings.sprintSpeed, 4, 22, 0.1, "set-sprintSpeed"),
              this.slider("set-jump", "pulo", settings.jumpSpeed, 3, 16, 0.1, "set-jumpSpeed"),
              this.slider("set-dash", "distância do dash", settings.dashDistance, 0, 16, 0.1, "set-dashDistance"),
              this.slider("set-dashcd", "recarga do dash", settings.dashCooldown, 0.2, 5, 0.1, "set-dashCooldown"),
              this.toggleNode("set-double", "pulo duplo", settings.doubleJump, "set-doubleJump"),
              this.slider("set-hp", "vida máxima", settings.maxHealth, 20, 400, 5, "set-maxHealth"),
              this.slider("set-regen", "regeneração (hp/s)", settings.healthRegen, 0, 20, 0.5, "set-healthRegen"),
              this.slider("set-head", "multiplicador de headshot", settings.headshotMultiplier, 1, 6, 0.1, "set-headshotMultiplier"),
              this.slider("set-difficulty", "dificuldade dos NPCs", settings.difficulty, 0.25, 4, 0.05, "set-difficulty"),
              this.toggleNode("set-ammo", "munição infinita", settings.infiniteAmmo, "set-infiniteAmmo"),
            ]),
            this.column("pause-gore", "Destruição e gore", [
              this.slider("set-gore", "gore (0 off · 1 leve · 2 cheio · 3 insano)", ["off", "light", "full", "insane"].indexOf(settings.gore), 0, 3, 1, "set-gore"),
              this.slider("set-blood", "quantidade de sangue", settings.bloodAmount, 0, 3, 0.05, "set-bloodAmount"),
              this.slider("set-gib", "limiar de estilhaço", settings.gibThreshold, 0, 200, 5, "set-gibThreshold"),
              this.toggleNode("set-dismember", "desmembrar membros", settings.dismember, "set-dismember"),
              this.toggleNode("set-destruction", "props destrutíveis", settings.destruction, "set-destruction"),
              this.slider("set-blast", "força das explosões", settings.explosiveForce, 0.2, 3, 0.05, "set-explosiveForce"),
              this.slider("set-decals", "marcas no cenário", settings.maxDecals, 0, 400, 5, "set-maxDecals"),
              this.slider("set-npcs", "limite de NPCs", settings.npcLimit, 0, 48, 1, "set-npcLimit"),
            ]),
            this.column("pause-video", "Vídeo e desempenho", [
              this.slider("set-fov", "campo de visão", settings.fov, 55, 115, 1, "set-fov"),
              this.slider("set-sens", "sensibilidade", settings.sensitivity, 0.2, 4, 0.05, "set-sensitivity"),
              this.slider("set-shake", "tremor de câmera", settings.shake, 0, 3, 0.05, "set-shake"),
              this.slider("set-particles", "partículas", settings.particles, 0, 2, 0.05, "set-particles"),
              this.toggleNode("set-tracers", "traçantes", settings.tracers, "set-tracers"),
              this.toggleNode("set-numbers", "números de dano", settings.damageNumbers, "set-damageNumbers"),
              this.toggleNode("set-viewmodel", "modelo em primeira pessoa", settings.viewmodel, "set-viewmodel"),
              this.slider("set-volume", "volume", settings.volume, 0, 1, 0.02, "set-volume"),
              {
                id: "set-quality",
                type: "tabs",
                options: ["auto", "economy", "high"],
                on: { press: "set-quality" },
              },
            ]),
        ]);
      case "interface":
        return body([
            this.column("pause-theme", "Tema (dados → CSS ao vivo)", [
              {
                id: "theme-list",
                type: "grid",
                style: { minWidth: "120px" },
                children: themeIds.map((id) => ({
                  id: `theme-${id}`,
                  type: "button",
                  text: themes[id].label,
                  icon: id === store.theme.id ? "◉" : "○",
                  on: { press: "theme" },
                  value: id,
                  style: { pad: "6px 8px", fontSize: "0.85em" },
                })),
              },
              { id: "theme-desc", type: "label", text: store.theme.description, bind: "themeDesc", style: { fontSize: "0.78em", color: "var(--gf-text-dim)" } },
              this.slider("th-radius", "arredondamento", store.theme.metrics.radius, 0, 40, 1, "theme-metric-radius"),
              this.slider("th-gap", "espaçamento", store.theme.metrics.gap, 0, 24, 1, "theme-metric-gap"),
              this.slider("th-pad", "margem interna", store.theme.metrics.pad, 2, 26, 1, "theme-metric-pad"),
              this.slider("th-scale", "escala", store.theme.metrics.scale, 0.6, 1.8, 0.02, "theme-metric-scale"),
              this.slider("th-border", "espessura da borda", store.theme.metrics.border, 0, 6, 1, "theme-metric-border"),
              this.slider("th-blur", "desfoque do painel", store.theme.metrics.blur, 0, 20, 1, "theme-metric-blur"),
              this.slider("th-font", "tamanho da fonte", store.theme.metrics.fontSize, 10, 26, 1, "theme-metric-fontSize"),
              this.slider("th-tracking", "espaço entre letras", store.theme.metrics.letterSpacing, 0, 4, 0.1, "theme-metric-letterSpacing"),
              this.slider("th-skew", "inclinação", store.theme.metrics.skew, -6, 6, 0.5, "theme-metric-skew"),
              this.slider("th-glow", "brilho", store.theme.metrics.glow, 0, 2, 0.05, "theme-metric-glow"),
            ]),
            this.column("pause-deform", "Deformação (o toque do GoreForge)", [
              this.slider("df-press", "achatar ao clicar", store.theme.deform.press, 0, 0.35, 0.01, "theme-deform-press"),
              this.slider("df-hover", "ímã no cursor", store.theme.deform.hover, 0, 10, 0.5, "theme-deform-hover"),
              this.slider("df-wobble", "oscilação elástica", store.theme.deform.wobble, 0, 3, 0.05, "theme-deform-wobble"),
              this.slider("df-pop", "entrada dos painéis (ms)", store.theme.deform.popIn, 0, 800, 10, "theme-deform-popIn"),
              this.slider("df-scan", "linhas de varredura", store.theme.deform.scanlines, 0, 1, 0.02, "theme-deform-scanlines"),
              this.slider("df-vig", "vinheta", store.theme.deform.vignette, 0, 1, 0.02, "theme-deform-vignette"),
              { id: "df-colors", type: "title", text: "Cores", style: { fontSize: "0.85em" } },
              {
                id: "color-hint",
                type: "label",
                text: "As 15 cores do tema (accent, danger, hp, sangue…) são editáveis na aba Dados, no JSON completo.",
                style: { fontSize: "0.75em", color: "var(--gf-text-dim)" },
              },
            ]),
            this.column("pause-hud", "HUD (layout e escala)", [
              {
                id: "hud-layout-tabs",
                type: "tabs",
                options: Object.keys(hudLayouts),
                on: { press: "hud-layout" },
              },
              this.slider("hud-scale", "escala do HUD", settings.hudScale, 0.6, 1.8, 0.02, "set-hudScale"),
              this.slider("hud-opacity", "opacidade do HUD", settings.hudOpacity, 0.25, 1, 0.02, "set-hudOpacity"),
              { id: "hud-note", type: "label", text: "Layouts são dados (hudLayouts). Adicione um novo no código e ele aparece aqui.", style: { fontSize: "0.75em", color: "var(--gf-text-dim)" } },
              { id: "interface-json", type: "title", text: "Tema em JSON", style: { fontSize: "0.85em" } },
            ]),
        ]);
      case "stats":
        return body([this.column("pause-stats", "Sessão", this.statsNodes())]);
      case "ajuda":
        return body([
            this.column("pause-help-move", "Movimento", [
              ...this.keyRows([
                ["W A S D", "andar"],
                ["Shift", "correr"],
                ["Ctrl / C", "agachar (correndo: escorregão)"],
                ["Q", "dash"],
                ["Space", "pular (duplo no ar)"],
                ["G", "noclip (atravessa tudo)"],
                ["R", "recarregar / renascer"],
                ["V", "primeira/terceira pessoa"],
              ]),
            ]),
            this.column("pause-help-fight", "Combate e ferramentas", [
              ...this.keyRows([
                ["Botão esquerdo", "atirar / usar"],
                ["Botão direito", "mira (ADS) / arremessar"],
                ["1..9", "armas do inventário"],
                ["0", "ciclar ferramentas"],
                ["Roda do mouse", "trocar arma"],
                ["F", "curar-se (sandbox)"],
                ["X", "alternar gore"],
                ["T", "modo de spawn (mira/pé)"],
              ]),
            ]),
            this.column("pause-help-menu", "Menus", [
              ...this.keyRows([
                ["Tab", "menu de spawn"],
                ["Esc", "pausa, ajustes e interface"],
                ["F5", "reiniciar o pátio"],
                ["H", "esconder HUD"],
                ["M", "mutar som"],
                ["Gráfico", "frames, corpos, rigs e partículas no HUD"],
              ]),
            ]),
        ]);
      case "dados":
      default:
        return body([
            this.column("pause-data-config", "Configuração atual", [
              { id: "data-summary", type: "label", text: this.summary(), bind: "dataSummary" },
              { id: "data-hint", type: "label", text: "Cole um JSON de tema abaixo e aplique — o HUD muda na hora.", style: { fontSize: "0.78em", color: "var(--gf-text-dim)" } },
            ]),
            this.column("pause-data-theme", "Tema (JSON)", [
              {
                id: "data-theme-box",
                type: "panel",
                style: { flex: "1", minHeight: "260px", pad: "0", bg: "var(--gf-panel-solid)" },
              },
            ]),
            this.column("pause-data-actions", "Ações", [
              this.button("data-copy", "Baixar tema (.json)", "export-theme", "", "⬇"),
              this.button("data-reset", "Restaurar tema do catálogo", "theme", store.settings.theme, "↺"),
              this.button("data-reset-settings", "Restaurar ajustes padrão", "reset-settings", "", "⟲"),
              this.button("data-save", "Salvar no navegador", "save-settings", "", "💾"),
              {
                id: "data-gore-modes",
                type: "tabs",
                options: ["gore off", "gore light", "gore full", "gore insane"],
                on: { press: "gore-preset" },
              },
              this.button("data-clear", "Apagar tudo que foi criado", "clear-spawned", "", "🗑"),
              this.button("data-restart", "Reiniciar pátio", "restart", "", "⟳"),
              this.button("data-resume", "Voltar ao jogo", "resume", "", "▶"),
            ]),
        ]);
    }
  }

  private keyRows(entries: [string, string][]): UINode[] {
    return entries.map(([key, description], index) => ({
      id: `help-${this.tab}-${index}`,
      type: "keyvalue",
      children: [
        { id: `help-${this.tab}-${index}-key`, type: "badge", text: key, style: { minWidth: "96px" } },
        {
          id: `help-${this.tab}-${index}-desc`,
          type: "label",
          text: description,
          style: { fontSize: "0.85em", align: "flex-end" },
        },
      ],
      style: { align: "center" },
    }));
  }

  private statsNodes(): UINode[] {
    const stats = this.ctx.store.stats();
    const rows: [string, string][] = [
      ["pontos", `${stats.score}`],
      ["abates", `${stats.kills}`],
      ["headshots", `${stats.headshots}`],
      ["mortes", `${stats.deaths}`],
      ["precisão", `${stats.accuracy.toFixed(1)}%`],
      ["dano causado", `${stats.damageDealt}`],
      ["dano recebido", `${stats.damageTaken}`],
      ["objetos destruídos", `${stats.destroyed}`],
      ["desmembramentos", `${stats.gibs}`],
      ["objetos criados", `${stats.spawned}`],
      ["melhor combo", `x${stats.combo}`],
      ["recordes (navegador)", `abates ${this.ctx.store.bestRecord.kills} · pontos ${this.ctx.store.bestRecord.score}`],
      ["corpos na física agora", `${this.ctx.world.bodies.size}`],
      ["rigs ativos", `${this.ctx.world.physicalRigs.size + this.ctx.world.jellyCharacters.size}`],
      ["partículas vivas", `${this.ctx.store.particles}`],
      ["marcas ativas", `${this.ctx.decals.count}`],
    ];
    return rows.map(([label, value], index) => ({
      id: `stat-${index}`,
      type: "keyvalue",
      children: [
        { id: `stat-${index}-k`, type: "label", text: label, style: { fontSize: "0.85em", color: "var(--gf-text-dim)" } },
        { id: `stat-${index}-v`, type: "label", text: value, style: { fontSize: "0.9em" } },
      ],
    }));
  }

  private summary() {
    return `tema ${this.ctx.store.theme.id} · hud ${this.ctx.settings.hudLayout} (${this.ctx.settings.hudScale.toFixed(2)}x) · gore ${this.ctx.settings.gore} · qualidade ${this.ctx.settings.quality} · física ${this.ctx.world.bodies.size} corpos`;
  }

  /** Injeta a área de texto do JSON (textarea nativo, não é um widget do kit). */
  private wireDataArea() {
    const host = this.ui.element("data-theme-box");
    if (!host || host.querySelector("textarea")) return;
    const textarea = document.createElement("textarea");
    textarea.dataset.gfPart = "theme-json";
    textarea.spellcheck = false;
    textarea.value = serializeTheme(this.ctx.store.theme);
    textarea.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;resize:none;border:0;background:transparent;color:var(--gf-text);font-family:var(--gf-font-mono);font-size:0.78em;padding:10px;outline:none";
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:6px;margin-top:6px";
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "Aplicar JSON";
    apply.style.cssText =
      "cursor:pointer;font:inherit;font-size:0.8em;padding:5px 10px;border-radius:var(--gf-radius);border:1px solid var(--gf-border);background:var(--gf-accent-soft);color:var(--gf-text)";
    apply.addEventListener("click", () => {
      if (!this.applyThemeJson(textarea.value)) {
        this.ctx.world.audio.play("ui.erro", 0.5, 1);
        this.ctx.store.pushToast("JSON de tema inválido", "bad");
        return;
      }
      this.lastSignature = "";
      this.rebuild(true);
      this.ctx.store.pushToast("Tema aplicado", "good");
    });
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = "Recarregar do tema atual";
    reload.style.cssText = apply.style.cssText;
    reload.addEventListener("click", () => {
      textarea.value = serializeTheme(this.ctx.store.theme);
    });
    actions.append(apply, reload);
    host.style.position = "relative";
    host.append(textarea, actions);
    actions.style.position = "absolute";
    actions.style.bottom = "6px";
    actions.style.left = "8px";
    textarea.style.paddingBottom = "40px";
  }

  private applyThemeJson(text: string) {
    try {
      const parsed = JSON.parse(text);
      const theme = validateTheme(parsed, this.ctx.store.theme);
      this.ctx.store.applyTheme(theme);
      this.action("theme-applied", theme.id, { id: "theme-applied", type: "label" });
      return true;
    } catch {
      return false;
    }
  }

  private wireThemeArea() {
    const host = this.ui.element("pause-hud");
    if (!host) return;
    host.querySelector("[data-gf-part='theme-json']")?.remove();
    const note = document.createElement("div");
    note.style.cssText = "font-size:0.75em;color:var(--gf-text-dim)";
    note.textContent = `Atalho: aba Dados abre o JSON completo do tema. Padrão de fábrica: ${goreforgeDefaults.theme}.`;
    host.append(note);
  }

  dispose() {
    this.ui.destroy();
    this.root.remove();
  }
}
