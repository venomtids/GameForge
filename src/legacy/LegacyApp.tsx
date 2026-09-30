import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type TabKey = "jogos" | "studio" | "testes";
type ObjectKind = "cubo" | "esfera" | "cone";
type GameStatus = "idle" | "running" | "paused" | "won" | "lost";
type DifficultyKey = "facil" | "normal" | "dificil";
type GameKey = "coleta" | "sobrevivencia" | "checkpoint" | "dueloia";

type SceneMode = "game" | "studio" | "chess" | "gravity" | "minecraft";
type ChessColor = "white" | "black";
type ChessPieceType = "pawn" | "rook" | "knight" | "bishop" | "queen" | "king";
type BlockType = "grama" | "terra" | "pedra" | "madeira" | "areia";

type SceneObject = {
  id: string;
  kind: ObjectKind;
  name: string;
  color: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationSpeed: number;
  rigidBody: boolean;
  scriptMode: "none" | "orbitar" | "pulsar";
};

type EnemyActor = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
};

type ChessPieceState = {
  id: string;
  type: ChessPieceType;
  color: ChessColor;
  x: number;
  z: number;
  mesh: THREE.Group;
};

type ChessMove = {
  piece: ChessPieceState;
  x: number;
  z: number;
  capture: boolean;
  score: number;
};

type SimChessPiece = {
  id: string;
  type: ChessPieceType;
  color: ChessColor;
  x: number;
  z: number;
};

type GravityBody = {
  mesh: THREE.Mesh;
  vy: number;
  vx: number;
  vz: number;
  spin: number;
  bounce: number;
  drag: number;
  floorLevel: number;
  friction: number;
  radius: number;
  kind: "grain" | "object";
};

type DuelAgent = {
  mesh: THREE.Mesh;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  learning: number;
  cooldown: number;
  abilityTimer: number;
  wins: number;
  ability: "dash" | "shield";
};

type GameDefinition = {
  name: string;
  description: string;
  baseTime: number;
  baseLives: number;
  baseEnemies: number;
  baseOrbs: number;
};

type DifficultyDefinition = {
  playerSpeed: number;
  enemySpeed: number;
  enemyMultiplier: number;
  timeMultiplier: number;
};

const templates: Record<string, string> = {
  plataforma: `// Plataforma 3D\nexport function iniciarJogo(engine) {\n  engine.criarPersonagem({ nome: "Runner", velocidade: 8, pulo: 12 });\n  engine.criarPlataforma({ tamanho: [40, 2, 40], posicao: [0, -2, 0] });\n  engine.criarCheckpoint([6, 1, -8]);\n}\n\nexport function atualizarJogo(delta, estado) {\n  if (estado.input.pular) estado.jogador.pular();\n  estado.camera.seguir(estado.jogador, { distancia: 9, altura: 4 });\n}`,
  corrida: `// Corrida 3D\nexport function iniciarPista(engine) {\n  engine.criarCarro({ modelo: "GT", tracao: "AWD", velocidadeMaxima: 300 });\n  engine.criarPista({ voltas: 3, largura: 18, checkpoints: 12 });\n}\n\nexport function atualizarFisica(delta, estado) {\n  estado.carro.aplicarAceleracao(estado.input.acelerador * delta * 130);\n  estado.carro.aplicarDirecao(estado.input.direcao * delta * 2.3);\n}`,
  shooter: `// Shooter 3D\nexport function iniciarCombate(engine) {\n  engine.criarJogador({ vida: 100, armaInicial: "blaster" });\n  engine.criarSpawners([{ posicao: [10, 0, 8] }, { posicao: [-10, 0, -6] }]);\n}\n\nexport function atualizarCombate(delta, estado) {\n  if (estado.input.atirar) estado.jogador.atirar();\n  estado.ia.atualizarInimigos(delta, estado.jogador.posicao);\n}`,
};

const gameDefinitions: Record<GameKey, GameDefinition> = {
  coleta: {
    name: "Arena de Coleta",
    description: "Colete todos os orbs antes do tempo acabar e evite drones.",
    baseTime: 55,
    baseLives: 3,
    baseEnemies: 3,
    baseOrbs: 12,
  },
  sobrevivencia: {
    name: "Sobrevivencia",
    description: "Nao colete nada: apenas sobreviva ate o cronometro zerar.",
    baseTime: 40,
    baseLives: 2,
    baseEnemies: 5,
    baseOrbs: 0,
  },
  checkpoint: {
    name: "Corrida de Checkpoints",
    description: "Passe por todos os aneis em sequencia antes do tempo acabar.",
    baseTime: 50,
    baseLives: 3,
    baseEnemies: 2,
    baseOrbs: 0,
  },
  dueloia: {
    name: "Versus IA 1v1",
    description:
      "Dois objetos com habilidades proprias evoluem por aprendizado calculado.",
    baseTime: 60,
    baseLives: 1,
    baseEnemies: 0,
    baseOrbs: 0,
  },
};

const difficultyDefinitions: Record<DifficultyKey, DifficultyDefinition> = {
  facil: {
    playerSpeed: 6.1,
    enemySpeed: 2.2,
    enemyMultiplier: 0.8,
    timeMultiplier: 1.2,
  },
  normal: {
    playerSpeed: 5.4,
    enemySpeed: 3.1,
    enemyMultiplier: 1,
    timeMultiplier: 1,
  },
  dificil: {
    playerSpeed: 5,
    enemySpeed: 4,
    enemyMultiplier: 1.25,
    timeMultiplier: 0.85,
  },
};

function disposeObject(root: THREE.Object3D) {
  root.traverse((node: THREE.Object3D) => {
    if (node instanceof THREE.Mesh) {
      if (node instanceof THREE.InstancedMesh) node.dispose();
      node.geometry.dispose();
      if (Array.isArray(node.material)) {
        node.material.forEach((material: THREE.Material) => material.dispose());
      } else {
        node.material.dispose();
      }
    }
  });
}

function randomArenaPosition() {
  return (Math.random() - 0.5) * 20;
}

function chessSquareKey(x: number, z: number) {
  return `${x},${z}`;
}

function isInsideBoard(x: number, z: number) {
  return x >= 0 && x < 8 && z >= 0 && z < 8;
}

function squareToNotation(x: number, z: number) {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  return `${files[x]}${z + 1}`;
}

function voxelKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

function createChessPiece(color: "white" | "black", kind: ChessPieceType) {
  const primary = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color === "white" ? "#f1f5f9" : "#0f172a"),
    roughness: 0.38,
    metalness: 0.25,
  });

  const accent = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color === "white" ? "#cbd5e1" : "#334155"),
    roughness: 0.5,
    metalness: 0.18,
  });

  const group = new THREE.Group();
  const add = (mesh: THREE.Mesh, y: number) => {
    mesh.position.y = y;
    group.add(mesh);
  };

  add(
    new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.1, 30), accent),
    0.05,
  );
  add(
    new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.4, 0.14, 30), primary),
    0.15,
  );
  add(
    new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.03, 10, 40), accent),
    0.23,
  );

  if (kind === "pawn") {
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.45, 24), primary),
      0.48,
    );
    add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 20), accent), 0.8);
  }

  if (kind === "rook") {
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.5, 24), primary),
      0.5,
    );
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.2, 24), accent),
      0.84,
    );
    for (let i = 0; i < 4; i += 1) {
      const crenel = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.1, 0.09),
        primary,
      );
      const angle = (i / 4) * Math.PI * 2;
      crenel.position.set(Math.cos(angle) * 0.18, 0.95, Math.sin(angle) * 0.18);
      group.add(crenel);
    }
  }

  if (kind === "knight") {
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.45, 22), primary),
      0.48,
    );
    const neck = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.1, 0.28, 6, 12),
      accent,
    );
    neck.position.set(0.03, 0.79, 0.03);
    neck.rotation.z = -0.55;
    group.add(neck);
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.34, 18),
      primary,
    );
    head.position.set(0.08, 0.95, 0.02);
    head.rotation.z = -0.65;
    group.add(head);
  }

  if (kind === "bishop") {
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.52, 24), primary),
      0.52,
    );
    add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 20), accent), 0.9);
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.16, 0.01),
      primary,
    );
    slit.position.set(0.02, 0.9, 0.14);
    slit.rotation.y = Math.PI / 8;
    group.add(slit);
  }

  if (kind === "queen") {
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.6, 26), primary),
      0.56,
    );
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 24), accent),
      0.95,
    );
    for (let i = 0; i < 6; i += 1) {
      const spike = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 12),
        primary,
      );
      const angle = (i / 6) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.17, 1.03, Math.sin(angle) * 0.17);
      group.add(spike);
    }
    add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), accent), 1.08);
  }

  if (kind === "king") {
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.62, 26), primary),
      0.58,
    );
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.17, 24), accent),
      0.98,
    );
    const crossVertical = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.22, 0.05),
      primary,
    );
    crossVertical.position.set(0, 1.1, 0);
    group.add(crossVertical);
    const crossHorizontal = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.045, 0.045),
      accent,
    );
    crossHorizontal.position.set(0, 1.1, 0);
    group.add(crossHorizontal);
  }

  return group;
}

