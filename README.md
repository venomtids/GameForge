# GameForge Studio 0.8

Um Studio **independente, inspirado no fluxo de criação do Roblox Studio**, construído sobre o código-fonte 0.7 fornecido: editor 3D, física, scripts, terreno, personagens e exportação offline. Interface em português, sem conta obrigatória.

> Não é Roblox, não importa `.rbxl`/`.rbxm`, não executa Luau e não oferece multiplayer ou serviços em nuvem. Lua 5.3 e JavaScript são as linguagens desta engine.

## Comece em cinco minutos

1. Abra **Projetos** e escolha **Ilha Aurora**, **Baseplate**, **Skyline Obby**, **Motion Lab**, **Laboratório de scripts** ou **Projeto vazio**.
2. Selecione objetos na cena/Explorador. Use **W / E / R** para mover, girar e escalar; **F** enquadra a seleção.
3. Adicione modelos na **Toolbox** ou busque um comando com **Ctrl+K**.
4. **F5** executa, **F8** volta à edição. WASD/setas, Espaço e Shift controlam o jogador; telas estreitas têm botões de toque.
5. **Ctrl+S** salva um projeto editável. **Exportar jogo** gera um HTML independente que pode ser aberto offline.

Guia completo: [docs/GUIA-STUDIO-0.8.md](docs/GUIA-STUDIO-0.8.md).

## Novidades desta atualização

- **Workspace responsivo:** Explorador/Inspetor redimensionáveis e recolhíveis; gavetas em telas estreitas; dock ajustável; preferências persistidas; atalhos de teclado e foco dos diálogos.
- **Qualidade adaptativa:** Auto, Econômica e Alta; ajuste gradual de resolução conforme o FPS observado. Céu físico opcional no editor; no jogo, respeita as configurações do mundo.
- **Seleção múltipla:** Ctrl/⌘ ou Shift+clique, copiar/colar, duplicar, agrupar/desagrupar, deslocar, alinhar e distribuir. Alterações em lote entram como uma operação no histórico.
- **Animação por keyframes:** posição, rotação e escala de objetos; interpolação linear/suave/degraus, duração, loops, prévia, captura de pose e reprodução no jogo/exportação. Plataformas estáticas animadas têm colisores cinemáticos.
- **Biblioteca local:** projetos recentes com miniaturas e versões nomeadas. Uma restauração primeiro cria **“Antes da restauração”**, para proteger a edição substituída.
- **Programação mais estável:** editor CodeMirror, diagnósticos, modelos de comandos, importação/exportação de scripts e recuperação de rascunhos ao trocar objetos/painéis na mesma sessão. Clique **Aplicar script** para gravar no projeto.
- **Desktop Electron:** menus em português, abrir arquivos pela linha de comando/associação, janela única, posição da janela, autosave em disco, salvamento atômico e `.bak`; renderer isolado, sem acesso direto a Node.js.
- **Exportação UTF-8:** nomes/textos com acentos e emojis; projeto limitado por bytes; runtime independente com controles de toque e qualidade automática.

A base anterior foi preservada: gizmos, hierarquia, snapping, câmeras ortográficas/perspectiva/FPS/terceira pessoa; física Cannon-es, humanoides, bots, ragdoll e gelatina; primitivas, modelos, terrenos contínuos/voxel e pintura; Pixel Studio, interfaces 2D, luzes, sombras, lanterna, céu e áudio sintetizado; jogos e laboratórios originais.

## Windows — usuário final

O alvo é **Windows 10/11 x64 (Intel/AMD)**. O pacote é um instalador Electron/NSIS:

`GameForge-Studio-0.8.0-Windows-x64-Setup.exe`

