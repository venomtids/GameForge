# GameForge Studio 0.3 — atualização instalável

**Parkour dentro da engine · Lua + JavaScript · câmeras selecionáveis · toolbox de construção.**

Esta versão continua a base React/Three.js enviada pelo usuário. Não é uma implementação completa da Godot ou do Roblox Studio, e não executa projetos `.rbxl`/Luau.

## Atualizar no Windows — sem Node ou Python

1. Na versão antiga, use **Salvar** para guardar uma cópia dos seus projetos em JSON.
2. Feche todas as janelas do GameForge Studio.
3. Execute `GameForge-Studio-0.3.0-Windows-x64-Setup.exe`.
4. Use o mesmo usuário e a mesma pasta de instalação anterior. Não precisa desinstalar antes.
5. Abra o atalho **GameForge Studio**.

Destino: **Windows 10/11 x64 (Intel/AMD)**. O instalador inclui Electron, editor, jogos, Lua e JavaScript; não exige Node.js, Python, npm, terminal ou download de dependências durante a instalação. Reserve pelo menos 500 MB livres.

O instalador não é assinado digitalmente e pode gerar um aviso de editor desconhecido/SmartScreen. Não é necessário desativar o antivírus. A atualização 0.2 → 0.3 foi verificada via Wine; a execução em Windows real não foi validada neste ambiente.

## Jogar parkour na engine

Abra **Novo → Skyline · Parkour FPS → Executar**. O percurso contém:

- 20 plataformas estáticas com saltos e mudanças de direção;
- 8 cristais, necessários para concluir;
- 3 checkpoints que alteram o ponto de retorno;
- portal de chegada, cronômetro e contador de quedas;
- corrida e tolerância curta de pulo ao sair da borda.

**WASD/setas:** mover · **Espaço:** pular · **Shift:** correr · **R:** voltar ao checkpoint · **Esc:** soltar o mouse e pausar · **F8:** parar.

Em primeira pessoa, clique no viewport para capturar o mouse. Se o ambiente bloquear a captura, segure o botão esquerdo e arraste para olhar. Para continuar após pausar, use o botão Pausar/Continuar do editor. Pare e execute novamente para reiniciar o percurso inteiro.

O projeto também acompanha a entrega como `Skyline-Parkour-v0.3.gameforge.json`: use **Abrir** na engine atualizada. Não é um jogo HTML externo.

## Modos de câmera

O seletor acima do viewport permite mudar durante a edição ou durante a execução:

- Perspectiva;
- Primeira pessoa, com movimento relativo à direção da câmera;
- Terceira pessoa, acompanhando o jogador;
- Livre **orbital** (não é um controlador de voo WASD);
- Isométrica;
- Superior, inferior, frontal, traseira, esquerda e direita.

Isométrica e as seis vistas ortogonais usam câmera ortográfica de verdade. As vistas de edição também permitem zoom e pan. **Configurações do projeto → Câmera padrão ao executar** salva o modo inicial no JSON.

## Ferramentas de construção

A nova aba **Toolbox** insere modelos editáveis: escada de seis degraus, ponte, jogador, checkpoint, chegada e zona de dano.

Na barra acima do viewport:

- **Ancorar / soltar:** alterna entre corpo estático e dinâmico;
- **Bloquear / desbloquear:** impede transformação/edição do nó no editor;
- **Agrupar nó:** cria um grupo em torno do nó selecionado, preservando os valores locais;
- **Colisores (AABB):** exibe caixas envolventes de diagnóstico — não é uma representação exata do colisor esférico;
- **Local/global:** muda o espaço do gizmo.

Continuam disponíveis primitivas, hierarquia por arrastar, duplicação, exclusão, transformações numéricas, snap, materiais, múltiplas cenas, histórico, captura PNG, autosave e importação/exportação. O agrupamento atual é de um nó por vez; seleção múltipla, terrain editor e marketplace ainda não existem.

## Programar em Lua e JavaScript

1. Selecione um nó na árvore.
2. Abra a aba **Scripts**.
3. Escolha **Lua 5.3** ou **JavaScript**.
4. Edite o código, marque **Ativo** e clique **Aplicar script**.
5. Execute e confirme a permissão para os scripts desse projeto.
6. Consulte mensagens e erros na aba **Console**.

**Novo → Lua + JavaScript** abre dois exemplos executáveis. A permissão para rodar código não é gravada no projeto nem concedida automaticamente ao abrir um arquivo. Também é possível **Executar sem scripts**.

### Lua

```lua
-- Lua 5.3 via Fengari; não é Luau e não usa a API Roblox.
engine.log("Lua iniciado")

function update(dt, time, input)
  self.ry = self.ry + 45 * dt
  self.y = 1.5 + math.sin(time) * 0.5
end
```

