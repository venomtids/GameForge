# GameForge Studio 0.4

**Atualização desktop · Lua melhorado · 40 novos modelos · design e pintura · física em passos fixos.**

Continuação da base React/Three.js do usuário. É uma engine/toolkit 3D inicial em evolução, não paridade com Godot ou Roblox Studio. O parkour e os exemplos rodam dentro da engine.

## Instalar ou atualizar

- Windows 10/11 x64 (Intel/AMD): `GameForge-Studio-0.4.0-Windows-x64-Setup.exe`.
- Não exige Node.js, Python, npm ou terminal; as dependências estão incluídas. Reserve 500 MB livres.
- Salve cópias JSON dos seus projetos, feche a aplicação e instale com o mesmo usuário na mesma pasta. Não precisa desinstalar primeiro.
- O instalador não é assinado digitalmente; pode aparecer aviso de editor desconhecido. Não desative o antivírus.
- Instalação 0.3 → 0.4 verificada sob Wine, com dados preservados. **Execução em Windows real não validada neste ambiente.**

## Destaques

### Programação

Editor CodeMirror 6 com cores para Lua/JavaScript, números de linha, realce da linha ativa, pareamento de delimitadores, indentação, undo local, busca (`Ctrl+F`) e sugestões básicas da API (`Ctrl+Espaço`). Não é um servidor de linguagem nem inferência de tipos.

Erros de **sintaxe** aparecem com linha/coluna e marcador no código, antes de executar. Aplicar fica desabilitado enquanto há erro de sintaxe. A validação apenas analisa o texto; não executa código. Lua é analisado por luaparse em modo 5.3 e JS por Acorn em modo ECMAScript 2022 script. Recursos JS mais novos que essa gramática podem ser recusados pelo editor. Erros de lógica, nomes inexistentes e tipos em tempo de execução não são todos detectáveis pelo analisador; consulte o Console ao executar.

Importe `.lua` / `.js` ou exporte o código selecionado como arquivo. No desktop, a exportação usa o diálogo nativo de salvar. O código importado fica como rascunho até **Aplicar script**. Revise antes de permitir sua execução.

### Lua 5.3 e JavaScript: API 0.4

Cada nó tem seu próprio estado. Escolha a linguagem na aba Scripts, marque Ativo, aplique e execute. `start()` é opcional, chamado uma vez antes do primeiro `update`; `update(dt, time, input)` é obrigatório. `dt` e `time` usam segundos.

| API | Significado |
|---|---|
| `self.x/y/z` | Posição **local** |
| `self.rx/ry/rz` | Rotação local em graus |
| `self.color`, `self.visible` | Cor `#RRGGBB`, visibilidade |
| `self.vx/vy/vz` | Velocidade física em coordenadas do mundo, para nós com corpo; escrita limitada a ±100 m/s |
| `self.grounded` | Contato com normal de apoio; somente leitura |
| `self.meuCampo` | Estado customizado persistente durante a execução, não gravado no projeto |
| `input.w`, `.space`, `.shift` etc. | Teclas mantidas; letras a–z, números, setas, Space e Shift; ausentes são nil/undefined |
| `input.pressed.w` / `input.released.w` | Bordas de entrada acumuladas até a próxima atualização de script |
| `engine.log(texto)` / `print(texto)` em Lua | Console |
| `engine.clamp(v, min, max)` | Limitar valor |
| `engine.lerp(a, b, t)` | Interpolar; t não é limitado automaticamente |
| `engine.distance(ax, ay, az, bx, by, bz)` | Distância entre dois pontos |

Lua mantém os campos customizados de `self`; a engine atualiza apenas os campos nativos. Em JS, mantenha o objeto `self`, sem reatribuí-lo. Estado se reinicia ao parar/executar. Escritas de posição/rotação teleportam corpos; para objetos dinâmicos, prefira velocidade. O controlador embutido do jogador controla vx/vz: não concorra com ele por script. Transformações de pais podem afetar os filhos, mas não constituem juntas físicas.

