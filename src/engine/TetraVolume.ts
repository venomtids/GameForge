import * as CANNON from "cannon-es";
import * as THREE from "three";

/** Six positive signed tetrahedra covering the eight corners of a hexahedron.
 * Low-resolution XPBD volumetric constraint inspired by PositionBasedDynamics
 * (MIT); NOT a Green-strain / corotated continuum FEM solver. */
export const CUBE_TETRAHEDRA = [
  [0, 1, 3, 7],
  [0, 3, 2, 7],
  [0, 2, 6, 7],
  [0, 6, 4, 7],
  [0, 4, 5, 7],
  [0, 5, 1, 7],
] as const;

export function signedTetraVolume(
  p: readonly { x: number; y: number; z: number }[],
) {
  const [a, b, c, d] = p;
  const ux = b.x - a.x,
    uy = b.y - a.y,
    uz = b.z - a.z;
  const vx = c.x - a.x,
    vy = c.y - a.y,
    vz = c.z - a.z;
  const wx = d.x - a.x,
    wy = d.y - a.y,
    wz = d.z - a.z;
  return (
    (ux * (vy * wz - vz * wy) +
      uy * (vz * wx - vx * wz) +
      uz * (vx * wy - vy * wx)) /
    6
  );
}

/** XPBD on the *signed volume of each tetrahedron*, not just a box determinant.
 * Compliance controls near-incompressibility; no force is injected on expansion
 * in the fluid-like mode (a bounded closed drop, not a free SPH liquid). */
export class TetraVolume {
  readonly rest: number[];
  readonly gradients = Array.from({ length: 4 }, () => new THREE.Vector3());
  private lambda = new Float64Array(CUBE_TETRAHEDRA.length);
  private u = new THREE.Vector3();
  private v = new THREE.Vector3();
  private w = new THREE.Vector3();
  private before = new THREE.Vector3();
  minRatio = 1;
  inversions = 0;

  constructor(
    private bodies: CANNON.Body[],
    rest: THREE.Vector3[],
    private minSize: number,
  ) {
    this.rest = CUBE_TETRAHEDRA.map((tet) =>
      signedTetraVolume(tet.map((i) => rest[i])),
    );
    if (this.rest.some((v) => !Number.isFinite(v) || v <= 0))
      throw Error("Cage has a degenerate or reversed tetrahedron.");
  }

  project(dt: number, recovery: number, fluidity = 0) {
    if (recovery <= 0 || dt <= 0 || !Number.isFinite(dt)) return;
    this.lambda.fill(0);
    const alpha =
      ((0.00008 * (1 - recovery)) / Math.max(0.025, recovery) + 0.0000005) /
      (dt * dt);
    const cap = this.minSize * 0.018;
    for (let pass = 0; pass < 3; pass++) {
      CUBE_TETRAHEDRA.forEach((tet, k) => {
        const [a, b, c, d] = tet.map((i) => this.bodies[i]);
        const volume = signedTetraVolume([
          a.position,
          b.position,
          c.position,
          d.position,
        ]);
        const original = this.rest[k];
        if (!Number.isFinite(volume)) return;
        if (fluidity > 0.6 && volume > original) return; // PBF-like compression-only pressure.
        // Use C = V/V_rest - 1; gradients and compliance are scale invariant.
        const constraint = volume / original - 1;
        this.u.set(
          b.position.x - a.position.x,
          b.position.y - a.position.y,
          b.position.z - a.position.z,
        );
        this.v.set(
          c.position.x - a.position.x,
          c.position.y - a.position.y,
          c.position.z - a.position.z,
        );
        this.w.set(
          d.position.x - a.position.x,
          d.position.y - a.position.y,
          d.position.z - a.position.z,
        );
        this.gradients[1]
          .crossVectors(this.v, this.w)
          .multiplyScalar(1 / (6 * original));
        this.gradients[2]
          .crossVectors(this.w, this.u)
          .multiplyScalar(1 / (6 * original));
        this.gradients[3]
          .crossVectors(this.u, this.v)
          .multiplyScalar(1 / (6 * original));
        this.gradients[0]
          .copy(this.gradients[1])
          .add(this.gradients[2])
          .add(this.gradients[3])
          .negate();
        const particles = [a, b, c, d];
        let denominator = alpha;
        for (let i = 0; i < 4; i++)
          denominator += particles[i].invMass * this.gradients[i].lengthSq();
        if (!(denominator > 1e-10)) return;
        let increment = (-constraint - alpha * this.lambda[k]) / denominator;
        // A very deep inversion can produce explosive corrections without bounds.
        increment = THREE.MathUtils.clamp(increment, -5, 5);
        this.lambda[k] += increment;
        for (let i = 0; i < 4; i++) {
          const particle = particles[i];
          if (!particle.invMass) continue;
          this.before
            .copy(this.gradients[i])
            .multiplyScalar(increment * particle.invMass)
            .clampLength(0, cap);
          particle.position.x += this.before.x;
          particle.position.y += this.before.y;
          particle.position.z += this.before.z;
          // Small velocity correction prevents a slow solver from re-penetrating.
          particle.velocity.x += (this.before.x / dt) * 0.06;
          particle.velocity.y += (this.before.y / dt) * 0.06;
          particle.velocity.z += (this.before.z / dt) * 0.06;
          particle.aabbNeedsUpdate = true;
        }
      });
    }
    this.minRatio = Infinity;
    this.inversions = 0;
    CUBE_TETRAHEDRA.forEach((tet, k) => {
      const ratio =
        signedTetraVolume(tet.map((i) => this.bodies[i].position)) /
        this.rest[k];
      if (ratio < 0) this.inversions++;
      this.minRatio = Math.min(this.minRatio, ratio);
    });
  }
}
