> **Registro histórico da 0.8.1:** o estado abaixo é anterior à adaptação 0.8.2. Para a física, licenças e validação atuais consulte [docs/GELATINA-0.8.2.md](docs/GELATINA-0.8.2.md). A conexão GitHub foi recuperada em 06/10/2026; não confundir os artefatos antigos citados aqui com o instalador 0.8.2.

# Entrega · Gelatina / Jelly Jump · 0.8.1

## O que está pronto

- Física de corpo macio com recuperação de forma/volume, massa respeitada, limites de esticamento/impulso e colisões entre gelatinas.
- Plataformas ancoradas que cedem sob o peso, recuperam a forma e podem impulsionar na aterrissagem.
- **Toolbox → gelatina → Jogador de gelatina · articulado e jogável**: controle normal, braços/cotovelos, pernas/joelhos, compressão e oscilação elástica. Inserção o seleciona como principal sem apagar outros jogadores.
- **Novo / Projetos → Jelly Jump**: 11 ilhas elásticas, 2 checkpoints, 5 cristais e chegada. A ilha amarela dá impulso.
- Pulo e retorno rápidos não se perdem entre eventos/quadros; controles móveis incluem retorno ao checkpoint. A edição/salvamento rápido usa o valor atual do campo/projeto.

**Jogar:** F5, WASD/setas, Espaço, Shift, R. F8 volta ao editor. Na exportação offline, Esc pausa e o botão Reiniciar recomeça.

## Arquivos locais

- `entregas/Jelly-Jump-Gelatina.html` — jogo autocontido com o runtime novo. Abra no navegador, sem instalar nada e sem rede.
- `entregas/Jelly-Jump-Gelatina.gameforge.json` — projeto editável para **esta versão 0.8.1**.
- `entregas/GameForge-Studio-0.8.1-Codigo-Fonte.zip` — fonte atualizado, exemplos, testes e scripts de empacotamento Windows. Não inclui dependências/binários gerados nem o antigo ZIP 0.7.

Prévia ao vivo nesta sessão: **Jelly Jump · Parkour de gelatina** (porta 5174); o Studio atualizado continua na porta 5173.

## Validação

**106/106 testes**, typecheck e build passaram. O percurso inteiro passou com controles reais a 30/60/144 FPS de entrada/simulação, sem teleporte e sem quedas. Toolbox, câmeras, morte/retorno, mobile 390 px, downloads reais e reprodução offline com zero requests HTTP passaram. Regressões Studio 0.8 (layout 320–1920 px) e Studio 0.6 também passaram.

O jogador é um sistema híbrido de **colisor estável + apresentação articulada elástica**; não tem colisão individual por membro. Apoios usam colisor plano aproximado; a física é discreta, não FEM nem fluido completo. Consulte [docs/GELATINA-0.8.1.md](docs/GELATINA-0.8.1.md).

## Instalador Windows atualizado — pendente

O NSIS 0.8.1 já foi gerado e instalado em CI. A validação nativa encontrou problemas de destino no mock de salvamento e de edição/salvamento imediato; ambos foram corrigidos no código/harness e os testes locais passaram. **A última correção ainda não foi revalidada no aplicativo Windows instalado**, pois a autenticação GitHub expirou antes de enviá-la.

Reconecte o GitHub na Arena para concluir o push, a validação e a publicação. **Não há um instalador 0.8.1 validado/publicado neste estado**. O instalador 0.8.0 anterior não contém estas melhorias e não deve ser usado como entrega atualizada.

A engine continua independente, não compatível com formatos/jogos Roblox. O instalador desta linha é uma prévia x64 não assinada; não há certificação em todo hardware Windows ou celulares físicos.
