# GameForge Studio 0.2

**Uma evolução funcional da engine enviada — editor 3D + jogos preservados + base desktop.**

Esta entrega não é equivalente à Godot. É uma primeira versão ampliada e testada, feita sobre os arquivos originais em React/Three.js, com um novo editor e um runtime compartilhado com a exportação de cenas.

## Rodar no PC

### Requisitos

- **Node.js 24 LTS recomendado** (mínimo 22.12) e npm.
- Windows, Linux ou macOS com aceleração gráfica/WebGL 2.
- Internet para instalar dependências e baixar o Electron na primeira execução.
- A pasta deve ser extraída do ZIP antes de executar os comandos.

No terminal, dentro da pasta `gameforge`:

```bash
npm ci
npm run desktop:dev
```

Isso baixa o Electron quando necessário, inicia o Vite e abre uma janela desktop. Não abra uma segunda instância do Vite na porta 5173 ao usar esse comando. O servidor de desenvolvimento é para uso local, não para publicar na internet.

Para testar apenas no navegador:

```bash
npm ci
npm run dev
```

Abra o endereço mostrado no terminal. O arquivo `public/player.html` já acompanha o projeto; execute `npm run build` para atualizá-lo quando modificar o runtime.

### Gerar o aplicativo

**No Windows**, para gerar o instalador NSIS:

```bash
npm run desktop:win
```

**No Linux**, para gerar um AppImage:

```bash
npm run desktop:linux
```

Para gerar a pasta do aplicativo, sem instalador:

```bash
npm run desktop:pack
```

A saída fica em `release/`. Os instaladores não são assinados digitalmente. O instalador Windows x64 foi gerado em uma entrega posterior e sua instalação/desinstalação foram testadas via Wine 10. A execução completa em Windows real ainda não foi validada. O conteúdo empacotado também passou nos testes com Electron Linux. Para usar o instalador pronto, não é necessário Node.js, Python ou terminal. Gere cada instalador preferencialmente no seu sistema de destino; macOS/distribuição assinada precisam de configuração adicional.

## O que está funcionando

### Editor 3D

- Interface em português, com árvore de cena, viewport, inspector, recursos, console e painel de componentes.
- Cubos, esferas, cones, cilindros e grupos.
- Seleção por clique no viewport ou na árvore.
- Gizmos de **posição, rotação e escala**; snap de 0,5 unidade, 15° e 0,1 de escala.
- Edição numérica de transformações locais, nomes e materiais.
- Pais/filhos por arrastar na árvore ou pelo seletor do inspector; prevenção de ciclos.
- Visibilidade, duplicação de ramos, exclusão e desfazer/refazer (até 60 alterações).
- Múltiplas cenas por projeto, criação, seleção, renomeação e exclusão.
- Navegação orbital, orientação superior/frontal, enquadrar seleção, grade e captura PNG.
- Indicadores de FPS e draw calls.

### Runtime da nova cena

- Física com **Cannon-es**, passo fixo de 60 Hz e até 3 subpassos por frame.
- Corpos estáticos/dinâmicos, massa, gravidade e restituição.
- Colisores esféricos e caixas; cones e cilindros usam **caixa envolvente**, e esferas com escala desigual usam esfera envolvente.
- Comportamentos declarativos: rotação, flutuação, jogador WASD e coletável.
- Jogador com pulo, detecção de apoio, movimento normalizado e retorno após cair do mundo.
- Uma cena de exemplo jogável: **Ilha dos cristais**, com três cristais para alcançar.
- Executar, pausar e parar; transformações da simulação não sobrescrevem a cena de edição.
- Perda de foco pausa a execução do editor.

O painel **Comportamento** edita JSON validado. Não é um editor de GDScript/JavaScript e **não executa código arbitrário**. Os textos de exemplo do studio original, que referenciavam APIs inexistentes, não são tratados como scripts funcionais.

### Projetos e exportação

- Autosave no armazenamento local, com mensagem se o armazenamento falhar.
- Salvar/abrir arquivos `.gameforge.json`.
- Diálogos nativos de arquivo no desktop; upload/download na web.
- Importação do JSON antigo que contém `sceneObjects` (migração aproximada de materiais, transformações e componentes).
- Validação de formato, versão, IDs, referências, ciclos, valores numéricos e limites.
- **Exportar jogo** gera um HTML independente, com Three.js e Cannon embutidos, que pode ser aberto offline.

**Importante:** a exportação inclui a **cena ativa do novo editor**, não os jogos legados, e não cria um executável de jogo. O HTML exportado usa os mesmos comportamentos/física do novo editor. Para atualizar esse runtime após alterações no código, rode `npm run build`.

O autosave não substitui um backup: limpar os dados do navegador/aplicativo remove essa cópia. Use **Salvar** para manter arquivos portáteis. Até 20 cenas, 500 nós por cena e 8 MB por projeto. O histórico é mantido durante a sessão, inclusive ao alternar entre Editor/Jogos/Laboratório; não é persistido após fechar o aplicativo.

### Jogos e laboratório originais

Preservados em `src/legacy/LegacyApp.tsx`:

1. Arena de Coleta.
2. Sobrevivência.
3. Corrida de Checkpoints.
4. Duelo automático de agentes.
5. Xadrez 3D simplificado, com bot ou dois jogadores.
6. Laboratório de gravidade.
7. Mundo voxel com construção e primeira pessoa.

Correções/melhorias na base original:

