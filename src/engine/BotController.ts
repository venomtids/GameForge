import * as THREE from "three";
import type { World } from "./World";
/** Local steering, not a navigation mesh. Body contacts still use the shared physics world. */
export class BotController {
  private phases = new Map<string, number>();
  private cooldowns = new Map<string, number>();
  update(world: World, dt: number) {
    const player = world.playerId ? world.bodies.get(world.playerId) : null;
    for (const n of world.configs) {
      if (
        n.actor.bot === "off" ||
        world.physicalRigs.has(n.id) ||
        (world.health.get(n.id) ?? 100) <= 0
      )
        continue;
      const b = world.bodies.get(n.id);
      if (!b || !b.mass) continue;
      const mode = n.actor.bot,
        p = new THREE.Vector3(b.position.x, b.position.y, b.position.z),
        spawn = world.botOrigins.get(n.id) ?? p;
      let target: THREE.Vector3 | null = null;
      const distance = player
        ? Math.hypot(player.position.x - p.x, player.position.z - p.z)
        : Infinity;
      if (mode === "patrol" || distance > n.actor.detection) {
        let phase = this.phases.get(n.id) ?? 0;
        const corners = [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
          ],
          corner = corners[phase % 4];
        target = spawn
          .clone()
          .add(
            new THREE.Vector3(
              corner[0] * n.actor.radius,
              0,
              corner[1] * n.actor.radius,
            ),
          );
        if (p.distanceTo(new THREE.Vector3(target.x, p.y, target.z)) < 0.7) {
          phase++;
          this.phases.set(n.id, phase);
        }
      } else if (player && (world.health.get(world.playerId!) ?? 100) > 0) {
        target = new THREE.Vector3(player.position.x, p.y, player.position.z);
      }
      const cooldown = Math.max(0, (this.cooldowns.get(n.id) ?? 0) - dt);
      this.cooldowns.set(n.id, cooldown);
      if (target) {
        const direction = target.sub(p);
        direction.y = 0;
        const len = direction.length(),
          stop =
            mode === "attack"
              ? n.actor.attackRange * 0.8
              : mode === "follow"
                ? 2
                : 0.25;
        if (len > stop) {
          direction.normalize();
          // Steer away from static obstacles at chest height, rather than walking through them.
          const ray = new THREE.Raycaster(p, direction, 0, 1);
          const hit = ray
            .intersectObjects(world.root.children, true)
            .find((h) => {
              const id = h.object.userData.nodeId;
              return (
                h.object.visible &&
                id !== n.id &&
                id !== world.playerId &&
                world.configs.some((c) => c.id === id && c.physics === "static")
              );
            });
          if (hit) {
            const x = direction.x;
            direction.x = -direction.z;
            direction.z = x;
          }
          b.velocity.x = direction.x * n.speed;
          b.velocity.z = direction.z * n.speed;
          b.wakeUp();
        } else {
          b.velocity.x = 0;
          b.velocity.z = 0;
        }
        if (
          mode === "attack" &&
          player &&
          distance <= n.actor.attackRange &&
          Math.abs(player.position.y - p.y) < 2 &&
          cooldown === 0
        ) {
          const direction = new THREE.Vector3(
            player.position.x - p.x,
            player.position.y - p.y,
            player.position.z - p.z,
          );
          const ray = new THREE.Raycaster(
            p,
            direction.clone().normalize(),
            0,
            direction.length(),
          );
          const blocked = ray
            .intersectObjects(world.root.children, true)
            .some(
              (h) =>
                h.object.visible &&
                h.object.userData.nodeId !== n.id &&
                h.object.userData.nodeId !== world.playerId &&
                world.configs.some(
                  (c) =>
                    c.id === h.object.userData.nodeId && c.physics === "static",
                ),
            );
          if (!blocked) {
            world.damage(world.playerId!, n.actor.damage, n.id);
            this.cooldowns.set(n.id, n.actor.cooldown);
          }
        }
      } else {
        b.velocity.x = 0;
        b.velocity.z = 0;
      }
    }
  }
}