**Disponibilidade:** o arquivo só existe após uma compilação Windows concluída. A configuração de empacotamento não é, por si só, um instalador. O fluxo [Instalador Windows](https://github.com/venomtids/GameForge/actions) compila a branch de trabalho e publica o `.exe`, `SHA256SUMS.txt` e instruções como artefato. Confira se a execução ficou verde antes de baixar.

- Feche a engine e guarde backups antes de atualizar. Instale no mesmo usuário/pasta da versão anterior.
- O usuário final **não precisa de Node.js/Python**. Recomendação: 4 GB de RAM, WebGL2/aceleração gráfica e 600 MB livres.
- Instalador **não assinado**: o Windows pode mostrar aviso de reputação/SmartScreen. Verifique origem e SHA-256. Não desative o antivírus.
- Projetos/autosave não são apagados pela desinstalação. Identidade mantida: `com.gameforge.studio`.
- A associação é para `.gameforge`; `.gameforge.json` também pode ser aberto pelo botão Abrir. Não se modifica a associação global de todos os arquivos JSON.

Instruções: [packaging/LEIA-ME-WINDOWS.txt](packaging/LEIA-ME-WINDOWS.txt).

## Rodar o código-fonte

Node.js **24 LTS recomendado** (mínimo 22.12), npm e acesso à internet para instalar dependências:

```bash
npm ci
npm run dev
```

O `predev` reconstrói o player offline. Abra `http://localhost:5173` **no computador onde o servidor está rodando**. Em um servidor remoto, use o endereço público fornecido; não há API externa/localhost embutida no frontend.

```bash
npm test                    # testes de engine, migração, edição e armazenamento
npm run typecheck
npm run build               # player single-file + editor de produção
npm run preview             # produção local
npm run test:studio08        # fluxos do Studio; servidor dev precisa estar aberto
npm run test:update          # regressões/scripts; servidor dev precisa estar aberto
npm run examples:studio08    # recria os projetos de exemplo 0.8
```

Testes de navegador usam Playwright. Instale Chromium com `npx playwright install chromium`; `CHROME_PATH` permite um navegador local. O helper tem fallback Linux para ambientes restritos. Não é necessário Playwright para o usuário final.

## Compilar o instalador no Windows

No Windows x64 com Node.js 24 LTS, dê dois cliques em **GERAR-INSTALADOR-WINDOWS.cmd**, ou execute:

```powershell
npm ci
npm test
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run desktop:win
```

Saída: `dist/windows/`. A compilação baixa Electron/NSIS; bloqueios de rede podem impedi-la. Não é preciso Wine ao compilar no Windows. `dist/desktop-app` contém somente assets compilados e o código do processo desktop, **sem node_modules de desenvolvimento**.

Para validar o aplicativo de produção sem instalar:

```powershell
npm run desktop:setup
$env:GAMEFORGE_TEST_APP = "dist/desktop-app"
npm run test:desktop:studio08
```

O CI Windows executa esses passos e só publica o instalador se os testes nativos passarem. São testes automatizados em uma VM, com diálogos de arquivo simulados e sistema de arquivos real — não uma certificação em todo hardware Windows.

## Projetos, compatibilidade e limites

- Leitor migra formatos 2–6; formato atual continua **7**, com `animation` opcional. Preserve backups ao voltar para engines anteriores.
- Projetos até **8 MB UTF-8**, até 500 nós/cena; scripts até 128 mil caracteres/nó.
- Histórico: até 60 estados, limitado a cerca de 32 MB (sem contar o estado atual).
- Biblioteca: até 12 recentes (~40 MB). Versões: até 5/projeto e 25 no total (~60 MB), com remoção das mais antigas.
- Dados de navegador ficam no perfil/origem atual. Limpar dados do site remove a biblioteca. **Salve arquivos para backup/transferência.** IndexedDB é o fallback quando o armazenamento local pequeno está cheio; recupere pelo painel Projetos.
- Rascunhos de scripts são **da sessão**, não sobrevivem ao encerramento; apenas o código aplicado entra em projetos/versões/exportações.
- Keyframes não são animação de esqueleto/IK. Corpos dinâmicos, terrenos e malhas deformadas não usam keyframes no runtime. Escala visual não redimensiona colisores durante a animação. Transformações que causariam shear, excederiam os limites ou destruiriam uma animação são recusadas.
- Física discreta, sem CCD; modelos e interfaces são procedurais/simples. Sem importador glTF/FBX, editor 2D dedicado, colaboração em tempo real, marketplace, hospedagem ou monetização.
- Scripts executam em Worker com limites de tempo/instruções, mas **não constituem sandbox auditada**. Só permita código de confiança. A permissão nunca é herdada automaticamente de um arquivo.

Exemplos 0.8 em `examples/studio08/`. Documentação original, conservada como histórico: [docs/archive/README-0.7.md](docs/archive/README-0.7.md). Licenças de terceiros e fonte Inter: [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).
