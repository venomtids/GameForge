> Relatório histórico da base fornecida; não certifica a versão 0.8.

# Validação da entrega — GameForge Studio 0.2

Validação realizada no ambiente Linux desta entrega, em 22/09/2026.

## Resultado

| Verificação | Resultado |
|---|---|
| TypeScript estrito (`npm run typecheck`) | Aprovado |
| Build do runtime HTML e editor (`npm run build`) | Aprovado |
| Testes de núcleo (`npm test`) | 10 testes aprovados |
| Fluxos no Chromium (`npm run test:e2e`) | Aprovados |
| Smoke test Electron, build de produção | Aprovado em Linux/Xvfb |
| `npm audit` no lockfile entregue | 0 vulnerabilidades reportadas |

O audit é um retrato da base de advisories no momento da execução; não é garantia de ausência de vulnerabilidades.

## Núcleo coberto

- Salvar/abrir sem alteração do projeto de exemplo.
- Rejeitar JSON malformado, versão desconhecida e IDs repetidos.
- Rejeitar escalas inválidas, gravidade inválida, campos ausentes e cores fora do formato.
- Rejeitar ciclos e pais inexistentes.
- Migrar o JSON da versão original.
- Duplicar hierarquia remapeando pais/filhos.
- Desfazer/refazer, invalidar o futuro e limitar o histórico.
- Queda de corpo dinâmico, contato com chão e restauração do estado de edição.
- Movimento do jogador e coleta sem duplicação de pontuação.
- Exclusão de nós invisíveis do mundo físico.

## Fluxos reais no navegador

- Carregar e renderizar um canvas WebGL.
- Selecionar na árvore, editar coordenada, desfazer e refazer.
- Duplicar/excluir nó, adicionar uma esfera e removê-la.
- Executar, movimentar, pausar e parar a cena.
- Baixar JSON, rejeitar importação inválida sem perder a cena, reabrir projeto válido.
- Exportar HTML e abri-lo por `file://`, renderizando a cena sem servidor.
- Iniciar, pausar e reiniciar cada um dos quatro jogos originais.
- Abrir o xadrez, alternar para gravidade e mundo voxel.
- Trocar o modo voxel para criativo, colocar e remover blocos por clique no canvas.
- Alterar distância voxel e retornar ao xadrez.
- Retornar ao editor preservando o projeto.
- Verificar ausência de overflow horizontal em viewport de 390 pixels.
- Nenhum erro JavaScript não tratado observado nesses fluxos.

## Desktop

Teste automatizado do app Electron carregando `dist/index.html`, e não o servidor de desenvolvimento:

- Carregamento da UI e canvas.
- API limitada do preload disponível.
- `window.require` não exposto.
- Salvar projeto no sistema de arquivos por IPC.
- Abrir o projeto salvo por IPC.
- Ler o runtime local e exportar HTML por IPC.

Os seletores de caminho dos diálogos foram simulados pelo teste, mas a leitura/escrita em disco foi real. Bibliotecas de sistema e Xvfb foram instalados no ambiente de teste. O Node do host web era 20.20.2; o download do Electron foi executado com Node 24. Para uso local, siga o requisito entregue: **Node 24 LTS recomendado, mínimo 22.12**.

## Não verificado / limites

- Não foi testada a execução em Windows real/macOS; não há assinatura digital ou auto-update. Veja o complemento sobre o instalador Windows produzido depois.
- Não há teste exaustivo de todas as jogadas de xadrez, condições de vitória ou combinações de física.
- Não há benchmark de GPU real: o Chromium do ambiente utiliza renderização de software.
- Não há garantia de 60 FPS; “60 Hz” se refere ao passo fixo da simulação.
- Não foi feita auditoria de segurança independente.
- Importação de modelos, scripting geral, editor 2D, animação esquelética, rede e exportação de jogos nativos não estão implementados.

Consulte README.md e ROADMAP.md antes de usar a engine em produção.

## Complemento: instalador Windows pronto

Foi gerado `GameForge-Studio-0.2.0-Windows-x64-Setup.exe` com Electron 44.4.3 e NSIS, sem assinatura digital. A instalação via Wine 10 retornou 0, criou atalhos e preservou o hash do app.asar. A desinstalação foi verificada. O app.asar passou nos testes desktop usando o Electron Linux. Isso não substitui a validação do runtime em Windows real, ainda pendente. O usuário final não precisa instalar Node.js ou Python.
