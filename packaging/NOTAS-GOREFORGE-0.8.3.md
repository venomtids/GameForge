# GORE FORGE 0.8.3 — Windows x64

Instalador do GORE FORGE para Windows 10/11 x64: o sandbox de física em primeira
pessoa no estilo **GoreBox**, feito com a engine atual, agora como aplicativo
nativo (Electron + NSIS) — janela própria, atalhos, desinstalador no painel de
controle, sem depender de navegador.

## O que tem dentro

- **O jogo completo** em arquivo único (`goreforge.html`): pátio com ~74 corpos
  dinâmicos, 12 rigs elásticos, gelatina que deforma vértice a vértice, ragdolls
  com desmembramento real, fratura de props, explosões em cadeia, gore com
  sangue/poças/estilhaços de carne, HUD e menus por dados, 4 temas ao vivo.
- **Aplicativo desktop** (`desktop/goreforge-main.cjs`): janela, F11 em tela
  cheia, mouse preso para o FPS (pointer lock), menu com controles e reinício,
  janela/tamanho memorizados, CSP local e nenhuma permissão além de pointer lock.
- **Instalador leve** (`GORE-FORGE-Instalador.cmd`, na pasta de instalação):
  um único arquivo com o jogo embutido em base64 que instala sem Electron e abre
  no Edge/Chrome em modo janela de aplicativo. Fica ao lado do .exe para quem
  quiser a versão sem runtime nenhum.

## Instalação

1. Baixe `GORE-FORGE-0.8.3-Windows-x64-Setup.exe`.
2. Confira o SHA-256 com o `SHA256SUMS.txt` desta release.
3. Execute. É por usuário (não pede senha de administrador), cria atalhos na Área
   de Trabalho e no Menu Iniciar e abre o jogo no fim.

Desinstalar: *Configurações > Aplicativos* (ou Menu Iniciar > GORE FORGE >
Desinstalar). Os ajustes em `%APPDATA%\GORE FORGE` são mantidos e voltam se você
instalar de novo.

## Sem assinatura digital

O pacote não é assinado: o SmartScreen pode avisar na primeira execução
("Mais informações" > "Executar assim mesmo"). Não desative o antivírus para
instalar — confira o hash e a origem.

## Como este .exe foi compilado

Automação `.github/workflows/goreforge-windows.yml`, em `windows-latest`:

1. `npm ci`, `npm test` (138 testes) e `npm run installer:goreforge` (gera o
   instalador leve e valida os textos);
2. `npm run desktop:goreforge` — build do jogo, preparo de `dist/goreforge-desktop`
   e empacotamento **Electron 44.4.3 + NSIS x64**, com `SHA256SUMS.txt`;
3. `npm run test:electron:goreforge` contra o app empacotado (abertura, física,
   tiro, spawn, dano da engine convertido em vida, HUD, tela cheia, localStorage);
4. instalação **silenciosa** do próprio `Setup.exe`, verificação do executável
   instalado (mesmo teste Electron, agora na pasta instalada), desinstalação e
   conferência de que a pasta saiu;
5. publicação dos artefatos e desta release.

Compilar a partir do Linux exige Wine/NSIS (`npm run desktop:goreforge`); o
usuário do instalador não precisa de nada disso.

## Limites honestos (iguais aos do jogo)

- 12 rigs elásticos/ragdolls por cena (limite da engine; ela avisa e o corpo fica
  rígido ao estourar).
- Sem multiplayer, sem FEM contínuo e sem CCD global.
- Validação automatizada em VM com renderização por software: não é certificação
  em todo hardware Windows nem benchmark de GPU.