- Opções de modo e distância voxel passam a usar os valores atuais, não valores capturados na inicialização.
- Movimento lateral e direção vertical do mouse em primeira pessoa corrigidos.
- Voo vertical no modo criativo acumula altura corretamente.
- FPS voxel não movimenta o jogador com o mouse destravado.
- Teclas não controlam os jogos enquanto o usuário edita campos de texto.
- Segurar Espaço não alterna pausa repetidamente.
- Perda de foco limpa teclas presas e pausa partidas.
- Delta de tempo limitado para evitar grandes saltos após travamentos/perda de foco.
- ResizeObserver acompanha o tamanho real da área de renderização.
- Ciclo do bot restrito ao experimento de xadrez.
- Tratamento de recusa da captura do mouse em ambientes incorporados.
- Voxel usa **InstancedMesh por material**: até cinco lotes de blocos, em vez de um draw call por bloco.
- Geração reduzida a superfícies/laterais expostas; remoção revela vizinhos e as edições da sessão são reaplicadas ao trocar região.
- Descarte de geometrias, materiais, instâncias e contextos ao desmontar a área.

Os jogos legados ainda usam seus sistemas originais e não foram todos reescritos para Cannon. O duelo é uma simulação heurística, não treinamento de uma rede neural. O xadrez não é uma implementação completa das regras oficiais. O mundo voxel continua experimental: não tem persistência em projeto, inventário, crafting, meshing guloso ou colisão lateral completa; mudar de área pode reiniciá-lo.

## Como usar o editor

1. Selecione **Jogador** na árvore para explorar o inspector.
2. Use os gizmos ou os campos numéricos para editar. Nos campos, confirme com Enter ou ao sair; Esc cancela a edição do campo.
3. Clique numa primitiva em Recursos ou no botão `+` para adicionar um nó.
4. Configure material, física e comportamento.
5. Clique **Executar**. Na cena de exemplo: WASD/setas para mover e Espaço para pular.
6. Clique **Parar** para retornar à cena original.
7. Salve o projeto em JSON; use **Exportar jogo** para testar a cena sem o editor.

Ao mudar o pai de um nó, os valores **locais** são preservados; a posição global pode mudar. Corpos físicos sob grupos estáticos são suportados, mas hierarquias com corpos aninhados/ancestrais animados não são um sistema de articulações. Prefira corpos dinâmicos na raiz. Movimentos de rotação/flutuação são para nós sem corpo físico.

### Atalhos

| Atalho | Ação |
|---|---|
| W / E / R | Mover / rotacionar / escalar |
| F | Enquadrar seleção; sem seleção, enquadrar cena |
| Ctrl+D | Duplicar nó e descendentes |
| Delete | Excluir nó e descendentes |
| Ctrl+Z | Desfazer |
| Ctrl+Shift+Z ou Ctrl+Y | Refazer |
| Ctrl+S / Ctrl+O | Salvar / abrir |
| F5 / F8 | Executar ou parar / parar |
| Mouse arrastado / scroll | Orbitar / zoom |

No macOS, os comandos Ctrl também aceitam Command. A interface foi priorizada para desktop; o layout compacto é utilizável, mas os jogos dependem de teclado/mouse e não têm controles touch completos.

## Arquitetura

```text
gameforge/
├── src/
│   ├── App.tsx                  # Navegação e isolamento de erros
│   ├── editor/
│   │   ├── Editor.tsx           # Editor, histórico, árvore, inspector e projetos
│   │   └── Viewport.tsx         # Three.js, gizmos, seleção e ciclo de renderização
│   ├── engine/
│   │   ├── model.ts             # Modelo versionado, validação, migração e histórico
│   │   ├── World.ts             # Runtime 3D/física/comportamentos compartilhados
│   │   └── io.ts                # Abertura, salvamento e exportação
│   ├── legacy/LegacyApp.tsx     # Jogos originais, preservados e corrigidos
│   └── player.ts               # Ponto de entrada do jogo exportado
├── desktop/
│   ├── main.cjs                # Electron, diálogos e IPC limitado
│   └── preload.cjs             # API estreita, sem expor Node ao renderer
├── public/player.html          # Runtime offline gerado
├── player.html                 # Template-fonte do runtime
├── tests/                      # Testes de núcleo, navegador e desktop
├── examples/                   # Cena de exemplo em JSON e jogo HTML offline
├── vite.config.ts
├── vite.player.config.ts
└── package.json                # Comandos e configuração electron-builder
```

No Electron: `contextIsolation: true`, `nodeIntegration: false`, sandbox, CSP, navegação/janelas extras bloqueadas e IPC limitado a abrir/salvar com diálogo. Projetos importados são dados, não código. Isso reduz a superfície de ataque, mas não é uma auditoria de segurança completa.

## Testes

```bash
npm run typecheck
npm test
npm run build
npm audit
```

Testes de navegador (com `npm run dev` ativo em outro terminal):

```bash
npx playwright install chromium
npm run test:e2e
```

No Linux, podem ser necessárias bibliotecas do navegador: `npx playwright install-deps chromium`.

Teste desktop (precisa de interface gráfica ou Xvfb no Linux):

```bash
npm run build
npm run desktop:setup
npm run test:desktop
# Linux sem interface gráfica:
# xvfb-run -a npm run test:desktop
```

O teste desktop simula a escolha dos caminhos nos diálogos e usa o sistema de arquivos real. Ele não testa a aparência/interação manual dos diálogos nativos. Os testes de smoke não são uma certificação de compatibilidade com todos os PCs.

Veja **VALIDACAO.md** para os resultados da entrega e **ROADMAP.md** para as próximas etapas.
