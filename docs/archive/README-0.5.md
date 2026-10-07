# GameForge Studio 0.5

**Engine desktop atualizada + projeto de jogo independente, programado nela.**

A engine não contém sistemas específicos de Minecraft. Ela fornece recursos genéricos de cena, formas, volumes de blocos, física, texturas, interface e scripting. **Bosque Vivo** é um projeto separado: suas regras de sobrevivência estão em JavaScript editável no próprio `.gameforge.json` e nos arquivos em `examples/bosque-vivo/`.

## Instalar / atualizar

Windows 10/11 x64 Intel/AMD: `GameForge-Studio-0.5.0-Windows-x64-Setup.exe`.

Salve backups JSON, feche a engine e instale usando o mesmo usuário e pasta anterior. Não é necessário desinstalar. O instalador inclui tudo: **não precisa de Node.js, Python ou terminal**. Reserve 500 MB livres.

Instalador não assinado digitalmente. A instalação/atualização foi testada sob Wine e o conteúdo em Electron Linux, **não em Windows real**. Não desative o antivírus para instalar.

## Novidades da engine

### Terreno contínuo

Em **Design & pintura → + Terreno contínuo 33 × 33**, ou **Novo → Colinas contínuas**.

Superfície triangulada contínua, normais suaves, pincéis de elevar/rebaixar/suavizar/nivelar, pintura de cor por vértice e colisão Heightfield. Cada aplicação por clique tem undo. Um terreno usa **um nó**, em vez de 65 nós de blocos. O formato também aceita resolução 17 × 17. Raio, força e altura estão no painel.

Os terrenos em blocos da versão anterior continuam disponíveis. Terreno contínuo é uma superfície sem cavernas; não é voxel nem escultura arbitrária. O Heightfield é estático e requer escala horizontal uniforme para correspondência exata. Mantenha X e Z iguais. Cores do terreno são por vértice; pintura pixel a pixel é feita na textura via Pixel Studio.

### Formas além das primitivas anteriores

**Adicionar nó** oferece cunha, cápsula, anel, arco curvo, rocha facetada e estrela extrudada. Veja **Novo → Formas avançadas**.

Cunha tem colisor convexo; cápsula, anel e arco usam colisores compostos aproximados, com passagem pelo vão. Rocha/estrela usam caixas aproximadas. Não é modelador de malhas, CSG nem importador GLB/FBX. Os 46 prefabs da versão 0.4 permanecem no Toolbox.

### Pixel Studio

Texturas próprias de 16, 32 ou 64 pixels de lado, pincel de **1 pixel**, traço contínuo, borracha com transparência, preencher e conta-gotas. Undo por traço. Até 48 texturas por projeto.

Selecione um objeto na árvore, crie/pinte uma textura e use **Aplicar no objeto 3D**. Para ícones/menu, selecione o elemento na aba Interface 2D e use **Aplicar no elemento 2D**. Texturas ficam embutidas no JSON e usam filtragem nearest. Importação PNG local redimensiona para a resolução escolhida; exportação PNG disponível. Não há pintura direta sobre UV no viewport nem editor de UV.

Para trocar a textura de um material voxel, use **Mundo → Textura do bloco**.

### Botão direito e navegação

Na câmera perspectiva do editor:
- Segure **direito** e mova o mouse para olhar.
- Mantendo direito: **WASD** desloca, **Q/E** desce/sobe, **Shift** acelera 3×.
- Clique direito curto abre menu: adicionar forma, enquadrar, duplicar e excluir seleção.
- Sobre volume voxel: menu também permite remover e colocar o bloco ativo.

Nas vistas ortográficas, botão direito desloca a vista. Órbita, pan e zoom antigos continuam. **Configurações do projeto** ajusta velocidade de voo e sensibilidade do botão direito, além de todos os controles 0.4. Teclas/mouse têm bordas de entrada registradas por evento, para não perder cliques rápidos entre frames.

### Interface 2D

Aba **Interface 2D** cria painéis, textos, botões, imagens e barras. Arraste no canvas e solte para posicionar. Coordenadas/tamanhos são percentuais da tela; fonte, cores, visibilidade e ação são editáveis. Até 64 elementos por cena.

Ações prontas: `pause`, `resume`, `respawn`, `hide`. `event` envia o ID do botão ao script em `input.events`. Visibilidade condicional: sempre, jogando ou pausado. Imagens podem usar texturas do Pixel Studio. A ordem da lista define a sobreposição. Não é editor de jogos 2D com física/sprites animados; é um editor de **interfaces sobre o jogo 3D**.

