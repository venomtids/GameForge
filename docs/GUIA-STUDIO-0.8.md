# Guia rápido — GameForge Studio 0.8

## 1. Um primeiro jogo

Abra **Projetos → Ilha Aurora**. O projeto já tem uma ilha flutuante, árvores, cristais coletáveis, portal e personagem. Selecione um cristal no Explorador, pressione **F** para enquadrá-lo, **W** para mover e **Ctrl+D** para criar outro. Altere cor/tamanho no Inspetor.

**F5** abre o jogo. Use WASD/setas, Espaço e Shift. Em telas estreitas, use os botões de movimento, corrida e pulo. **F8** para e recupera a cena editável; as alterações da física durante o jogo não são gravadas como edição.

**Ctrl+S** guarda o projeto `.gameforge.json`. **Exportar jogo** gera um HTML com a cena ativa e o runtime embutido: não é preciso instalar a engine para jogar esse HTML num navegador com WebGL2.

## 2. Workspace e navegação

- **Explorador:** objetos e cenas. Busque nomes, expanda modelos, selecione, organize a hierarquia.
- **Viewport:** clique seleciona; W/E/R trocam gizmos. Ferramentas de câmera, grade, snapping e visualização de colisores ficam na barra da cena.
- **Inspetor:** transforma o objeto e configura material, corpo físico, comportamento, personagem, deformação e luz.
- **Dock:** Recursos, Toolbox, Design, Scripts, Console, Pixel Studio, UI, Mundo, Terreno e Animação.
- **Ctrl+K:** paleta de comandos; digite parte do nome, navegue com as setas e confirme com Enter.

Arraste os separadores dos painéis. Eles também aceitam setas, Home e End ao receber foco pelo teclado. Os botões de painéis permitem ocultá-los; **Restaurar layout**, na paleta, recupera o padrão.

No celular/tablet estreito, use **Cena / Viewport / Inspetor / Recursos**. Os painéis laterais viram gavetas; toque na parte livre da cena ou em Viewport para fechar. Durante o jogo, a área 3D ganha espaço automaticamente.

No rodapé escolha **Auto / Econômica / Alta**. Auto reduz gradualmente a resolução quando o FPS observado cai. O FPS depende do hardware e da complexidade da cena; qualidade automática não garante uma taxa fixa. Reduza também a resolução das sombras, luzes com sombra e a quantidade de objetos físicos. O botão de sol mostra/esconde o céu físico na edição.

## 3. Seleção múltipla e modelos

**Ctrl/⌘ ou Shift+clique** adiciona/remove objetos da seleção. A seleção atual é indicada no Viewport e o Inspetor passa a oferecer operações em lote.

- **Ctrl+C / Ctrl+V:** copiar/colar na sessão do Studio.
- **Ctrl+D:** duplicar com novos IDs, preservando a hierarquia.
- **Ctrl+G:** agrupar num modelo; **Ctrl+Shift+G:** desagrupar.
- **Alinhar / Distribuir:** usam os centros locais de objetos no mesmo nível da hierarquia.
- **Deslocar seleção:** move raízes, sem deslocar um filho duas vezes quando o pai também está selecionado.
- **Ancorar, Cor, Ocultar, Bloquear:** alterações em lote.

Objetos bloqueados são protegidos. Agrupamento exige o mesmo pai. Desagrupamento é recusado se destruir shear ou curvas de rotação dependentes de um grupo transformado. Operações são pré-validadas: um erro não deve deixar metade dos objetos alterados.

**Ctrl+Z / Ctrl+Shift+Z** desfaz/refaz. O histórico é limitado para evitar acumular cópias muito grandes de terrenos.

## 4. Animação por keyframes

Comece em **Projetos → Motion Lab**. Selecione **Plataforma móvel** e abra **Animação**.

1. Clique no diamante de um keyframe para selecionar uma pose.
2. Edite posição, rotação ou escala dessa pose e confirme com Enter/saída do campo.
3. Ajuste nome, duração, interpolação e repetição.
4. Use a régua/slider para pré-visualizar um instante.
5. Para gravar outra pose, modifique o objeto no Inspetor, escolha o tempo e clique **Capturar pose**.
6. O botão Play da timeline reproduz uma **prévia**. Stop recupera a pose original. **F5** testa no runtime.

