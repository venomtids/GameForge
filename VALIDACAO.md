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

A compilação local do Electron foi impedida pelo acesso aos hosts de binários. Portanto, **os testes de Node/navegador não certificam o aplicativo Windows**.

O workflow `.github/workflows/windows.yml` executa uma compilação real em `windows-latest`, seguida de `test:desktop:studio08` usando o renderer de produção. Verifica isolamento do preload, abrir/salvar em disco, backup `.bak`, UTF-8, exportação `file://`, rejeição de janela IPC não confiável/payload maior que 8 MB, timeline/runtime e flush de autosave. Os diálogos de arquivo são simulados; o sistema de arquivos e o Electron são reais.

O instalador só é publicado pelo workflow depois desse smoke test. Confira a execução no GitHub Actions; uma configuração ou teste escrito não equivale a uma execução bem-sucedida.

## Limitações da validação

- Navegador headless e viewports simulados, não testes de ergonomia/FPS em celulares físicos.
- Windows CI é uma VM, não teste de instalação/upgrade em todas as versões/hardwares Windows.
- Instalador não tem assinatura digital/certificado de reputação.
- Sandbox dos scripts não é auditada; proteção de Worker/watchdog não autoriza rodar código hostil.
- Projetos/versões locais não substituem backups em arquivo.

Reprodução e limites: `README.md` e `docs/GUIA-STUDIO-0.8.md`. Logs/screenshots são gerados em `test-results/` e ficam fora do Git.
