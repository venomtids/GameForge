# GameForge Studio 0.7.0 — registro da entrega

Data: 29/09/2026. Atualização da engine 0.6.0, não aplicativo separado.

## Entregáveis

- `GameForge-Studio-0.7.0-Windows-x64-Setup.exe`: instalador NSIS Windows x64, inclui Electron 44.4.3 e os projetos de exemplo embutidos em `resources/Projetos` (PORTAS, Laboratório 0.6 e Bosque Vivo). O botão **Abrir** já começa nessa pasta.
- `Portas-Hotel-100-Portas.gameforge.json`: o jogo **PORTAS · Hotel das 100 Portas** como projeto editável para abrir dentro da engine 0.7.
- `GameForge-Studio-0.7-Codigo-Fonte.zip`: fonte, documentação, exemplos e testes.
- `GameForge-Studio-0.7-SHA256.txt`: integridade dos três arquivos acima.

Não requer Node.js, Python ou terminal no computador do usuário. Feche a engine, faça backup dos JSON e instale no mesmo usuário/pasta (a atualização preserva projetos e preferências). Instalador não assinado; não desative antivírus. O aplicativo permanece em beta.

## Escopo implementado

- **Luzes por nó**: ponto (lâmpada) ou holofote (cone), cor, acesa/apagada, intensidade 0–60, alcance 0–120, queda, ângulo 5–90°, penumbra, piscada 0–1 com velocidade e sombras opcionais por luz. Painel **Luz do nó** no Inspetor.
- **Lanterna do jogador** presa à câmera: intensidade, alcance, ângulo, penumbra, cor, sombras e "ligada ao iniciar" na aba **Mundo**.
- **Áudio sintetizado em tempo real** (sem arquivos externos): 40 efeitos (porta, gaveta, moeda, rugido, sussurro, eletrico, curativo, elevador, morte, olhos, seek, figura…) e 6 camadas em repetição (vento, drone, coração, tambores, passos da Figura, alarme); volume geral 0–1.
- **Programação**: comandos prontos e APIs novas em **JavaScript e Lua** — `engine.light`, `engine.flicker`, `engine.torch`, `engine.sound`, `engine.loop`, `engine.volume`, `engine.move` (tween suave) — além de `engine.heal`; limite de fonte por nó de 64.000 para **128.000 caracteres**.
- **Motor**: schema **7** (migra 2–6 → 7 sem tocar no arquivo original), piscadas e tweens avaliados por quadro, luzes acompanhando o nó, 5 modelos novos na Toolbox (categoria **Iluminação**) — total **60 modelos**.
- **Jogo PORTAS · Hotel das 100 Portas** (PT-BR), entregue como projeto editável: hotel procedural de 100 portas com quartos, corredores, depósito, loja do Jeff, biblioteca e sala final; entidades **Rush**, **Ambush**, **Screech** (no escuro, olhar desfaz), **Eyes** (quadros), **Halt** (pune quem anda), **Seek** (corredor de fuga, portas 34 e 84) e **Figure** (biblioteca + alavanca); esconderijos em armários; itens chave, gazua, curativo, crucifixo, pilha e vitaminas; moedas e loja; HUD completo; revives; melhor porta salva. Todo o jogo é um script editável dentro da engine — nada foi embutido no motor.

## Validação realizada

- TypeScript sem erros; build do editor e do jogador concluídos.
- **57/57 testes de núcleo**, incluindo **11 testes headless do hotel** (`tests/portas-sim.test.ts`) que rodam o script do jogo contra uma engine falsa com RNG determinístico e checam: saguão/elevador, 8 portas com remoção de salas antigas, tranca/chave, gazua, alavanca, Rush/Ambush (morte, esconderijo e crucifixo), Screech, olhos, Halt, perseguição do Seek, loja do Jeff, biblioteca e 3.000 quadros de estabilidade — tudo com validação de ids, cores, limites e HUD.
- Navegador 0.7 (`tests/studio07-browser.mjs`): Toolbox com 60 modelos e categoria Iluminação; Inspetor de luz persistindo tipo/intensidade/ângulo/piscada; aba Mundo persistindo lanterna e volume; runtime com `engine.light`/`flicker`/`torch`/`sound`/`loop`/`move`/`heal`; e o **jogo PORTAS rodando dentro da engine** (HUD "PORTA 1 / 100", sala 1 construída, 9 luzes, lanterna ligada, sons e camadas de áudio).
- Regressão: Toolbox/Design 0.4, ferramentas 0.5, laboratório 0.6, Bosque Vivo, câmeras/FPS, Lua/JS, watchdogs, edição/histórico, IO, os 4 jogos de exemplo e exportação offline.
- Migração de autosaves 2, 3, 4, 5 **e 6** → 7, mantendo a chave original sem alteração.
- **ASAR exato do pacote Windows executado com Electron Linux**: abertura/salvamento nativo, FPS, ragdoll/morte/respawn, terceiro-personagem, restauração de autoria e exportado HTML offline (0.6) e o fluxo completo do Bosque exportado.
- **Wine 10**: instalação do 0.7.0 com código de retorno zero e ASAR instalado idêntico ao empacotado; versão interna 0.7.0. O caminho de atualização 0.6.0 → 0.7.0 (mesma pasta, projetos preservados) também foi exercitado.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas na data da validação.

SHA256 do ASAR empacotado e instalado:
`c1395defa6d0280cd542f8017b5a68e15ae1ac13bd2053f7c1aef2934d70ba4b`

## Como abrir o jogo

1. Instale a 0.7.0 e abra o GameForge Studio.
2. **Abrir projeto** → `Portas-Hotel-100-Portas.gameforge.json`.
3. Aperte **Jogar** (▶). No saguão, chegue perto do elevador e aperte **E** para começar as 100 portas.

Controles: WASD/setas mover · Shift correr · Espaço pular · **E** interagir · **F** lanterna · **Q** curativo · **G** vitaminas · **C** crucifixo · **R** voltar à entrada da sala · **1–5** comprar na loja · Esc pausar. Comandos de teste (só com `depuracao: true` no script): **7** Rush · **8** Ambush · **9** Screech · **0** morrer · **6** +50 moedas.

O script do jogo fica no nó `controlador` (aba Código) com a configuração comentada no topo (`CFG`): número de portas, velocidades, preços, chances, bateria, revives e depuração. Alterar e apertar **Jogar** já aplica.

## Ressalvas

- Instalador **não assinado**; validação feita por Wine 10 e Electron no Linux, não em hardware Windows real.
- A primeira execução do app depois de instalar pode levar alguns segundos a mais (criação do perfil); repita o teste se a suíte de desktop falhar na estreia.
- O áudio é **sintetizado** pela engine; são efeitos próprios, não os arquivos do jogo original.
- PORTAS é uma recriação de mecânicas com conteúdo próprio — nenhum asset do Roblox foi usado ou redistribuído.
- Single-player: a engine tem um jogador por cena (a versão original é multiplayer).
- Lua 5.3 (não Luau); bots e criaturas usam desvio local, sem navmesh; gelatina continua experimental; sem CCD.
- Arquivos salvos em 0.6 abrem na 0.7 (migração automática); o contrário não é possível.
