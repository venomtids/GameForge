# Bosque Vivo — jogo editável feito com GameForge Studio 0.5

## Abrir

Instale a engine 0.5. Use **Abrir → Bosque-Vivo-v0.5.gameforge.json → Executar → Permitir e executar → Começar**. Tudo roda dentro da engine. Não precisa instalar ferramentas de programação.

## Arquivos

- **Bosque-Vivo-v0.5.gameforge.json:** projeto completo, já contém o código, mapa inicial, 14 texturas próprias e 35 elementos de interface. Este é o arquivo para abrir na engine.
- **Controlador-completo.js:** código completo para importar na aba Scripts, inclui worldgen.js + game.js. É a versão independente para editar fora da engine.
- **game.js:** regras e sistemas do jogo. Para importar sozinho, mantenha o gerador `createWorld` já existente no script; preferencialmente importe Controlador-completo.js.
- **worldgen.js:** gerador procedural do jogo. Sua função é concatenada ao controlador no projeto.

O projeto usa APIs genéricas da engine (`engine.voxel`, `engine.ui`, `engine.spawn`, etc.). Vida, fome, inventário, receitas, mineração, IA e objetivo são implementados no JavaScript do jogo — não são sistemas de sobrevivência fixos dentro do editor.

## Controles

WASD mover; Shift correr; Espaço pular. Clique no viewport para capturar o mouse. Segure esquerdo para minerar ou atacar. Direito coloca o item escolhido. 1–8 escolhe hotbar. E abre/fecha mochila e libera o mouse; F come fruta. Esc pausa a engine; F8 para.

## Progressão e receitas

1. Mine **madeira** dos troncos. Folhas fornecem frutas.
2. 1 madeira → 4 tábuas. 2 tábuas → 4 gravetos.
3. 3 tábuas + 2 gravetos → picareta de madeira. Agora pode minerar pedra, carvão e ferro.
4. 3 ferros + 2 gravetos → picareta de ferro. Ela também minera cristal.
5. 6 pedras + 2 ferros + 1 cristal → Farol do Bosque.
6. Selecione o farol no slot 8 e coloque com o botão direito: objetivo concluído. Pode continuar construindo.

Outras receitas: 2 tábuas + 1 graveto → espada; 1 carvão + 1 graveto → 4 tochas decorativas. A ferramenta disponível mais forte é usada automaticamente. Frutas recuperam fome e um pouco de vida. Fome alta permite regeneração lenta; fome zero causa dano. Cuidado com quedas. Criaturas ficam mais agressivas à noite.

Há depósitos de ferro/cristal garantidos perto de x=21–22, z=13–15, nas camadas baixas. Isso não elimina a necessidade de fabricar as ferramentas para extraí-los.

## Salvar versus editar

- **Mochila → Salvar progresso:** salva inventário, vida, fome, posição, horário e alterações de blocos neste aplicativo. Há autosave de gameplay a cada 45 segundos de jogo ativo.
- **Menu inicial → Carregar progresso:** restaura esse save. Criaturas são recriadas; seus estados individuais não são salvos.
- **Novo mundo:** recria o mapa da execução usando CONFIG.seed. Não apaga o arquivo de projeto; só substitui o save quando você salvar/autosalvar depois.
- **Salvar da engine:** salva o projeto de edição, não captura automaticamente o que foi minerado/construído durante a partida.
- Parar restaura o mapa inicial do projeto. Para alterar esse mapa, pare, use o menu de botão direito nos blocos e salve o projeto.

O progresso fica em localStorage do aplicativo, por ID de cena/controlador. Não é sincronizado entre computadores. O JSON de projeto pode ser enviado a outra pessoa, mas não leva automaticamente seu save local.

## Alterar o jogo

Selecione **Controlador do jogo · JavaScript editável → Scripts**. Edite CONFIG para dificuldade, duração do dia, fome e número de inimigos. RECIPES e ITEMS definem fabricação e itens. A engine avisa erros de sintaxe antes de Aplicar; erros durante execução aparecem no Console. Salve uma cópia antes de mudar o código.

Na aba Interface 2D, altere HUD, barras, menus, botões e posições. Os IDs ligam elementos aos scripts: mantenha-os ou atualize as referências no código. Pixel Studio edita as texturas; Mundo escolhe a textura de cada tipo de bloco. O personagem e seus valores de movimento estão na árvore/Inspector e nas configurações do projeto.

## Escopo

Jogo próprio, inspirado no gênero de sobrevivência em blocos, com arte procedural original. Não usa recursos da Mojang e não reproduz todos os sistemas de Minecraft. Mundo finito 32 × 24 × 32, sem multiplayer, propagação de água, redstone, animais, fornos, agricultura, armaduras, áudio ou animação de ferramenta. Inventário é por contagem, com hotbar, não grade de arrastar itens.
