# Gelatina 0.8.3 · braços, visão em primeira pessoa e volumes deformáveis

## Problema corrigido

Os cotovelos dobravam no eixo oposto ao movimento para a frente, a pose de salto levava os braços para trás, e o `cos(phase/2)` das mãos em primeira pessoa era reiniciado a cada volta de `2π` — uma descontinuidade de aproximadamente 1,6 cm em um quadro, visível como “flic”. Os materiais transparentes das mãos não testavam/escreviam profundidade e, sobre plataformas transparentes, sobrepunham-se indevidamente.

- Dobras dos cotovelos agora apontam **para a frente** durante caminhada, parada e salto, limitando a amplitude sem desencaixar ombros e cotovelos. A malha macia das mãos/braços tem deslocamento menor que o tronco; cabeça e pés não piscam por grandes saltos de vértice.
- A fase do balanço retorna somente a cada **4π**; aceleração e parada são suavizadas. Escala de squash das mãos em primeira pessoa tem limite e amortecimento, além de uma pequena resposta ao olhar e à velocidade vertical.
- Mãos, antebraços, lanterna e objetos segurados usam geometria coerente e **renderização em uma segunda camada**: o mundo é renderizado normalmente, z-buffer é limpo, e as mãos são renderizadas com depth test/write entre si. Assim a mão não fica cortada pelo cenário nem atravessa o próprio antebraço; a renderização de terceira pessoa e oclusão do mundo ficam intactas.
- As malhas próprias do avatar só são exibidas em terceira pessoa; testes no navegador inspecionam composição real de pixels, alternância de câmera, respawn e saltos repetidos.

## Referências inspecionadas

| Projeto | Ideia usada/resultado | Limite/compatibilidade |
| --- | --- | --- |
| [Rafapp/jellyengine](https://github.com/Rafapp/jellyengine), `359781ae` (`Engine/src/physics.cpp`, MIT) | Molas locais entre pontos e atualização da malha visível; contrastado com nossas 28 molas + capa por vértice. | C++/OpenGL, até seu código anota colisão rígido→gelatina como TODO; não fornece colisão exata global para Three.js. |
| [michaelapfelbeck/jellyPhysics](https://github.com/michaelapfelbeck/jellyPhysics), `6f45b23` (`PressureBody.hx`, MIT) | Pressão para corpo fechado inspirou o preset **Gota viscosa**: menos cisalhamento/recuperação da forma e maior pressão anti-compressão. | Haxe/2D: sua pressão é proporcional à área; isto **não vira água 3D livre** nem roda código Haxe no navegador. |
| [InteractiveComputerGraphics/PositionBasedDynamics](https://github.com/InteractiveComputerGraphics/PositionBasedDynamics), `10a70bc` (`XPBD.cpp`, `PositionBasedFluids.cpp`, MIT) | **6 tetraedros XPBD** com volume assinado, gradientes e complacência por passo; pressão anti-compressão estilo PBF na gota. | Uma gaiola de 8 pontos é FEM volumétrico **simplificado**, não FEM neo-Hookean/Green-strain por malha arbitrária nem SPH/PBF de água livre. |
| [GrahamZen/Soft-Body-Simulation-CUDA](https://github.com/GrahamZen/Soft-Body-Simulation-CUDA), `a16dad0` (`narrowphase.cu`, `README`, licença ausente na raiz) | Comparação de arquitetura BVH/narrowphase/CCD. Implementamos consulta CPU da distância exata **ponto–triângulo da malha atualmente deformada**, com AABB de rejeição. | CUDA≥12/cublas/cusolver e IPC contínuo não são portáveis diretamente para Electron/WebGL; **nenhum código CUDA foi copiado**, não anunciamos IPC/CCD completos. |

Licenças MIT preservadas em `licenses/Soft-Physics-References.txt`, `THIRD-PARTY-NOTICES.txt` e no HTML exportado. O código CUDA sem licença na raiz foi usado somente como referência pública de arquitetura, não como dependência.

## Física implementada e escopo real

- A gaiola existente continua usando 8 massas/28 molas, recuperação de forma e volume global. **Seis tetraedros positivos** cobrem toda a caixa, cada um com restrição XPBD de volume assinado, até 3 iterações limitadas por passo. Cantos estáticos da base não se movem; há teste contra inversão/NaN e estabilidade a 30/120/240 Hz.
- `Fluidez da gota (confinada)` é de 0 a 1. O preset **Gota viscosa** (`0,85`) enfraquece molas de cisalhamento/forma e mantém o volume com pressão de compressão. Após o mesmo impulso do teste, a diferença de raios dos 8 pontos é maior que no preset elástico. A gota mantém uma pele fechada e a malha original; **não se divide, não escorre como água, não respinga e não tem partículas SPH**. A opção não altera o controlador físico do personagem.
- `Contato por triângulos deformados` é ativado por padrão em corpos livres. Depois do passo Cannon, até 3 sondas esféricas do controlador consultam os triângulos **reais da BufferGeometry deformada nesse passo**, com descarte por caixa envolvente. Um contato limitado move o jogador para fora da superfície, zera velocidade entrando na face e transfere impulso aos 4 pontos mais próximos. O botão do Inspetor permite desligar.
- Esse contato é **exato somente no cálculo local de ponto mais próximo sobre cada triângulo renderizado**. A forma do jogador é aproximada por sondas esféricas; há contato discreto a 120 Hz e um passo limitado. Outros corpos continuam com Cannon, plataformas ancoradas preservam o **apoio plano sólido**, membros não têm colisores individuais, e não há CCD global/IPC/colisão exata para todos os pares da cena. O antigo colisor rígido e a proteção contra afundamento não foram removidos.
- LOD visual reduz apenas atualização dos vértices, nunca os corpos físicos; perto do jogador um corpo livre força atualização da pele antes da consulta de triângulo.

Projetos schema 7 antigos continuam abrindo: `fluidity` (0–1) e `surfaceCollision` (booleano) são opcionais, validados, ajustáveis no Inspetor e por patch `engine.set`. O preset Gota viscosa é experimental. O novo modo não é uma alegação de compatibilidade com CUDA/Unity/Roblox.

## Verificação e entrega

**130/130 testes unitários**, typecheck/build e suites de navegador (`test:jelly`, `test:studio06`, `test:studio08`, `test:export:studio08`) passaram. Testes quantitativos cobrem curvatura do cotovelo por 1.000 passos, fase do viewmodel, visibilidade e pixels de sua camada, 6 tetraedros, pressão, contato por triângulo e integração real no World. O teste offline de 390px agora verifica pixels reais do cenário (além do HUD) após o ajuste automático de resolução. O renderer passou a ajustar resolução **antes** de desenhar, não depois de apagar o frame recém-apresentado. Testes de regressão existentes incluem saltos/boost sem deriva, parkour completo a 30/60/144 cadências, exportação offline/touch e layout de 320–1920 px.

O instalador Windows 0.8.2 foi validado e publicado *antes* desta mudança e **não contém estas correções**. Só declare um instalador 0.8.3 atualizado após instalação e teste do aplicativo no Windows CI.

![Primeira pessoa: antebraços e mãos em uma camada própria](screenshots/jelly-first-person.png)

![Jelly Jump offline em 390 px, geometria visível](screenshots/jelly-mobile.png)