```lua
function start()
  self.baseY = self.y
end

function update(dt, time, input)
  self.ry = self.ry + 45 * dt
  self.y = self.baseY + math.sin(time) * 0.25
  if input.pressed.e then
    self.color = "#edac80"
    engine.log("Cor alterada!")
  end
end
```

Para esse exemplo, use Física = Sem colisão e Comportamento = Nenhum. Exemplo completo: **Novo → Ateliê 0.4** ou `examples/escultura-interativa.lua`.

Lua 5.3/Fengari **não é Luau**, não tem APIs Roblox, `require` de arquivos, módulos nativos nem acesso ao sistema. Ainda não há API geral de nós, sinais, debugger com breakpoints ou módulos de projeto.

### Toolbox: 46 itens, sendo 40 novos

Busca por nome e filtros Construção, Natureza, Decoração e Jogabilidade. Tudo local, sem downloads. Modelos feitos de primitivas, editáveis pela hierarquia; não são modelos importados de terceiros.

**40 novos:** parede, parede com porta, janela, arco, coluna, rampa, plataforma larga, torre, casa, telhado, cerca, portão, estrada, calçada, cruzamento, barreira, árvore, pinheiro, palmeira, arbusto, rocha, rochas agrupadas, flor, cogumelo, banco, mesa, cadeira, caixote, barril, poste decorativo, placa, fonte decorativa, moeda coletável, cristal coletável, bola elástica, dominó físico, alvo decorativo, espinhos de dano, pedras de travessia e escada em espiral.

**6 anteriores:** escada, ponte, jogador, checkpoint, chegada e zona de dano.

Postes/fontes/alvos são decorativos: não têm luz pontual, água simulada ou sistema de tiro. Caixotes, barris, bolas e dominós têm corpos dinâmicos. Moedas/cristais usam o comportamento coletável existente (malha de cristal no runtime). Peças de cenário e construções têm corpos estáticos, salvo folhagens/detalhes sem colisão. Não há juntas: prefabs dinâmicos agrupados continuam sendo corpos independentes.

### Design & pintura

- Pincel por clique para cor, rugosidade e metalicidade; conta-gotas de um objeto.
- Aplicar material à seleção ou aos descendentes de um grupo; bloqueios respeitados.
- 8 materiais prontos: grama, areia, pedra, madeira, metal, neve, argila e água **decorativa**. São parâmetros PBR/cor, não texturas UV nem transparência.
- Alinhar e distribuir X/Y/Z atua nos **filhos diretos desbloqueados do grupo selecionado**, em coordenadas locais. Não é seleção múltipla.
- Terreno inicial: grupos de **8 × 8 blocos**, 16 × 16 unidades, com colisão estática. Elevar, rebaixar, suavizar, nivelar e pintar por clique; raio, força e altura ajustáveis.
- Cada clique/aplicação participa do histórico (Ctrl+Z). O raio é medido no espaço local do grupo. A vista Superior facilita a pintura. Volte a Selecionar para usar os gizmos.
- Terreno em blocos, não heightmap contínuo, voxel destrutível, escultura de malha, cavernas ou splatmaps. Um terreno ocupa 65 dos 500 nós disponíveis por cena.

### Física e controles

- Integração fixa padrão de **120 Hz**, desacoplada da frequência de renderização; ajuste 60–240 Hz.
- Solver iterativo configurável (padrão 15, de 5 a 30), colisões estáveis nos testes de queda/percurso.
- Cones e cilindros usam colisores convexos de 8/12 lados em vez de caixas. Elipses/esferas com escala não uniforme usam raio maior aproximado; cisalhamento hierárquico não é reproduzido exatamente.
- Atrito por corpo no Inspector; para jogador o atrito é zerado para reduzir agarramento nas paredes. Massa, restituição e gravidade continuam editáveis. Combinação de materiais é a do Cannon; restituição de ambos os contatos influencia o quique.
- Pulo com tolerância de borda (~100 ms), buffer de entrada de 120 ms e proteção contra reutilizar contato antigo para pular duas vezes.
- Passos de renderização muito longos são limitados; não há CCD. Corpos muito rápidos podem atravessar paredes finas. Não é simulador físico de engenharia.

