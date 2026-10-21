# Atualização 0.3 — o que foi entregue e verificado

## Mudanças

- Parkour integrado ao editor, não em um arquivo HTML separado: **Novo → Skyline · Parkour FPS**.
- 20 plataformas, 8 cristais, 3 checkpoints, chegada, cronômetro e retorno após quedas.
- Câmera em primeira pessoa e terceira pessoa; livre orbital; perspectiva, isométrica e seis vistas ortográficas.
- Lua 5.3 via Fengari e JavaScript com código editável, ciclo `update`, estado local do nó e console.
- Confirmação de confiança antes de executar scripts; limites de instruções/tempo e Worker separado.
- Toolbox de escadas, ponte, jogador, checkpoint, chegada e zona de dano.
- Ancoragem, bloqueio de nó, agrupamento individual, gizmos locais/globais e diagnóstico de caixas envolventes.
- Formato v3, migração de projetos v2 e preservação do autosave v2.
- Instalador Windows x64 que atualiza a mesma aplicação 0.2; sem Node/Python para o usuário final.

## Verificações realizadas

### Núcleo

**15 testes passaram**, incluindo:

- validação de projetos, migração v2 → v3, scripts e modos de câmera;
- histórico, hierarquia, colisões, movimento e coleta;
- ativação de checkpoint, queda/retorno e conclusão condicionada aos cristais;
- movimento relativo ao yaw da câmera e sprint;
- **percurso inteiro com passos de física**, saltando entre todas as plataformas, ativando os três checkpoints, coletando os oito cristais e alcançando a chegada sem quedas.

TypeScript estrito e build de produção do editor/runtime passaram. `npm audit` não reportou vulnerabilidades no lockfile utilizado; isso não substitui auditoria independente.

### Navegador e scripts

- Fluxos anteriores de edição, salvar/abrir, exportação HTML, quatro jogos e três experimentos: aprovados.
- Seletores de câmera, modo FPS e ciclo de execução: aprovados.
- Lua e JavaScript alteraram os valores dos nós durante a execução: aprovado.
- Lua com loop infinito foi interrompido pelo limite de 50.000 instruções.
- JavaScript com loop infinito foi interrompido pelo watchdog sem travar a interface.
- Erros de sintaxe Lua foram reportados.
- Abertura com autosave v2 produziu v3, preservou o nome/projeto do usuário e manteve o valor original de v2 intacto.

### Electron

No Electron Linux, tanto o build de produção quanto o `app.asar` retirado do pacote Windows passaram nos testes de:

- carregamento, preload e isolamento do contexto;
- Lua/JavaScript executando sob a CSP do aplicativo;
- mensagens de ambos os scripts no console;
- toolbox de escada e bloqueio/desbloqueio de edição;
- salvamento/abertura e exportação por IPC (diálogos simulados, sistema de arquivos real).

### Instalador Windows

Empacotamento com Electron 44.4.3 e NSIS concluído. Sob **Wine 10**:

1. Instalado o pacote 0.2 original na pasta de teste — retorno 0.
2. Gravado um arquivo-sentinela no diretório de dados do aplicativo.
3. Instalado o pacote 0.3 na mesma pasta — retorno 0.
4. `package.json` do aplicativo instalado confirmou versão 0.3.0.
5. SHA-256 do `app.asar` instalado coincidiu com o empacotado.
6. O arquivo de dados foi preservado.

**Limitação:** não foi validada a execução completa em uma instalação real de Windows. Wine não é equivalente a Windows, e testar o conteúdo com Electron Linux não testa os drivers/integrações Windows. O instalador não tem assinatura digital.

## Escopo que ainda não existe

- Luau, APIs do Roblox, importação `.rbxl`, C#, GDScript ou compatibilidade com plugins Roblox/Godot.
- API geral de scripting para criar nós, sinais, multiplayer ou acesso a arquivos.
- Marketplace, terrain editor, importação GLB, animação esquelética, seleção múltipla ou editor 2D.
- Sandbox formalmente auditada contra código hostil. Não execute projetos de origem desconhecida.

A versão é uma atualização funcional da base, não paridade completa com Godot/Roblox.
