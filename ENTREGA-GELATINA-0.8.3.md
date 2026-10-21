# Entrega · GameForge Studio 0.8.3

06/10/2026. Correção dos braços e da visão em primeira pessoa, volume tetraédrico XPBD, gota viscosa confinada e contato pontual por triângulos da malha deformada. A prévia de Jelly Jump continua disponível ao lado do Studio.

## Instalador Windows x64 atualizado — entregue

**[Baixar GameForge-Studio-0.8.3-Windows-x64-Setup.exe](https://github.com/venomtids/GameForge/releases/download/studio-v0.8.3/GameForge-Studio-0.8.3-Windows-x64-Setup.exe)**

- [Release, instruções e checksum](https://github.com/venomtids/GameForge/releases/tag/studio-v0.8.3).
- [SHA256SUMS.txt](https://github.com/venomtids/GameForge/releases/download/studio-v0.8.3/SHA256SUMS.txt).
- **103.759.512 bytes**, SHA-256 informado pelo metadado do asset publicado no GitHub:

```text
4d188ac60c79230a7b74811a6814e17b1e61e5cf643e1bcfc91f3c0d6021bf1e
```

[Windows CI nº 37501148172](https://github.com/venomtids/GameForge/actions/runs/37501148172): **success** (3m02s), commit `cbc0a207370363d0fc723da9ee78023600a8105a` na branch `arena/01a0f29f-gameforge`. Passou pela instalação NSIS, verificação dos recursos, licenças e exemplos, teste **do executável instalado** com IPC/backup/abertura/salvamento rápido/gelatina/exportação/animador, upload do artefato e publicação da release. A primeira execução (37500043364) foi bloqueada corretamente por uma corrida no salvamento rápido; corrigida antes desta publicação. O instalador público 0.8.2 é anterior e **não inclui esta correção**.

Windows 10/11 x64 Intel/AMD. Prévia **não assinada digitalmente**; confira origem e hash, não desative o antivírus. Usuários não precisam instalar Node.js/Python. A validação de CI usa VM Windows, não certificação de todo hardware.

## Experimentar agora

- **Live Preview Jelly Jump (porta 5174):** versão atualizada e pronta para jogar.
- **Live Preview Studio (porta 5173):** **Projetos → Jelly Jump → F5**. Alternar para **Primeira pessoa** no seletor; **F8** volta à edição.
- WASD/setas movem; Espaço pula; Shift corre; R retorna. Toque disponível no celular.
- Selecione gelatina na Toolbox/Inspetor para os presets **Muito mole / Macia / Gota viscosa / Firme**, a fluidez e o contato por triângulos.

## Evidências, fonte e limites

- **130/130 testes unitários**, typecheck/build, testes de navegador `test:jelly`, `test:studio06`, `test:studio08`, `test:export:studio08` locais passam. O editor/exportação offline testou mobiles a 390 px com verificação dos pixels do cenário após resize, layout 320–1920, teclado/toque e saltos repetidos. Percurso completo de 11 superfícies, 5 cristais, 2 checkpoints e boost passou com entradas a 30/60/144 cadências; esses valores não garantem FPS em todo hardware.
- `entregas/Jelly-Jump-Gelatina.html`: jogo offline independente; `entregas/Jelly-Jump-Gelatina.gameforge.json`: projeto editável; `entregas/GameForge-Studio-0.8.3-Codigo-Fonte.zip`: fonte e scripts (não é instalador). Esses arquivos locais são gerados e podem não existir em outro checkout; o instalador público está nos links acima.
- [Referências, licenças, implementação e limites exatos](docs/GELATINA-0.8.3.md). Braços agora se dobram para a frente; a primeira pessoa tem um render pass de mãos com profundidade própria. Seis tetraedros XPBD estabilizam o volume. A gota é **fechada e viscosa, não água livre**. Só o contato de jogador contra gelatinas *livres* consulta ponto mais próximo na malha deformada; o controlador é aproximado por esferas, com solver discreto. **Não** há FEM constitutivo completo, SPH, colisão exata geral entre malhas, CUDA, IPC ou CCD global. Plataformas de parkour mantêm apoio plano sólido.
