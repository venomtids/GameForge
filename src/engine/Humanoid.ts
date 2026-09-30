import * as THREE from "three";
import type { Node3D } from "./model";
export interface Limbs {
  visual: THREE.Group;
  lean: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  phase: number;
  heading: number;
  time: number;
  land: number;
  airAnterior?: boolean;
}
function material(color: string, list: THREE.MeshStandardMaterial[]) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  list.push(m);
  return m;
}
function box(
  size: number[],
  position: number[],
  mat: THREE.MeshStandardMaterial,
) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    mat,
  );
  m.position.set(position[0], position[1], position[2]);
  return m;
}
/** Corpo articulado de verdade: quadril, joelhos, ombros, cotovelos e cabeça. */
export function humanoid(n: Node3D) {
  const root = new THREE.Group(),
    lean = new THREE.Group(),
    visual = new THREE.Group(),
    materials: THREE.MeshStandardMaterial[] = [];
  root.add(lean);
  lean.add(visual);
  const tecido = material(n.color, materials),
    pele = material(n.actor.skin, materials),
    calca = material("#425463", materials),
    escuro = material("#2b333a", materials),
    cabelo = material("#2a2320", materials);

  // tronco
  visual.add(box([0.44, 0.16, 0.28], [0, 0.02, 0], calca)); // quadril
  visual.add(box([0.5, 0.38, 0.3], [0, 0.27, 0], tecido)); // torso
  visual.add(box([0.54, 0.16, 0.32], [0, 0.45, 0], tecido)); // ombros
  // cabeça
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0);
  head.add(box([0.14, 0.1, 0.14], [0, 0.05, 0], pele)); // pescoço
  head.add(box([0.32, 0.3, 0.3], [0, 0.24, 0], pele)); // crânio
  head.add(box([0.34, 0.08, 0.32], [0, 0.4, 0.01], cabelo)); // cabelo
  head.add(box([0.34, 0.16, 0.06], [0, 0.28, 0.16], cabelo)); // nuca
  for (const x of [-0.08, 0.08]) {
    head.add(box([0.06, 0.05, 0.02], [x, 0.26, -0.155], escuro)); // olhos
    head.add(box([0.03, 0.02, 0.02], [x, 0.24, -0.16], material("#ffffff", materials)));
  }
  head.add(box([0.1, 0.02, 0.02], [0, 0.16, -0.15], escuro)); // boca
  visual.add(head);

  const arm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.32, 0.44, 0);
    shoulder.add(box([0.15, 0.26, 0.17], [0, -0.13, 0], tecido));
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.26, 0);
    elbow.add(box([0.12, 0.24, 0.14], [0, -0.12, 0], pele));
    elbow.add(box([0.13, 0.11, 0.16], [0, -0.28, 0], pele)); // mão
    shoulder.add(elbow);
    visual.add(shoulder);
    return { shoulder, elbow };
  };
  const leg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0, 0);
    hip.add(box([0.2, 0.28, 0.22], [0, -0.14, 0], calca));
    const knee = new THREE.Group();
    knee.position.set(0, -0.28, 0);
    knee.add(box([0.17, 0.24, 0.19], [0, -0.12, 0], calca));
    knee.add(box([0.19, 0.09, 0.28], [0, -0.27, -0.05], escuro)); // pé
    hip.add(knee);
    visual.add(hip);
    return { hip, knee };
  };
  const bracoE = arm(-1),
    bracoD = arm(1),
    pernaE = leg(-1),
    pernaD = leg(1);

  root.userData.limbs = {
    visual,
    lean,
    head,
    leftArm: bracoE.shoulder,
    rightArm: bracoD.shoulder,
    leftElbow: bracoE.elbow,
    rightElbow: bracoD.elbow,
    leftLeg: pernaE.hip,
    rightLeg: pernaD.hip,
    leftKnee: pernaE.knee,
    rightKnee: pernaD.knee,
    materials,
    phase: 0,
    heading: 0,
    time: 0,
    land: 0,
  } satisfies Limbs;
  root.traverse((o) => {
    o.userData.nodeId = n.id;
    o.castShadow = n.castShadow;
    o.receiveShadow = n.receiveShadow;
  });
  return root;
}
const suave = (atual: number, alvo: number, k: number) =>
  atual + (alvo - atual) * k;
