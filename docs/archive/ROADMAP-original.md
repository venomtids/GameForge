# Roteiro para uma engine mais completa

A Godot representa anos de trabalho de uma grande comunidade. Igualá-la não é uma alteração pontual de interface. A versão 0.2 organiza uma base executável e testável; as etapas abaixo **ainda não estão implementadas**.

## 1. Consolidar a base

- Decompor o módulo legado em jogos independentes, com ciclo de vida e input padronizados.
- Remover o antigo studio do módulo legado depois de estabilizar a migração.
- Sistema de comandos transacionais para agrupar edições e suportar seleção múltipla.
- Separar mais componentes React do editor (árvore, inspector, componentes, projetos).
- Persistência transacional em IndexedDB/arquivos, cópias de segurança, detecção de corrupção e recuperação.
- Testes de regressão de xadrez, física, voxel e cenários de perda de contexto gráfico.
- Medições de memória/GPU em hardware real e documentação de orçamento de cena.

**Critério de conclusão:** ciclos prolongados de abrir/editar/executar/fechar sem perda de dados ou crescimento contínuo de memória.

## 2. Pipeline de recursos

- Importar GLB/glTF, imagens, áudio e fontes.
- Diretório `res://` real, IDs de recursos e caminhos relativos portáteis.
- Biblioteca de materiais e texturas, prefabs/cenas instanciáveis.
- Importação assíncrona, miniaturas e rastreamento de dependências.
- Pacotes de assets e detecção de recursos ausentes.

**Critério de conclusão:** transportar um projeto entre dois PCs sem quebrar referências.

## 3. Runtime expansível

- Componentes registrados com schemas, inspector automático e serialização.
- Eventos/sinais, cena inicial, troca de cenas e estado global.
- Ambiente de scripts com API documentada, ciclo de vida, limites e depuração.
- Input remapeável, gamepads, touch, áudio espacial e interface de jogo.
- Character controller robusto, raios, triggers, camadas/máscaras de colisão.
- Colisores convexos/trimesh, articulações e regras claras para hierarquia física.

**Critério de conclusão:** implementar um jogo novo por componentes/scripts sem alterar o núcleo da engine.

## 4. Ferramentas de produção

- Editor 2D, tilemaps e animação por sprites.
- Timeline, keyframes, animação esquelética e máquinas de estado.
- Terrenos, navegação, pathfinding e profiler CPU/GPU.
- Editor de UI, fontes e localização.
- Plugins e extensões versionadas.

**Critério de conclusão:** produzir um projeto 2D e um 3D completos com o mesmo fluxo de recursos/build.

## 5. Distribuição

- Instalação/atualização assinada para Windows/macOS/Linux.
- Exportação de jogos desktop com empacotamento próprio, não só HTML.
- Builds reprodutíveis e integração contínua em todos os sistemas-alvo.
- Licenças/avisos de terceiros, política de versões e compatibilidade de projetos.
- Benchmark comparável, documentação de API e exemplos progressivos.

**Critério de conclusão:** compilar, distribuir e atualizar um jogo fora da máquina do desenvolvedor de forma repetível.

## Prioridade sugerida

Começar por **estabilidade + importação GLB + componentes extensíveis**, antes de adicionar efeitos visuais. Para chegar mais rápido a recursos equivalentes aos da Godot, outra opção é migrar os conceitos/jogos para a própria Godot; isso seria um projeto separado em GDScript/C#, não uma simples continuação desta base React/Three.js.
