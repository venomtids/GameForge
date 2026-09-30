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
