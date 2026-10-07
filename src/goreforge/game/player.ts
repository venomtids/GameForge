import * as THREE from "three";
import type * as CANNON from "cannon-es";
import type { GameContext } from "./context";
import type { Node3D } from "../../engine/model";
import { clamp, damp, rng } from "./util";

type MoveState = "idle" | "walk" | "sprint" | "crouch" | "slide" | "air" | "dash" | "noclip";

/**
 * Controlador FPS instalado no hook `world.playerStep` da engine.
 *
 * A engine continua dona da física (corpos, contatos, sincronização, respawn);
 * aqui só decidimos a velocidade do passo fixo — o que permite aceleração
 * própria, coyote time, pulo duplo, dash, escorregão, noclip e "câmera suja".
 */
export class PlayerController {
  state: MoveState = "idle";
  grounded = true;
  crouched = false;
  noclip = false;
  bob = 0;
  lean = 0;
  private lastGroundedAt = -10;
  landing = 0;
  private lastJumpAt = -10;
  private dashUntil = -10;
  private dashReadyAt = 0;
  private slideUntil = -10;
  private slideReadyAt = 0;
  private jumpBufferUntil = -100;
  private doubleJumps = 0;
  private coyote = 0;
  private fallSpeed = 0;
  private stepPhase = 0;
  private stepCooldown = 0;
  private wish = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private random = rng(5150);
  private regenDelay = 0;
  private damageFlash = 0;
  private breath = 0;

  constructor(private ctx: GameContext) {
    ctx.world.playerStep = (context) => this.step(context);
  }

  get speed() {
    const body = this.body();
    return body ? Math.hypot(body.velocity.x, body.velocity.z) : 0;
  }

  /** 0..1.4 — usado pelo spread das armas e pelo crosshair dinâmico. */
  speedRatio() {
    return clamp(this.speed / Math.max(1, this.ctx.settings.sprintSpeed), 0, 1.4);
  }

  get dashing() {
    return this.ctx.time < this.dashUntil;
  }

  get sliding() {
    return this.ctx.time < this.slideUntil;
  }

  get damageFlashAmount() {
    return this.damageFlash;
  }

  private body() {
    return this.ctx.world.playerId ? (this.ctx.world.bodies.get(this.ctx.world.playerId) ?? null) : null;
  }

