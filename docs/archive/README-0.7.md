> Registro do código-fonte 0.7 fornecido. Afirmações de empacotamento/validação antigas não certificam a versão 0.8. Consulte o README atual.

# GameForge Studio 0.7

**Atualização desktop Windows: luzes, lanterna, áudio sintetizado e o jogo PORTAS — sem substituir os jogos existentes.**

## Instalar e atualizar

`GameForge-Studio-0.7.0-Windows-x64-Setup.exe` — Windows 10/11 x64 Intel/AMD.

1. Salve cópias dos seus projetos `.gameforge.json` e feche a engine.
2. Execute o instalador usando o mesmo usuário e a mesma pasta da instalação anterior.
3. Abra seus projetos normalmente. **Não é necessário desinstalar nem instalar Node.js ou Python.** Reserve 500 MB livres.

Identidade preservada: `com.gameforge.studio` / GameForge Studio. O leitor migra formatos 2, 3, 4, 5 e 6 para o formato **7**, sem sobrescrever as chaves antigas do autosave (a chave de trabalho continua `gameforge.project.v6`). Projetos salvos em v7 não abrem na engine 0.6: mantenha o backup original se precisar voltar.

Instalador **sem assinatura digital**. Validação em Wine e Electron Linux, não em hardware Windows real. Não desative o antivírus para instalar.

## O que mudou

### Luzes de verdade em cada objeto — Inspetor

Qualquer nó pode ter luz **ponto** (lâmpada) ou **holofote** (cone): cor, acesa/apagada, intensidade 0–60, alcance 0–120, queda, ângulo 5–90°, penumbra, piscada 0–1 com velocidade e sombras opcionais. A Toolbox ganhou a categoria **Iluminação** com lâmpada de teto, lâmpada piscante, luz de corredor e holofote (total **60 modelos**).

### Lanterna do jogador — aba Mundo

Lanterna presa à câmera com intensidade, alcance, ângulo, penumbra, cor, sombras e "ligada ao iniciar". Scripts controlam com `engine.torch(true)`, `engine.torch(false, { intensity: 4 })`.

### Áudio sintetizado, sem arquivos

40 efeitos (porta, gaveta, moeda, rugido, sussurro, choque, curativo, elevador, morte, olhos, seek, figura…) e 6 camadas em repetição (vento, drone, coração, tambores, passos da Figura, alarme), com volume geral. `engine.sound("porta.abrir", 1, 1)` e `engine.loop("vento", 0.4)`; volume 0 interrompe a camada.

### Scripts e comandos novos

`engine.light`, `engine.flicker`, `engine.torch`, `engine.sound`, `engine.loop`, `engine.volume`, `engine.move` (tween suave) e `engine.heal`, em **JavaScript e Lua**, com comandos prontos no painel. O limite de fonte por nó subiu de 64.000 para **128.000 caracteres**.

### Jogo PORTAS · Hotel das 100 Portas — projeto editável

Hotel procedural de 100 portas com quartos, corredores, depósito, loja do Jeff, biblioteca e elevador final; entidades **Rush**, **Ambush**, **Screech**, **Eyes**, **Halt**, **Seek** e **Figure**; armários para se esconder; chave, gazua, curativo, crucifixo, pilha e vitaminas; moedas e loja; HUD, revives e melhor porta salva. Controles: WASD, Shift, Espaço, **E** interagir, **F** lanterna, **Q** curativo, **G** vitaminas, **C** crucifixo, **R** voltar, **1–5** loja; com `depuracao: true`, **7** Rush, **8** Ambush, **9** Screech, **0** morrer, **6** +50 moedas. Tudo é script editável na engine — nada foi embutido como modo fixo.

### Sombras configuráveis — aba Mundo

- Ativar/desativar; filtro PCF suave ou VSM.
- Resolução 512 / 1024 / 2048 / 4096, limitada à capacidade da GPU.
- Cobertura, intensidade, bias e normal bias.
- Desfoque real no VSM: o campo fica desabilitado no PCF, que não usa esse parâmetro.
- Intensidade do sol e da luz ambiente; foco acompanha câmera/jogador ou permanece na origem.
- No Inspector → **Personagem, bot & física**, cada objeto pode projetar/receber sombras.

Comece com PCF, resolução 2048, cobertura 40–50. Reduzir a cobertura aumenta a definição. Bias muito alto separa a sombra do objeto; muito baixo causa manchas. VSM pode apresentar vazamento de luz e custa mais processamento. O ciclo de céu/sol continua modulando a iluminação configurada. Braços FPS são um modelo de visão sem sombra; o corpo completo fica oculto no FPS.

### Segundo jogador — dentro da Toolbox

**Toolbox → Personagens e física → Jogador articulado · opção 2.** O prefab **Jogador** anterior continua disponível. Agora são **55 prefabs**, nove novos.