Marque **Tocar no jogo** para autoplay. O projeto/exportação guarda o clip; não é necessário gravar vídeo nem ter o editor aberto.

Limites: 1–120 keyframes, duração 0,1–120 segundos, TRS local. Rotação é interpolada em graus, permitindo voltas de 360°. Não há animação de ossos/IK. Física dinâmica, terreno e malha deformada não usam clips no jogo. Para plataforma móvel use **Estático**: o runtime atualiza seu colisor cinemático, mas não anima o tamanho do colisor.

## 5. Lua e JavaScript

Selecione um objeto, abra **Scripts**, escolha a linguagem e use os exemplos ou **Comandos prontos**. CodeMirror oferece destaque, busca e diagnósticos de sintaxe.

```javascript
function start() {
  engine.log("Olá, mundo!");
}
function update(dt, time, input) {
  self.ry += 45 * dt;
}
```

```lua
function start()
  engine.log("Olá, mundo!")
end
function update(dt, time, input)
  self.ry = self.ry + 45 * dt
end
```

`dt` é em segundos; posição é local e rotação é em graus. O guia dentro do painel lista os comandos disponíveis. Modelos de andar, girar, bots, impulso, luz, lanterna, áudio e tween vêm da base 0.7.

Clique **Aplicar script** antes de salvar/exportar. O indicador “não aplicado” significa rascunho. Rascunhos sobrevivem à troca de objeto/painel durante a sessão (até 32), mas **não ao fechamento/reinício**. Trocar a linguagem/substituir pelo modelo pede confirmação.

A aba **Console** filtra mensagens e erros; erros de execução não são equivalentes a erros de sintaxe. Quando F5 pedir permissão, revise o código ou escolha **Executar sem scripts**. Worker e watchdog reduzem problemas comuns, mas não são uma sandbox de segurança auditada. Não execute código desconhecido.

## 6. Projetos e versões

**Projetos** reúne os seis starters, recentes e versões do projeto atual. Crie uma versão nomeada antes de uma mudança importante.

Ao restaurar uma versão, o Studio cria **“Antes da restauração”** com a edição substituída. Se não conseguir criar essa cópia, cancela a restauração. Só depois carrega o estado escolhido.

A biblioteca tem limites: 12 recentes, 5 versões por projeto/25 no total; entradas mais antigas são removidas para conter uso de disco. Remover um recente também remove suas versões locais, mas não apaga arquivos de projeto salvos fora da biblioteca nem a cena aberta.

No navegador os dados pertencem àquele perfil/origem; limpar o site os apaga. Se o localStorage pequeno estiver cheio, procure a última versão em **Projetos** (IndexedDB). No Electron há também `autosave.gameforge.json` no diretório de dados do app (normalmente `%APPDATA%\gameforge-studio`) e cópia `.bak` no fechamento. **Use arquivos externos para backup durável.**

## 7. Atalhos principais

| Atalho | Ação |
|---|---|
| Ctrl/⌘+K | Buscar comandos |
| Ctrl/⌘+N | Biblioteca |
| Ctrl/⌘+O / S | Abrir / salvar arquivo |
| Ctrl/⌘+A | Selecionar objetos (fora de campos de texto) |
| Ctrl/⌘+C / V / D | Copiar / colar / duplicar |
| Ctrl/⌘+G / Shift+G | Agrupar / desagrupar |
| Ctrl/⌘+Z / Shift+Z | Desfazer / refazer |
| Delete | Excluir seleção |
| W / E / R | Mover / girar / escalar |
| F | Enquadrar seleção |
| F5 / F8 | Executar / parar |
| Escape | Fechar diálogo / pausar jogo |

Os atalhos de edição não substituem os atalhos normais dos campos de texto/CodeMirror. No Electron, o menu **Arquivo / Criar / Exibir / Ajuda** também dá acesso aos comandos.

## O que esta versão não promete

Não é uma réplica da plataforma Roblox: não tem Luau, formatos Roblox, multiplayer, marketplace, hospedagem, colaboração online ou monetização. Não há importação de malhas externas, física CCD, editor 2D completo ou animação esquelética. O objetivo é um Studio local, editável e extensível sobre a fonte fornecida.
