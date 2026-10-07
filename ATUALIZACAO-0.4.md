# GameForge Studio 0.4.0 — relatório de entrega

## Implementado

- CodeMirror 6, cores Lua/JS, números de linha, busca, indentação, sugestões simples da API.
- Diagnóstico sintático sem executar código: linha/coluna/marcadores, bloqueio de Aplicar com erro. Runtime continua reportando erros no Console.
- Importação `.lua`/`.js`, exportação nativa no desktop; Lua 5.3 com start, campos customizados persistentes, input pressed/released, helpers matemáticos e velocidade/apoio físico.
- 40 novos prefabs, total 46, busca e categorias; componentes editáveis offline.
- Design: materiais, pincel por clique, conta-gotas, aplicação em grupo, alinhamento/distribuição de filhos.
- Terreno 8 × 8 blocos com colisão e pincéis elevar/rebaixar/suavizar/nivelar/pintar; desfazer.
- Física em passo fixo, padrão 120 Hz, solver configurável, cilindros/cones convexos, atrito por corpo, buffer e tolerância de pulo.
- Velocidades/sensibilidades configuráveis e persistidas: jogador, corrida, pulo, mouse FPS, pan/órbita/zoom, terceira pessoa/FOV.
- Exemplo integrado Ateliê 0.4; parkour anterior preservado.
- Formato v4, importação v2/v3/original, autosaves anteriores preservados.
- Instalador Windows x64 offline, mesmo appId e nome da aplicação anterior.

## Verificações executadas

1. TypeScript estrito e builds de editor/runtime: passaram.
2. **23 testes de núcleo:** passaram. Incluem 46 prefabs, migração, diagnóstico Lua/JS, materiais/terreno/histórico, configurações, colisores, gravidade consistente a 30/60/144 FPS e parkour inteiro (20 plataformas, 8 cristais, 3 checkpoints, zero quedas).
3. Browser 0.4: busca/categorias/46 itens, pintura de grupo, pincel no viewport por raycast, undo, ajustes de controles, erro sintático, código colorido, `.lua` import/export, start/estado/input edges: passaram.
4. Testes anteriores: edição, histórico, IO, exportação HTML, quatro jogos, três experimentos, layout mobile e câmeras: passaram.
5. Scripts: Lua/JS reais alteraram a cena; Lua infinito atingiu o limite de instruções, JS infinito o watchdog e erro de sintaxe Lua foi reportado.
6. Autosave v2 → v4 e v3 → v4: passaram; conteúdo original de cada chave anterior permaneceu idêntico.
7. Electron Linux produção: Lua/JS sob CSP, toolbox, bloqueio, preload/context isolation, abrir/salvar/exportar, diagnósticos, novo Ateliê, `.lua` nativo e tecla E do exemplo: passaram. Diálogos de arquivo simulados, escrita/leitura real.
8. O **app.asar extraído do pacote Windows** passou no teste desktop 0.4 usando Electron Linux.
9. NSIS Windows: compilação concluída. Sob Wine 10, instalador 0.3 seguido de 0.4 na mesma pasta: ambos retorno 0; sentinela no diretório de dados preservada; SHA-256 do ASAR instalado idêntico ao empacotado:
   `00849beaf4223480583819014e36648239dec6c979a2a0362ba0b28eacb16673`.
10. `npm audit --omit=dev`: zero vulnerabilidades reportadas no momento da verificação; não equivale a auditoria de segurança.

## Limitações relevantes

- **Não foi validada a execução em Windows real.** Wine testa instalação; Electron Linux testa conteúdo, não drivers/integrações Windows.
- Instalador **não assinado digitalmente**.
- Terreno é feito de blocos, pintura é cor/material por peça, não texturização UV nem terrain contínuo.
- Erros de sintaxe não abrangem erros de lógica/tipos em execução. Sugestões não são LSP.
- Colisão discreta sem CCD; muito alta velocidade/parede fina pode falhar. Formas não uniformes e hierarquias complexas continuam aproximadas.
- Não é Luau nem API Roblox; não é paridade com Godot/Roblox. APIs/sistemas ainda ausentes estão no README.
- Scripts somente de confiança. Sem auditoria formal contra código hostil ou esgotamento de memória.

## Atualização

Salve backups JSON, feche a aplicação e execute `GameForge-Studio-0.4.0-Windows-x64-Setup.exe` com o mesmo usuário e pasta. Não requer Node/Python. O aplicativo atualizado abre projetos antigos; o inverso não é suportado. `Atelie-GameForge-v0.4.gameforge.json` também pode ser aberto diretamente na engine atualizada.
