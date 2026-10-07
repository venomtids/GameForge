# GameForge Studio 0.8.1 · Jelly Jump

Atualização da prévia independente para Windows 10/11 Intel/AMD x64.

## Novidades

- **Física da gelatina:** 8 partículas/28 molas, recuperação rotacional de forma e volume, limites de esticamento/impulso, massas respeitadas e colisão entre gelatinas independentes.
- **Plataformas elásticas:** base ancorada, apoio sólido que cede ao peso e retorna à forma original. Restituição a partir de 0,4 adiciona impulso na aterrissagem.
- **Toolbox:** jogador de gelatina articulado e jogável, além de uma plataforma pronta. O jogador tem joelhos/cotovelos, deformação elástica, corrida, pulo, câmeras e retorno ao checkpoint.
- **Jelly Jump:** mapa editável com 11 ilhas de gelatina, 2 checkpoints, 5 cristais e portal de chegada. Disponível em **Novo / Projetos** e incluído nos exemplos do instalador.
- **Controles rápidos:** pulo/retorno não se perdem entre quadros; botão de retorno ao checkpoint também no celular. Mãos de gelatina na primeira pessoa.

## Jogar

Abra **Novo → Jelly Jump**, pressione **F5**. **WASD** move, **Espaço** pula, **Shift** corre e **R** retorna. A ilha amarela impulsiona ao aterrissar. Colete os cinco doces de luz e alcance o portal. **F8** volta ao editor.

Na Toolbox, busque **gelatina**. O novo jogador se torna o personagem principal sem excluir os anteriores. Ajuste rigidez, amortecimento, recuperação de volume e esticamento no Inspetor.

## Validação e limites

106 testes de engine/armazenamento, incluindo percurso completo por controles reais com entradas a 30, 60 e 144 FPS (sem teleporte), estabilidade, peso nas plataformas, morte/renascimento e compatibilidade com projetos v7. Testes de navegador cobrem Toolbox, câmeras e exportação offline com toque. A publicação ocorre apenas após gerar o NSIS, instalá-lo e testar o aplicativo instalado no Windows.

O personagem usa **colisor sólido estável + molas na apresentação articulada**; não simula colisões individuais de cada membro. As plataformas usam **apoio plano aproximado**, não colisão por cada vértice. Até 12 rigs físicos/elásticos ativos. A física é discreta, sem CCD, e não equivale a uma simulação volumétrica FEM completa. Os FPS dos testes são cadências de entrada/simulação, não garantia de desempenho em qualquer aparelho.

O aplicativo é independente e não compatível com jogos/formatos Roblox. Esta prévia não tem assinatura digital: confira a origem e o arquivo SHA256SUMS.txt; não desative o antivírus. O usuário final não precisa de Node.js/Python.
