# GameForge Studio 0.8.0 — Windows x64 (prévia)

Engine independente inspirada no fluxo de criação do Roblox Studio, aprimorada a partir da fonte 0.7 fornecida. Não é afiliada ao Roblox e não executa Luau nem importa seus formatos.

## Baixar e instalar

Baixe `GameForge-Studio-0.8.0-Windows-x64-Setup.exe`, feche versões anteriores e execute o instalador. O usuário final não precisa de Node.js. Windows 10/11 x64; 4 GB de RAM e 600 MB livres recomendados.

**Sem assinatura digital:** o Windows pode mostrar aviso de reputação/SmartScreen. Confira a origem e `SHA256SUMS.txt`. Não desative o antivírus. Faça backup dos projetos antes de atualizar.

## Novidades

- Workspace responsivo com painéis redimensionáveis, gavetas e qualidade automática.
- Seleção múltipla, agrupamento, operações em lote, histórico e paleta Ctrl+K.
- Biblioteca local de projetos e versões com cópia antes da restauração.
- Timeline TRS com keyframes, interpolação, loops e colisores cinemáticos.
- Lua/JavaScript, CodeMirror sob demanda e rascunhos de sessão.
- Exportação HTML independente, Unicode, controles de toque e execução offline.
- Electron isolado, menus em português, salvamento atômico e backups.

A base de física, terreno, personagens, Pixel Studio, interfaces, luzes, áudio e jogos anteriores foi preservada.

## Validação

94 testes automatizados; testes de navegador de 320 a 1920 px, regressões 0.7, scripts com watchdog e HTML offline. No Windows CI: NSIS instalado silenciosamente e executável INSTALADO testado (IPC, arquivos/backup/UTF-8, exportação, keyframes, scripts e flush de autosave). Não é certificação de todo hardware nem auditoria da sandbox.

Guias e limites: README e docs/GUIA-STUDIO-0.8.md. Sem multiplayer, serviços em nuvem, importador de malhas ou animação esquelética.
