# Gelatina e Jelly Jump · Studio 0.8.1

## Abrir o mapa

1. Clique em **Novo → Jelly Jump** ou **Projetos → Jelly Jump** (`Ctrl+N`). Salve seu projeto atual antes de substituí-lo.
2. Pressione **F5**. O mapa já vem com o jogador de gelatina configurado; não precisa habilitar scripts.
3. Use **WASD / setas**, **Espaço** para pular, **Shift** para correr e **R** para retornar ao início ou ao último checkpoint.
4. No celular, use os botões direcionais, corrida, pulo e **↺** para retornar. Pulo e retorno são capturados no evento, inclusive quando a tecla/toque termina antes do próximo quadro.
5. Colete **5 doces de luz**, ative os **2 checkpoints** e alcance o portal. A **ilha amarela** lança o jogador para cima ao aterrissar. **F8** encerra o teste sem modificar a cena editável.

São 11 superfícies gelatinosas. O caminho completo foi validado com movimento e saltos do controlador real, sem teletransportar o personagem entre plataformas, com entradas a 30/60/144 FPS. Isso verifica a travessia e a independência da cadência de entrada; não é uma promessa de FPS em qualquer hardware.

Projeto portátil: `examples/studio08/Jelly-Jump-Gelatina.gameforge.json`. Use **Exportar jogo** para produzir um HTML autocontido que funciona offline; os controles de toque também estão incluídos.

## Toolbox

Busque **gelatina** na Toolbox, categoria **Personagens e física**:

| Modelo | Uso |
| --- | --- |
| **Jogador de gelatina · articulado e jogável** | Personagem principal com braços/cotovelos, pernas/joelhos, cabeça, corrida, salto, impacto e deformação por molas. |
| **Plataforma de gelatina · elástica** | Caixa ancorada com superfície sólida de apoio. Cede sob o peso e recupera a forma ao sair. |
| **Gelatina física · corpo macio** | Corpo livre com 8 partículas e 28 molas, colisões e impulso. Não é o jogador controlável. |

Inserir o jogador configura `settings.playerId` automaticamente e preserva os jogadores anteriores. Para mudar de volta, selecione outro jogador e clique em **Usar como jogador principal**. O personagem jogável deve usar física **Dinâmica**. Ao morrer, pode virar ragdoll; **R** recupera a vida, o controlador e a apresentação elástica.

## Ajustes no Inspetor

Em **Personagem, bot & física → Gelatina · corpo elástico**:

- **Rigidez das molas (20–180):** maior = resposta mais firme/rápida; menor = mais maleável.
- **Amortecimento (0,5–8):** maior = menos oscilação após impactos.
- **Recuperação de volume (0–1):** maior = mais resistência ao achatamento/colapso. Usa recuperação de forma e uma projeção volumétrica limitada, não volume perfeito em toda colisão.
- **Limite de esticamento (1,1–2,5):** limite relativo ao comprimento original das molas; no jogador também limita o movimento secundário dos membros.
- **Plataforma ancorada · apoio sólido:** disponível para gelatina não humanoide. Marcada usa física estática/autoria e um apoio cinemático no jogo; desmarcada transforma em corpo livre.
- **Restituição:** plataformas com valor **≥ 0,4** recebem impulso de aterrissagem; abaixo disso são apoios macios sem salto automático. O impulso é limitado e respeita o congelamento de controles.

A plataforma pronta usa massa 24, rigidez 160 e amortecimento 6. O jogador usa massa 12 e rigidez 110. Nos apoios, a massa controla os pontos elásticos, não move a base ancorada.

## Implementação e limites honestos

- **Corpo livre:** molas estruturais/diagonais, recuperação em referencial rotacional, projeção limitada de volume/estiramento e velocidades/impulsos limitados. Colisores são as oito esferas de partículas: não um casco contínuo perfeito. Cada rig tem uma máscara própria e não colide consigo mesmo; pode colidir com outros rigs e com o cenário. Tamanhos dos corpos livres são limitados a 0,25–8 m por eixo.
- **Apoio ancorado:** quatro cantos inferiores fixos e quatro superiores móveis. As forças de contato do colisor sólido alimentam as molas. A altura média superior move o colisor de apoio. Deformações locais visuais não são colisão exata por vértice.
- **Jogador:** conserva o colisor convencional, central e estável. Osciladores de massa/mola geram compressão/alongamento e atraso angular nos membros, mantendo as juntas conectadas. Não há colisão independente de cada braço/perna; não é um ragdoll ativo de corpo inteiro durante a caminhada.
- **Responsividade:** estados pequenos, passo fixo de no mínimo 120 Hz quando há rigs elásticos, amortecimento/rigidez limitados pela massa e pelo passo, materiais com clearcoat sem render adicional de transmissão e resolução adaptativa herdada. Máximo de **12 rigs físicos/elásticos ativos**, contando jogadores de gelatina. Objetos só decorativos sem física não usam esses slots.
- Colisão discreta **sem CCD**: não use velocidades extremas ou apoios finíssimos. O sistema é uma aproximação de corpo macio, não FEM nem líquido com volume de fluido.
- Projetos **v7 antigos** continuam válidos sem os dois campos novos: o runtime usa valores seguros padrão. Projetos de outras ferramentas/Roblox não são suportados.

## Reproduzir os testes

```sh
npm ci
npm test                 # 106 testes, incluindo o percurso completo
npm run build            # typecheck, player offline e editor de produção
npm run dev              # servidor em 0.0.0.0:5173
npm run test:jelly       # Toolbox, jogo, câmeras, offline, mobile e retorno
npm run test:studio08    # regressão do editor e layout responsivo
```

A compilação Windows também verifica o exemplo instalado e executa o mapa/personagem, salva/reabre, retorna com R e volta à cena original no aplicativo **realmente instalado**. O instalador permanece uma prévia Windows Intel/AMD x64 não assinada.
