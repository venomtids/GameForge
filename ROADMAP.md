# Roteiro após o Studio 0.8

A engine entregue é local e independente, não uma réplica da plataforma Roblox. A fonte 0.7 foi preservada; o roteiro anterior está em `docs/archive/ROADMAP-original.md`.

## Implementado nesta atualização

- Workspace adaptável, painéis redimensionáveis/recolhíveis, atalhos e paleta.
- Seleção múltipla e operações em lote transacionais.
- Projetos IndexedDB, versões e recuperação antes de restaurar.
- Timeline TRS, interpolação, loops, prévia e colisores cinemáticos.
- Qualidade adaptativa e controles de toque compartilhados com o player.
- Electron com IPC estreito, menu, arquivos, backups e autosave atômico.
- Pipeline Windows/NSIS e smoke test nativo de produção.

## Próximas etapas (não implementadas)

1. **Recursos:** glTF/GLB, importação de imagem/áudio, referências portáteis e prefabs instanciáveis.
2. **Animação:** esqueleto, skinning, IK, curvas por componente, animação de colisores e conflitos com scripts.
3. **Física:** CCD, depurador de contato e orçamento de corpos dinâmicos por dispositivo.
4. **Editor:** decompor árvore/inspetor, virtualizar cenas grandes, criar plugins e editor 2D dedicado.
5. **Segurança:** auditar sandbox, restringir capacidades de scripts e testar perda de contexto gráfico.
6. **Distribuição:** assinatura digital, teste manual de instalação/upgrade em Windows real e atualização confiável.
7. **Rede:** desenhar servidor autoritativo, sincronização, colaboração, hospedagem e privacidade antes de prometer multiplayer.
8. **Qualidade:** medições de memória/FPS em GPU integrada/celular físico e testes prolongados de edição/execução.

Não se deve anunciar uma dessas etapas como pronta só porque há um plano ou interface inicial.
