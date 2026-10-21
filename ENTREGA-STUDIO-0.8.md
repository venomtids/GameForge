# GameForge Studio 0.8 — entrega

Engine independente, aprimorada a partir da fonte 0.7 fornecida, com fluxo de criação inspirado no Roblox Studio.

## Instalador Windows

**[Baixar GameForge-Studio-0.8.0-Windows-x64-Setup.exe](https://github.com/venomtids/GameForge/releases/download/studio-v0.8.0/GameForge-Studio-0.8.0-Windows-x64-Setup.exe)**

[Página da prévia e checksum SHA-256](https://github.com/venomtids/GameForge/releases/tag/studio-v0.8.0). Instalador publicado: **103.732.242 bytes (~104 MB)**.

SHA-256 do `.exe` confirmado nos metadados da release:

```text
54cf511620fa007d542c34145d10616f3a97fab5ee0dc491e5a174f100cdd382
```

Alternativa: [pacote ZIP da compilação validada](https://github.com/venomtids/GameForge/actions/runs/36748313262/artifacts/11113203349). Este ZIP contém o `.exe`, `SHA256SUMS.txt` e instruções; requer login GitHub e tem retenção de 30 dias.

### Instalar

1. Salve backups dos projetos e feche versões anteriores da engine.
2. Execute o instalador em **Windows 10/11 x64 (Intel/AMD)**.
3. Escolha a pasta e abra o atalho GameForge Studio.
4. Comece em **Projetos → Ilha Aurora** ou **Motion Lab**.

O usuário final **não precisa de Node.js ou Python**. Recomendação: 4 GB de RAM, WebGL2/aceleração gráfica e 600 MB livres. O instalador é **não assinado**; confira a origem e o SHA-256, sem desativar o antivírus.

## Código e guia

- [Código aprimorado na branch de trabalho](https://github.com/venomtids/GameForge/tree/arena/01a0f29f-gameforge)
- [Baixar fontes em ZIP pelo GitHub](https://github.com/venomtids/GameForge/archive/refs/heads/arena/01a0f29f-gameforge.zip)
- [Guia de uso](docs/GUIA-STUDIO-0.8.md)
- [Detalhes e comandos para recompilar](README.md)
- [Validações e limites](VALIDACAO.md)

## O que foi acrescentado

- Painéis responsivos, redimensionáveis/recolhíveis e gavetas para telas estreitas.
- Qualidade gráfica automática e controles de toque no editor/player.
- Seleção múltipla, copiar/colar, agrupar, alinhar, distribuir e histórico limitado.
- Timeline de keyframes com prévia, interpolação, loops e reprodução offline.
- Biblioteca de projetos/versões com backup antes da restauração.
- CodeMirror sob demanda, rascunhos de sessão e diagnósticos Lua/JavaScript.
- Electron com menus, IPC isolado, arquivos, autosave atômico e `.bak`.

Preservados: editor 3D, física, terreno, personagens, prefabs, Pixel Studio, UI, luzes, sombras, áudio e jogos da base original.

## Resultado dos testes

**94/94 testes automatizados**, typecheck e build passaram. Testados os fluxos do Studio em viewports de **320–1920 px**, regressões 0.7, limites dos scripts e HTML independente rodando por `file://` com a rede desligada.

No Windows CI, o NSIS foi instalado e o **executável instalado** passou por testes de abertura, salvamento/backup/UTF-8, exportação, IPC, animação, Worker JavaScript e flush de autosave. [Execução final com publicação](https://github.com/venomtids/GameForge/actions/runs/36749138083).

Esta é uma prévia independente: **não é Roblox**, não executa Luau, não importa seus formatos e não oferece multiplayer/nuvem. Os testes Windows ocorreram em VM, não em todo hardware; a sandbox de scripts não foi auditada. Faça backups e permita somente código de confiança.
