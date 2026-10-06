# Entrega · GameForge Studio 0.8.2

06/10/2026. Gelatina mais mole, móvel e reativa, baseada nos algoritmos inspecionados do Roundy/Jelly-Mesh-System e adaptada para Three.js/Cannon.

## Instalador Windows atualizado — entregue

**[Baixar GameForge-Studio-0.8.2-Windows-x64-Setup.exe](https://github.com/venomtids/GameForge/releases/download/studio-v0.8.2/GameForge-Studio-0.8.2-Windows-x64-Setup.exe)**

- [Release pública](https://github.com/venomtids/GameForge/releases/tag/studio-v0.8.2).
- [Checksum publicado](https://github.com/venomtids/GameForge/releases/download/studio-v0.8.2/SHA256SUMS.txt).
- [Instruções Windows](https://github.com/venomtids/GameForge/releases/download/studio-v0.8.2/LEIA-ME-WINDOWS.txt).
- **103.753.986 bytes**, SHA-256 confirmado pelos metadados do asset no GitHub:

```text
598f6cb27b00190fb8a7f64687ed686bffc404ddf359f6a31d606272632c819d
```

A [validação Windows 37466047048](https://github.com/venomtids/GameForge/actions/runs/37466047048) terminou com **success**, em 3m08s: 121 testes, build/NSIS, instalação silenciosa, recursos/licenças/projetos empacotados, teste do **executável instalado**, IPC, abrir/salvar/backup/exportação e publicação. Código do aplicativo: `2a13d4ed1534ebc489e7f918f53db33926831118`, branch `arena/01a0f29f-gameforge`.

Alvo Windows 10/11 x64 Intel/AMD. É uma prévia sem assinatura digital; confirme a origem e o SHA-256, sem desativar o antivírus. Não é necessário Node.js/Python para o usuário final.

O download do asset dentro deste sandbox encontrou EOF no host de arquivos do GitHub; por isso não existe uma cópia local fictícia do EXE. O instalador real está publicado nos links acima, e seu digest foi consultado no GitHub após o sucesso do CI.

## Testar a física

- **Live Preview — Jelly Jump**, porta 5174: versão reconstruída, mais mole por padrão.
- **Live Preview — GameForge Studio**, porta 5173: **Projetos → Jelly Jump → F5**.
- **WASD/setas**, Espaço, Shift e R. Toque e retorno ao checkpoint também disponíveis em telas estreitas.
- Toolbox → gelatina; no inspector experimente **Muito mole / Macia / Firme**, intensidade, reação ao movimento, raio e pivô.

## Arquivos locais

- `entregas/Jelly-Jump-Gelatina.html`: jogo independente/offline com a mesma física e avisos MIT.
- `entregas/Jelly-Jump-Gelatina.gameforge.json`: projeto editável atualizado.
- `entregas/GameForge-Studio-0.8.2-Codigo-Fonte.zip`: código e scripts de empacotamento, sem dependências/binários/ZIP antigo.
- `docs/GELATINA-0.8.2.md`: comparação real com o upstream, parâmetros, implementação, testes e limites.

## O que mudou

Molas por vértice, inércia de translação/rotação, pivô e falloff, recuperação radial, LOD visual/invisibilidade, impactos locais e cisalhamento, presets e preservação da geometria original. Mais squash/stretch e oscilação de membros; guardas de pés/topo e correção de offset/grounding/profundidade preservadas.

121 testes unitários e build passaram. Navegador: novos controles persistidos, câmeras/mãos, saltos repetidos, JSON/HTML baixados, `file://`, toque a 390px e layout 320–1920px. Parkour completo real a 30/60/144 cadências, 11 superfícies, 5 cristais, 2 checkpoints, boost, sem teleporte/mortes. Não é benchmark universal de hardware.

Continua sendo uma aproximação híbrida, não FEM/líquido nem colisor exato por vértice: controlador sólido, gaiola de 8 pontos/28 molas e apoio plano aproximado; até 12 rigs, sem CCD. As bibliotecas Unity não foram transplantadas; algoritmos adaptados, licenças MIT preservadas.

A conexão GitHub expirou **após a publicação bem-sucedida**. As últimas atualizações documentais estão salvas nesta sessão; para sincronizá-las, reconecte GitHub na Arena. Isso não impede o download público da versão 0.8.2 já entregue.
