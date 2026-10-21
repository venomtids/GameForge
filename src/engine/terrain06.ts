import { flatSurface, type Surface } from "./studio-model";
export interface TerrainOptions {
  size: number;
  resolution: 17 | 33 | 65;
  preset: "flat" | "hills" | "mountains" | "dunes";
  amplitude: number;
  frequency: number;
  seed: number;
  color: string;
}
export const terrainDefaults: TerrainOptions = {
  size: 32,
  resolution: 33,
  preset: "hills",
  amplitude: 3,
  frequency: 2,
  seed: 7,
  color: "#6b984e",
};
export function generateTerrain(o: TerrainOptions): Surface {
  const s = flatSurface(o.resolution, o.size);
  s.colors.fill(o.color);
  const seed = o.seed * 0.631;
  for (let z = 0; z < o.resolution; z++)
    for (let x = 0; x < o.resolution; x++) {
      const a = (x / (o.resolution - 1)) * Math.PI * o.frequency,
        b = (z / (o.resolution - 1)) * Math.PI * o.frequency;
      const low = Math.sin(a + seed) * Math.cos(b - seed),
        detail =
          Math.sin(a * 2.13 + seed * 3) * Math.cos(b * 1.91 + seed) * 0.25;
      let h = 0;
      if (o.preset === "hills") h = (low + detail) * o.amplitude;
      if (o.preset === "mountains")
        h = (Math.pow(1 - Math.abs(low), 2) + detail * 0.5) * o.amplitude * 2;
      if (o.preset === "dunes")
        h = (Math.sin(a + Math.sin(b * 0.7)) * 0.7 + 0.7) * o.amplitude;
      s.heights[z * o.resolution + x] = Math.max(-20, Math.min(40, h));
    }
  return s;
}
