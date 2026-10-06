# GameForge Studio 0.8.2 · Gelatina mais mole e reativa

Prévia independente para Windows 10/11 Intel/AMD x64, com Jelly Jump editável e Electron/NSIS.

## Novidades

- Física de superfície adaptada do [Jelly-Mesh-System de Roundy](https://github.com/roundyyy/Jelly-Mesh-System), sob MIT: molas por vértice, inércia de translação/rotação, pivô, falloff, recuperação radial e LOD visual.
- Jogador mais mole: squash/stretch mais amplo, mais oscilação nas nove juntas e deformação também nas malhas dos membros. Controle de caminhada/corrida/salto continua sólido.
- Plataformas cedem ao peso, balançam e recebem impactos locais. O topo mantém coerência com o apoio físico; os pés não atravessam a superfície.
- Presets **Muito mole / Macia / Firme**, controles de intensidade, reação ao movimento, raio, pivô, LOD e economia da malha no inspector.
- Preservação da geometria original das gelatinas livres: uma esfera não é substituída por uma caixa.
- Correção de offsets acumulados nos saltos, grounding relativo ao suporte e profundidade das gelatinas mantidos; proteção adicional dos pés.
- Correção do salvamento imediato de campos/nomes em UTF-8, inclusive após exportar HTML.
- HTML exportado incorpora a atribuição/licença e executa a mesma física offline, com toque.

## Experimentar

**Projetos → Jelly Jump → F5**. WASD/setas movem, Espaço pula, Shift corre e R retorna. Colete os cinco cristais, use os dois checkpoints e alcance o portal; a ilha amarela impulsiona na aterrissagem. **F8** volta à edição.

Na Toolbox busque **gelatina**. Selecione o personagem/plataforma e experimente os três presets em **Personagem, bot & física**. Mais intensidade/reação e menos amortecimento produzem mais oscilação.

## Validação e limites

121 testes unitários; typecheck/build; navegador, persistência dos controles, saltos repetidos, câmeras, exportação `file://` e toque; layout de 320–1920 px. Percurso completo com entradas a 30/60/144 cadências, sem teleporte nem mortes. Essas cadências não são garantia de FPS em qualquer hardware.

A publicação deste instalador é condicionada à instalação NSIS e ao teste do **executável instalado** no Windows CI, incluindo abrir/salvar/backup, exportação, viewport e reinício do aplicativo.

Não é FEM/líquido nem colisão exata da malha deformada: jogador híbrido com colisor estável, corpos livres com 8 pontos/28 molas e plataformas de apoio plano aproximado; até 12 rigs ativos, solver discreto sem CCD. Jobs/Burst e componentes Unity não são dependências deste aplicativo; houve uma adaptação dos algoritmos.

Esta prévia é independente, não compatível com formatos/jogos Roblox e **não tem assinatura digital**. Confira a origem e `SHA256SUMS.txt`; não desative o antivírus. O usuário final não precisa instalar Node.js/Python.
