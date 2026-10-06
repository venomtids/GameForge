import * as THREE from "three";
import * as CANNON from "cannon-es";

export interface TriangleContact {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  depth: number;
  triangle: number;
}

/** Narrowphase against actual, CURRENT triangles of a deformed BufferGeometry.
 * Closest-point sphere probes: not arbitrary-mesh CCD, frictional IPC or exact
 * rigid box-vs-triangle contact. No other scene meshes are modified. */
export class DeformedMeshContact {
  private bounds = new THREE.Box3();
  private triangle = new THREE.Triangle();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private candidate = new THREE.Vector3();
  private matrix = new THREE.Matrix4();
  private normal = new THREE.Vector3();
  private closest = new THREE.Vector3();
  private world = new THREE.Vector3();
  queries = 0;
  trianglesTested = 0;

  query(
    mesh: THREE.Mesh,
    point: THREE.Vector3,
    radius: number,
  ): TriangleContact | null {
    if (!(radius > 0 && Number.isFinite(radius))) return null;
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    mesh.updateWorldMatrix(true, false);
    this.matrix.copy(mesh.matrixWorld);
    this.bounds.copy(geometry.boundingBox!).applyMatrix4(this.matrix);
    this.queries++;
    if (this.bounds.distanceToPoint(point) > radius) return null;
    const insideBounds = this.bounds.containsPoint(point);
    const attribute = geometry.getAttribute("position"),
      indices = geometry.getIndex();
    // Visual vertices are world-space in cage rigs; keep the general matrix path
    // to support custom/transformed scene parents as well.
    const faces = indices ? indices.count / 3 : attribute.count / 3;
    let best = insideBounds ? Infinity : radius * radius,
      chosen = -1;
    let faceX = 0,
      faceY = 0,
      faceZ = 0;
    for (let i = 0; i < faces; i++) {
      const j = 3 * i;
      const ia = indices ? indices.getX(j) : j;
      const ib = indices ? indices.getX(j + 1) : j + 1;
      const ic = indices ? indices.getX(j + 2) : j + 2;
      this.a.fromBufferAttribute(attribute, ia).applyMatrix4(this.matrix);
      this.b.fromBufferAttribute(attribute, ib).applyMatrix4(this.matrix);
      this.c.fromBufferAttribute(attribute, ic).applyMatrix4(this.matrix);
      // Vertex AABB cheaply rejects most faces before closest-point math.
      if (
        !insideBounds &&
        (point.x + radius < Math.min(this.a.x, this.b.x, this.c.x) ||
          point.x - radius > Math.max(this.a.x, this.b.x, this.c.x) ||
          point.y + radius < Math.min(this.a.y, this.b.y, this.c.y) ||
          point.y - radius > Math.max(this.a.y, this.b.y, this.c.y) ||
          point.z + radius < Math.min(this.a.z, this.b.z, this.c.z) ||
          point.z - radius > Math.max(this.a.z, this.b.z, this.c.z))
      )
        continue;
      this.trianglesTested++;
      this.triangle.set(this.a, this.b, this.c);
      this.triangle.closestPointToPoint(point, this.candidate);
      const distanceSquared = point.distanceToSquared(this.candidate);
      if (distanceSquared >= best) continue;
      this.triangle.getNormal(this.normal);
      if (this.normal.lengthSq() < 1e-10) continue;
      best = distanceSquared;
      chosen = i;
      this.closest.copy(this.candidate);
      faceX = this.normal.x;
      faceY = this.normal.y;
      faceZ = this.normal.z;
    }
    if (chosen < 0) return null;
    const distance = Math.sqrt(best);
    this.world.copy(point).sub(this.closest);
    const inside =
      this.world.x * faceX + this.world.y * faceY + this.world.z * faceZ <
      -1e-7;
    if (inside || distance < 1e-7)
      this.world.set(faceX, faceY, faceZ).normalize();
    else this.world.divideScalar(distance);
    if (!inside && distance >= radius) return null;
    if (!Number.isFinite(this.world.x + this.world.y + this.world.z))
      return null;
    return {
      point: this.closest.clone(),
      normal: this.world.clone(),
      depth: inside ? radius + distance : radius - distance,
      triangle: chosen,
    };
  }
}

/** Limited correction of a controller sphere against a real deforming face.
 * Leaves the existing Cannon shape/contacts intact as the safety broadphase. */
export function resolveDeformedSphere(
  player: CANNON.Body,
  contact: TriangleContact,
  maxCorrection = 0.07,
) {
  const p = contact.normal,
    amount = Math.min(maxCorrection, contact.depth);
  if (!(amount > 0) || !Number.isFinite(amount)) return 0;
  player.position.x += p.x * amount;
  player.position.y += p.y * amount;
  player.position.z += p.z * amount;
  const toward =
    player.velocity.x * p.x + player.velocity.y * p.y + player.velocity.z * p.z;
  if (toward < 0) {
    player.velocity.x -= toward * p.x;
    player.velocity.y -= toward * p.y;
    player.velocity.z -= toward * p.z;
  }
  player.aabbNeedsUpdate = true;
  player.wakeUp();
  return amount;
}