### Céu, sol e mapas-base

Aba **Mundo** controla céu atmosférico, nuvens, elevação e direção do sol. A iluminação acompanha o sol.

**Novo → Gramado e céu**, **Colinas contínuas** ou **Formas avançadas**. Mapas próprios com gramado e céu, sem assets Roblox. Sky e nuvens são decorativos; não há clima físico.

### Volume de blocos genérico

Aba Mundo pode criar volume editável 32 × 24 × 32. O formato aceita também 48 × 24 × 48. Até 16 materiais, com cor, textura e propriedade sólida. Faces internas não são renderizadas.

O volume não tem inventário, fome, receitas ou inimigos embutidos. Essas regras são escritas pelo jogo. A colisão voxel é mantida na vizinhança do jogador; não simula todos os corpos afastados do jogador. Há um volume por cena, alinhado aos eixos e em unidades de 1 metro.

## Bosque Vivo — projeto independente

Abra `Bosque-Vivo-v0.5.gameforge.json` na engine 0.5, execute e permita os scripts desse projeto. Não é necessário usar HTML externo. O arquivo já traz cenário, texturas próprias, personagem, **35 elementos de interface** e o controlador JavaScript.

Recursos do jogo: mundo finito gerado por semente, mineração e construção, hotbar de 8 slots, inventário por contagem, 7 receitas, ferramentas, minérios, vida/fome, frutas, dano de queda/contato/fome, criaturas com IA simples mais agressivas à noite, ciclo dia/noite, morte/renascimento e save/load local. Objetivo completável: fabricar e colocar o Farol do Bosque. Depois, pode continuar construindo.

**WASD:** mover · **Shift:** correr · **Espaço:** pular · **esquerdo segurado:** minerar/atacar · **direito:** construir · **1–8:** selecionar · **E:** mochila/receitas · **F:** fruta · **Esc:** pausa da engine · **F8:** parar.

No início escolha Começar. Clique no viewport para capturar o mouse; se bloqueado, arraste com esquerdo. E abre a mochila e solta o mouse. Volte ao jogo e clique no viewport novamente.

Para modificar regras: selecione **Controlador do jogo · JavaScript editável → Scripts**. `CONFIG`, `ITEMS`, `RECIPES`, `mining`, `craft`, `hurt`, `eat` e `update` estão no código do projeto. Fonte completa exportável: `Controlador-completo.js` (inclui o gerador). Para alterar o cenário inicial, pare a execução e edite os blocos pelo menu contextual. Interface 2D edita o HUD/menu; Pixel Studio edita as texturas.

**Não é Minecraft completo:** mapa finito, não tem multiplayer, mundo infinito, redstone, dimensões, fornos, fazendas, animais, armaduras, áudio ou todos os sistemas de Minecraft. As criaturas são modelos simples originais; ferramentas não têm animação na mão. Água não se propaga e tochas são decorativas. É um jogo de sobrevivência próprio com os sistemas acima, não apenas uma coleção de blocos.

Veja `examples/bosque-vivo/LEIA-ME.md` para a estrutura dos arquivos e a progressão.

## API de programação 0.5

Lua 5.3 e JavaScript continuam disponíveis. CodeMirror tem cores, linhas, busca e sugestões básicas; diagnóstico sintático indica linha/coluna e bloqueia Aplicar com sintaxe inválida. Erros de runtime ficam no Console. Não é análise completa de tipos/lógica nem debugger.

Ciclo de vida: `start()` opcional, antes do primeiro `update(dt, time, input)` obrigatório. `dt`/`time` são segundos. O Worker roda aproximadamente a 30 Hz; a física padrão roda a 120 Hz, ajustável. Estado customizado em `self` dura até parar/executar.

API anterior (Lua e JS): `self.x/y/z`, `self.rx/ry/rz` (graus), `self.color/visible`, `self.vx/vy/vz` (m/s globais), `self.grounded`, `engine.log/clamp/lerp/distance`, `input.pressed/released`. `self` deve continuar sendo tabela/objeto. Lua não é Luau nem API Roblox.

### APIs genéricas novas — JavaScript nesta versão