Em **Configurações do projeto** (seta ao lado do nome), ajuste velocidade do personagem (multiplicador), corrida, impulso do pulo, sensibilidade FPS, órbita, pan, zoom, resposta de terceira pessoa, FOV e precisão física. A velocidade base de cada jogador continua no Inspector. Configurações são salvas no JSON e usadas também no jogo exportado. A câmera Livre continua **orbital**, não flycam WASD.

Os 11 modos de câmera continuam disponíveis: perspectiva, primeira pessoa, terceira pessoa, livre orbital, isométrica e seis vistas ortográficas.

## Exemplos integrados

- **Novo → Ateliê 0.4:** terreno, modelos, corpos dinâmicos e Lua. WASD, Shift, Espaço; E muda a cor da escultura se scripts estiverem permitidos.
- **Novo → Skyline · Parkour FPS:** 20 plataformas, 8 cristais, 3 checkpoints e chegada. WASD/setas, Space, Shift, R checkpoint, Esc pausar/soltar, F8 parar.
- **Novo → Lua + JavaScript:** duas linguagens lado a lado.
- Ilha dos cristais e projeto vazio continuam disponíveis.

Clique no viewport em FPS para capturar o mouse; se bloqueado, arraste com o botão esquerdo. Pare/execute para reiniciar o jogo. Projetos `.gameforge.json` são abertos **na engine**. Exportar HTML é uma opção adicional, não substitui o runtime integrado.

## Compatibilidade e segurança

Formato **v4**, migra v2/v3 e JSON original `sceneObjects` ao abrir. Autosave usa `gameforge.project.v4`, lendo v3/v2 na ausência dele, **sem sobrescrever as chaves antigas**. Versões 0.2/0.3 não abrem v4; mantenha backups antes de atualizar.

Permissão explícita antes de executar scripts; pode jogar sem scripts. Worker separado, até 32 scripts ativos/12.000 caracteres cada, ~30 Hz. Lua: 50.000 instruções por chamada. Watchdog JS: 350 ms; inicialização 2,5 s. Respostas de script não são aplicadas enquanto pausado. Runtime assíncrono, não lockstep determinístico com a física.

APIs comuns de rede/armazenamento/timers são removidas e alterações aceitas pelo host são validadas. **Não é sandbox auditada contra código hostil ou exaustão de memória. Execute somente scripts de confiança.** Context isolation e sandbox do renderer Electron permanecem ativos, sem Node no renderer.

Ainda faltam: editor 2D, importação GLB/FBX, animação esquelética, seleção múltipla, iluminação editável por nó, áudio de cena, multiplayer, navegação/IA, profiling avançado, módulos e API ampla de scripting. Os quatro jogos e três experimentos originais mantêm seus runtimes simplificados separados.

## Desenvolvimento e validação

Quem usa o instalador **não precisa destes comandos**. Para editar o código-fonte: Node 24 recomendado, mínimo 22.12.

```sh
npm ci
npm run dev
npm run build
npm run desktop:dev
npm run desktop:win
npm run examples
```

```sh
npm run typecheck
npm test                            # 23 testes de núcleo
npm run test:e2e                    # servidor dev ativo
npm run test:update                 # scripts, câmeras e limites
npm run test:studio                 # ferramentas 0.4 + migração
npm run test:desktop
npm run test:desktop:update
node tests/studio04-desktop.mjs     # produção desktop 0.4
```

Playwright requer `npx playwright install chromium`; Linux headless pode exigir Xvfb e dependências GTK. Veja `ATUALIZACAO-0.4.md` para o que foi de fato testado e suas limitações. A documentação 0.3 foi arquivada; licenças das dependências em `THIRD-PARTY-NOTICES.txt`.