### JavaScript

```javascript
engine.log("JavaScript iniciado");

function update(dt, time, input) {
  self.ry += 45 * dt;
  self.y = 1.5 + Math.sin(time) * 0.5;
}
```

### API inicial

| Campo/função | Uso |
|---|---|
| `update(dt, time, input)` | Chamado aproximadamente 30 vezes/s, enquanto a simulação executa |
| `dt` | Segundos desde a última atualização do script |
| `time` | Tempo de simulação em segundos, sem contar pausas |
| `self.x`, `self.y`, `self.z` | Posição local do nó |
| `self.rx`, `self.ry`, `self.rz` | Rotação local em graus |
| `self.color` | Cor hexadecimal `#RRGGBB` |
| `self.visible` | Visibilidade booleana |
| `input.w`, `.a`, `.s`, `.d`, `.space`, `.shift`, `.r` | Teclas pressionadas; ausentes são false/nil |
| `engine.log(texto)` | Mensagem no console |

Variáveis declaradas fora de `update` persistem durante a execução, mas são reiniciadas ao parar/executar. Scripts alteram transformações diretamente; evite disputar o controle do mesmo corpo com física/jogador. Não há ainda API geral para criar/remover nós, acessar outros nós, sinais, módulos externos ou depuração com breakpoints.

### Limites e segurança

- Um Worker separado executa os scripts, sem expor Node.js, DOM ou a ponte de arquivos do Electron.
- APIs de rede/armazenamento/timers comuns são removidas do ambiente do Worker.
- O host aceita apenas campos de transformação, cor e visibilidade, com limites e validação.
- Até 32 nós com scripts ativos; fonte limitada a 12.000 caracteres por nó.
- Lua possui limite de 50.000 instruções por chamada; JavaScript é interrompido por watchdog se a resposta não chega em 350 ms (inicialização: 2,5 s).
- Scripts com erro são desativados; timeout interrompe o Worker inteiro sem encerrar a cena.
- **Não é uma sandbox auditada para código hostil**: ataques de memória e APIs indiretas não foram exaustivamente avaliados. Execute somente projetos de confiança. A CSP do desktop permite avaliação de código para o compilador de scripts, com código executado pelo host somente no Worker.

## Compatibilidade e dados

- O novo formato é **GameForge v3**.
- Arquivos v2 e o JSON original com `sceneObjects` são convertidos ao abrir.
- Nós antigos recebem `locked: false` e script desativado.
- O autosave novo usa `gameforge.project.v3` e lê o autosave v2 somente se não houver v3.
- O autosave v2 permanece intacto como cópia separada. Não limpe os dados do aplicativo sem backup.
- A versão 0.2 não abre projetos v3: atualize antes de usar o parkour novo.
- Exportar jogo continua produzindo HTML offline e agora inclui câmeras/checkpoints/runtime 0.3. Scripts exportados exigem permissão explícita ao jogar.

Os quatro jogos e os três experimentos originais continuam disponíveis. O xadrez e o mundo voxel são simplificados; eles não usam automaticamente todas as ferramentas do novo runtime. Não há importação GLB, editor 2D, multiplayer, Luau, C#, animação esquelética ou API completa de engine nesta entrega.

## Código-fonte e testes (opcional, só para desenvolvedores)

Quem instala o `.exe` **não precisa executar os comandos abaixo**.

Requisito de desenvolvimento: Node.js 24 LTS recomendado, mínimo 22.12.

```bash
npm ci
npm run desktop:dev       # Electron + Vite
npm run dev               # prévia web
npm run build             # runtime de exportação + editor
npm run desktop:win       # instalador Windows x64 (preferir Windows)
```

```bash
npm run typecheck
npm test                  # 15 testes, incluindo o percurso completo com física
npm run test:e2e           # exige servidor dev em outra janela
npm run test:update       # câmeras, scripts e guardas de execução
npm run test:desktop      # build de produção + Electron
npm run test:desktop:update
```

Testes de navegador usam Playwright: `npx playwright install chromium`; Linux pode exigir `npx playwright install-deps chromium`. Testes desktop Linux sem interface podem rodar sob `xvfb-run -a`.

O empacotamento Windows usa `scripts/stage-windows.mjs` e `electron-builder.windows.json`, com o mesmo `appId` da versão 0.2. Licenças de bibliotecas em `THIRD-PARTY-NOTICES.txt`.

Veja `ATUALIZACAO-0.3.md` para o resumo de validação. A documentação anterior foi preservada em `docs/archive/README-0.2.md`.
