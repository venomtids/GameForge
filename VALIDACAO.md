# Validação da gelatina 0.8.3 · 06/10/2026

**130/130 testes unitários**, typecheck/build e testes de navegador `test:jelly`, `test:studio06`, `test:studio08`, `test:export:studio08` passaram. Braços e câmera, 6 tetraedros XPBD, gota viscosa confinada e consulta triângulo da malha para gelatinas livres cobertos. Visão de primeira pessoa comparada por pixels, mobile `file://` a 390px verifica **pixels de cena** após resize, layout 320–1920. Parkour completo sem teleporte/morte nas cadências de entrada 30/60/144. Studio e jogo nos servidores 5173/5174 respondem HTTP200. O instalador 0.8.2 documentado abaixo é da versão anterior, sem estas alterações. **Windows CI 37501148172: success (3m02s)** em `cbc0a207370363d0fc723da9ee78023600a8105a`. NSIS foi gerado/instalado, recursos verificados, aplicativo instalado testado (salvamento rápido/UTF-8, `.bak`, IPC, Jelly Jump, exportação e shutdown) e instalador 0.8.3 publicado. [Execução](https://github.com/venomtids/GameForge/actions/runs/37501148172) · [download](https://github.com/venomtids/GameForge/releases/download/studio-v0.8.3/GameForge-Studio-0.8.3-Windows-x64-Setup.exe). Asset de 103.759.512 bytes, SHA-256 `4d188ac60c79230a7b74811a6814e17b1e61e5cf643e1bcfc91f3c0d6021bf1e`. A execução anterior 37500043364 falhou corretamente em salvamento rápido e foi corrigida antes da publicação.

# Validação da gelatina 0.8.2 · 06/10/2026

- 121 testes unitários, typecheck/build e `test:jelly`, `test:studio06`, `test:studio08`.
- Referência Roundy/Jelly-Mesh-System inspecionada no commit 730062288016c211c773610cf4a11bfe947ef0fa; algoritmos de vértices/pivô/raio/LOD adaptados e licenças incluídas no aplicativo e HTML.
- Mais squash/stretch, molas nas malhas, impulsos locais/cisalhamento, presets e pivô persistidos.
- Saltos/boosts repetidos sem deriva; topo alinhado ao apoio; 11 superfícies, 5 cristais, 2 checkpoints e percurso completo a 30/60/144 cadências, sem teleporte/mortes.
- Offline `file://`, mobile 390px e workspace 320–1920px. Cadências de teste não são garantia de FPS em todo dispositivo.
- Studio5173 e jogo5174 reconstruídos/HTTP200 com host de prévia.
- **Windows CI 37466047048: success (3m08s)**. NSIS gerado/instalado, recursos verificados, executável instalado/IPC/backup/exportação testados e release 0.8.2 publicada. [Execução](https://github.com/venomtids/GameForge/actions/runs/37466047048) · [download](https://github.com/venomtids/GameForge/releases/download/studio-v0.8.2/GameForge-Studio-0.8.2-Windows-x64-Setup.exe). Código `2a13d4ed1534ebc489e7f918f53db33926831118`; 103.753.986 bytes; SHA-256 `598f6cb27b00190fb8a7f64687ed686bffc404ddf359f6a31d606272632c819d`. À época a conexão GitHub expirou após a publicação, mas o instalador público 0.8.2 já estava disponível; a conexão foi restabelecida posteriormente para o lançamento 0.8.3.

[Detalhes e limites da adaptação](docs/GELATINA-0.8.2.md).

---

## Histórico de validações anteriores

# Validação — Studio 0.8.1 · Gelatina

Estado em 30/09/2026. A seção histórica 0.8 abaixo se refere à entrega anterior, não ao instalador desta atualização.

| Verificação 0.8.1 | Resultado |
|---|---|
| `npm test` | **106/106 passaram**: 94 herdados + 12 de gelatina |
| `npm run typecheck` / `npm run build` | Passaram; editor e player autocontido |
| `npm run test:jelly` | Passou em Chromium headless, incluindo edição/blur/salvamento imediato |
| `npm run test:studio08` | Passou; agora sete templates e layouts 320–1920 px |
| `npm run test:studio06` | Passou; scripts JS/Lua, câmera, rigs, bots, sombras e terreno |
| Mapas/saltos | Percurso completo sem teleporte com entradas a 30/60/144 FPS, 2 checkpoints, 5 cristais, impulso, chegada e zero quedas |
| Exportação | Downloads reais JSON/HTML, standalone `file://` offline, zero requests HTTP, câmera, controles de toque, retorno ↺, pausa/reinício |
| Windows 0.8.1 | NSIS gerado e realmente instalado; **validação nativa final/publicação pendentes** |

## Windows 0.8.1: resultado real, não publicação presumida

- [Run 36758997765](https://github.com/venomtids/GameForge/actions/runs/36758997765), commit `166dc926895989cec27bbf270228badcaa0658f7`: testes, build, NSIS e instalação/recursos passaram. O teste novo de gelatina falhou porque o mock do diálogo ainda apontava para `offline.html` depois da exportação, enquanto verificava o JSON anterior. Corrigido no commit `25bee6f`.
- [Run 36759709158](https://github.com/venomtids/GameForge/actions/runs/36759709158), commit `25bee6fc67709d411efc6243cb54fdb0331f89cc`: testes, build e instalação passaram. O teste nativo encontrou um salvamento rápido mantendo o nome anterior. A versão local agora não sobrescreve um draft recém-digitado em efeito de montagem tardio, usa o valor atual do input no blur e salva o `projectRef` mais recente. O harness confirma o nome aplicado antes de salvar e restaura corretamente o destino JSON.
- Essa correção passou nos testes de engine e no navegador, inclusive a regressão **fill → blur/fechar → download** com nome Unicode. **Ainda não foi revalidada no aplicativo Windows instalado.** A autenticação `git`/`gh` expirou antes do push dessa correção; a publicação está bloqueada até reconectar o GitHub na Arena.
- **Não existe uma release 0.8.1 validada/publicada neste estado.** O instalador 0.8.0 é anterior e não contém as novidades de gelatina. Não se entrega um binário antigo como se fosse atualizado.

Screenshots desta atualização: `docs/screenshots/jelly-{play,toolbox,mobile}.png`. Relatórios temporários ficam em `test-results/` (ignorados). Limites de física, FPS e validação: [GELATINA-0.8.1.md](docs/GELATINA-0.8.1.md).

---

# Validação — Studio 0.8

Estado registrado em 30/09/2026. Os relatórios originais estão em `docs/archive/` e não certificam esta atualização.

## Executado no ambiente de desenvolvimento

| Verificação | Resultado |
|---|---|
| `npm test` | **94/94 passaram**; 65 testes herdados + 29 da atualização |
| `npm run typecheck` | Passou |
| `npm run build` | Passou; editor, fonte local, scripts em chunk sob demanda e player single-file |
| `npm run test:studio08` | Passou em Chromium headless (WebGL por software) |
| `npm audit` no lock instalado | 0 vulnerabilidades reportadas |
| `node --check` no main/preload/storage e teste nativo | Passou |

Os testes Studio 0.8 de navegador exercitam paleta, duplicação/cópia, autosave, seleção múltipla, alinhamento, agrupamento, undo/redo, painéis/teclado/preferências, autoria e prévia de keyframes, execução/retorno à edição, rascunhos/aplicação de scripts, biblioteca IndexedDB, versões e cópia antes da restauração, limites de biblioteca, reload e layouts **320, 390, 768, 1024, 1440, 1920 px**, incluindo paisagem baixa e botões de toque.

Os testes novos da engine incluem schema/animação, curvas e loops, colisores cinemáticos/filhos, proteção contra shear/transformações fora dos limites, atomicidade de operações, rotações de 360°, histórico limitado, UTF-8/bytes, preferências malformadas, rascunhos, gravação atômica/backup, ausência de corrida entre rename assíncrono e flush síncrono, leitura limitada e recuperação de janela fora da tela.

## Windows / instalador

**Passou em Windows CI — instalação e aplicativo instalado:**

- [Run 36748313262](https://github.com/venomtids/GameForge/actions/runs/36748313262), commit `89e686bd281c92fc539c58e03866995f4afe9094`, conclusão `success`.
- Electron 44.4.3 / NSIS x64: `.exe` gerado, checksum calculado e instalação silenciosa concluída.
- Verificados executável, `app.asar`, licenças e projetos de exemplo no destino instalado.
- Playwright abriu o **executável instalado** e confirmou isolamento do preload, abrir/salvar com filesystem real, `.bak`, UTF-8, exportação `file://`, IPC recusado de janela não confiável/payload acima de 8 MB, timeline/runtime, CodeMirror carregado sob demanda, Worker JavaScript e flush de autosave. Apenas os diálogos de arquivo são simulados.
- O teste em caminho temporário Windows encontrou e permitiu corrigir a comparação de URLs: IPC agora usa a URL canônica do primeiro documento carregado pela engine, mantendo validação de sender/frame e bloqueio de navegação.
- [Artefato Windows](https://github.com/venomtids/GameForge/actions/runs/36748313262/artifacts/11113203349), 103.734.693 bytes (ZIP), inclui instalador, `SHA256SUMS.txt` e instruções.

A aquisição de binários locais foi bloqueada pelos hosts de download; a compilação e a instalação ocorreram na VM Windows. A rede do sandbox também bloqueia o download do artefato: os arquivos de instalação são entregues por link GitHub, não disfarçados como anexos inexistentes.

## Publicação final

[Run 36749138083](https://github.com/venomtids/GameForge/actions/runs/36749138083) também passou, repetindo build, instalação e testes nativos, e publicou a [prévia `studio-v0.8.0`](https://github.com/venomtids/GameForge/releases/tag/studio-v0.8.0) no commit `4ed8f6f500be17b7f31357eef669325e4a698e21`.

O asset `GameForge-Studio-0.8.0-Windows-x64-Setup.exe` está publicado com 103.732.242 bytes. Digest SHA-256 do GitHub: `54cf511620fa007d542c34145d10616f3a97fab5ee0dc491e5a174f100cdd382`. O hash também é fornecido em `SHA256SUMS.txt`.

## Validações adicionais

- `node tests/scripts-safety.mjs`: passou; budget Lua de 50.000 instruções, watchdog JavaScript e erro de sintaxe.
- `npm run test:export:studio08`: passou; downloads reais JSON/HTML, nome com acentos/Japonês/emoji, reprodução por `file://` com rede desligada, nenhum request HTTP, toque, pausa/retorno/reinício.
- `node tests/studio07-browser.mjs`: passou; luz/spot, sombras/lanterna/volume, comandos de áudio/tween/heal e inicialização do hotel com HUD, salas e luzes. A lanterna é verificada durante a simulação: inimigos aleatórios podem matar o jogador parado e desligá-la corretamente no final.

## Limitações da validação

- Navegador headless e viewports simulados, não testes de ergonomia/FPS em celulares físicos.
- Windows CI é uma VM, não teste de instalação/upgrade em todas as versões/hardwares Windows.
- Instalador não tem assinatura digital/certificado de reputação.
- Sandbox dos scripts não é auditada; proteção de Worker/watchdog não autoriza rodar código hostil.
- Projetos/versões locais não substituem backups em arquivo.

Reprodução e limites: `README.md` e `docs/GUIA-STUDIO-0.8.md`. Logs/screenshots são gerados em `test-results/` e ficam fora do Git.
