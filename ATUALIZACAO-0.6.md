# GameForge Studio 0.6.0 — registro da entrega

Data: 23/09/2026. Atualização da engine 0.5.0, não aplicativo separado.

## Entregáveis

- `GameForge-Studio-0.6.0-Windows-x64-Setup.exe`: instalador NSIS Windows x64, inclui Electron 44.4.3.
- `Laboratorio-0.6.gameforge.json`: projeto editável para abrir dentro da engine 0.6.
- `GameForge-Studio-0.6-Codigo-Fonte.zip`: fonte, documentação, exemplos e testes.
- `GameForge-Studio-0.6-SHA256.txt`: integridade dos três arquivos acima.

Não requer Node.js, Python ou terminal no computador do usuário. Feche a engine, faça backup JSON e instale no mesmo usuário/pasta. Instalador não assinado; não desative antivírus. O aplicativo permanece em beta.

## Escopo implementado

- Sombras reais com resolução/filtro/cobertura/bias/intensidade/desfoque VSM e controles de luz; flags por objeto.
- Segundo jogador na Toolbox, preservando o prefab anterior: corpo articulado e passos; braços FPS; seletor de jogador principal.
- Ragdoll físico de seis corpos e cinco juntas; gelatina experimental com oito partículas e 28 molas.
- Terreno dedicado com geração por semente, resolução até 65 × 65, arraste contínuo, oito modos incluindo seleção, parâmetros e undo por traço.
- Comandos prontos/editáveis e helpers de andar/girar/parar, bots, dano, ragdoll e impulso em JavaScript e Lua.
- Bots de patrulha, seguir e atacar com corpo dinâmico, parâmetros e código; desvio local, não navmesh.
- Schema 6 e autosave v6, migração dos formatos 2–5 e original. Bosque Vivo e Skyline continuam projetos independentes.

## Validação realizada

- TypeScript sem erros e builds do editor/player de produção concluídos.
- **46/46 testes de núcleo**, incluindo 13 testes novos. Exercitados extremos de massa/rigidez/amortecimento e frequências 60/120/240 Hz, com subpassos de segurança quando existem rigs; isso não constitui prova de estabilidade para qualquer cena possível.
- Navegador 0.6: Toolbox, jogador anterior preservado, bot/Inspector, sombra VSM, terreno 65 × 65, traço contínuo e undo único; workers reais JavaScript/Lua; viewmodel FPS e corpo em terceira pessoa.
- Regressão: Toolbox/Design 0.4; ferramentas 0.5; Bosque; câmeras/FPS; Lua/JS; watchdogs; edição/histórico; IO; jogos e exportação offline.
- Migração de autosaves 2, 3, 4 e 5 → 6, mantendo a chave original sem alteração.
- **ASAR exato do pacote Windows executado com Electron Linux**: abertura/salvamento nativo, projeto do laboratório, morte/ragdoll/respawn, atalhos rápidos, terceiro-personagem, restauração ao parar e exportado HTML offline.
- Mesmo ASAR: Bosque Vivo, HUD/bolsa/save, 35 elementos 2D, 14 texturas e exportação nativa; Bosque exportado também testado via `file://`.
- **Wine 10: instalação 0.5.0 seguida de 0.6.0**, ambas com código de retorno zero, mesma pasta `C:\GameForge-Upgrade`, arquivo-sentinela no AppData preservado e ASAR instalado idêntico ao empacotado. Versão interna confirmada: 0.6.0.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas na data da validação.

SHA256 do ASAR empacotado e instalado:
`758ef0a057b7e838f3c6f6bd0b152d24c4d177803a5887b8080a79d44016ba92`

## Ressalvas

**Não houve teste em Windows físico/VM Windows real.** Wine valida instalação; Electron Linux valida o conteúdo da aplicação, mas não garante comportamento de drivers/GPU/antivírus do seu Windows.

Gelatina experimental; limite de 12 rigs; dimensões físicas limitadas; sem CCD, auto-colisão completa ou conservação exata de volume. Bots não fazem busca de caminho completa. Terreno é Heightfield sem cavernas e exige escala horizontal uniforme para colisão fiel. VSM pode vazar luz. A engine não equivale à Godot completa.

Scripts só devem ser executados com confiança. O sandbox não foi formalmente auditado. Os sistemas de fome/vida/crafting do Bosque continuam no script do projeto; não são substituídos pela vida genérica dos bots. Projetos salvos em schema 6 não podem ser reabertos na 0.5 sem conversão; guarde cópia anterior.