  /* -------------------------------------------------------------- passo --- */
  /** Passo de movimento do jogador — chamado pela engine via World.playerStep. */
  step(context: {
    dt: number;
    keys: Set<string>;
    yaw: number;
    body: CANNON.Body;
    node: Node3D;
    grounded: boolean;
    jumpQueued: boolean;
    consumeJump: () => void;
  }) {
    const { dt, keys, yaw, body } = context;
    const settings = this.ctx.settings;
    const store = this.ctx.store;
    this.grounded = context.grounded;
    const frozen = this.ctx.world.inputFrozen || !store.alive || this.ctx.menuOpen;

    if (this.grounded) {
      this.lastGroundedAt = this.ctx.time;
      this.coyote = settings.coyoteTime;
      this.doubleJumps = 0;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }
    if (context.jumpQueued) {
      this.jumpBufferUntil = this.ctx.time + 0.16;
      context.consumeJump();
    }

    /* ------------------------------------------------------ noclip (G) --- */
    if (this.noclip) {
      const direction = new THREE.Vector3();
      this.ctx.camera.getWorldDirection(direction);
      const side = new THREE.Vector3().crossVectors(direction, this.up).normalize();
      const speed = keys.has("shift") ? 42 : 16;
      this.wish
        .set(0, 0, 0)
        .addScaledVector(direction, Number(keys.has("w")) - Number(keys.has("s")))
        .addScaledVector(side, Number(keys.has("d")) - Number(keys.has("a")));
      if (keys.has(" ") || keys.has("e")) this.wish.y += 1;
      if (keys.has("control") || keys.has("c") || keys.has("q")) this.wish.y -= 1;
      if (this.wish.lengthSq() > 0) this.wish.normalize().multiplyScalar(speed);
      body.velocity.set(this.wish.x, this.wish.y, this.wish.z);
      body.wakeUp();
      this.state = "noclip";
      return true;
    }

    /* --------------------------------------------------------- direção --- */
    const dx =
      Number(keys.has("d") || keys.has("arrowright")) -
      Number(keys.has("a") || keys.has("arrowleft"));
    const dz =
      Number(keys.has("s") || keys.has("arrowdown")) -
      Number(keys.has("w") || keys.has("arrowup"));
    this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    this.wish
      .set(0, 0, 0)
      .addScaledVector(this.forward, -dz)
      .addScaledVector(this.right, dx);
    if (this.wish.lengthSq() > 0) this.wish.normalize();
    if (frozen) this.wish.set(0, 0, 0);
    this.crouched = !frozen && (keys.has("control") || keys.has("c")) && !this.dashing;

    /* ------------------------------------------------------------ dash --- */
    if (!frozen && this.ctx.input.pressed("q") && this.ctx.time >= this.dashReadyAt) {
      this.dashReadyAt = this.ctx.time + settings.dashCooldown;
      this.dashUntil = this.ctx.time + 0.18;
      const direction = this.wish.lengthSq() > 0 ? this.wish.clone() : this.forward.clone();
      body.velocity.x = direction.x * settings.dashDistance * 2.2;
      body.velocity.z = direction.z * settings.dashDistance * 2.2;
      body.velocity.y = Math.max(body.velocity.y, 0.4);
      this.ctx.world.audio.play("dash.ar", 0.6, 1);
      this.ctx.fx.ring(this.feet(), 2.1, "#31e7ff");
      this.ctx.fx.burst("plasma", this.feet(), {
        amount: 10,
        scale: 0.9,
        direction: this.up.clone().multiplyScalar(-1),
      });
      this.ctx.store.score += 1;
    }

    /* ------------------------------------------- escorregão (agachar) --- */
    const planarSpeed = Math.hypot(body.velocity.x, body.velocity.z);
    if (
      !frozen &&
      this.crouched &&
      this.grounded &&
      !this.sliding &&
      planarSpeed > settings.walkSpeed * 1.02 &&
      this.ctx.time >= this.slideReadyAt
    ) {
      this.slideUntil = this.ctx.time + 0.9;
      this.slideReadyAt = this.ctx.time + 1.1;
      const boost = settings.slideBoost;
      body.velocity.x += this.forward.x * boost * 0.6 + this.wish.x * boost;
      body.velocity.z += this.forward.z * boost * 0.6 + this.wish.z * boost;
      this.ctx.world.audio.play("dash.ar", 0.5, 0.85);
      this.ctx.fx.burst("poeira", this.feet(), { amount: 14, scale: 0.9, direction: this.up });
      this.ctx.fx.ring(this.feet(), 1.6, "#ffd166");
      this.ctx.fx.shake(0.25);
      this.ctx.store.pushToast("Escorregão!", "info");
    }

    /* ---------------------------------------------------------- pulo ----- */
    if (this.jumpBufferUntil >= this.ctx.time && !frozen) {
      const canGround = this.coyote > 0 && this.ctx.time - this.lastJumpAt > 0.2;
      const canDouble =
        !canGround && settings.doubleJump && this.doubleJumps < 1 && this.ctx.time - this.lastJumpAt > 0.2;
      if (canGround || canDouble) {
        body.velocity.y = settings.jumpSpeed * (canGround ? 1 : 0.86);
        this.lastJumpAt = this.ctx.time;
        this.coyote = 0;
        this.jumpBufferUntil = -100;
        if (!canGround) {
          this.doubleJumps += 1;
          this.ctx.fx.burst("plasma", this.feet(), {
            amount: 8,
            scale: 0.7,
            direction: new THREE.Vector3(0, -1, 0),
          });
        }
        this.ctx.world.audio.play("pulo.ar", 0.45, 0.95 + this.random() * 0.1);
        this.landing = Math.min(this.landing, -0.35);
      }
    }

    /* -------------------------------------------------- velocidade ------ */
    const sprinting =
      !frozen && keys.has("shift") && !this.crouched && this.wish.lengthSq() > 0 && !this.sliding;
    const targetSpeed = this.crouched
      ? settings.crouchSpeed
      : sprinting
        ? settings.sprintSpeed
        : settings.walkSpeed;
    if (this.sliding) {
      const decay = Math.exp(-settings.slideFriction * dt);
      body.velocity.x *= decay;
      body.velocity.z *= decay;
      if (Math.hypot(body.velocity.x, body.velocity.z) < settings.walkSpeed * 0.5)
        this.slideUntil = -10;
      body.velocity.x += this.wish.x * settings.acceleration * 0.1 * dt;
      body.velocity.z += this.wish.z * settings.acceleration * 0.1 * dt;
      this.state = "slide";
    } else {
      const control = this.grounded ? 1 : settings.airControl;
      const acceleration = Math.max(1, settings.acceleration * control);
      const blend = 1 - Math.exp(-(acceleration / Math.max(1, targetSpeed)) * dt);
      body.velocity.x += (this.wish.x * targetSpeed - body.velocity.x) * blend;
      body.velocity.z += (this.wish.z * targetSpeed - body.velocity.z) * blend;
      if (!this.wish.lengthSq() && this.grounded) {
        const friction = Math.exp(-settings.groundFriction * dt);
        body.velocity.x *= friction;
        body.velocity.z *= friction;
      }
      this.state = !this.grounded
        ? "air"
        : this.crouched
          ? "crouch"
          : sprinting
            ? "sprint"
            : this.wish.lengthSq() > 0
              ? "walk"
              : "idle";
    }

    /* ------------------------------------------------------- quedas ------ */
    if (!this.grounded) {
      this.fallSpeed = Math.max(this.fallSpeed, -body.velocity.y);
      body.velocity.y = Math.max(body.velocity.y, -48);
    } else if (this.fallSpeed > 7) {
      this.onLand(this.fallSpeed);
      this.fallSpeed = 0;
    } else {
      this.fallSpeed = 0;
    }

    /* --------------------------------------------------- passos / som ---- */
    this.stepCooldown -= dt;
    const planar = Math.hypot(body.velocity.x, body.velocity.z);
    if (this.grounded && planar > 1.4 && this.stepCooldown <= 0) {
      this.stepCooldown = clamp(1.9 / Math.max(1.5, planar), 0.22, 0.62);
      this.stepPhase += 1;
      this.ctx.world.audio.play(
        this.crouched ? "passo" : planar > settings.walkSpeed * 1.05 ? "corrida" : "passo",
        0.2 + Math.min(0.2, planar * 0.015),
        0.92 + this.random() * 0.16,
      );
    }
    if (planar > 0.2 && this.grounded) body.wakeUp();
    return true;
  }

