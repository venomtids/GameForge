# Correção: personagem afundando/piscando ao saltar

Atualização local de 06/10/2026, sobre a versão 0.8.1.

## Problema reproduzido

A animação secundária somava `squash * 0.5` à posição vertical do grupo `lean` a cada passo. O reset removia rotação/escala, mas não essa translação. A pose no ar mantinha a posição anterior: saltos repetidos e impulsos acumulavam deslocamento, separando a malha visível do colisor sólido. Na reprodução de 15 segundos, os pés visíveis chegaram a **2,52 m abaixo** da base do colisor. Isso parecia atravessar o bloco, embora o corpo físico continuasse apoiado.

Contatos calculados no início do passo ainda marcavam o personagem como apoiado depois de um salto/impulso. Além disso, plataformas e membros transparentes não escreviam profundidade, dependendo da ordenação dos centros dos objetos.

## Alterações

- Remover a translação elástica anterior antes de aplicar a nova pose. A compressão/alongamento continua ancorada nos pés, sem acumular deslocamento no ar, no renascimento ou no descarte.
- Reconhecer afastamento do apoio pela velocidade relativa e pelo contato atual. Não confundir lançamento com chão; preservar pequenos ajustes do solver e o apoio em plataformas que sobem.
- Gelatinas escrevem profundidade, mantendo o material brilhante/semitransparente, para oclusão consistente de plataformas e membros.

## Validação

- **110/110 testes unitários passaram**, incluindo quatro regressões novas: lançamento, saltos/impulsos repetidos, profundidade e movimento relativo do apoio.
- Os testes de saltos repetidos verificam a geometria visível e o colisor, não apenas velocidade/HUD, com entradas a 30 e 144 FPS. O percurso completo continua passando a 30/60/144 FPS, sem teleporte e sem quedas.
- Na mesma reprodução de 15 segundos, o deslocamento acumulado desapareceu; a diferença mínima dos pés para a base do colisor ficou em aproximadamente **5,1 cm**, devido à pose articulada, em vez de metros de deriva.
- O teste de navegador de gelatina passou, incluindo repetidos saltos, alinhamento visual, pose no ar, escrita de profundidade, controles móveis e exportação offline. As regressões de navegador Studio 0.6 e 0.8 também passaram. Typecheck e build passaram.

O apoio continua plano e aproximado, e a física continua discreta: esta correção não transforma a gelatina em FEM nem promete colisão perfeita em qualquer velocidade/hardware. A compilação/validação/publicação do instalador Windows desta correção não foi realizada nesta sessão. A prévia e o HTML offline foram reconstruídos com o código corrigido.