export default function LegacyApp({
  initialTab = "jogos",
}: {
  initialTab?: "jogos" | "testes";
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const editorGroupRef = useRef<THREE.Group | null>(null);
  const gameGroupRef = useRef<THREE.Group | null>(null);
  const chessGroupRef = useRef<THREE.Group | null>(null);
  const gravityGroupRef = useRef<THREE.Group | null>(null);
  const voxelGroupRef = useRef<THREE.Group | null>(null);
  const gravityBodiesRef = useRef<GravityBody[]>([]);
  const voxelMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const selectedBlockRef = useRef<BlockType>("grama");
  const chessBoardRef = useRef<Map<string, ChessPieceState>>(new Map());
  const chessTilesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const selectedChessPieceRef = useRef<ChessPieceState | null>(null);
  const legalChessMovesRef = useRef<string[]>([]);
  const chessTurnRef = useRef<ChessColor>("white");
  const chessWinnerRef = useRef<ChessColor | null>(null);
  const chessBotTimerRef = useRef<number | null>(null);
  const chessVsBotRef = useRef(true);
  const botThinkingRef = useRef(false);
  const studioPlayRef = useRef(false);
  const sceneObjectsRef = useRef<SceneObject[]>([]);
  const studioMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const studioRuntimeRef = useRef<
    Map<string, { vy: number; baseX: number; baseY: number; baseZ: number }>
  >(new Map());
  const minecraftViewRef = useRef<"orbital" | "fps">("orbital");
  const minecraftPlayerPosRef = useRef(new THREE.Vector3(16, 10, 16));
  const minecraftVelYRef = useRef(0);
  const minecraftOnGroundRef = useRef(false);
  const minecraftYawRef = useRef(-Math.PI * 0.75);
  const minecraftPitchRef = useRef(-0.2);
  const minecraftPointerLockedRef = useRef(false);
  const minecraftLastChunkRef = useRef<{ x: number; z: number } | null>(null);
  const minecraftOverridesRef = useRef<Map<string, BlockType | null>>(
    new Map(),
  );

  const playerRef = useRef<THREE.Mesh | null>(null);
  const orbsRef = useRef<THREE.Mesh[]>([]);
  const checkpointsRef = useRef<THREE.Mesh[]>([]);
  const enemiesRef = useRef<EnemyActor[]>([]);
  const duelAgentsRef = useRef<{ alpha: DuelAgent; beta: DuelAgent } | null>(
    null,
  );
  const duelAttackClockRef = useRef(0);

  const rotationMapRef = useRef<Map<string, number>>(new Map());
  const keyMapRef = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    space: false,
  });
  const sceneModeRef = useRef<SceneMode>("game");
  const orbitRef = useRef(0);
  const invulnerableUntilRef = useRef(0);
  const previousSecondRef = useRef(0);
  const nextCheckpointIndexRef = useRef(0);

  const gameStatusRef = useRef<GameStatus>("idle");
  const currentGameRef = useRef<GameKey>("coleta");
  const currentDifficultyRef = useRef<DifficultyKey>("normal");
  const timeLeftRef = useRef(0);
  const livesRef = useRef(0);
  const scoreRef = useRef(0);
  const objectiveLeftRef = useRef(0);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [template, setTemplate] =
    useState<keyof typeof templates>("plataforma");
  const [script, setScript] = useState(templates.plataforma);

  const [selectedGame, setSelectedGame] = useState<GameKey>("coleta");
  const [difficulty, setDifficulty] = useState<DifficultyKey>("normal");
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [objectiveLeft, setObjectiveLeft] = useState(0);
  const [duelRound, setDuelRound] = useState(1);
  const [duelAlphaHp, setDuelAlphaHp] = useState(0);
  const [duelBetaHp, setDuelBetaHp] = useState(0);
  const [duelAlphaWins, setDuelAlphaWins] = useState(0);
  const [duelBetaWins, setDuelBetaWins] = useState(0);
  const [duelLog, setDuelLog] = useState("Aguardando rodada de IA.");
  const [chessTurn, setChessTurn] = useState<ChessColor>("white");
  const [chessStatus, setChessStatus] = useState(
    "Clique em uma peca branca para iniciar.",
  );
  const [chessVsBot, setChessVsBot] = useState(true);
  const [botThinking, setBotThinking] = useState(false);
  const [activeTest, setActiveTest] = useState<
    "chess" | "gravity" | "minecraft"
  >("chess");
  const [gravityInfo, setGravityInfo] = useState("Sem simulacao ativa.");
  const [minecraftInfo, setMinecraftInfo] = useState(
    "Mundo pronto para construir.",
  );
  const [selectedBlock, setSelectedBlock] = useState<BlockType>("grama");
  const [voxelCount, setVoxelCount] = useState(0);
  const [minecraftView, setMinecraftView] = useState<"orbital" | "fps">(
    "orbital",
  );
  const [minecraftLocked, setMinecraftLocked] = useState(false);
  const [minecraftMode, setMinecraftMode] = useState<"survival" | "creative">(
    "survival",
  );
  const [minecraftRenderDistance, setMinecraftRenderDistance] = useState(1);
  const minecraftModeRef = useRef(minecraftMode);
  const minecraftDistanceRef = useRef(minecraftRenderDistance);
  minecraftModeRef.current = minecraftMode;
  minecraftDistanceRef.current = minecraftRenderDistance;
  const [studioPlay, setStudioPlay] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [engineNotice, setEngineNotice] = useState(
    "Engine pronto: SceneTree + Inspector + Play Mode",
  );

  useEffect(() => {
    botThinkingRef.current = botThinking;
  }, [botThinking]);

  useEffect(() => {
    chessVsBotRef.current = chessVsBot;
  }, [chessVsBot]);

  useEffect(() => {
    studioPlayRef.current = studioPlay;
  }, [studioPlay]);

  useEffect(() => {
    minecraftViewRef.current = minecraftView;
  }, [minecraftView]);

  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);

  useEffect(() => {
    if (tab !== "testes" || activeTest !== "minecraft") return;
    const chunkX = Math.floor(minecraftPlayerPosRef.current.x / 16);
    const chunkZ = Math.floor(minecraftPlayerPosRef.current.z / 16);
    rebuildMinecraftRegion(chunkX, chunkZ, false);
    setMinecraftInfo(
      `Distancia de render: ${minecraftRenderDistance} chunk(s).`,
    );
  }, [minecraftRenderDistance, tab, activeTest]);

  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([
    {
      id: "obj-a",
      name: "PlayerBlock",
      kind: "cubo",
      color: "#60a5fa",
      x: -2.5,
      y: 0.6,
      z: -1.2,
      scale: 1.2,
      rotationSpeed: 0.011,
      rigidBody: false,
      scriptMode: "none",
    },
    {
      id: "obj-b",
      name: "EnergyOrb",
      kind: "esfera",
      color: "#f97316",
      x: 1.5,
      y: 0.7,
      z: 1.6,
      scale: 1,
      rotationSpeed: 0.017,
      rigidBody: false,
      scriptMode: "pulsar",
    },
  ]);

  const [form, setForm] = useState<Omit<SceneObject, "id">>({
    name: "NovoNode",
    kind: "cubo",
    color: "#22c55e",
    x: 0,
    y: 0.6,
    z: 0,
    scale: 1,
    rotationSpeed: 0.02,
    rigidBody: false,
    scriptMode: "none",
  });

  useEffect(() => {
    sceneObjectsRef.current = sceneObjects;
  }, [sceneObjects]);

  const studioStats = useMemo(() => {
    const total = sceneObjects.length;
    const averageRotation =
      total === 0
        ? 0
        : sceneObjects.reduce((acc, object) => acc + object.rotationSpeed, 0) /
          total;
    return { total, averageRotation };
  }, [sceneObjects]);

  const syncStatus = (status: GameStatus) => {
    gameStatusRef.current = status;
    setGameStatus(status);
  };

  const clearGroupChildren = (group: THREE.Group | null) => {
    if (!group) return;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      disposeObject(child);
    }
  };

  const clearGameEntities = () => {
    clearGroupChildren(gameGroupRef.current);
    playerRef.current = null;
    orbsRef.current = [];
    checkpointsRef.current = [];
    enemiesRef.current = [];
    duelAgentsRef.current = null;
    duelAttackClockRef.current = 0;
    nextCheckpointIndexRef.current = 0;
  };

  const updateSceneVisibility = (mode: SceneMode) => {
    if (editorGroupRef.current)
      editorGroupRef.current.visible = mode === "studio";
    if (gameGroupRef.current) gameGroupRef.current.visible = mode === "game";
    if (chessGroupRef.current) chessGroupRef.current.visible = mode === "chess";
    if (gravityGroupRef.current)
      gravityGroupRef.current.visible = mode === "gravity";
    if (voxelGroupRef.current)
      voxelGroupRef.current.visible = mode === "minecraft";
  };

  const clearGravityTest = () => {
    clearGroupChildren(gravityGroupRef.current);
    gravityBodiesRef.current = [];
    setGravityInfo("Sem simulacao ativa.");
  };

  const clearMinecraftTest = () => {
    clearGroupChildren(voxelGroupRef.current);
    voxelMapRef.current.forEach((mesh) => disposeObject(mesh));
    voxelMapRef.current.clear();
    minecraftLastChunkRef.current = null;
    setVoxelCount(0);
    setMinecraftInfo("Mundo limpo.");
  };

  const rebuildMinecraftRegion = (
    centerChunkX: number,
    centerChunkZ: number,
    resetWorld: boolean,
  ) => {
    if (!voxelGroupRef.current) return;
    if (resetWorld) {
      minecraftOverridesRef.current.clear();
      clearMinecraftTest();
    } else {
      clearGroupChildren(voxelGroupRef.current);
      voxelMapRef.current.forEach((mesh) => disposeObject(mesh));
      voxelMapRef.current.clear();
    }

    const chunkSize = 16;
    const waterLevel = 5;
    const minX = (centerChunkX - minecraftDistanceRef.current) * chunkSize;
    const maxX = (centerChunkX + minecraftDistanceRef.current + 1) * chunkSize;
    const minZ = (centerChunkZ - minecraftDistanceRef.current) * chunkSize;
    const maxZ = (centerChunkZ + minecraftDistanceRef.current + 1) * chunkSize;

    for (let x = minX; x < maxX; x += 1) {
      for (let z = minZ; z < maxZ; z += 1) {
        const baseHeight = terrainHeightAt(x, z);
        const lowestNeighbor = Math.min(
          baseHeight - 1,
          terrainHeightAt(x - 1, z),
          terrainHeightAt(x + 1, z),
          terrainHeightAt(x, z - 1),
          terrainHeightAt(x, z + 1),
        );
        for (let y = Math.max(0, lowestNeighbor - 1); y < baseHeight; y += 1) {
          const top = y === baseHeight - 1;
          const type: BlockType = top
            ? "grama"
            : y >= baseHeight - 3
              ? "terra"
              : "pedra";
          addVoxelBlock(x, y, z, type, false);
        }

        if (baseHeight < waterLevel) {
          for (let y = baseHeight; y <= waterLevel; y += 1) {
            addVoxelBlock(x, y, z, "areia", false);
          }
        }

        if (
          Math.sin(x * 12.9898 + z * 78.233) > 0.985 &&
          baseHeight > waterLevel + 1
        ) {
          addVoxelBlock(x, baseHeight, z, "madeira", false);
          addVoxelBlock(x, baseHeight + 1, z, "madeira", false);
          addVoxelBlock(x, baseHeight + 2, z, "madeira", false);
          for (let lx = -2; lx <= 2; lx += 1) {
            for (let lz = -2; lz <= 2; lz += 1) {
              const dist = Math.abs(lx) + Math.abs(lz);
              if (dist <= 3)
                addVoxelBlock(x + lx, baseHeight + 3, z + lz, "grama", false);
            }
          }
        }
      }
    }

    minecraftOverridesRef.current.forEach((type, key) => {
      const [sx, sy, sz] = key.split(",").map(Number);
      if (sx < minX || sx >= maxX || sz < minZ || sz >= maxZ) return;
      if (type === null) {
        removeVoxelBlock(sx, sy, sz, false);
        for (const [dx, dy, dz] of [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
          [0, 0, 1],
          [0, 0, -1],
        ]) {
          const x = sx + dx,
            y = sy + dy,
            z = sz + dz,
            h = terrainHeightAt(x, z);
          const override = minecraftOverridesRef.current.get(voxelKey(x, y, z));
          if (
            y >= 0 &&
            y < h &&
            override !== null &&
            x >= minX &&
            x < maxX &&
            z >= minZ &&
            z < maxZ
          )
            addVoxelBlock(
              x,
              y,
              z,
              override ??
                (y === h - 1 ? "grama" : y >= h - 3 ? "terra" : "pedra"),
              false,
            );
        }
      } else {
        removeVoxelBlock(sx, sy, sz, false);
        addVoxelBlock(sx, sy, sz, type, false);
      }
    });

    syncVoxelInstances();
    minecraftLastChunkRef.current = { x: centerChunkX, z: centerChunkZ };
    setVoxelCount(voxelMapRef.current.size);
  };

  const blockMaterial = (type: BlockType) => {
    if (type === "grama")
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#55c65a"),
        roughness: 0.9,
        metalness: 0,
        flatShading: true,
      });
    if (type === "terra")
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#8a5c34"),
        roughness: 0.96,
        metalness: 0,
        flatShading: true,
      });
    if (type === "pedra")
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#8d96a1"),
        roughness: 0.84,
        metalness: 0.04,
        flatShading: true,
      });
    if (type === "madeira")
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#9e6b2f"),
        roughness: 0.9,
        metalness: 0,
        flatShading: true,
      });
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e6c27a"),
      roughness: 0.94,
      metalness: 0,
      flatShading: true,
    });
  };

  const terrainHeightAt = (x: number, z: number) => {
    const ridge =
      Math.sin(x * 0.085) * 4 +
      Math.cos(z * 0.07) * 3 +
      Math.sin((x + z) * 0.042) * 2;
    return Math.max(2, Math.round(7 + ridge));
  };

  const addVoxelBlock = (
    x: number,
    y: number,
    z: number,
    type: BlockType,
    updateCounter = true,
  ) => {
    if (!voxelGroupRef.current) return false;
    if (y < 0 || y > 32) return false;
    const key = voxelKey(x, y, z);
    if (voxelMapRef.current.has(key)) return false;

    const mesh = new THREE.Object3D();
    mesh.position.set(x, y + 0.5, z);
    mesh.userData.entityType = "voxel";
    mesh.userData.voxelX = x;
    mesh.userData.voxelY = y;
    mesh.userData.voxelZ = z;
    mesh.userData.voxelType = type;
    voxelMapRef.current.set(key, mesh);
    if (updateCounter) {
      syncVoxelInstances();
      setVoxelCount(voxelMapRef.current.size);
    }
    return true;
  };

  const removeVoxelBlock = (
    x: number,
    y: number,
    z: number,
    updateCounter = true,
  ) => {
    const key = voxelKey(x, y, z);
    const mesh = voxelMapRef.current.get(key);
    if (!mesh || !voxelGroupRef.current) return false;
    if (y <= 0) return false;
    disposeObject(mesh);
    voxelMapRef.current.delete(key);
    if (updateCounter) {
      syncVoxelInstances();
      setVoxelCount(voxelMapRef.current.size);
    }
    return true;
  };

  // One GPU draw call per material, instead of one per voxel. The map stores logical cells.
  const syncVoxelInstances = () => {
    const group = voxelGroupRef.current;
    if (!group) return;
    clearGroupChildren(group);
    const matrix = new THREE.Matrix4();
    for (const type of [
      "grama",
      "terra",
      "pedra",
      "madeira",
      "areia",
    ] as BlockType[]) {
      const cells = [...voxelMapRef.current.entries()].filter(
        ([, mesh]) => mesh.userData.voxelType === type,
      );
      if (!cells.length) continue;
      const batch = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        blockMaterial(type),
        cells.length,
      );
      batch.userData.voxelKeys = cells.map(([key]) => key);
      cells.forEach(([, mesh], index) => {
        matrix.makeTranslation(
          mesh.position.x,
          mesh.position.y,
          mesh.position.z,
        );
        batch.setMatrixAt(index, matrix);
      });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
      group.add(batch);
    }
  };

  const getMinecraftGroundY = (x: number, z: number) => {
    const samples: Array<[number, number]> = [
      [0, 0],
      [0.26, 0],
      [-0.26, 0],
      [0, 0.26],
      [0, -0.26],
    ];

    let highest = 0;
    samples.forEach(([sx, sz]) => {
      const cellX = Math.round(x + sx);
      const cellZ = Math.round(z + sz);
      for (let y = 0; y <= 30; y += 1) {
        if (voxelMapRef.current.has(voxelKey(cellX, y, cellZ)))
          highest = Math.max(highest, y + 1);
      }
    });

    return highest;
  };

  const enterMinecraftFps = () => {
    if (!rendererRef.current) return;
    setMinecraftView("fps");
    minecraftViewRef.current = "fps";
    setMinecraftInfo(
      "Modo primeira pessoa ativo: WASD move, clique esquerdo quebra, direito coloca.",
    );
    void rendererRef.current.domElement
      .requestPointerLock()
      ?.catch(() =>
        setMinecraftInfo(
          "Captura do mouse bloqueada. Use a câmera orbital ou abra o app desktop.",
        ),
      );
  };

  const leaveMinecraftFps = () => {
    setMinecraftView("orbital");
    minecraftViewRef.current = "orbital";
    setMinecraftLocked(false);
    setMinecraftInfo("Modo orbital ativo.");
    if (document.pointerLockElement) document.exitPointerLock();
  };

  const resetGameState = () => {
    const gameDef = gameDefinitions[currentGameRef.current];
    const diffDef = difficultyDefinitions[currentDifficultyRef.current];
    const seconds = Math.round(gameDef.baseTime * diffDef.timeMultiplier);

    clearGameEntities();
    scoreRef.current = 0;
    objectiveLeftRef.current = 0;
    timeLeftRef.current = seconds;
    livesRef.current = gameDef.baseLives;
    previousSecondRef.current = seconds;

    setScore(0);
    setObjectiveLeft(0);
    setTimeLeft(seconds);
    setLives(gameDef.baseLives);
    setDuelAlphaHp(0);
    setDuelBetaHp(0);
    setDuelLog("Aguardando rodada de IA.");
    syncStatus("idle");
  };

  const startGame = () => {
    const gameGroup = gameGroupRef.current;
    if (!gameGroup) return;

    const gameDef = gameDefinitions[currentGameRef.current];
    const diffDef = difficultyDefinitions[currentDifficultyRef.current];
    sceneModeRef.current = "game";
    updateSceneVisibility("game");

    clearGameEntities();

    if (currentGameRef.current === "dueloia") {
      const alphaMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#22d3ee"),
          roughness: 0.35,
        }),
      );
      alphaMesh.position.set(-6, 0.5, 0);

      const betaMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 24, 24),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#f97316"),
          roughness: 0.35,
        }),
      );
      betaMesh.position.set(6, 0.6, 0);

      gameGroup.add(alphaMesh);
      gameGroup.add(betaMesh);

      const alpha: DuelAgent = {
        mesh: alphaMesh,
        name: "Cubo Alpha",
        hp: 100,
        maxHp: 100,
        attack: 16,
        defense: 7,
        speed: 4.6,
        learning: 1,
        cooldown: 0,
        abilityTimer: 0,
        wins: duelAlphaWins,
        ability: "dash",
      };

      const beta: DuelAgent = {
        mesh: betaMesh,
        name: "Orb Beta",
        hp: 100,
        maxHp: 100,
        attack: 14,
        defense: 8,
        speed: 4.2,
        learning: 1,
        cooldown: 0,
        abilityTimer: 0,
        wins: duelBetaWins,
        ability: "shield",
      };

      duelAgentsRef.current = { alpha, beta };
      duelAttackClockRef.current = 0;
      scoreRef.current = 0;
      objectiveLeftRef.current = 1;
      setScore(0);
      setObjectiveLeft(1);
      setLives(1);
      livesRef.current = 1;
      timeLeftRef.current = 75;
      previousSecondRef.current = 75;
      setTimeLeft(75);
      setDuelAlphaHp(100);
      setDuelBetaHp(100);
      setDuelLog("Rodada iniciada: Cubo Alpha vs Orb Beta.");
      syncStatus("running");
      return;
    }

    const player = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.92, 0.92),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#22d3ee"),
        roughness: 0.33,
        metalness: 0.2,
      }),
    );
    player.position.set(0, 0.5, 0);
    gameGroup.add(player);
    playerRef.current = player;

    const enemyCount = Math.max(
      1,
      Math.round(gameDef.baseEnemies * diffDef.enemyMultiplier),
    );
    for (let index = 0; index < enemyCount; index += 1) {
      const enemy = new THREE.Mesh(
        new THREE.ConeGeometry(0.54, 1.1, 22),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color("#fb7185"),
          roughness: 0.45,
        }),
      );
      enemy.position.set(randomArenaPosition(), 0.58, randomArenaPosition());
      enemy.rotation.x = Math.PI;
      const direction = new THREE.Vector3(
        Math.random() - 0.5,
        0,
        Math.random() - 0.5,
      ).normalize();
      enemiesRef.current.push({
        mesh: enemy,
        velocity: direction.multiplyScalar(diffDef.enemySpeed),
      });
      gameGroup.add(enemy);
    }

    if (currentGameRef.current === "coleta") {
      const orbCount = Math.max(
        6,
        Math.round(gameDef.baseOrbs * diffDef.enemyMultiplier),
      );
      for (let index = 0; index < orbCount; index += 1) {
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.34, 20, 20),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color("#f59e0b"),
            emissive: new THREE.Color("#7c2d12"),
            emissiveIntensity: 0.6,
          }),
        );
        orb.position.set(randomArenaPosition(), 0.5, randomArenaPosition());
        orbsRef.current.push(orb);
        gameGroup.add(orb);
      }
      objectiveLeftRef.current = orbCount;
      setObjectiveLeft(orbCount);
    }

    if (currentGameRef.current === "checkpoint") {
      const checkpoints = 6;
      for (let index = 0; index < checkpoints; index += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.9, 0.16, 16, 34),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(index === 0 ? "#22d3ee" : "#334155"),
            metalness: 0.25,
          }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(
          Math.cos((index / checkpoints) * Math.PI * 2) * 8,
          1.3,
          Math.sin((index / checkpoints) * Math.PI * 2) * 8,
        );
        checkpointsRef.current.push(ring);
        gameGroup.add(ring);
      }
      nextCheckpointIndexRef.current = 0;
      objectiveLeftRef.current = checkpoints;
      setObjectiveLeft(checkpoints);
    }

    const seconds = Math.round(gameDef.baseTime * diffDef.timeMultiplier);
    scoreRef.current = 0;
    livesRef.current = gameDef.baseLives;
    timeLeftRef.current = seconds;
    previousSecondRef.current = seconds;
    invulnerableUntilRef.current = 0;

    setScore(0);
    setLives(gameDef.baseLives);
    setTimeLeft(seconds);
    if (currentGameRef.current === "sobrevivencia") {
      objectiveLeftRef.current = seconds;
      setObjectiveLeft(seconds);
    }
    syncStatus("running");
  };

  const concludeDuelRound = (winner: "alpha" | "beta" | "draw") => {
    const duel = duelAgentsRef.current;
    if (!duel) return;

    if (winner === "alpha") {
      setDuelAlphaWins((value) => value + 1);
      setDuelLog(
        `Vitoria do Cubo Alpha. Aprendizado = ${duel.alpha.learning.toFixed(2)} | ${duel.beta.learning.toFixed(2)}.`,
      );
      setScore((value) => value + 1);
    }

    if (winner === "beta") {
      setDuelBetaWins((value) => value + 1);
      setDuelLog(
        `Vitoria do Orb Beta. Aprendizado = ${duel.alpha.learning.toFixed(2)} | ${duel.beta.learning.toFixed(2)}.`,
      );
      setScore((value) => value + 1);
    }

    if (winner === "draw") {
      setDuelLog(
        "Empate tecnico: ambos adaptaram defesa e ataque para a proxima rodada.",
      );
    }

    setDuelRound((value) => value + 1);
    syncStatus(winner === "draw" ? "lost" : "won");
  };

  const clearChessHighlights = () => {
    chessTilesRef.current.forEach((tile: THREE.Mesh) => {
      const material = tile.material as THREE.MeshStandardMaterial;
      material.emissive.set("#000000");
      material.emissiveIntensity = 0;
    });

    if (selectedChessPieceRef.current) {
      selectedChessPieceRef.current.mesh.scale.set(1, 1, 1);
    }

    legalChessMovesRef.current = [];
  };

  const getLegalMoves = (piece: ChessPieceState) => {
    const legal: string[] = [];
    const board = chessBoardRef.current;
    const addIfValid = (x: number, z: number) => {
      if (!isInsideBoard(x, z)) return false;
      const target = board.get(chessSquareKey(x, z));
      if (!target) {
        legal.push(chessSquareKey(x, z));
        return true;
      }
      if (target.color !== piece.color) legal.push(chessSquareKey(x, z));
      return false;
    };

    if (piece.type === "pawn") {
      const dir = piece.color === "white" ? 1 : -1;
      const startRow = piece.color === "white" ? 1 : 6;
      const oneForward = chessSquareKey(piece.x, piece.z + dir);
      if (isInsideBoard(piece.x, piece.z + dir) && !board.get(oneForward)) {
        legal.push(oneForward);
        const twoForward = chessSquareKey(piece.x, piece.z + dir * 2);
        if (piece.z === startRow && !board.get(twoForward))
          legal.push(twoForward);
      }

      [-1, 1].forEach((dx) => {
        const tx = piece.x + dx;
        const tz = piece.z + dir;
        if (!isInsideBoard(tx, tz)) return;
        const target = board.get(chessSquareKey(tx, tz));
        if (target && target.color !== piece.color)
          legal.push(chessSquareKey(tx, tz));
      });
      return legal;
    }

    if (piece.type === "knight") {
      const jumps = [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ];
      jumps.forEach(([dx, dz]) => addIfValid(piece.x + dx, piece.z + dz));
      return legal;
    }

    if (piece.type === "king") {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          if (dx === 0 && dz === 0) continue;
          addIfValid(piece.x + dx, piece.z + dz);
        }
      }
      return legal;
    }

    const directions: Array<[number, number]> = [];
    if (piece.type === "rook" || piece.type === "queen") {
      directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    }
    if (piece.type === "bishop" || piece.type === "queen") {
      directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    }

    directions.forEach(([dx, dz]) => {
      let tx = piece.x + dx;
      let tz = piece.z + dz;
      while (addIfValid(tx, tz)) {
        tx += dx;
        tz += dz;
      }
    });

    return legal;
  };

  const getPieceValue = (type: ChessPieceType) => {
    if (type === "pawn") return 1;
    if (type === "knight" || type === "bishop") return 3;
    if (type === "rook") return 5;
    if (type === "queen") return 9;
    return 50;
  };

  const getAllLegalMoves = (color: ChessColor) => {
    const moves: ChessMove[] = [];
    chessBoardRef.current.forEach((piece) => {
      if (piece.color !== color) return;
      const legal = getLegalMoves(piece);
      legal.forEach((key) => {
        const [x, z] = key.split(",").map(Number);
        const target = chessBoardRef.current.get(key);
        const capture = Boolean(target && target.color !== color);
        const score =
          (capture ? getPieceValue(target!.type) : 0) +
          (piece.type === "pawn" ? z * 0.07 : 0) +
          (piece.type === "queen" ? 0.1 : 0) +
          Math.random() * 0.25;
        moves.push({ piece, x, z, capture, score });
      });
    });
    return moves;
  };

  const cloneBoardState = () => {
    const snapshot = new Map<string, SimChessPiece>();
    chessBoardRef.current.forEach((piece, key) => {
      snapshot.set(key, {
        id: piece.id,
        type: piece.type,
        color: piece.color,
        x: piece.x,
        z: piece.z,
      });
    });
    return snapshot;
  };

  const getLegalMovesOnBoard = (
    piece: SimChessPiece,
    board: Map<string, SimChessPiece>,
  ) => {
    const legal: string[] = [];
    const addIfValid = (x: number, z: number) => {
      if (!isInsideBoard(x, z)) return false;
      const target = board.get(chessSquareKey(x, z));
      if (!target) {
        legal.push(chessSquareKey(x, z));
        return true;
      }
      if (target.color !== piece.color) legal.push(chessSquareKey(x, z));
      return false;
    };

    if (piece.type === "pawn") {
      const dir = piece.color === "white" ? 1 : -1;
      const startRow = piece.color === "white" ? 1 : 6;
      const oneForward = chessSquareKey(piece.x, piece.z + dir);
      if (isInsideBoard(piece.x, piece.z + dir) && !board.get(oneForward)) {
        legal.push(oneForward);
        const twoForward = chessSquareKey(piece.x, piece.z + dir * 2);
        if (piece.z === startRow && !board.get(twoForward))
          legal.push(twoForward);
      }

      [-1, 1].forEach((dx) => {
        const tx = piece.x + dx;
        const tz = piece.z + dir;
        if (!isInsideBoard(tx, tz)) return;
        const target = board.get(chessSquareKey(tx, tz));
        if (target && target.color !== piece.color)
          legal.push(chessSquareKey(tx, tz));
      });
      return legal;
    }

    if (piece.type === "knight") {
      const jumps = [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ];
      jumps.forEach(([dx, dz]) => addIfValid(piece.x + dx, piece.z + dz));
      return legal;
    }

    if (piece.type === "king") {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          if (dx === 0 && dz === 0) continue;
          addIfValid(piece.x + dx, piece.z + dz);
        }
      }
      return legal;
    }

    const directions: Array<[number, number]> = [];
    if (piece.type === "rook" || piece.type === "queen")
      directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    if (piece.type === "bishop" || piece.type === "queen")
      directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);

    directions.forEach(([dx, dz]) => {
      let tx = piece.x + dx;
      let tz = piece.z + dz;
      while (addIfValid(tx, tz)) {
        tx += dx;
        tz += dz;
      }
    });

    return legal;
  };

  const evaluateBoard = (board: Map<string, SimChessPiece>) => {
    let score = 0;
    board.forEach((piece) => {
      const material = getPieceValue(piece.type);
      const centrality =
        3.5 - (Math.abs(piece.x - 3.5) + Math.abs(piece.z - 3.5)) * 0.2;
      const sign = piece.color === "black" ? 1 : -1;
      score += sign * (material + centrality * 0.12);
    });
    return score;
  };

  const pickBestBotMove = (moves: ChessMove[]) => {
    const baseBoard = cloneBoardState();
    let bestMove = moves[0];
    let bestScore = -Infinity;

    moves.forEach((move) => {
      const board = new Map<string, SimChessPiece>();
      baseBoard.forEach((value, key) => board.set(key, { ...value }));

      const fromKey = chessSquareKey(move.piece.x, move.piece.z);
      const movingPiece = board.get(fromKey);
      if (!movingPiece) return;

      const toKey = chessSquareKey(move.x, move.z);
      const captured = board.get(toKey);
      board.delete(fromKey);
      board.delete(toKey);

      movingPiece.x = move.x;
      movingPiece.z = move.z;
      if (movingPiece.type === "pawn" && move.z === 0)
        movingPiece.type = "queen";
      board.set(toKey, movingPiece);

      // If bot can capture king immediately, always pick this line.
      if (captured?.type === "king") {
        bestMove = move;
        bestScore = 10000;
        return;
      }

      const opponentMoves: Array<{
        targetType: ChessPieceType | null;
        score: number;
      }> = [];
      board.forEach((piece) => {
        if (piece.color !== "white") return;
        const legal = getLegalMovesOnBoard(piece, board);
        legal.forEach((destination) => {
          const target = board.get(destination);
          opponentMoves.push({
            targetType: target ? target.type : null,
            score: target ? getPieceValue(target.type) : 0,
          });
        });
      });

      const maxOpponentThreat = opponentMoves.reduce(
        (acc, item) => Math.max(acc, item.score),
        0,
      );
      const selfPressurePenalty = opponentMoves.some(
        (item) => item.targetType === "king",
      )
        ? 200
        : 0;
      const candidateScore =
        evaluateBoard(board) +
        (captured ? getPieceValue(captured.type) * 1.2 : 0) -
        maxOpponentThreat * 0.9 -
        selfPressurePenalty +
        Math.random() * 0.12;

      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestMove = move;
      }
    });

    return bestMove;
  };

  const selectChessPiece = (piece: ChessPieceState) => {
    clearChessHighlights();
    selectedChessPieceRef.current = piece;
    piece.mesh.scale.set(1.08, 1.08, 1.08);

    const legal = getLegalMoves(piece);
    legalChessMovesRef.current = legal;
    legal.forEach((square) => {
      const tile = chessTilesRef.current.get(square);
      if (!tile) return;
      const material = tile.material as THREE.MeshStandardMaterial;
      material.emissive.set("#22d3ee");
      material.emissiveIntensity = 0.35;
    });

    setChessStatus(
      `Selecionado ${piece.color === "white" ? "Branco" : "Preto"} ${piece.type}.`,
    );
  };

  const concludeChess = (winner: ChessColor) => {
    chessWinnerRef.current = winner;
    setChessStatus(
      `Xeque-mate simbolico: ${winner === "white" ? "Branco" : "Preto"} venceu.`,
    );
  };

  const executeChessMove = (
    piece: ChessPieceState,
    x: number,
    z: number,
    mover: "human" | "bot" = "human",
  ) => {
    const fromKey = chessSquareKey(piece.x, piece.z);
    const toKey = chessSquareKey(x, z);
    const board = chessBoardRef.current;
    const target = board.get(toKey);

    if (target && target.color === piece.color) return;

    if (target) {
      if (chessGroupRef.current) chessGroupRef.current.remove(target.mesh);
      disposeObject(target.mesh);
      if (target.type === "king") concludeChess(piece.color);
    }

    board.delete(fromKey);
    piece.x = x;
    piece.z = z;
    piece.mesh.userData.boardX = x;
    piece.mesh.userData.boardZ = z;
    piece.mesh.position.set(x * 1.2 - 4.2, 0.16, z * 1.2 - 4.2);

    // Auto-promove peoes para rainha para manter a partida fluida.
    if (
      piece.type === "pawn" &&
      ((piece.color === "white" && z === 7) ||
        (piece.color === "black" && z === 0))
    ) {
      piece.type = "queen";
      setChessStatus("Promocao automatica para rainha.");
    }

    board.set(toKey, piece);
    selectedChessPieceRef.current = null;
    clearChessHighlights();

    if (!chessWinnerRef.current) {
      chessTurnRef.current =
        chessTurnRef.current === "white" ? "black" : "white";
      setChessTurn(chessTurnRef.current);
      const moverLabel = mover === "bot" ? "Bot" : "Jogador";
      setChessStatus(
        `${moverLabel} moveu para ${squareToNotation(x, z)}. Turno ${chessTurnRef.current === "white" ? "Branco" : "Preto"}.`,
      );
    }
  };

  const runChessBotMove = () => {
    if (!chessVsBotRef.current || chessWinnerRef.current) return;
    if (chessTurnRef.current !== "black") return;

    const moves = getAllLegalMoves("black");
    if (moves.length === 0) {
      concludeChess("white");
      setBotThinking(false);
      return;
    }

    const bestMove = pickBestBotMove(moves);
    const targetPiece = chessBoardRef.current.get(
      chessSquareKey(bestMove.x, bestMove.z),
    );
    if (targetPiece && targetPiece.color === "white") {
      setChessStatus(
        `Bot encontrou tatico em ${squareToNotation(bestMove.x, bestMove.z)}.`,
      );
    }
    executeChessMove(bestMove.piece, bestMove.x, bestMove.z, "bot");
    setBotThinking(false);
  };

  const handleChessSelection = (targetObject: THREE.Object3D | null) => {
    if (!targetObject || chessWinnerRef.current) return;

    let node: THREE.Object3D | null = targetObject;
    let pieceEntity: ChessPieceState | null = null;
    let tileSquare: string | null = null;

    while (node) {
      if (node.userData?.entityType === "piece") {
        const square = chessSquareKey(
          node.userData.boardX as number,
          node.userData.boardZ as number,
        );
        pieceEntity = chessBoardRef.current.get(square) ?? null;
        break;
      }
      if (node.userData?.entityType === "tile") {
        tileSquare = node.userData.square as string;
        break;
      }
      node = node.parent;
    }

    const selected = selectedChessPieceRef.current;

    if (pieceEntity && pieceEntity.color === chessTurnRef.current) {
      if (chessVsBotRef.current && chessTurnRef.current === "black") {
        setChessStatus("Aguarde: o bot esta pensando.");
        return;
      }
      selectChessPiece(pieceEntity);
      return;
    }

    if (!selected) {
      setChessStatus(
        `Turno ${chessTurnRef.current === "white" ? "Branco" : "Preto"}. Selecione uma peca.`,
      );
      return;
    }

    const destination = pieceEntity
      ? chessSquareKey(pieceEntity.x, pieceEntity.z)
      : tileSquare;
    if (!destination) return;
    if (!legalChessMovesRef.current.includes(destination)) {
      setChessStatus("Movimento invalido para essa peca.");
      return;
    }

    const [x, z] = destination.split(",").map(Number);
    executeChessMove(selected, x, z);
  };

  const buildChessTest = () => {
    const chessGroup = chessGroupRef.current;
    if (!chessGroup) return;

    clearGroupChildren(chessGroup);
    chessBoardRef.current.clear();
    chessTilesRef.current.clear();
    selectedChessPieceRef.current = null;
    legalChessMovesRef.current = [];
    chessTurnRef.current = "white";
    chessWinnerRef.current = null;
    if (chessBotTimerRef.current !== null) {
      window.clearTimeout(chessBotTimerRef.current);
      chessBotTimerRef.current = null;
    }
    setBotThinking(false);
    setChessTurn("white");
    setChessStatus("Clique em uma peca branca para iniciar.");

    const tileSize = 1.2;
    const offset = (7 * tileSize) / 2;
    let pieceId = 0;

    for (let x = 0; x < 8; x += 1) {
      for (let z = 0; z < 8; z += 1) {
        const isDark = (x + z) % 2 === 0;
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.16, 1.1),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(isDark ? "#1e293b" : "#94a3b8"),
            roughness: 0.9,
          }),
        );
        tile.position.set(x * tileSize - offset, 0.08, z * tileSize - offset);
        const square = chessSquareKey(x, z);
        tile.userData.entityType = "tile";
        tile.userData.square = square;
        chessTilesRef.current.set(square, tile);
        chessGroup.add(tile);
      }
    }

    const placePiece = (
      color: ChessColor,
      type: ChessPieceType,
      x: number,
      z: number,
    ) => {
      const mesh = createChessPiece(color, type);
      mesh.position.set(x * tileSize - offset, 0.16, z * tileSize - offset);
      mesh.userData.entityType = "piece";
      mesh.userData.boardX = x;
      mesh.userData.boardZ = z;
      mesh.userData.floatOffset = (x + z) * 0.25;

      const piece: ChessPieceState = {
        id: `piece-${pieceId}`,
        type,
        color,
        x,
        z,
        mesh,
      };

      pieceId += 1;
      chessBoardRef.current.set(chessSquareKey(x, z), piece);
      chessGroup.add(mesh);
    };

    const major: ChessPieceType[] = [
      "rook",
      "knight",
      "bishop",
      "queen",
      "king",
      "bishop",
      "knight",
      "rook",
    ];
    for (let x = 0; x < 8; x += 1) {
      placePiece("white", major[x], x, 0);
      placePiece("white", "pawn", x, 1);
      placePiece("black", "pawn", x, 6);
      placePiece("black", major[x], x, 7);
    }
  };

  const buildGravityTest = () => {
    const gravityGroup = gravityGroupRef.current;
    if (!gravityGroup) return;

    clearGravityTest();

    // Caixa de areia: base + areia + paredes para testes de queda.
    const arenaBase = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.5, 12),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#4b5563"),
        roughness: 0.85,
      }),
    );
    arenaBase.position.set(0, -0.24, 0);
    gravityGroup.add(arenaBase);

    const sandLayer = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.7, 10),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#d4a373"),
        roughness: 0.98,
        metalness: 0,
      }),
    );
    sandLayer.position.set(0, 0.1, 0);
    gravityGroup.add(sandLayer);

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#64748b"),
      roughness: 0.7,
    });
    const wallNorth = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 1.2, 0.3),
      wallMaterial,
    );
    const wallSouth = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 1.2, 0.3),
      wallMaterial,
    );
    const wallEast = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.2, 10.8),
      wallMaterial,
    );
    const wallWest = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.2, 10.8),
      wallMaterial,
    );
    wallNorth.position.set(0, 0.6, -5.35);
    wallSouth.position.set(0, 0.6, 5.35);
    wallEast.position.set(5.35, 0.6, 0);
    wallWest.position.set(-5.35, 0.6, 0);
    gravityGroup.add(wallNorth);
    gravityGroup.add(wallSouth);
    gravityGroup.add(wallEast);
    gravityGroup.add(wallWest);

    const sandTop = 0.45;

    // Graos de areia dinamicos com variacao de cor, atrito e assentamento.
    for (let index = 0; index < 260; index += 1) {
      const grainRadius = 0.035 + Math.random() * 0.045;
      const grainColor = new THREE.Color().setHSL(
        0.1,
        0.68,
        0.58 + Math.random() * 0.08,
      );
      const grain = new THREE.Mesh(
        new THREE.SphereGeometry(grainRadius, 10, 10),
        new THREE.MeshStandardMaterial({
          color: grainColor,
          roughness: 0.97,
          metalness: 0,
        }),
      );
      grain.position.set(
        (Math.random() - 0.5) * 8.2,
        0.8 + Math.random() * 2.4,
        (Math.random() - 0.5) * 8.2,
      );
      gravityGroup.add(grain);
      gravityBodiesRef.current.push({
        mesh: grain,
        vy: -Math.random() * 0.55,
        vx: (Math.random() - 0.5) * 0.42,
        vz: (Math.random() - 0.5) * 0.42,
        spin: 0.22 + Math.random() * 0.4,
        bounce: 0.16,
        drag: 1.05,
        floorLevel: sandTop,
        friction: 0.84,
        radius: grainRadius,
        kind: "grain",
      });
    }

    const shapeKinds = [
      "box",
      "sphere",
      "cone",
      "cylinder",
      "dodeca",
      "icosa",
      "octa",
      "torus",
    ] as const;
    const total = 24;
    for (let index = 0; index < total; index += 1) {
      const kind = shapeKinds[index % shapeKinds.length];
      const size = 0.32 + Math.random() * 0.55;
      const geometry =
        kind === "box"
          ? new THREE.BoxGeometry(size, size, size)
          : kind === "sphere"
            ? new THREE.SphereGeometry(size * 0.56, 20, 20)
            : kind === "cone"
              ? new THREE.ConeGeometry(size * 0.45, size * 1.15, 20)
              : kind === "cylinder"
                ? new THREE.CylinderGeometry(
                    size * 0.35,
                    size * 0.35,
                    size * 1.08,
                    20,
                  )
                : kind === "dodeca"
                  ? new THREE.DodecahedronGeometry(size * 0.5)
                  : kind === "icosa"
                    ? new THREE.IcosahedronGeometry(size * 0.5)
                    : kind === "octa"
                      ? new THREE.OctahedronGeometry(size * 0.55)
                      : new THREE.TorusGeometry(
                          size * 0.32,
                          size * 0.14,
                          12,
                          26,
                        );

      const hue = 0.52 + Math.random() * 0.25;
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(hue, 0.7, 0.58),
          roughness: 0.32,
          metalness: 0.22,
        }),
      );

      mesh.position.set(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 8,
        (Math.random() - 0.5) * 8,
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      gravityGroup.add(mesh);
      const radius = kind === "torus" ? size * 0.46 : size * 0.5;
      gravityBodiesRef.current.push({
        mesh,
        vy: -Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.95,
        vz: (Math.random() - 0.5) * 0.95,
        spin: 0.5 + Math.random() * 1.4,
        bounce: 0.52 + Math.random() * 0.14,
        drag: 1,
        floorLevel: sandTop,
        friction: 0.88,
        radius,
        kind: "object",
      });
    }

    if (cameraRef.current) {
      cameraRef.current.position.set(8, 7, 10);
      cameraRef.current.lookAt(0, 1.2, 0);
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 1.2, 0);
      controlsRef.current.update();
    }

    setGravityInfo(
      "Caixa de areia realista: mais graos, dunas dinamicas, atrito lateral e novas formas geometricas.",
    );
  };

  const buildMinecraftTest = () => {
    if (!voxelGroupRef.current) return;
    rebuildMinecraftRegion(0, 0, true);

    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f8fafc"),
      roughness: 1,
      metalness: 0,
    });
    for (let i = 0; i < 18; i += 1) {
      const cloud = new THREE.Mesh(
        new THREE.BoxGeometry(
          3 + Math.random() * 2,
          0.6,
          2 + Math.random() * 2,
        ),
        cloudMaterial,
      );
      cloud.position.set(
        (Math.random() - 0.5) * 90,
        16 + Math.random() * 8,
        (Math.random() - 0.5) * 90,
      );
      cloud.userData.entityType = "cloud";
      voxelGroupRef.current.add(cloud);
    }

    if (cameraRef.current) {
      cameraRef.current.position.set(16, 16, 16);
      cameraRef.current.lookAt(0, 3, 0);
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 3, 0);
      controlsRef.current.update();
    }

    minecraftPlayerPosRef.current.set(0, getMinecraftGroundY(0, 0) + 1.7, 0);
    minecraftVelYRef.current = 0;
    minecraftOnGroundRef.current = false;
    minecraftYawRef.current = 0;
    minecraftPitchRef.current = 0;
    if (cameraRef.current && minecraftViewRef.current === "fps") {
      cameraRef.current.position.copy(minecraftPlayerPosRef.current);
    }

    setMinecraftInfo(
      "Minecraft Test: chunks em tempo real, clique esquerdo quebra e direito coloca.",
    );
  };

  useEffect(() => {
    currentGameRef.current = selectedGame;
    resetGameState();
  }, [selectedGame]);

  useEffect(() => {
    currentDifficultyRef.current = difficulty;
    resetGameState();
  }, [difficulty]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#020617");
    scene.fog = new THREE.Fog(0x020617, 14, 45);

    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(11, 8, 12);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(8, 12, 8);
    scene.add(keyLight);

    const fill = new THREE.PointLight(0x38bdf8, 18, 90);
    fill.position.set(-8, 5, -5);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26, 1, 1),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0f172a"),
        roughness: 0.93,
        metalness: 0.08,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(11.8, 0.06, 16, 120),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#22d3ee") }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.03;
    scene.add(ring);

    const grid = new THREE.GridHelper(26, 26, 0x334155, 0x111827);
    scene.add(grid);

    const editorGroup = new THREE.Group();
    const gameGroup = new THREE.Group();
    const chessGroup = new THREE.Group();
    const gravityGroup = new THREE.Group();
    const voxelGroup = new THREE.Group();
    scene.add(editorGroup);
    scene.add(gameGroup);
    scene.add(chessGroup);
    scene.add(gravityGroup);
    scene.add(voxelGroup);

    editorGroupRef.current = editorGroup;
    gameGroupRef.current = gameGroup;
    chessGroupRef.current = chessGroup;
    gravityGroupRef.current = gravityGroup;
    voxelGroupRef.current = voxelGroup;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, 0.6, 0);
    controls.enabled =
      sceneModeRef.current === "chess" ||
      sceneModeRef.current === "gravity" ||
      sceneModeRef.current === "minecraft";
    controlsRef.current = controls;

    updateSceneVisibility(sceneModeRef.current);

    const clock = new THREE.Clock();
    const followTarget = new THREE.Vector3();
    let frameId = 0;

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      if (
        sceneModeRef.current !== "minecraft" &&
        (scene.background as THREE.Color)?.getHexString() !== "020617"
      ) {
        scene.background = new THREE.Color("#020617");
        scene.fog = new THREE.Fog(0x020617, 14, 45);
      }

      if (sceneModeRef.current === "chess") {
        if (chessGroupRef.current) {
          chessGroupRef.current.children.forEach(
            (obj: THREE.Object3D, index: number) => {
              if (obj instanceof THREE.Group) {
                const baseY = 0.16;
                const floatOffset = Number(
                  obj.userData.floatOffset ?? index * 0.2,
                );
                obj.position.y =
                  baseY + Math.sin(elapsed * 1.8 + floatOffset) * 0.03;
              }
            },
          );
        }
        controls.enabled = true;
        controls.update();
        renderer.render(scene, camera);
        return;
      }

      if (sceneModeRef.current === "gravity") {
        gravityBodiesRef.current.forEach((body) => {
          body.vx *= 1 - Math.min(0.6 * delta, 0.08);
          body.vz *= 1 - Math.min(0.6 * delta, 0.08);
          body.vy -= 9.8 * body.drag * delta;
          body.mesh.position.x += body.vx * delta;
          body.mesh.position.y += body.vy * delta;
          body.mesh.position.z += body.vz * delta;
          body.mesh.rotation.x += body.spin * delta;
          body.mesh.rotation.z += body.spin * 0.7 * delta;

          const border = 5 - body.radius;
          if (body.mesh.position.x > border) {
            body.mesh.position.x = border;
            body.vx = -Math.abs(body.vx) * 0.45;
          }
          if (body.mesh.position.x < -border) {
            body.mesh.position.x = -border;
            body.vx = Math.abs(body.vx) * 0.45;
          }
          if (body.mesh.position.z > border) {
            body.mesh.position.z = border;
            body.vz = -Math.abs(body.vz) * 0.45;
          }
          if (body.mesh.position.z < -border) {
            body.mesh.position.z = -border;
            body.vz = Math.abs(body.vz) * 0.45;
          }

          const radialDistance = Math.sqrt(
            body.mesh.position.x * body.mesh.position.x +
              body.mesh.position.z * body.mesh.position.z,
          );
          const duneRaise = Math.max(0, 0.24 - radialDistance * 0.03);
          const floorWithDune =
            body.kind === "grain"
              ? body.floorLevel + duneRaise
              : body.floorLevel + duneRaise * 0.45;

          if (body.mesh.position.y <= floorWithDune) {
            body.mesh.position.y = floorWithDune;
            body.vy = Math.abs(body.vy) * body.bounce;
            if (Math.abs(body.vy) < 0.15) body.vy = 0;
            body.vx *= body.friction;
            body.vz *= body.friction;
            if (Math.abs(body.vx) < 0.03) body.vx = 0;
            if (Math.abs(body.vz) < 0.03) body.vz = 0;
          }
        });

        // Colisao aproximada entre formas usando volume esferico para manter custo baixo.
        const bodies = gravityBodiesRef.current;
        for (let i = 0; i < bodies.length; i += 1) {
          for (let j = i + 1; j < bodies.length; j += 1) {
            const a = bodies[i];
            const b = bodies[j];

            // Ignora colisao entre graos para nao pesar a simulacao.
            if (a.kind === "grain" && b.kind === "grain") continue;

            const deltaVec = new THREE.Vector3().subVectors(
              b.mesh.position,
              a.mesh.position,
            );
            const dist = deltaVec.length();
            const minDist = a.radius + b.radius;
            if (dist === 0 || dist >= minDist) continue;

            const normal = deltaVec.multiplyScalar(1 / dist);
            const penetration = minDist - dist;

            const aWeight = a.kind === "object" ? 0.55 : 0.45;
            const bWeight = b.kind === "object" ? 0.55 : 0.45;
            const totalWeight = aWeight + bWeight;

            a.mesh.position.addScaledVector(
              normal,
              -(penetration * (bWeight / totalWeight)),
            );
            b.mesh.position.addScaledVector(
              normal,
              penetration * (aWeight / totalWeight),
            );

            const aVel = new THREE.Vector3(a.vx, a.vy, a.vz);
            const bVel = new THREE.Vector3(b.vx, b.vy, b.vz);
            const relVel = new THREE.Vector3().subVectors(bVel, aVel);
            const relAlongNormal = relVel.dot(normal);
            if (relAlongNormal > 0) continue;

            const restitution = Math.min(a.bounce, b.bounce) * 0.9;
            const impulse = (-(1 + restitution) * relAlongNormal) / 2;
            const impulseVec = normal.clone().multiplyScalar(impulse);

            aVel.addScaledVector(impulseVec, -1);
            bVel.add(impulseVec);

            a.vx = aVel.x * a.friction;
            a.vy = aVel.y;
            a.vz = aVel.z * a.friction;
            b.vx = bVel.x * b.friction;
            b.vy = bVel.y;
            b.vz = bVel.z * b.friction;
          }
        }

        controls.enabled = true;
        controls.update();
        renderer.render(scene, camera);
        return;
      }

      if (sceneModeRef.current === "minecraft") {
        const day = 0.6 + Math.sin(elapsed * 0.04) * 0.4;
        const sky = new THREE.Color().setHSL(0.58, 0.5, 0.34 + day * 0.32);
        scene.background = sky;
        scene.fog = new THREE.Fog(sky.getHex(), 28, 130);

        if (minecraftViewRef.current === "fps") {
          controls.enabled = false;
          if (!minecraftPointerLockedRef.current) {
            renderer.render(scene, camera);
            return;
          }
          const move = new THREE.Vector3();
          const forward = new THREE.Vector3(
            -Math.sin(minecraftYawRef.current),
            0,
            -Math.cos(minecraftYawRef.current),
          );
          const right = new THREE.Vector3(-forward.z, 0, forward.x);
          const speed =
            keyMapRef.current.shift && minecraftModeRef.current === "survival"
              ? 8.8
              : 5.6;
          if (keyMapRef.current.w) move.add(forward);
          if (keyMapRef.current.s) move.sub(forward);
          if (keyMapRef.current.d) move.add(right);
          if (keyMapRef.current.a) move.sub(right);

          if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(speed * delta);
            minecraftPlayerPosRef.current.x += move.x;
            minecraftPlayerPosRef.current.z += move.z;
          }

          minecraftPlayerPosRef.current.x = THREE.MathUtils.clamp(
            minecraftPlayerPosRef.current.x,
            -240,
            240,
          );
          minecraftPlayerPosRef.current.z = THREE.MathUtils.clamp(
            minecraftPlayerPosRef.current.z,
            -240,
            240,
          );

          const chunkX = Math.floor(minecraftPlayerPosRef.current.x / 16);
          const chunkZ = Math.floor(minecraftPlayerPosRef.current.z / 16);
          const lastChunk = minecraftLastChunkRef.current;
          if (!lastChunk || lastChunk.x !== chunkX || lastChunk.z !== chunkZ) {
            rebuildMinecraftRegion(chunkX, chunkZ, false);
          }

          const ground =
            getMinecraftGroundY(
              minecraftPlayerPosRef.current.x,
              minecraftPlayerPosRef.current.z,
            ) + 1.7;

          if (minecraftModeRef.current === "creative") {
            const lift = keyMapRef.current.space ? 4 * delta : 0;
            const down = keyMapRef.current.shift ? 4 * delta : 0;
            minecraftPlayerPosRef.current.y = Math.max(
              ground,
              minecraftPlayerPosRef.current.y + lift - down,
            );
          } else {
            const isGrounded = minecraftPlayerPosRef.current.y <= ground + 0.02;
            if (isGrounded) {
              minecraftPlayerPosRef.current.y = ground;
              minecraftOnGroundRef.current = true;
              if (minecraftVelYRef.current < 0) minecraftVelYRef.current = 0;
            } else {
              minecraftOnGroundRef.current = false;
            }

            if (keyMapRef.current.space && minecraftOnGroundRef.current) {
              minecraftVelYRef.current = 7.7;
              minecraftOnGroundRef.current = false;
            }

            minecraftVelYRef.current -= 19.8 * delta;
            minecraftPlayerPosRef.current.y += minecraftVelYRef.current * delta;

            if (minecraftPlayerPosRef.current.y <= ground) {
              minecraftPlayerPosRef.current.y = ground;
              minecraftVelYRef.current = 0;
              minecraftOnGroundRef.current = true;
            }
          }

          camera.position.copy(minecraftPlayerPosRef.current);
          camera.rotation.order = "YXZ";
          camera.rotation.y = minecraftYawRef.current;
          camera.rotation.x = minecraftPitchRef.current;
        } else {
          controls.enabled = true;
          controls.update();
        }
        renderer.render(scene, camera);
        return;
      }

      controls.enabled = false;

      if (sceneModeRef.current === "studio") {
        const objects = sceneObjectsRef.current;
        objects.forEach((config) => {
          const mesh = studioMeshMapRef.current.get(config.id);
          const runtime = studioRuntimeRef.current.get(config.id);
          if (!mesh || !runtime) return;

          if (!studioPlayRef.current) {
            mesh.position.set(runtime.baseX, runtime.baseY, runtime.baseZ);
            mesh.rotation.y += config.rotationSpeed;
            return;
          }

          if (config.scriptMode === "orbitar") {
            mesh.position.x =
              runtime.baseX + Math.cos(elapsed * 1.2 + runtime.baseX) * 1.2;
            mesh.position.z =
              runtime.baseZ + Math.sin(elapsed * 1.2 + runtime.baseZ) * 1.2;
          }

          if (config.scriptMode === "pulsar") {
            const pulsar = 0.9 + Math.sin(elapsed * 3 + runtime.baseX) * 0.12;
            mesh.scale.setScalar(config.scale * pulsar);
          } else {
            mesh.scale.setScalar(config.scale);
          }

          if (config.rigidBody) {
            runtime.vy -= 9.8 * delta;
            mesh.position.y += runtime.vy * delta;
            const floorLevel = Math.max(0.3, config.scale * 0.45);
            if (mesh.position.y <= floorLevel) {
              mesh.position.y = floorLevel;
              runtime.vy = Math.abs(runtime.vy) * 0.45;
            }
          }

          mesh.rotation.y += config.rotationSpeed;
        });

        orbitRef.current += 0.002;
        camera.position.x = Math.cos(orbitRef.current) * 10;
        camera.position.z = Math.sin(orbitRef.current) * 10;
        camera.position.y = 6;
        camera.lookAt(0, 0.8, 0);
        renderer.render(scene, camera);
        return;
      }

      if (gameStatusRef.current === "running") {
        if (currentGameRef.current === "dueloia") {
          const duel = duelAgentsRef.current;
          if (duel) {
            const agents: Array<DuelAgent> = [duel.alpha, duel.beta];

            agents.forEach((agent: DuelAgent, index: number) => {
              const target = index === 0 ? duel.beta : duel.alpha;
              const direction = target.mesh.position
                .clone()
                .sub(agent.mesh.position)
                .setY(0);
              if (direction.lengthSq() > 0.01) {
                direction.normalize();
                const dashBonus =
                  agent.ability === "dash" &&
                  agent.hp < 50 &&
                  agent.abilityTimer <= 0
                    ? 1.4
                    : 1;
                agent.mesh.position.addScaledVector(
                  direction,
                  agent.speed * dashBonus * agent.learning * delta,
                );
              }

              agent.cooldown = Math.max(0, agent.cooldown - delta);
              agent.abilityTimer = Math.max(0, agent.abilityTimer - delta);

              if (
                agent.ability === "shield" &&
                agent.abilityTimer <= 0 &&
                agent.hp < 65
              ) {
                agent.abilityTimer = 5;
                setDuelLog(
                  "Orb Beta ativou Shield Pulse: defesa reforcada por calculo adaptativo.",
                );
              }
            });

            duelAttackClockRef.current += delta;
            if (duelAttackClockRef.current > 0.45) {
              duelAttackClockRef.current = 0;

              const runAttack = (attacker: DuelAgent, defender: DuelAgent) => {
                const distance = attacker.mesh.position.distanceTo(
                  defender.mesh.position,
                );
                if (distance > 1.8 || attacker.cooldown > 0) return;

                const shieldFactor =
                  defender.ability === "shield" && defender.abilityTimer > 0
                    ? 1.55
                    : 1;
                const base = attacker.attack * attacker.learning;
                const blocked = defender.defense * shieldFactor;
                const damage = Math.max(2, base - blocked * 0.6);

                defender.hp = Math.max(0, defender.hp - damage);
                attacker.cooldown = 0.7;

                // Simple reinforcement: if the action causes net positive damage, the agent raises aggression.
                const deltaLearning = ((damage - blocked * 0.1) / 120) * 0.55;
                attacker.learning = THREE.MathUtils.clamp(
                  attacker.learning + deltaLearning,
                  0.75,
                  1.7,
                );
                defender.learning = THREE.MathUtils.clamp(
                  defender.learning + (blocked / 220 - damage / 260),
                  0.75,
                  1.7,
                );
              };

              runAttack(duel.alpha, duel.beta);
              runAttack(duel.beta, duel.alpha);

              setDuelAlphaHp(Math.round(duel.alpha.hp));
              setDuelBetaHp(Math.round(duel.beta.hp));

              if (duel.alpha.hp <= 0 && duel.beta.hp <= 0) {
                concludeDuelRound("draw");
              } else if (duel.alpha.hp <= 0) {
                concludeDuelRound("beta");
              } else if (duel.beta.hp <= 0) {
                concludeDuelRound("alpha");
              }
            }

            const duelCenter = duel.alpha.mesh.position
              .clone()
              .add(duel.beta.mesh.position)
              .multiplyScalar(0.5);
            followTarget.set(duelCenter.x + 8.6, 7.2, duelCenter.z + 8.6);
            camera.position.lerp(followTarget, 0.06);
            camera.lookAt(duelCenter.x, 0.65, duelCenter.z);

            timeLeftRef.current -= delta;
            const seconds = Math.max(0, Math.ceil(timeLeftRef.current));
            if (seconds !== previousSecondRef.current) {
              previousSecondRef.current = seconds;
              setTimeLeft(seconds);
            }
            if (
              timeLeftRef.current <= 0 &&
              gameStatusRef.current === "running"
            ) {
              if (duel.alpha.hp > duel.beta.hp) concludeDuelRound("alpha");
              else if (duel.beta.hp > duel.alpha.hp) concludeDuelRound("beta");
              else concludeDuelRound("draw");
            }
          }
        } else if (playerRef.current) {
          const diffDef = difficultyDefinitions[currentDifficultyRef.current];
          const moveX =
            (keyMapRef.current.d ? 1 : 0) - (keyMapRef.current.a ? 1 : 0);
          const moveZ =
            (keyMapRef.current.s ? 1 : 0) - (keyMapRef.current.w ? 1 : 0);
          const direction = new THREE.Vector3(moveX, 0, moveZ);
          if (direction.lengthSq() > 0) direction.normalize();

          const speedMultiplier = keyMapRef.current.shift ? 1.45 : 1;
          playerRef.current.position.addScaledVector(
            direction,
            diffDef.playerSpeed * speedMultiplier * delta,
          );
          playerRef.current.position.x = THREE.MathUtils.clamp(
            playerRef.current.position.x,
            -10.8,
            10.8,
          );
          playerRef.current.position.z = THREE.MathUtils.clamp(
            playerRef.current.position.z,
            -10.8,
            10.8,
          );

          enemiesRef.current.forEach((enemy: EnemyActor) => {
            enemy.mesh.position.addScaledVector(enemy.velocity, delta);
            if (Math.abs(enemy.mesh.position.x) > 10.9) enemy.velocity.x *= -1;
            if (Math.abs(enemy.mesh.position.z) > 10.9) enemy.velocity.z *= -1;
            enemy.mesh.lookAt(enemy.mesh.position.clone().add(enemy.velocity));

            if (elapsed > invulnerableUntilRef.current && playerRef.current) {
              const hitDistance = enemy.mesh.position.distanceTo(
                playerRef.current.position,
              );
              if (hitDistance < 1.05) {
                invulnerableUntilRef.current = elapsed + 1.1;
                livesRef.current -= 1;
                setLives(livesRef.current);
                playerRef.current.position.set(0, 0.5, 0);
                if (livesRef.current <= 0) syncStatus("lost");
              }
            }
          });

          if (currentGameRef.current === "coleta") {
            orbsRef.current.forEach((orb: THREE.Mesh) => {
              orb.rotation.y += delta * 2.5;
              orb.position.y =
                0.5 + Math.sin(elapsed * 3 + orb.position.x) * 0.09;
            });

            const gameGroup = gameGroupRef.current;
            orbsRef.current = orbsRef.current.filter((orb: THREE.Mesh) => {
              if (!playerRef.current || !gameGroup) return true;
              const distance = orb.position.distanceTo(
                playerRef.current.position,
              );
              if (distance < 0.88) {
                gameGroup.remove(orb);
                disposeObject(orb);
                scoreRef.current += 1;
                objectiveLeftRef.current = Math.max(
                  0,
                  objectiveLeftRef.current - 1,
                );
                setScore(scoreRef.current);
                setObjectiveLeft(objectiveLeftRef.current);
                if (objectiveLeftRef.current === 0) syncStatus("won");
                return false;
              }
              return true;
            });
          }

          if (currentGameRef.current === "checkpoint") {
            checkpointsRef.current.forEach(
              (ringObj: THREE.Mesh, index: number) => {
                ringObj.rotation.z += delta * 0.8;
                const active = index === nextCheckpointIndexRef.current;
                const ringMaterial =
                  ringObj.material as THREE.MeshStandardMaterial;
                ringMaterial.color.set(active ? "#22d3ee" : "#334155");
              },
            );

            const target =
              checkpointsRef.current[nextCheckpointIndexRef.current];
            if (target && playerRef.current) {
              if (
                target.position.distanceTo(playerRef.current.position) < 1.25
              ) {
                scoreRef.current += 1;
                setScore(scoreRef.current);
                nextCheckpointIndexRef.current += 1;
                objectiveLeftRef.current = Math.max(
                  0,
                  checkpointsRef.current.length -
                    nextCheckpointIndexRef.current,
                );
                setObjectiveLeft(objectiveLeftRef.current);
                if (
                  nextCheckpointIndexRef.current >=
                  checkpointsRef.current.length
                )
                  syncStatus("won");
              }
            }
          }

          timeLeftRef.current -= delta;
          const seconds = Math.max(0, Math.ceil(timeLeftRef.current));
          if (seconds !== previousSecondRef.current) {
            previousSecondRef.current = seconds;
            setTimeLeft(seconds);
            if (currentGameRef.current === "sobrevivencia")
              setObjectiveLeft(seconds);
          }

          if (timeLeftRef.current <= 0) {
            if (
              currentGameRef.current === "sobrevivencia" &&
              livesRef.current > 0
            ) {
              syncStatus("won");
            } else if (gameStatusRef.current === "running") {
              syncStatus("lost");
            }
          }

          followTarget.set(
            playerRef.current.position.x + 6.5,
            7,
            playerRef.current.position.z + 6.5,
          );
          camera.position.lerp(followTarget, 0.08);
          camera.lookAt(
            playerRef.current.position.x,
            0.5,
            playerRef.current.position.z,
          );
        }
      } else if (
        gameStatusRef.current === "paused" &&
        currentGameRef.current === "dueloia" &&
        duelAgentsRef.current
      ) {
        const duelCenter = duelAgentsRef.current.alpha.mesh.position
          .clone()
          .add(duelAgentsRef.current.beta.mesh.position)
          .multiplyScalar(0.5);
        followTarget.set(duelCenter.x + 8.6, 7.2, duelCenter.z + 8.6);
        camera.position.lerp(followTarget, 0.05);
        camera.lookAt(duelCenter.x, 0.65, duelCenter.z);
      } else if (gameStatusRef.current === "paused" && playerRef.current) {
        followTarget.set(
          playerRef.current.position.x + 6.5,
          7,
          playerRef.current.position.z + 6.5,
        );
        camera.position.lerp(followTarget, 0.06);
        camera.lookAt(
          playerRef.current.position.x,
          0.5,
          playerRef.current.position.z,
        );
      } else {
        orbitRef.current += 0.002;
        camera.position.x = Math.cos(orbitRef.current) * 12;
        camera.position.z = Math.sin(orbitRef.current) * 12;
        camera.position.y = 7;
        camera.lookAt(0, 0.5, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current)
        return;
      const { clientWidth, clientHeight } = mountRef.current;
      if (!clientWidth || !clientHeight) return;
      cameraRef.current.aspect = clientWidth / clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(clientWidth, clientHeight);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      const key = event.key.toLowerCase();
      if ([" ", "w", "a", "s", "d"].includes(key)) event.preventDefault();
      if (key === "w" || key === "a" || key === "s" || key === "d")
        keyMapRef.current[key] = true;
      if (key === "shift") keyMapRef.current.shift = true;
      if (key === " ") keyMapRef.current.space = true;

      if (sceneModeRef.current === "minecraft") {
        const hotbarMap: Record<string, BlockType> = {
          "1": "grama",
          "2": "terra",
          "3": "pedra",
          "4": "madeira",
          "5": "areia",
        };
        if (hotbarMap[key]) {
          setSelectedBlock(hotbarMap[key]);
          setMinecraftInfo(`Hotbar: bloco ${hotbarMap[key]} selecionado.`);
        }
      }

      if (key === " " && !event.repeat && sceneModeRef.current === "game") {
        if (gameStatusRef.current === "running") syncStatus("paused");
        else if (gameStatusRef.current === "paused") syncStatus("running");
      }
      if (
        key === "escape" &&
        sceneModeRef.current === "minecraft" &&
        minecraftViewRef.current === "fps"
      ) {
        leaveMinecraftFps();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "a" || key === "s" || key === "d")
        keyMapRef.current[key] = false;
      if (key === "shift") keyMapRef.current.shift = false;
      if (key === " ") keyMapRef.current.space = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (sceneModeRef.current !== "minecraft") return;
      if (minecraftViewRef.current !== "fps") return;
      if (!minecraftPointerLockedRef.current) return;
      minecraftYawRef.current -= event.movementX * 0.0025;
      minecraftPitchRef.current -= event.movementY * 0.0022;
      minecraftPitchRef.current = THREE.MathUtils.clamp(
        minecraftPitchRef.current,
        -1.35,
        1.2,
      );
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      minecraftPointerLockedRef.current = locked;
      setMinecraftLocked(locked);
      if (
        !locked &&
        sceneModeRef.current === "minecraft" &&
        minecraftViewRef.current === "fps"
      ) {
        setMinecraftInfo(
          "Pointer liberado. Clique em Entrar FPS para continuar.",
        );
      }
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (event: PointerEvent) => {
      if (!rendererRef.current || !cameraRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, cameraRef.current);

      if (sceneModeRef.current === "chess") {
        if (
          (chessVsBotRef.current && botThinkingRef.current) ||
          !chessGroupRef.current
        )
          return;
        const intersections = raycaster.intersectObjects(
          chessGroupRef.current.children,
          true,
        );
        if (intersections.length === 0) return;
        handleChessSelection(intersections[0].object);
        return;
      }

      if (sceneModeRef.current === "minecraft") {
        if (!voxelGroupRef.current) return;
        if (
          minecraftViewRef.current === "fps" &&
          !minecraftPointerLockedRef.current
        ) {
          void rendererRef.current?.domElement
            .requestPointerLock()
            ?.catch(() =>
              setMinecraftInfo(
                "Captura do mouse bloqueada. Use a câmera orbital ou o app desktop.",
              ),
            );
        }
        if (
          minecraftViewRef.current === "fps" &&
          minecraftPointerLockedRef.current
        ) {
          pointer.x = 0;
          pointer.y = 0;
          raycaster.setFromCamera(pointer, cameraRef.current);
        }

        const intersections = raycaster.intersectObjects(
          voxelGroupRef.current.children,
          true,
        );
        if (intersections.length === 0) return;
        const hit = intersections[0];
        const obj =
          hit.instanceId !== undefined
            ? voxelMapRef.current.get(
                hit.object.userData.voxelKeys?.[hit.instanceId],
              )
            : hit.object;
        if (!obj) return;
        const vx = Number(obj.userData.voxelX);
        const vy = Number(obj.userData.voxelY);
        const vz = Number(obj.userData.voxelZ);
        if (
          !Number.isFinite(vx) ||
          !Number.isFinite(vy) ||
          !Number.isFinite(vz)
        )
          return;

        // Minecraft style: clique esquerdo quebra, clique direito coloca.
        if (event.button === 0) {
          if (removeVoxelBlock(vx, vy, vz)) {
            minecraftOverridesRef.current.set(voxelKey(vx, vy, vz), null);
            for (const [dx, dy, dz] of [
              [1, 0, 0],
              [-1, 0, 0],
              [0, 1, 0],
              [0, -1, 0],
              [0, 0, 1],
              [0, 0, -1],
            ]) {
              const x = vx + dx,
                y = vy + dy,
                z = vz + dz;
              const h = terrainHeightAt(x, z);
              const override = minecraftOverridesRef.current.get(
                voxelKey(x, y, z),
              );
              if (y >= 0 && y < h && override !== null)
                addVoxelBlock(
                  x,
                  y,
                  z,
                  override ??
                    (y === h - 1 ? "grama" : y >= h - 3 ? "terra" : "pedra"),
                  false,
                );
            }
            syncVoxelInstances();
            setVoxelCount(voxelMapRef.current.size);
            setMinecraftInfo(`Bloco removido em (${vx}, ${vy}, ${vz}).`);
          }
          return;
        }

        if (event.button !== 2) return;
        const n = hit.face?.normal ?? new THREE.Vector3(0, 1, 0);
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(
          obj.matrixWorld,
        );
        const worldNormal = n.clone().applyMatrix3(normalMatrix).normalize();
        const nx = Math.round(worldNormal.x);
        const ny = Math.round(worldNormal.y);
        const nz = Math.round(worldNormal.z);
        const tx = vx + nx;
        const ty = vy + ny;
        const tz = vz + nz;

        // Evita colocar bloco dentro da camera do jogador em primeira pessoa.
        if (minecraftViewRef.current === "fps") {
          const px = Math.round(minecraftPlayerPosRef.current.x);
          const py = Math.floor(minecraftPlayerPosRef.current.y - 1.2);
          const pz = Math.round(minecraftPlayerPosRef.current.z);
          if (tx === px && (ty === py || ty === py + 1) && tz === pz) return;
        }

        if (addVoxelBlock(tx, ty, tz, selectedBlockRef.current)) {
          minecraftOverridesRef.current.set(
            voxelKey(tx, ty, tz),
            selectedBlockRef.current,
          );
          setMinecraftInfo(
            `Bloco ${selectedBlockRef.current} criado em (${tx}, ${ty}, ${tz}).`,
          );
        }
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      if (sceneModeRef.current === "minecraft") event.preventDefault();
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);
    const onBlur = () => {
      keyMapRef.current = {
        w: false,
        a: false,
        s: false,
        d: false,
        shift: false,
        space: false,
      };
      if (gameStatusRef.current === "running") syncStatus("paused");
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      window.cancelAnimationFrame(frameId);
      scene.traverse((node: THREE.Object3D) => {
        if (node instanceof THREE.Mesh) disposeObject(node);
      });
      voxelMapRef.current.forEach((mesh) => disposeObject(mesh));
      voxelMapRef.current.clear();
      controls.dispose();
      controlsRef.current = null;
      renderer.dispose();
      renderer.forceContextLoss();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const group = editorGroupRef.current;
    if (!group) return;

    clearGroupChildren(group);
    const nextMap = new Map<string, number>();
    const nextMeshMap = new Map<string, THREE.Mesh>();
    const nextRuntime = new Map<
      string,
      { vy: number; baseX: number; baseY: number; baseZ: number }
    >();

    sceneObjects.forEach((item) => {
      const geometry =
        item.kind === "esfera"
          ? new THREE.SphereGeometry(item.scale * 0.62, 28, 22)
          : item.kind === "cone"
            ? new THREE.ConeGeometry(item.scale * 0.56, item.scale * 1.32, 24)
            : new THREE.BoxGeometry(item.scale, item.scale, item.scale);

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(item.color),
          roughness: 0.34,
          metalness: 0.2,
        }),
      );
      mesh.position.set(item.x, item.y, item.z);
      mesh.name = item.id;
      group.add(mesh);
      nextMap.set(item.id, item.rotationSpeed);
      nextMeshMap.set(item.id, mesh);
      nextRuntime.set(item.id, {
        vy: 0,
        baseX: item.x,
        baseY: item.y,
        baseZ: item.z,
      });
    });

    rotationMapRef.current = nextMap;
    studioMeshMapRef.current = nextMeshMap;
    studioRuntimeRef.current = nextRuntime;

    if (sceneObjects.length > 0 && !selectedObjectId) {
      setSelectedObjectId(sceneObjects[0].id);
    }
  }, [sceneObjects]);

  useEffect(() => {
    if (tab === "testes") {
      setStudioPlay(false);
      syncStatus("idle");
      clearGameEntities();

      if (activeTest === "gravity") {
        leaveMinecraftFps();
        sceneModeRef.current = "gravity";
        updateSceneVisibility("gravity");
        clearGroupChildren(chessGroupRef.current);
        clearMinecraftTest();
        buildGravityTest();
      } else if (activeTest === "minecraft") {
        sceneModeRef.current = "minecraft";
        updateSceneVisibility("minecraft");
        clearGroupChildren(chessGroupRef.current);
        clearGravityTest();
        buildMinecraftTest();
      } else {
        leaveMinecraftFps();
        sceneModeRef.current = "chess";
        updateSceneVisibility("chess");
        clearGravityTest();
        clearMinecraftTest();
        buildChessTest();
      }
      return;
    }

    if (tab === "studio") {
      leaveMinecraftFps();
      sceneModeRef.current = "studio";
      updateSceneVisibility("studio");
      syncStatus("idle");
      clearGameEntities();
      clearGroupChildren(chessGroupRef.current);
      clearGravityTest();
      clearMinecraftTest();
      return;
    }

    sceneModeRef.current = "game";
    leaveMinecraftFps();
    setStudioPlay(false);
    updateSceneVisibility("game");
    clearGroupChildren(chessGroupRef.current);
    clearGravityTest();
    clearMinecraftTest();
    syncStatus("idle");
    clearGameEntities();
  }, [tab, activeTest]);

  useEffect(() => {
    if (tab !== "testes" || activeTest !== "chess") return;
    if (!chessVsBot) return;
    if (chessWinnerRef.current) return;
    if (chessTurn !== "black") return;

    setBotThinking(true);
    chessBotTimerRef.current = window.setTimeout(() => {
      runChessBotMove();
      chessBotTimerRef.current = null;
    }, 650);

    return () => {
      if (chessBotTimerRef.current !== null) {
        window.clearTimeout(chessBotTimerRef.current);
        chessBotTimerRef.current = null;
      }
      setBotThinking(false);
    };
  }, [chessTurn, chessVsBot, tab, activeTest]);

  useEffect(() => {
    if (chessVsBot) return;
    if (chessBotTimerRef.current !== null) {
      window.clearTimeout(chessBotTimerRef.current);
      chessBotTimerRef.current = null;
    }
    setBotThinking(false);
    if (tab === "testes" && activeTest === "chess") {
      setChessStatus(
        `Modo 2 jogadores ativo. Turno ${chessTurnRef.current === "white" ? "Branco" : "Preto"}.`,
      );
    }
  }, [chessVsBot, tab, activeTest]);

  useEffect(() => {
    resetGameState();
  }, []);

  const addObject = () => {
    const id = `obj-${Date.now()}`;
    setSceneObjects((prev) => [...prev, { id, ...form }]);
    setSelectedObjectId(id);
    setEngineNotice(`Node ${form.name} criado na SceneTree.`);
  };

  const removeObject = (id: string) => {
    setSceneObjects((prev) => prev.filter((object) => object.id !== id));
    if (selectedObjectId === id) setSelectedObjectId(null);
    setEngineNotice("Node removido da cena.");
  };

  const updateSceneObject = (id: string, partial: Partial<SceneObject>) => {
    setSceneObjects((prev) =>
      prev.map((object) =>
        object.id === id ? { ...object, ...partial } : object,
      ),
    );
  };

  const selectedSceneObject =
    sceneObjects.find((item) => item.id === selectedObjectId) ?? null;

  const duplicateSelectedObject = () => {
    if (!selectedSceneObject) return;
    const id = `obj-${Date.now()}`;
    const clone = {
      ...selectedSceneObject,
      id,
      name: `${selectedSceneObject.name}_copy`,
      x: selectedSceneObject.x + 0.8,
      z: selectedSceneObject.z + 0.8,
    };
    setSceneObjects((prev) => [...prev, clone]);
    setSelectedObjectId(id);
    setEngineNotice(`Duplicado ${selectedSceneObject.name}.`);
  };

  const exportProject = () => {
    const payload = {
      game: selectedGame,
      difficulty,
      status: gameStatus,
      script,
      sceneObjects,
    };
    const content = JSON.stringify(payload, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "gameforge-project.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const gameLabel = gameDefinitions[selectedGame].name;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/70 px-6 py-4">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-2xl font-bold tracking-tight text-cyan-300"
        >
          GameForge 3D Lab
        </motion.h1>
        <p className="mt-1 text-sm text-slate-400">
          Studio funcional com varios jogos e aba de testes com Xadrez 3D.
        </p>
      </header>

      <div className="border-b border-slate-800/70 px-6 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("jogos")}
            className={`px-3 py-2 text-sm ${tab === "jogos" ? "bg-cyan-400 font-semibold text-slate-950" : "border border-slate-700 text-slate-200"}`}
          >
            Jogos
          </button>
          <button
            onClick={() => setTab("studio")}
            className={`px-3 py-2 text-sm ${tab === "studio" ? "bg-cyan-400 font-semibold text-slate-950" : "border border-slate-700 text-slate-200"}`}
          >
            Studio
          </button>
          <button
            onClick={() => setTab("testes")}
            className={`px-3 py-2 text-sm ${tab === "testes" ? "bg-cyan-400 font-semibold text-slate-950" : "border border-slate-700 text-slate-200"}`}
          >
            Testes
          </button>
        </div>
      </div>

      <main className="grid min-h-[calc(100vh-132px)] grid-cols-1 lg:grid-cols-[360px_1fr]">
        <section className="border-b border-slate-800/70 p-5 lg:border-r lg:border-b-0">
          {tab === "jogos" && (
            <div className="space-y-4">
              <div className="border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-sm font-semibold text-cyan-300">
                  Jogos Disponiveis
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedGame === "dueloia"
                    ? "Modo IA: duelo automatico 1v1 com habilidade propria e aprendizado por calculo."
                    : "WASD move, Shift acelera, Espaco pausa."}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500">
                  Selecione o jogo
                </label>
                <select
                  value={selectedGame}
                  onChange={(event) =>
                    setSelectedGame(event.target.value as GameKey)
                  }
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
                >
                  <option value="coleta">Arena de Coleta</option>
                  <option value="sobrevivencia">Sobrevivencia</option>
                  <option value="checkpoint">Corrida de Checkpoints</option>
                  <option value="dueloia">Versus IA 1v1</option>
                </select>
                <p className="text-xs text-slate-400">
                  {gameDefinitions[selectedGame].description}
                </p>
              </div>

              {selectedGame === "dueloia" && (
                <div className="border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
                  <p>Cubo Alpha: habilidade Dash Adaptativo</p>
                  <p>Orb Beta: habilidade Shield Pulse</p>
                  <p>
                    Formula: L = clamp(L + ((dano - bloqueio * 0.1) / 120) *
                    0.55)
                  </p>
                  <p className="mt-2 text-slate-400">
                    Rodada {duelRound} | Wins Alpha {duelAlphaWins} | Wins Beta{" "}
                    {duelBetaWins}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500">
                  Dificuldade
                </label>
                <select
                  value={difficulty}
                  onChange={(event) =>
                    setDifficulty(event.target.value as DifficultyKey)
                  }
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
                >
                  <option value="facil">Facil</option>
                  <option value="normal">Normal</option>
                  <option value="dificil">Dificil</option>
                </select>
              </div>

              <div className="flex gap-2">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startGame}
                  className="flex-1 bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950"
                >
                  Play
                </motion.button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (gameStatus === "running") syncStatus("paused");
                    else if (gameStatus === "paused") syncStatus("running");
                  }}
                  className="flex-1 border border-slate-700 px-3 py-2 text-sm"
                >
                  {gameStatus === "paused" ? "Continuar" : "Pausar"}
                </motion.button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={resetGameState}
                  className="border border-slate-700 px-3 py-2 text-sm"
                >
                  Reset
                </motion.button>
              </div>
            </div>
          )}

          {tab === "studio" && (
            <div className="space-y-4">
              <div className="border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-sm font-semibold text-cyan-300">
                  Engine Runtime
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  SceneTree + Inspector + Play Mode semelhante ao fluxo da
                  Godot.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setStudioPlay((value) => !value);
                      setEngineNotice(
                        studioPlay
                          ? "Engine pausada."
                          : "Engine executando scripts e fisica.",
                      );
                    }}
                    className="flex-1 bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950"
                  >
                    {studioPlay ? "Parar Engine" : "Play Engine"}
                  </button>
                  <button
                    onClick={duplicateSelectedObject}
                    disabled={!selectedSceneObject}
                    className="border border-slate-700 px-3 py-2 text-sm disabled:opacity-40"
                  >
                    Duplicar Node
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">{engineNotice}</p>
              </div>

              <div className="grid gap-3 border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  SceneTree
                </p>
                <div className="grid max-h-36 gap-1 overflow-auto">
                  {sceneObjects.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedObjectId(item.id)}
                      className={`px-2 py-1 text-left text-xs ${selectedObjectId === item.id ? "bg-cyan-400/20 text-cyan-200" : "text-slate-300"}`}
                    >
                      {item.name} [{item.kind}]
                    </button>
                  ))}
                </div>
              </div>

              {selectedSceneObject && (
                <div className="space-y-2 border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Inspector
                  </p>
                  <input
                    value={selectedSceneObject.name}
                    onChange={(event) =>
                      updateSceneObject(selectedSceneObject.id, {
                        name: event.target.value,
                      })
                    }
                    className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={selectedSceneObject.x}
                      onChange={(event) =>
                        updateSceneObject(selectedSceneObject.id, {
                          x: Number(event.target.value),
                        })
                      }
                      className="border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={selectedSceneObject.y}
                      onChange={(event) =>
                        updateSceneObject(selectedSceneObject.id, {
                          y: Number(event.target.value),
                        })
                      }
                      className="border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={selectedSceneObject.z}
                      onChange={(event) =>
                        updateSceneObject(selectedSceneObject.id, {
                          z: Number(event.target.value),
                        })
                      }
                      className="border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedSceneObject.rigidBody}
                        onChange={(event) =>
                          updateSceneObject(selectedSceneObject.id, {
                            rigidBody: event.target.checked,
                          })
                        }
                      />
                      RigidBody
                    </label>
                    <select
                      value={selectedSceneObject.scriptMode}
                      onChange={(event) =>
                        updateSceneObject(selectedSceneObject.id, {
                          scriptMode: event.target
                            .value as SceneObject["scriptMode"],
                        })
                      }
                      className="border border-slate-700 bg-slate-950 px-2 py-2 text-xs"
                    >
                      <option value="none">Script: none</option>
                      <option value="orbitar">Script: orbitar</option>
                      <option value="pulsar">Script: pulsar</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500">
                  Template
                </label>
                <select
                  value={template}
                  onChange={(event) => {
                    const next = event.target.value as keyof typeof templates;
                    setTemplate(next);
                    setScript(templates[next]);
                  }}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none transition focus:border-cyan-400"
                >
                  <option value="plataforma">Plataforma 3D</option>
                  <option value="corrida">Corrida 3D</option>
                  <option value="shooter">Shooter 3D</option>
                </select>
              </div>

              <textarea
                value={script}
                onChange={(event) => setScript(event.target.value)}
                className="h-44 w-full border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 outline-none transition focus:border-cyan-400"
              />

              <div className="space-y-3 border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Criar objeto 3D
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                  />
                  <select
                    value={form.kind}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        kind: event.target.value as ObjectKind,
                      }))
                    }
                    className="border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                  >
                    <option value="cubo">Cubo</option>
                    <option value="esfera">Esfera</option>
                    <option value="cone">Cone</option>
                  </select>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        color: event.target.value,
                      }))
                    }
                    className="h-10 w-full border border-slate-700 bg-slate-950"
                  />
                  <input
                    type="number"
                    value={form.x}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        x: Number(event.target.value),
                      }))
                    }
                    className="border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={form.y}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        y: Number(event.target.value),
                      }))
                    }
                    className="border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={form.z}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        z: Number(event.target.value),
                      }))
                    }
                    className="border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0.3}
                    step={0.1}
                    value={form.scale}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        scale: Number(event.target.value),
                      }))
                    }
                    className="border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.rigidBody}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          rigidBody: event.target.checked,
                        }))
                      }
                    />
                    RigidBody
                  </label>
                  <select
                    value={form.scriptMode}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        scriptMode: event.target
                          .value as SceneObject["scriptMode"],
                      }))
                    }
                    className="border border-slate-700 bg-slate-950 px-2 py-2 text-xs"
                  >
                    <option value="none">Script none</option>
                    <option value="orbitar">Script orbitar</option>
                    <option value="pulsar">Script pulsar</option>
                  </select>
                </div>
                <input
                  type="range"
                  min={0.002}
                  max={0.05}
                  step={0.002}
                  value={form.rotationSpeed}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      rotationSpeed: Number(event.target.value),
                    }))
                  }
                  className="w-full accent-cyan-400"
                />
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={addObject}
                  className="w-full bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950"
                >
                  Adicionar objeto
                </motion.button>
              </div>
            </div>
          )}

          {tab === "testes" && (
            <div className="space-y-4">
              <div className="border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-sm font-semibold text-cyan-300">
                  Aba de Testes
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Teste ativo:{" "}
                  {activeTest === "chess"
                    ? "Xadrez 3D"
                    : activeTest === "gravity"
                      ? "Laboratorio de Gravidade"
                      : "Minecraft"}
                  .
                </p>
                {activeTest === "chess" && (
                  <>
                    <p className="mt-2 text-xs text-slate-300">
                      Turno: {chessTurn === "white" ? "Brancas" : "Pretas"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{chessStatus}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Modo: {chessVsBot ? "Contra Bot" : "2 Jogadores"}
                    </p>
                    {botThinking && (
                      <p className="mt-1 text-xs text-amber-300">
                        Bot pensando...
                      </p>
                    )}
                  </>
                )}
                {activeTest === "gravity" && (
                  <p className="mt-2 text-xs text-slate-300">{gravityInfo}</p>
                )}
                {activeTest === "minecraft" && (
                  <>
                    <p className="mt-2 text-xs text-slate-300">
                      {minecraftInfo}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Blocos no mundo: {voxelCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Esquerdo quebra, direito coloca. Hotbar: teclas 1-5.
                    </p>
                    <div className="mt-2">
                      <label className="text-[11px] text-slate-400">
                        Render distance: {minecraftRenderDistance}
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={1}
                        value={minecraftRenderDistance}
                        onChange={(event) =>
                          setMinecraftRenderDistance(Number(event.target.value))
                        }
                        className="mt-1 w-full accent-cyan-400"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTest("chess")}
                  className={`flex-1 px-3 py-2 text-sm ${activeTest === "chess" ? "bg-cyan-400 font-semibold text-slate-950" : "border border-slate-700"}`}
                >
                  Teste Xadrez
                </button>
                <button
                  onClick={() => setActiveTest("gravity")}
                  className={`flex-1 px-3 py-2 text-sm ${activeTest === "gravity" ? "bg-cyan-400 font-semibold text-slate-950" : "border border-slate-700"}`}
                >
                  Teste Gravidade
                </button>
                <button
                  onClick={() => setActiveTest("minecraft")}
                  className={`flex-1 px-3 py-2 text-sm ${activeTest === "minecraft" ? "bg-cyan-400 font-semibold text-slate-950" : "border border-slate-700"}`}
                >
                  Teste Minecraft
                </button>
              </div>

              {activeTest === "minecraft" && (
                <div className="grid grid-cols-5 gap-2">
                  {(
                    [
                      "grama",
                      "terra",
                      "pedra",
                      "madeira",
                      "areia",
                    ] as BlockType[]
                  ).map((block) => (
                    <button
                      key={block}
                      onClick={() => setSelectedBlock(block)}
                      className={`px-2 py-2 text-xs ${selectedBlock === block ? "bg-cyan-400 text-slate-950" : "border border-slate-700 text-slate-200"}`}
                    >
                      {block}
                    </button>
                  ))}
                </div>
              )}

              {activeTest === "minecraft" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setMinecraftMode("survival");
                      setMinecraftInfo(
                        "Modo Survival: gravidade, pulo e corrida.",
                      );
                    }}
                    className={`px-3 py-2 text-sm ${minecraftMode === "survival" ? "bg-cyan-400 font-semibold text-slate-950" : "border border-slate-700"}`}
                  >
                    Survival
                  </button>
                  <button
                    onClick={() => {
                      setMinecraftMode("creative");
                      setMinecraftInfo(
                        "Modo Creative: voo vertical com Space e Shift.",
                      );
                    }}
                    className={`px-3 py-2 text-sm ${minecraftMode === "creative" ? "bg-cyan-400 font-semibold text-slate-950" : "border border-slate-700"}`}
                  >
                    Creative
                  </button>
                  <button
                    onClick={enterMinecraftFps}
                    className="bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950"
                  >
                    Entrar FPS
                  </button>
                  <button
                    onClick={leaveMinecraftFps}
                    className="border border-slate-700 px-3 py-2 text-sm"
                  >
                    Sair FPS
                  </button>
                  <p className="col-span-2 text-xs text-slate-400">
                    Camera:{" "}
                    {minecraftView === "fps" ? "Primeira pessoa" : "Orbital"} |
                    Pointer: {minecraftLocked ? "travado" : "livre"} | Modo:{" "}
                    {minecraftMode}
                  </p>
                </div>
              )}
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (chessBotTimerRef.current !== null) {
                    window.clearTimeout(chessBotTimerRef.current);
                    chessBotTimerRef.current = null;
                  }
                  setBotThinking(false);
                  setChessVsBot((value) => !value);
                  setChessStatus("Modo de xadrez alterado.");
                }}
                disabled={activeTest !== "chess"}
                className="w-full border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-200"
              >
                {chessVsBot ? "Trocar para 2 Jogadores" : "Ativar Contra Bot"}
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (activeTest === "chess") buildChessTest();
                  else if (activeTest === "gravity") buildGravityTest();
                  else buildMinecraftTest();
                }}
                className="w-full bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                {activeTest === "chess"
                  ? "Recarregar teste Xadrez 3D"
                  : activeTest === "gravity"
                    ? "Reiniciar teste de Gravidade"
                    : "Recriar mundo Minecraft"}
              </motion.button>
              <p className="text-xs text-slate-400">
                Camera livre: arraste para orbitar e use scroll para zoom.
              </p>
            </div>
          )}
        </section>

        <section className="grid grid-rows-[1fr_auto]">
          <div
            ref={mountRef}
            className="relative min-h-[460px] w-full overflow-hidden"
          >
            {tab === "testes" &&
              activeTest === "minecraft" &&
              minecraftView === "fps" && (
                <div className="pointer-events-none absolute inset-0 z-20">
                  <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 bg-cyan-200/90" />
                    <div className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 bg-cyan-200/90" />
                  </div>
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1">
                    {(
                      [
                        "grama",
                        "terra",
                        "pedra",
                        "madeira",
                        "areia",
                      ] as BlockType[]
                    ).map((block, index) => (
                      <div
                        key={`hud-${block}`}
                        className={`min-w-14 border px-2 py-1 text-center text-[10px] uppercase ${selectedBlock === block ? "border-cyan-300 bg-slate-900/90 text-cyan-200" : "border-slate-600 bg-slate-900/70 text-slate-300"}`}
                      >
                        {index + 1} {block}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-2 text-xs">
              <motion.div
                key={`game-${selectedGame}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="border border-cyan-700/70 bg-slate-900/70 px-3 py-2"
              >
                Modo{" "}
                {tab === "testes"
                  ? activeTest === "chess"
                    ? "Xadrez 3D"
                    : activeTest === "gravity"
                      ? "Gravidade"
                      : "Minecraft"
                  : gameLabel}
              </motion.div>
              <motion.div
                key={`time-${timeLeft}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="border border-cyan-700/70 bg-slate-900/70 px-3 py-2"
              >
                {tab === "jogos"
                  ? `Tempo ${timeLeft}s`
                  : tab === "studio"
                    ? "Modo Studio"
                    : activeTest === "chess"
                      ? `Xadrez turno ${chessTurn === "white" ? "Brancas" : "Pretas"}`
                      : activeTest === "gravity"
                        ? "Gravidade ativa"
                        : `Minecraft bloco ${selectedBlock}`}
              </motion.div>
              {tab === "jogos" && (
                <div className="border border-cyan-700/70 bg-slate-900/70 px-3 py-2">
                  Vidas {lives}
                </div>
              )}
              {tab === "jogos" && (
                <div className="border border-cyan-700/70 bg-slate-900/70 px-3 py-2">
                  Score {score}
                </div>
              )}
              {tab === "jogos" && (
                <div className="border border-cyan-700/70 bg-slate-900/70 px-3 py-2">
                  Objetivo {objectiveLeft}
                </div>
              )}
              {tab === "jogos" && selectedGame === "dueloia" && (
                <div className="border border-cyan-700/70 bg-slate-900/70 px-3 py-2">
                  Alpha HP {duelAlphaHp}
                </div>
              )}
              {tab === "jogos" && selectedGame === "dueloia" && (
                <div className="border border-cyan-700/70 bg-slate-900/70 px-3 py-2">
                  Beta HP {duelBetaHp}
                </div>
              )}
            </div>

            {tab === "jogos" &&
              gameStatus !== "running" &&
              gameStatus !== "paused" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/40">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={startGame}
                    className="flex items-center gap-3 border border-cyan-500 bg-slate-900/85 px-6 py-3 text-sm font-semibold text-cyan-200"
                  >
                    <span className="inline-block h-0 w-0 border-b-[10px] border-l-[16px] border-t-[10px] border-b-transparent border-l-cyan-300 border-t-transparent" />
                    Play {gameDefinitions[selectedGame].name}
                  </motion.button>
                </div>
              )}

            <AnimatePresence>
              {(gameStatus === "won" ||
                gameStatus === "lost" ||
                gameStatus === "paused") &&
                tab === "jogos" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-1/2 top-5 z-10 -translate-x-1/2 border border-cyan-700/70 bg-slate-950/85 px-4 py-2 text-sm"
                  >
                    {gameStatus === "won" && "Vitoria"}
                    {gameStatus === "lost" && "Derrota"}
                    {gameStatus === "paused" && "Pausado"}
                  </motion.div>
                )}
            </AnimatePresence>
          </div>

          <div className="border-t border-slate-800/70 bg-slate-900/70 p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
              <p>Objetos do studio: {studioStats.total}</p>
              <p>Rotacao media: {studioStats.averageRotation.toFixed(3)}</p>
            </div>

            <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
              <p>Status do jogo: {gameStatus}</p>
              <p>Dificuldade: {difficulty}</p>
            </div>

            {tab === "jogos" && selectedGame === "dueloia" && (
              <p className="mb-3 text-xs text-slate-400">{duelLog}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {sceneObjects.map((item) => (
                <button
                  key={item.id}
                  onClick={() => removeObject(item.id)}
                  className="border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-rose-400 hover:text-rose-300"
                >
                  remover {item.kind}
                </button>
              ))}
              <button
                onClick={exportProject}
                className="bg-emerald-400 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Exportar projeto JSON
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