  private feet() {
    const body = this.body();
    const node = this.ctx.world.configs.find((n) => n.id === this.ctx.world.playerId);
    const half = node ? node.scale[1] * 0.5 : 0.9;
    if (!body) return new THREE.Vector3();
    return new THREE.Vector3(body.position.x, body.position.y - half, body.position.z);
  }

  private onLand(speed: number) {
    const settings = this.ctx.settings;
    const airTime = Math.max(0, this.ctx.time - this.lastGroundedAt);
    const hard = speed > 13 || airTime > 0.9;
    this.landing = clamp(speed / 18, 0.15, 1);
    this.ctx.fx.burst("poeira", this.feet(), {
      amount: hard ? 16 : 7,
      scale: clamp(speed / 12, 0.4, 1.5),
      direction: this.up,
    });
    this.ctx.world.audio.play("aterrissar.pesado", clamp(speed / 24, 0.25, 0.85), 0.95);
    if (hard) this.ctx.fx.shake(clamp(speed / 28, 0.2, 0.9));
    const damage = (speed - 13) * settings.fallDamage * 4;
    if (damage > 3) {
      this.damage(damage, "queda");
      this.ctx.gibs.fallImpact(this.ctx.world.playerId ?? "", this.feet(), speed);
    }
  }

  /* --------------------------------------------------------- vida/dano --- */
  damage(amount: number, source = "desconhecido") {
    const store = this.ctx.store;
    if (!store.alive || amount <= 0) return;
    if (store.godMode) {
      this.ctx.fx.shake(0.12);
      return;
    }
    let remaining = amount;
    if (store.armor > 0) {
      const absorbed = Math.min(store.armor, remaining * 0.6);
      store.armor -= absorbed;
      remaining -= absorbed;
    }
    store.health = Math.max(0, store.health - remaining);
    store.damageTaken += amount;
    this.regenDelay = 5;
    this.damageFlash = Math.min(1, this.damageFlash + clamp(amount / 45, 0.15, 1));
    this.ctx.world.audio.play("dano.jogador", clamp(amount / 40, 0.25, 0.9), 1);
    this.ctx.fx.shake(clamp(amount / 45, 0.1, 1.1));
    const attacker = this.ctx.world.bodies.get(source);
    const body = this.body();
    if (attacker && body) {
      const angle = Math.atan2(
        attacker.position.x - body.position.x,
        attacker.position.z - body.position.z,
      );
      store.markPlayerHit(angle);
    }
    if (store.health <= 0) this.die();
  }

  heal(amount: number) {
    const store = this.ctx.store;
    store.health = Math.min(store.settings.maxHealth, store.health + amount);
    store.armor = Math.min(store.settings.maxArmor, store.armor + amount * 0.4);
    this.ctx.world.audio.play("curativo", 0.35, 1.1);
    this.ctx.store.pushToast("Vida restaurada", "good");
  }

  knockback(direction: THREE.Vector3, force: number) {
    const body = this.body();
    if (!body) return;
    body.velocity.x += direction.x * force;
    body.velocity.y += Math.max(1.4, direction.y * force * 0.5);
    body.velocity.z += direction.z * force;
    body.wakeUp();
  }

  private die() {
    const store = this.ctx.store;
    if (!store.alive) return;
    store.alive = false;
    store.deaths += 1;
    store.combo = 0;
    store.respawnIn = 3;
    this.ctx.world.audio.play("morte.grito", 0.75, 0.95);
    this.ctx.fx.shake(2.2);
    this.ctx.ui.pushFeed("Você morreu", "R para renascer · Esc para o menu", "info");
    this.ctx.rig.release();
  }

