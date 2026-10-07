# GameForge Studio 0.8.3 · Visão em primeira pessoa e volume deformável

Prévia independente para Windows 10/11 x64 Intel/AMD; teste o Jelly Jump em **Projetos → Jelly Jump → F5**.

- Ombros/cotovelos agora flexionam para a frente ao caminhar e saltar; molas dos braços e cabeça são limitadas para não piscar/desencaixar.
- Balanço das mãos contínuo em primeira pessoa, squash amortecido e segunda camada WebGL: mãos, lanterna e objetos segurados não atravessam o próprio antebraço nem são recortados pelos blocos do mundo.
- Corpo gelatinoso livre: seis tetraedros com restrições XPBD de volume assinado, recuperação anti-inversão e preset experimental **Gota viscosa** (corpo selado, não água livre).
- Consulta geométrica do ponto mais próximo nos triângulos **atuais da malha deformada** em corpos livres próximos ao jogador; contato esférico limitado e impulso localizado. Os oito cantos físicos e as plataformas de apoio plano continuam estáveis.
- Opções `Fluidez da gota` e `Contato por triângulos deformados` no Inspetor; parâmetros opcionais compatíveis com projetos antigos.
- Atribuição e licenças MIT dos projetos de referência incorporadas ao código, pacote e HTML exportado.

**Limites:** a gaiola é FEM volumétrico simplificado, não material contínuo neo-Hookean. A gota não é água/SPH/PBF livre. Apenas jogador × gelatina *livre* utiliza sondas esféricas nos triângulos visíveis: não é colisão exata de caixas/membros, cena inteira ou CCD/IPC contínuo. Plataformas ancoradas mantêm apoio rígido plano. Não executamos CUDA/Unity/Haxe/PBD nativos nem copiamos o código CUDA sem licença verificada. Até 12 rigs; sem garantia universal de FPS.

Validação local: 130 testes unitários, typecheck/build e navegador/HTML offline a 390 px com prova por pixels; parkour completo a 30/60/144 cadências. Esses números não garantem FPS em todos os aparelhos.

O instalador só é publicado **após** testes de engine, build NSIS, instalação e validação do executável instalado no Windows CI. Prévia independente sem assinatura digital: confirme a origem e SHA256SUMS.txt; não desative o antivírus. O usuário final não precisa instalar ferramentas de desenvolvimento.