/** Ciclo de caminhada/corrida, respiração parado, pose de salto e impacto. */
export function animateHumanoid(
  o: THREE.Object3D,
  n: Node3D,
  dt: number,
  vx: number,
  vz: number,
  grounded: boolean,
  vy = 0,
) {
  const h = o.userData.limbs as Limbs | undefined;
  if (!h) return;
  const velocidade = Math.hypot(vx, vz),
    andando = velocidade > 0.15,
    correndo = velocidade > (n.speed || 5) * 0.72,
    anim = Math.max(0.2, n.actor.animationSpeed || 1),
    blend = 1 - Math.exp(-16 * dt);
  h.time += dt;
  h.phase += andando ? dt * anim * (2.1 + velocidade * 1.45) : dt * anim * 1.4;
  if (andando) {
    const destino = Math.atan2(-vx, -vz);
    h.heading +=
      Math.atan2(
        Math.sin(destino - h.heading),
        Math.cos(destino - h.heading),
      ) * Math.min(1, dt * 10);
  }
  h.visual.rotation.y = h.heading;
  const passo = Math.min(1, velocidade / Math.max(1.2, n.speed || 5)),
    amp = andando ? 0.42 + passo * 0.62 : 0,
    seno = Math.sin(h.phase),
    senoDir = Math.sin(h.phase + Math.PI);
  if (!grounded) {
    // no ar: pernas recolhidas, braços para cima
    h.leftLeg.rotation.x = suave(h.leftLeg.rotation.x, -0.5, blend);
    h.rightLeg.rotation.x = suave(h.rightLeg.rotation.x, 0.34, blend);
    h.leftKnee.rotation.x = suave(h.leftKnee.rotation.x, -0.95, blend);
    h.rightKnee.rotation.x = suave(h.rightKnee.rotation.x, -0.55, blend);
    h.leftArm.rotation.x = suave(h.leftArm.rotation.x, -1.15, blend);
    h.rightArm.rotation.x = suave(h.rightArm.rotation.x, -1.05, blend);
    h.leftArm.rotation.z = suave(h.leftArm.rotation.z, 0.32, blend);
    h.rightArm.rotation.z = suave(h.rightArm.rotation.z, -0.32, blend);
    h.leftElbow.rotation.x = suave(h.leftElbow.rotation.x, -0.55, blend);
    h.rightElbow.rotation.x = suave(h.rightElbow.rotation.x, -0.5, blend);
    h.head.rotation.x = suave(h.head.rotation.x, -0.12, blend);
  } else if (andando) {
    const swingE = seno * amp,
      swingD = senoDir * amp;
    h.leftLeg.rotation.x = swingE;
    h.rightLeg.rotation.x = swingD;
    // joelho dobra quando a perna vai para trás
    h.leftKnee.rotation.x = -Math.max(0, swingE) * 1.05 - (correndo ? 0.2 : 0.06);
    h.rightKnee.rotation.x =
      -Math.max(0, swingD) * 1.05 - (correndo ? 0.2 : 0.06);
    h.leftArm.rotation.x = suave(h.leftArm.rotation.x, -swingE * 0.78, blend);
    h.rightArm.rotation.x = suave(h.rightArm.rotation.x, -swingD * 0.78, blend);
    h.leftElbow.rotation.x = -0.34 - Math.max(0, -swingE) * 0.5;
    h.rightElbow.rotation.x = -0.34 - Math.max(0, -swingD) * 0.5;
    h.leftArm.rotation.z = suave(h.leftArm.rotation.z, 0.1, blend);
    h.rightArm.rotation.z = suave(h.rightArm.rotation.z, -0.1, blend);
    h.head.rotation.x = suave(h.head.rotation.x, correndo ? 0.08 : 0.02, blend);
    h.lean.rotation.x = suave(h.lean.rotation.x, correndo ? -0.16 : -0.05, blend);
    h.visual.rotation.z = seno * 0.045 * passo;
    h.lean.position.y =
      Math.abs(seno) * (correndo ? 0.05 : 0.028) * passo + h.land * 0.05;
  } else {
    // parado: respiração, peso do corpo e braços relaxados
    const respira = Math.sin(h.time * 1.7) * 0.5 + 0.5;
    h.leftLeg.rotation.x = suave(h.leftLeg.rotation.x, 0, blend);
    h.rightLeg.rotation.x = suave(h.rightLeg.rotation.x, 0, blend);
    h.leftKnee.rotation.x = suave(h.leftKnee.rotation.x, -0.04, blend);
    h.rightKnee.rotation.x = suave(h.rightKnee.rotation.x, -0.04, blend);
    h.leftArm.rotation.x = suave(h.leftArm.rotation.x, respira * 0.05, blend);
    h.rightArm.rotation.x = suave(
      h.rightArm.rotation.x,
      -respira * 0.05,
      blend,
    );
    h.leftArm.rotation.z = suave(h.leftArm.rotation.z, 0.08, blend);
    h.rightArm.rotation.z = suave(h.rightArm.rotation.z, -0.08, blend);
    h.leftElbow.rotation.x = suave(h.leftElbow.rotation.x, -0.22, blend);
    h.rightElbow.rotation.x = suave(h.rightElbow.rotation.x, -0.22, blend);
    h.head.rotation.x = suave(h.head.rotation.x, respira * 0.03, blend);
    h.lean.rotation.x = suave(h.lean.rotation.x, 0, blend);
    h.lean.position.y = respira * 0.012 + h.land * 0.05;
    h.visual.rotation.z = suave(h.visual.rotation.z, 0, blend);
  }
  if (grounded && h.airAnterior === false && Math.abs(vy) > 2)
    h.land = Math.min(1, Math.abs(vy) / 9);
  h.airAnterior = grounded;
  h.land = Math.max(0, h.land - dt * 3.2);
  const agacha = h.land * 0.5;
  h.lean.scale.set(1 + agacha * 0.18, 1 - agacha * 0.3, 1 + agacha * 0.18);
}