| Chamada | Função |
|---|---|
| `engine.get(id)` | Snapshot do estado de um nó: posição local, rotação, velocidades, grounded, cor, visible |
| `engine.set(id, patch)` | Alterar esses campos em outro nó, com validação |
| `engine.spawn(id, {kind,x,y,z,scale,color,...})` | Criar malha visual de forma suportada, sem corpo físico/script; máximo total 750 nós em execução |
| `engine.remove(id)` | Remover nó em execução, exceto o jogador principal |
| `engine.ui(id, {text,visible,color,background,value})` | Atualizar elemento já existente; `value` de barra entre 0 e 1 |
| `engine.freeze(bool)` | Suspender input de movimento; scripts e física continuam, permitindo processar menus |
| `engine.respawn()` | Retornar jogador ao spawn/checkpoint |
| `engine.sky(elevação, azimute)` | Alterar sol em execução, se céu estiver ativo |
| `engine.voxel.size / height` | Dimensões do volume da cena |
| `engine.voxel.get(x,y,z)` | Tipo do bloco; 0 = vazio |
| `engine.voxel.set(x,y,z,tipo)` | Alterar uma célula, respeitando limites |
| `engine.voxel.snapshot()` | Copiar os índices de todos os blocos |
| `engine.voxel.replace(blocos)` | Substituir o volume, com mesmo tamanho/material válido |
| `engine.store(objetoJSON)` | Save local de até 500.000 caracteres, por cena/nó de script |
| `engine.saved` | Save lido no início desta execução, ou null |
| `input.events` | IDs dos botões acionados e `storage-saved` / `storage-error` |
| `input.mouse0 / mouse2` | Botões mantidos; também disponíveis em pressed/released |
| `input.camera` | `{origin:[x,y,z], direction:[x,y,z]}` |
| `input.ray` | Voxel apontado até 6 m: `{cell, normal, type, distance}`, ou null |
| `input.target` | Nó visual apontado até 6 m: `{id,distance}`, ou null |

Cada tick admite até 256 comandos. Scripts de jogo controlam sua própria lógica de inventário, física de IA, dano e UI. Spawn é visual: colisão e regras adicionais precisam ser modeladas pelo jogo. O controlador de jogador embutido continua controlando vx/vz, portanto não dispute esses eixos com `engine.set`.

## Dados, limites e segurança

- Formato v5, importação v2/v3/v4/original. Autosave `gameforge.project.v5` lê versões anteriores quando ausente, sem sobrescrevê-las. Versões anteriores não abrem v5.
- 500 nós editáveis/cena, 20 cenas, 48 texturas/projeto, 64 elementos UI/cena, 32 scripts ativos.
- Fonte até 64.000 caracteres/nó; projeto até 8 MB. JS parser em modo ECMAScript 2022, Lua parser em 5.3.
- Lua: 50.000 instruções/chamada. Watchdog JS: 350 ms/tick e 2,5 s inicialização.
- Saves de jogo são separados do JSON do editor. Copiar projeto com o mesmo ID de cena/nó compartilha seu namespace local de save. Alterar IDs ou limpar dados do aplicativo pode impedir encontrar o save. Guardar o projeto não salva automaticamente o progresso de gameplay.
- Execução muda apenas o estado runtime; parar restaura o projeto. Use os comandos de save do jogo para manter progresso.
- Scripts exigem confiança e permissão explícita. Worker separado, comandos validados, renderer Electron sem Node. **Não é sandbox auditada contra código hostil ou consumo excessivo de memória.**
- Física discreta sem CCD; objetos muito rápidos podem atravessar paredes finas. Não há importação de malhas, animação esquelética, CSG, multiplayer, editor 2D de sprites ou paridade Godot/Roblox.

## Desenvolvimento (não necessário para quem instala o EXE)

Node 24 recomendado, mínimo 22.12.

```sh
npm ci
npm run dev
npm run build
npm run desktop:win
npx tsx scripts/generate-bosque.ts
npm test
node tests/studio05-browser.mjs
node tests/bosque-browser.mjs
node tests/studio05-desktop.mjs
node tests/exported-bosque.mjs
```

Testes browser exigem servidor dev + Chromium Playwright. Desktop Linux headless usa Xvfb. Os testes 0.3/0.4 anteriores permanecem, com migração atualizada. Veja `ATUALIZACAO-0.5.md`. Documentação anterior arquivada em `docs/archive/`; licenças em `THIRD-PARTY-NOTICES.txt`.