O segundo jogador tem corpo em estilo blocado, cabeça, braços e pernas articulados. As pernas/braços oscilam conforme a velocidade durante o movimento no chão. Em primeira pessoa aparecem dois braços; em terceira pessoa aparece o corpo completo. Cor da pele, ritmo dos passos e vida inicial são editáveis. Não há IK, dedos, importação de esqueletos nem animação por keyframes.

Inserir um prefab de jogador o define como jogador principal da cena. O nó anterior **não é apagado**. Para trocar, selecione outro jogador e clique **Usar como jogador principal**. Há um jogador controlado por vez; não é multiplayer.

### Ragdoll e gelatina — física real

- **Ragdoll físico:** seis corpos rígidos e cinco juntas ConeTwist: tronco, cabeça, dois braços e duas pernas. Também pode ser ativado por script ou pela vida chegar a zero num humanoide.
- **Gelatina física:** volume cúbico experimental com oito partículas e 28 molas. A malha acompanha as partículas; não é só oscilação visual.
- Rigidez e amortecimento da gelatina são editáveis no Inspector. Massa vem do componente Física.
- Máximo de **12 rigs ativos** por cena. Com rigs, a frequência interna é pelo menos 120 Hz. Molas são limitadas conforme massa/passo e velocidades são limitadas para reduzir explosões numéricas.
- Dimensões físicas de cada eixo são limitadas a 0,25–8 unidades nos rigs. Evite interpenetrar vários rigs ao posicioná-los; comece com poucos, separados, sobre um piso estático.

Ragdoll usa o boneco predefinido; não é autorig de qualquer malha. Gelatina usa o volume cúbico predefinido; não converte uma esfera em soft-body esférico. Há colisão por partículas, sem conservação exata de volume, auto-colisão completa ou contato contínuo de toda a superfície. Velocidades extremas podem atravessar superfícies, pois a engine não tem CCD. Em mapas voxel, os colisores continuam sendo gerados na região do jogador, não para cada objeto distante.

**R** restaura o jogador e sua vida. Parar a execução restaura a cena editada e remove corpos/juntas temporários. `engine.ragdoll(id, false)` desativa o rig, mas não cura a vida; para o jogador morto, use R/respawn.

### Bots prontos e programáveis

Toolbox: **Bot · patrulha**, **Bot · seguir**, **Bot · atacar**.

Inspector: modo, velocidade (componente Comportamento), raio de patrulha, alcance de detecção, alcance/dano/intervalo do ataque, vida inicial e ragdoll ao morrer. Os bots usam corpos dinâmicos eretos, pernas animadas e a mesma física da cena.

Patrulha percorre quatro pontos em torno da posição inicial. Seguir aproxima-se do jogador e guarda distância. Atacar aproxima-se, verifica alcance/linha de visão e aplica dano com intervalo. Fora do alcance de detecção, seguir/atacar voltam à patrulha. Existe desvio local simples de obstáculos: **não há navmesh, A*, rotas através de labirintos, salto automático ou garantia de contornar qualquer parede**. Não use centenas de bots esperando desempenho de engine comercial.

A fonte JavaScript dos prefabs de bot já vem preenchida e desativada. Abra Scripts para editar e ativar. Também funcionam comandos em Lua. O bot não controla/ataca a si próprio quando seu ID é o jogador principal.

A vida dos atores é um recurso genérico da engine. A vida/fome do **Bosque Vivo** continua implementada no script daquele jogo; adicionar um bot não integra automaticamente os dois sistemas.

### Terreno — ferramenta dedicada

Aba **Terreno**:
- Geradores: plano, colinas, montanhas e dunas; tamanho, amplitude, frequência, semente e cor.
- Resoluções 17 × 17, 33 × 33 e **65 × 65**.
- Pincéis: elevar, abaixar, suavizar, nivelar, pintar, ruído e terraços.
- Forma circular/quadrada, raio, força/opacidade, dureza, altura de nivelamento, degrau dos terraços, semente do ruído e limites mínimo/máximo da altura resultante.
- Clique e arraste para esculpir, com indicação do raio. **Um traço = uma ação de desfazer.** Esc cancela o traço; Ctrl+Z desfaz; Ctrl+Shift+Z refaz.
- Regenerar substitui a escultura/pintura após confirmação e também permite desfazer.

É uma superfície contínua sem cavernas, não um volume voxel. Cores são por vértice; a ferramenta Pixel Studio continua sendo a pintura de texturas por pixel. Heightfield estático: mantenha escala X igual a Z para correspondência exata entre malha e colisão. Raio do pincel usa unidades locais. Os blocos antigos e o volume de blocos do Bosque permanecem separados.

### Programação mais rápida

**Scripts → Comandos prontos** cria um rascunho editável em Lua ou JavaScript. Confirmação antes de substituir um rascunho; o projeto só muda em **Aplicar script**. Toolbox também possui Girar, Flutuar e Ir e voltar prontos.

Novas APIs disponíveis **nas duas linguagens**:

| Chamada | Resultado |
|---|---|
| `engine.walk(id, dx, dz, velocidade)` | Direção X/Z normalizada; movimento contínuo até parar, 0–30 unidades/s |
| `engine.rotate(id, grausPorSegundo)` | Giro contínuo em Y, −720 a 720 graus/s |
| `engine.stop(id)` | Interrompe andar/girar e desliga o bot daquele nó |
| `engine.bot(id, modo)` | `off`, `patrol`, `follow` ou `attack`; requer corpo dinâmico e não ser o jogador principal |
| `engine.damage(id, valor)` | Reduz a vida; 0–100 por chamada |
| `engine.ragdoll(id, true)` | Ativa rig físico; `false` restaura o corpo original |
| `engine.impulse(id, x, y, z)` | Impulso no corpo/rig; componentes −100 a 100 |
| `self.id`, `self.health` | ID e vida informados ao script; saúde é somente leitura direta |

`walk` interrompe o bot; `bot` interrompe `walk`. Comandos persistem no runtime até parar/trocar ou encerrar a execução. Durante o ragdoll, patches diretos de transformação/velocidade são ignorados para não contrariar as juntas: use impulso. Objetos dinâmicos respondem a colisões; andar num objeto sem corpo é deslocamento visual, não navegação física.

JavaScript:
```js
function start() {
  engine.walk(self.id, 1, 0, 2);
  engine.rotate(self.id, 45);
}
function update(dt, time, input) {
  if (input.pressed.space) engine.stop(self.id);
}
```
Lua:
```lua
function start()
  engine.bot(self.id, "patrol")
end
function update(dt, time, input)
  if input.pressed.b then engine.bot(self.id, "follow") end
end
```

Lua é 5.3, não Luau/Roblox. APIs genéricas anteriores `get/set/spawn/remove/ui/voxel/store` continuam exclusivas de JavaScript. O worker tem limites de comandos, instruções/tempo; não é um sandbox formalmente auditado. Execute apenas scripts em que confia.

## Projetos incluídos no código-fonte

- `Portas-Hotel-100-Portas.gameforge.json` (também em `examples/portas-hotel/Hotel-Portas.gameforge.json`): o jogo PORTAS. Cole o elevador do saguão e aperte **E** para começar as 100 portas. Recriação com conteúdo próprio; não usa assets do Roblox.
- `examples/laboratorio06/Laboratorio-0.6.gameforge.json`: demonstração nova com jogador 2, bots, ragdoll, gelatina, sombra e terreno 65 × 65. Abra na engine e execute; permita os scripts do projeto se confiar. **G** dá impulso na gelatina, **J** derruba o jogador, **K** derruba o oponente, **B/N** muda o bot para seguir/patrulhar, **R** renasce. WASD, Shift, Espaço e câmeras continuam.
- `examples/bosque-vivo/Bosque-Vivo-v0.5.gameforge.json`: jogo de sobrevivência independente. Nada de vida/fome/crafting foi hardcoded como modo novo da engine. Abra diretamente na 0.6.
- Projetos Skyline Parkour e antigos continuam disponíveis.

Os recursos herdados (Pixel Studio, interfaces 2D, volume voxel, céu, navegação, formas, exportação offline e APIs anteriores) estão documentados em [README 0.5 arquivado](docs/archive/README-0.5.md). Os limites de projeto continuam: 500 nós/cena, 20 cenas, 48 texturas, 64 elementos 2D, 32 scripts ativos, fonte de 128 mil caracteres e importação de até 8 MB. O histórico de terrenos grandes consome memória; guarde backups.

## Desenvolvimento e validação

Somente para quem deseja modificar/recompilar: Node >= 22.12 (empacotamento validado com Node 24), `npm ci`, `npm run dev`, `npm test`, `npm run build`, `npm run desktop:win`. Para empacotar Windows a partir de Linux são necessários Wine/NSIS. O usuário do instalador não precisa dessas ferramentas.

- `tests/studio06.test.ts`: schema, iluminação, humanoide, molas/juntas/estabilidade, dano/respawn, bots/parede, comandos, geração/pincel e limpeza de rigs.
- `tests/studio06-browser.mjs`: Toolbox/Inspector, sombra VSM, pincel contínuo com undo, workers Lua/JS e câmeras/arms.
- `tests/studio06-desktop.mjs`: IO nativo, demonstração, morte/respawn, comandos, save v7, restauração e exportado offline.
- `tests/portas-sim.test.ts`: 11 testes headless do jogo PORTAS (quartos, trancas, esconderijo, criaturas, loja, perseguição, biblioteca, 3.000 quadros).
- `tests/studio07-browser.mjs`: 60 modelos, Inspetor de luz, lanterna/volume, APIs novas e o jogo PORTAS rodando na engine.
- Suítes anteriores permanecem para regressão. Rode os testes do navegador sem builds simultâneos: Vite recarrega a página quando `public/player.html` é regenerado.

Consulte [ATUALIZACAO-0.7.md](ATUALIZACAO-0.7.md) para o registro do pacote entregue e seus limites.