  respawn() {
    const store = this.ctx.store;
    store.alive = true;
    store.health = store.settings.maxHealth;
    store.armor = store.settings.maxArmor * 0.6;
    store.respawnIn = 0;
    store.reloading = 0;
    this.ctx.world.respawn();
    this.ctx.store.pushToast("De volta ao pátio", "good");
  }

  /* ----------------------------------------------------------- câmera --- */
  /** "Câmera suja": bob, inclinação, mergulho de pouso, FOV de sprint/mira. */
  applyCameraFeel(dt: number) {
    const camera = this.ctx.camera;
    const settings = this.ctx.settings;
    const store = this.ctx.store;
    const body = this.body();
    if (!body) return;
    const speed = this.speed;
    const moving = clamp(speed / Math.max(1, settings.walkSpeed), 0, 1.8);

    this.stepPhase += dt * (2.2 + speed * 1.5);
    this.breath += dt * 1.4;
    const bobAmount = (this.grounded ? 0.012 : 0) * moving * settings.shake;
    const bobY = Math.sin(this.stepPhase * 2) * bobAmount;
    const bobX = Math.cos(this.stepPhase) * bobAmount * 0.7;
    this.bob = bobY;

    const strafe = this.wish.x * this.speedRatio();
    this.lean = damp(this.lean, clamp(-strafe * 0.05, -0.07, 0.07), 8, dt);
    camera.rotation.z += this.lean;

    const crouchOffset = this.sliding ? -0.52 : this.crouched ? -0.34 : 0;
    camera.position.y += crouchOffset + bobY + bobX * 0.2;
    camera.position.x += bobX * 0.6;

    if (this.landing !== 0) {
      camera.position.y -= Math.abs(this.landing) * 0.26;
      camera.rotation.x += this.landing * 0.02;
      this.landing = damp(this.landing, 0, 9, dt);
      if (Math.abs(this.landing) < 0.002) this.landing = 0;
    }
    if (moving < 0.05 && this.grounded)
      camera.position.y += Math.sin(this.breath) * 0.006 * settings.shake;

    const spec = this.ctx.combat.currentSpec;
    const targetFov = store.ads
      ? spec.adsFov
      : settings.fov + (this.state === "sprint" ? 6 : 0) + (this.dashing ? 5 : 0);
    camera.fov = damp(camera.fov, targetFov, store.ads ? 14 : 8, dt);
    camera.updateProjectionMatrix();

    if (this.damageFlash > 0) {
      camera.position.y += Math.sin(this.ctx.time * 60) * this.damageFlash * 0.012;
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.6);
    }
  }

  update(dt: number) {
    const store = this.ctx.store;
    const settings = store.settings;
    /* A engine lê world.health para esconder braços, ativar ragdoll e tocar
       eventos: mantemos o mapa sincronizado com o estado do jogo — MAS antes
       convertemos em dano qualquer queda que tenha vindo DA ENGINE (NPCs com
       `behavior: attack` chamam world.damage direto, e explosões/contatos
       também). Sem isso, escrever o valor do jogo por cima apagaria os ataques. */
    const engineId = this.ctx.world.playerId;
    if (engineId) {
      const engineHealth = this.ctx.world.health.get(engineId) ?? store.health;
      const last = this.ctx.world.lastDamage;
      const source = last && last.id === engineId ? last.source : "engine";
      if (store.alive && engineHealth < store.health - 0.5) {
        /* Modo deus: a engine não conhece o ajuste, então devolvemos a vida. */
        if (store.godMode) this.ctx.world.health.set(engineId, store.health);
        else this.damage(store.health - engineHealth, source);
      }
      this.ctx.world.health.set(engineId, store.alive ? store.health : 0);
    }
    if (!store.alive) {
      store.respawnIn = Math.max(0, store.respawnIn - dt);
      if (store.respawnIn === 0 && this.ctx.input.pressed("r")) this.respawn();
      return;
    }
    if (this.regenDelay > 0) this.regenDelay -= dt;
    else if (store.health < settings.maxHealth && settings.healthRegen > 0)
      store.health = Math.min(settings.maxHealth, store.health + settings.healthRegen * dt);
    if (this.sliding && !this.grounded) this.slideUntil = Math.min(this.slideUntil, this.ctx.time + 0.05);
  }

  reset() {
    this.state = "idle";
    this.fallSpeed = 0;
    this.landing = 0;
    this.damageFlash = 0;
    this.dashUntil = -10;
    this.dashReadyAt = 0;
    this.slideUntil = -10;
    this.slideReadyAt = 0;
    this.jumpBufferUntil = -100;
    this.doubleJumps = 0;
    this.crouched = false;
    this.noclip = false;
  }
}
