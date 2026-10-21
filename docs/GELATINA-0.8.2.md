# Gelatina 0.8.2 — mais mole, mais movimento e mais reação

Atualização de 06/10/2026. A referência fornecida foi realmente inspecionada: [Roundy / Jelly-Mesh-System](https://github.com/roundyyy/Jelly-Mesh-System), commit `730062288016c211c773610cf4a11bfe947ef0fa`. Foram lidos o `Runtime/JellyMeshSystem.cs`, o manual e as licenças MIT da raiz e do pacote.

## O que foi adaptado

| Recurso da referência Unity | Implementação nesta engine |
| --- | --- |
| Mola e velocidade por vértice (`JellyMeshVertexJob`) | `JellyMesh.ts`: buffers persistentes, integração implícita, limite de deslocamento e recuperação. Não é apenas squash animado. |
| Resposta à translação e à rotação | Histórico da posição mundial de cada vértice-alvo. Mudanças de velocidade excitam as molas, incluindo o movimento das articulações. |
| Intensidade, massa, rigidez e amortecimento | Massa do nó, novos controles de intensidade/reação e presets; rigidez mínima 5 e amortecimento mínimo 0,1. As unidades não são idênticas às do Unity. |
| Pivô customizado e influência por distância | Pivô editável em X/Y/Z, falloff e atualização em runtime. Partes articuladas mantêm a tampa ligada à sua junta. |
| Manter raio em torno do pivô | Recuperação radial com força ajustável, além da recuperação de volume/limites já existentes na gaiola física. |
| LOD por distância, performance e invisibilidade | Menos atualizações de detalhe/normais à distância; malha oculta em primeira pessoa não processa detalhe. Reentrada não herda velocidade antiga. |
| Aplicação em malhas diferentes | A gaiola preserva a topologia da geometria de origem. Uma esfera não vira mais uma caixa gelatinosa. |
| Atualização de MeshCollider | **Não transplantada como colisor deformável exato.** O jogador continua com seu controlador sólido; as plataformas usam apoio plano cinemático e os corpos livres, a gaiola física. |
| Jobs/Burst e SkinnedMeshRenderer | **Não são dependências desta engine web.** O algoritmo foi adaptado para Three.js/Cannon e a hierarquia articulada própria. O próprio upstream marca seu SkinnedMeshRenderer como experimental. |

A fórmula de força da referência usa deslocamento multiplicado pelo passo. Aqui a excitação usa mudança de velocidade, e não aquela expressão literalmente, evitando uma resposta que varie com a frequência do solver. A integração das molas é implícita; buffers de vértices coincidentes são compartilhados para reduzir trabalho e não abrir costuras.

## Movimento e impactos

- O jogador usa molas menos rígidas e menos amortecimento: aceleração, parada, mudança de direção, salto e aterrissagem causam oscilação secundária.
- Squash/stretch agora pode ir de **0,70 a 1,25**. A compensação de largura preserva volume aproximado; o colisor não muda de escala.
- As nove juntas continuam conectadas. Limites angulares específicos protegem joelhos/pés; as tampas das partes ficam presas à sua junta.
- As plataformas transferem carga e cisalhamento para os quatro pontos superiores. Colisões também excitam impulsos locais na superfície, com falloff espacial e cooldown.
- O corpo da plataforma pode balançar e expandir lateralmente, mas a área plana do topo acompanha o suporte físico. As ondas não podem atravessar nem suspender os pés do jogador.
- O preset macio demora mais a assentar depois da retirada do peso; a regressão verifica recuperação após várias oscilações, em vez de exigir o antigo assentamento rígido em três segundos.

## Usar no Studio

1. **Projetos → Jelly Jump → F5**. WASD/setas movem, Espaço pula, Shift corre e R retorna ao checkpoint.
2. Na Toolbox, busque **gelatina** e insira um jogador, plataforma ou corpo livre.
3. Em **Personagem, bot & física**, escolha **Muito mole**, **Macia** ou **Firme**.
4. Ajuste **Intensidade da gelatina**, **Reação ao movimento**, **Distribuição pelo pivô**, **Preservação do raio** e **Pivô X/Y/Z**.
5. O pivô usa unidades normalizadas de meia-extensão da malha: `0` é o pivô original/da junta; `1` desloca uma meia-extensão. Não é um objeto Unity/Transform importado.
6. LOD próximo/distante e **Economia da malha** alteram só o detalhe visual, não a física nem os comandos do jogador.

Exemplo JavaScript em runtime (use o ID de um nó de gelatina):

```js
engine.set(id, {
  deform: {
    stiffness: 42,
    damping: 1.4,
    intensity: 1.8,
    movementInfluence: 1.45,
    pivot: [0, 1, 0],
    radiusConstraint: 0.2,
  },
});
```

Esse patch é validado; não pode mudar implicitamente o tipo do rig. Projetos antigos schema7 sem os novos campos continuam abrindo. Arrays de pivô são copiados, não compartilhados entre nós.

## Estabilidade e responsividade

- Física/controlador/juntas: passo mínimo de **120 Hz** para rigs elásticos.
- Detalhe próximo: até **60 Hz**; plataformas distantes reduzem progressivamente até 15 Hz. Normais têm orçamento separado. O jogador principal não perde detalhe por distância.
- Vértices únicos, arrays persistentes e matrizes reaproveitadas evitam duplicação do trabalho por face. Membros pequenos conservam tesselação leve; plataformas têm mais subdivisões.
- Culling visual nunca remove corpos, molas ou contatos.
- Deslocamento da malha limitado a 30% da menor extensão, com limites de velocidade e recuperação de valores não finitos.
- A remoção do offset elástico anterior, o grounding relativo ao suporte e `depthWrite: true` da correção de salto foram preservados. Uma guarda adicional conserva os pés acima da base do controlador, sem acumular translação.
- Exportação HTML continua independente/offline, com controles de toque e as mesmas fórmulas.

## Validação local

**121 testes unitários**, typecheck/build e suites de navegador de gelatina/Studio 0.6/0.8. Cobertura adicional:

- mole versus firme, excitação translacional/rotacional, impulso localizado e recuperação;
- raio, pivô, costuras, massa/limites extremos, desligamento por intensidade zero;
- LOD/invisibilidade e retorno sem impulso de movimento antigo;
- topologia da esfera e colisões ativas mesmo sem detalhe;
- presets/pivô em runtime e persistência dos novos controles no inspector;
- compressão do personagem, pés protegidos e topo visual alinhado ao colisor;
- saltos/boosts repetidos sem deriva; percurso completo real a 30/60/144 cadências, sem teleporte nem mortes;
- downloads JSON/HTML, execução `file://`, toque a 390 px e workspace de 320–1920 px.

Na sonda determinística de mudança brusca de matriz da malha unitária, os picos foram **0,300 m (muito mole)** e **0,02255 m (firme)**. No salto/aterrissagem do personagem, a variação de escala foi **0,300** contra **0,07289**. São comparações de presets nas condições do teste, não uma promessa de multiplicador universal de maciez nem benchmark de FPS em todo aparelho.

## Licença e limites

A atribuição e ambas as licenças MIT estão em `licenses/Jelly-Mesh-System-MIT.txt` e `THIRD-PARTY-NOTICES.txt`. O HTML exportado também incorpora o aviso. Nenhum asset/modelo dos GIFs, biblioteca Unity ou DLL de Jobs/Burst foi copiado.

Continuam os limites de 12 rigs ativos, colisão aproximada dos corpos livres, apoio plano nas plataformas e controlador híbrido sem colisor de cada membro. Isto não é líquido, FEM volumétrico, colisão exata por triângulo da malha deformada ou CCD. A documentação não afirma que todos os recursos Unity foram executados nativamente no navegador.

O instalador **0.8.2 foi gerado, instalado, validado e publicado**. O [Windows CI](https://github.com/venomtids/GameForge/actions/runs/37466047048) passou (3m08s), incluindo teste do executável instalado/IPC/salvamento/exportação. [Download Windows x64](https://github.com/venomtids/GameForge/releases/download/studio-v0.8.2/GameForge-Studio-0.8.2-Windows-x64-Setup.exe) e [release/checksum](https://github.com/venomtids/GameForge/releases/tag/studio-v0.8.2). São 103.753.986 bytes, SHA-256 `598f6cb27b00190fb8a7f64687ed686bffc404ddf359f6a31d606272632c819d`. A prévia não tem assinatura digital; confira a origem e o hash, sem desativar o antivírus.
