# GameForge Studio 0.5.0 — entrega e validação

## Separação engine / jogo

A pedido do usuário, **Bosque Vivo é um jogo programado com a engine, não um sistema de sobrevivência fixo adicionado ao editor**. O projeto `.gameforge.json` traz seu controlador JavaScript, cenário, texturas e interfaces. O código de vida/fome, inventário, receitas, mineração, construção, combate, IA, dia/noite, save e objetivo está em `examples/bosque-vivo/game.js`, concatenado ao gerador e embutido no nó Controlador do jogo. A engine só fornece APIs genéricas.

## Recursos entregues

- Superfície de terreno contínua 33 × 33, escultura/pintura por vértice, normais e colisão Heightfield.
- Seis formas novas: cunha, cápsula, anel, arco, rocha facetada e estrela extrudada. Alguns colisores continuam aproximados.
- Pixel Studio: texturas 16/32/64, pincel de 1 pixel, traços, borracha, fill, conta-gotas, PNG e aplicação a 3D/UI.
- Botão direito + WASD/Q/E/Shift para navegação, sensibilidade/velocidade ajustáveis; clique curto abre ações contextuais.
- Editor de interface 2D: painéis/textos/botões/imagens/barras, layout relativo à tela e eventos de botão.
- Céu atmosférico, sol/nuvens, mapas-base de gramado/colinas/formas.
- Volume voxel genérico, materiais/texturas, edição de células, faces internas removidas e colisão local do jogador.
- APIs JavaScript de cena, UI, voxel, câmera/raycast de entrada, save local e spawn visual.
- Registro de bordas por evento para evitar perda de teclas/cliques rápidos entre frames.
- Formato v5 com migração v2/v3/v4/original; autosaves anteriores preservados.
- Instalador Windows x64, mesma identidade e pasta da aplicação anterior, sem Node/Python para uso.

## Testes efetivamente executados

1. Typecheck estrito e builds de editor/player: passaram.
2. **33 testes de núcleo passaram.** Incluem os 23 anteriores, parkour inteiro com física, validação/migração v5, novas geometrias, escultura, Heightfield suportando corpo, volume voxel e suporte físico ao jogador real do projeto.
3. Dois desses testes executam **o código JavaScript do próprio jogo em VM com API simulada**: progressão madeira → ferramentas → ferro → cristal → farol, vitória, fome/comida, dano de queda, criaturas, morte/respawn e save/load. Isso valida lógica; não equivale a uma campanha inteira jogada manualmente pela interface.
4. Browser: pintura de pixel individual, aplicação de textura a objeto/UI, botão de interface pausando runtime, painéis de céu/novas formas, menu contextual, voo com RMB+WASD e pincel de terreno contínuo: passaram.
5. Browser com projeto real dentro da engine: abrir, permitir scripts, iniciar, HUD de vida/fome, mochila, save/load persistente e código editável com sintaxe válida: passaram.
6. E2E anterior: edição, undo/redo, IO, HTML, quatro jogos, laboratório e mobile: passou. Migrações de autosave v2/v3/v4 → v5 preservaram o valor original das chaves.
7. Lua e JS reais executaram; loop Lua atingiu limite de instruções, loop JS foi interrompido pelo watchdog, sintaxe inválida foi reportada.
8. Electron Linux produção: IO por IPC (diálogos simulados, filesystem real), CSP, Lua/JS, exportação, exemplo 0.4, projeto Bosque Vivo, UI, saves e edição de texturas: passaram.
9. O **ASAR do pacote Windows**, executado via Electron Linux, passou no teste desktop 0.5: projeto de jogo, scripts/CSP, mochila/save, 35 elementos UI, 14 texturas e exportação nativa.
10. HTML exportado do jogo também passou em Chromium via file://: scripts permitidos, menu/HUD, mochila, save e pausa. Essa exportação é adicional; a entrega principal do jogo é para abrir dentro da engine.
11. Sob **Wine 10**, instalador 0.4 seguido de 0.5 na mesma pasta: retorno 0 para ambos; sentinela em AppData preservada; versão instalada confirmada como 0.5.0. ASAR instalado igual ao empacotado, SHA-256:
    `218c1fd19a8183b502bbde676fd73fa703e14e04dad626c52f3ae4c5597c1062`.
12. `npm audit --omit=dev`: zero vulnerabilidades reportadas; não constitui auditoria de segurança.

Uma repetição de teste browser durante o build foi interrompida pelo reload do Vite ao regenerar player.html. Reexecutada sem build concorrente, a suíte passou. Um teste revelou entradas rápidas perdidas; o registro por evento foi implementado e os testes browser/desktop passaram depois. Jogador foi configurado sem sleep para preservar apoio/entrada responsivos.

## Limitações

- **Execução em Windows real não foi validada**. Wine não valida drivers/runtime real do Windows. Instalador não assinado digitalmente.
- Jogo próprio com escopo finito, não uma cópia integral de Minecraft: 32 × 24 × 32, 7 receitas, inventário por contagem, criaturas simples. Sem multiplayer, mundo infinito, água dinâmica, redstone, fornos, agricultura, áudio ou animação de ferramenta.
- Save de gameplay local e separado do projeto. Criaturas são recriadas ao carregar. Não há sincronização entre computadores.
- Interface 2D não é editor de jogos 2D/sprites. Pixel Studio edita texturas, não UVs nem pintura diretamente sobre a malha.
- Heightfield estático com escala X/Z uniforme; não há cavernas no terreno contínuo. Volumes voxel têm colisão na região próxima do jogador. Física discreta sem CCD.
- APIs novas de cena/UI/voxel são JavaScript; Lua mantém a API 0.4. Não há Luau, APIs Roblox ou paridade Godot/Roblox.
- Scripts somente de confiança. Sem auditoria formal contra código hostil/exaustão de memória.
