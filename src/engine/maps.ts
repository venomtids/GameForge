import { createProject, makeNode, uid, type Project, type Kind } from "./model";
export function baseMap(kind: "grass" | "hills" | "shapes"): Project {
  const p = createProject();
  p.name =
    kind === "grass"
      ? "Base · Gramado e céu"
      : kind === "hills"
        ? "Base · Colinas contínuas"
        : "Galeria · Formas avançadas";
  p.settings.sky = {
    enabled: true,
    sunElevation: 50,
    sunAzimuth: 35,
    clouds: true,
  };
  p.settings.gameCamera = "first";
  p.scenes[0].name = p.name;
  const base =
    kind === "hills"
      ? makeNode("terrain", {
          name: "Colinas esculpíveis",
          position: [0, 0, 0],
          physics: "static",
          color: "#ffffff",
        })
      : makeNode("box", {
          name: "Gramado",
          position: [0, -0.5, 0],
          scale: [40, 1, 40],
          color: "#6b984e",
          physics: "static",
          restitution: 0,
        });
  if (base.surface) {
    const s = base.surface;
    for (let z = 0; z < s.resolution; z++)
      for (let x = 0; x < s.resolution; x++) {
        const xx = x - s.resolution / 2,
          zz = z - s.resolution / 2;
        s.heights[z * s.resolution + x] =
          Math.sin(xx * 0.24) * Math.cos(zz * 0.2) * 2;
      }
  }
  const player = makeNode("box", {
    id: uid(),
    name: "Jogador",
    position: [0, 4, 9],
    scale: [0.6, 1.7, 0.6],
    behavior: "player",
    physics: "dynamic",
    speed: 7,
    restitution: 0,
  });
  p.scenes[0].nodes = [base, player];
  if (kind === "shapes")
    (["wedge", "capsule", "torus", "arch", "rock", "star"] as Kind[]).forEach(
      (kind, i) =>
        p.scenes[0].nodes.push(
          makeNode(kind, {
            position: [((i % 3) - 1) * 5, 1.5, Math.floor(i / 3) * 5 - 3],
            scale: [1.5, 1.5, 1.5],
            color: [
              "#e1b27d",
              "#82baa0",
              "#83cbd4",
              "#dba6ab",
              "#adb5c5",
              "#e2ca77",
            ][i],
            physics: "static",
          }),
        ),
    );
  return p;
}