export interface FpsArms extends THREE.Group {
  userData: {
    phase: number;
    lanterna: THREE.Group;
    esquerda: { braco: THREE.Group; mao: THREE.Mesh };
    direita: { braco: THREE.Group; mao: THREE.Mesh };
  };
}
/** Braços em primeira pessoa com lanterna na mão direita. */
export function fpsArms() {
  const group = new THREE.Group() as FpsArms;
  const material = (color: string) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      depthTest: false,
      depthWrite: false,
    });
  const pele = material("#ddb48d"),
    tecido = material("#4d6a72"),
    metal = material("#3d4249");
  const build = (side: number) => {
    const braco = new THREE.Group();
    braco.position.set(side * 0.22, -0.3, -0.1);
    braco.rotation.z = side * 0.1;
    const antebraco = box([0.11, 0.12, 0.34], [0, 0, -0.17], tecido);
    antebraco.renderOrder = 1000;
    const mao = box([0.1, 0.1, 0.14], [0, -0.01, -0.36], pele);
    mao.renderOrder = 1001;
    braco.add(antebraco, mao);
    return { braco, mao };
  };
  const esquerda = build(-1),
    direita = build(1);
  // lanterna na mão direita
  const lanterna = new THREE.Group();
  lanterna.position.set(0, 0.02, -0.48);
  const corpo = box([0.09, 0.09, 0.3], [0, 0, 0], metal);
  corpo.renderOrder = 1001;
  const lente = box([0.11, 0.11, 0.05], [0, 0, -0.17], material("#ffe9b8"));
  lente.renderOrder = 1002;
  lanterna.add(corpo, lente);
  direita.mao.add(lanterna);
  group.add(esquerda.braco, direita.braco);
  group.userData = {
    phase: 0,
    lanterna,
    esquerda,
    direita,
    prop: null,
  } as FpsArms["userData"];
  return group;
}
/** Modelos prontos de "coisa na mao": a engine entrega a forma, o jogo escolhe qual. */
export function handProp(kind: string) {
  const material = (color: string, metalness = 0.2) =>
    new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness: 0.45,
      depthTest: false,
      depthWrite: false,
    });
  const grupo = new THREE.Group();
  grupo.position.set(0, -0.02, -0.42);
  grupo.rotation.set(-0.25, 0, 0);
  const peca = (
    geo: THREE.BufferGeometry,
    cor: string,
    pos: [number, number, number],
    rot?: [number, number, number],
    metalness = 0.2,
  ) => {
    const m = new THREE.Mesh(geo, material(cor, metalness));
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.renderOrder = 1002;
    grupo.add(m);
    return m;
  };
  const caixa = (s: [number, number, number]) => new THREE.BoxGeometry(...s);
  if (kind === "chave") {
    peca(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 6), "#ffe08a", [0, 0, 0], [Math.PI / 2, 0, 0], 0.6);
    peca(new THREE.TorusGeometry(0.05, 0.014, 6, 12), "#ffe08a", [0, 0, 0.15], [0, 0, 0], 0.6);
    peca(caixa([0.012, 0.05, 0.03]), "#ffe08a", [0.02, 0, -0.11], undefined, 0.6);
  } else if (kind === "gazua") {
    peca(caixa([0.03, 0.012, 0.3]), "#cfd6dd", [0, 0, 0], undefined, 0.7);
    peca(caixa([0.03, 0.012, 0.12]), "#cfd6dd", [0, 0.02, -0.16], [0, 0.9, 0], 0.7);
    peca(caixa([0.03, 0.012, 0.09]), "#cfd6dd", [0, 0.02, 0.15], [0, 2.4, 0], 0.7);
  } else if (kind === "crucifixo") {
    peca(caixa([0.03, 0.26, 0.03]), "#d8b46a", [0, 0.05, 0], undefined, 0.65);
    peca(caixa([0.16, 0.03, 0.03]), "#d8b46a", [0, 0.14, 0], undefined, 0.65);
  } else if (kind === "pilha") {
    peca(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), "#3f4a52", [0, 0, 0], [Math.PI / 2, 0, 0]);
    peca(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8), "#c9a24a", [0, 0, -0.09], [Math.PI / 2, 0, 0], 0.7);
  } else if (kind === "curativo") {
    peca(caixa([0.14, 0.06, 0.1]), "#e8e4dc", [0, 0, 0]);
    peca(caixa([0.09, 0.02, 0.03]), "#c8503f", [0, 0.033, 0]);
    peca(caixa([0.03, 0.02, 0.08]), "#c8503f", [0, 0.033, 0]);
  } else if (kind === "moeda") {
    peca(new THREE.CylinderGeometry(0.06, 0.06, 0.014, 14), "#f2c85a", [0, 0, 0], [Math.PI / 2, 0, 0], 0.6);
  } else if (kind === "radio") {
    peca(caixa([0.16, 0.1, 0.08]), "#2f3a44", [0, 0, 0]);
    peca(caixa([0.1, 0.05, 0.01]), "#8fe6c8", [0, 0.01, -0.045]);
  } else if (kind === "vitamina") {
    peca(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10), "#e0783c", [0, 0, 0], [Math.PI / 2, 0, 0]);
    peca(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), "#f4f1e6", [0, 0, -0.075], [Math.PI / 2, 0, 0]);
  } else return null;
  return grupo;
}
/** Troca o objeto da mao livre (kind vazio devolve a mao vazia). */
export function setHandProp(arms: THREE.Group, kind: string) {
  const dados = arms.userData as any;
  if (!dados) return;
  if (dados.prop) {
    dados.prop.removeFromParent();
    dados.prop.traverse((o: any) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    dados.prop = null;
  }
  if (!kind || kind === "nenhum") return;
  const grupo = handProp(kind);
  if (!grupo) return;
  dados.esquerda.mao.add(grupo);
  dados.prop = grupo;
}
/** Balanço dos braços conforme o jogador anda ou corre. */
export function animateArms(
  arms: THREE.Group,
  dt: number,
  velocidade: number,
  grounded: boolean,
) {
  const dados = arms.userData as any;
  if (!dados) return;
  const andando = velocidade > 0.2 && grounded,
    passo = Math.min(1, velocidade / 6);
  dados.phase += dt * (andando ? 3 + velocidade * 1.2 : 1.1);
  dados.phase = dados.phase % (Math.PI * 2);
  const seno = Math.sin(dados.phase),
    amp = andando ? 0.02 + passo * 0.028 : 0.004;
  arms.position.y = seno * amp;
  arms.position.x = Math.cos(dados.phase * 0.5) * (andando ? 0.008 : 0.002);
  arms.rotation.z = -seno * (andando ? 0.02 : 0.004);
  if (dados.esquerda) dados.esquerda.braco.rotation.x = -seno * amp * 6;
  if (dados.direita) dados.direita.braco.rotation.x = seno * amp * 6;
}
