// NEON SWARM — the simulation: player, enemies, bullets, gems, particles.
// Pure state + step function; rendering lives in render.js, flow in main.js.

import { VIEW, RUN_SECONDS, ARENA, PLAYER, GUN, ENEMY, SPAWN, XP_CURVE } from './config.js';
import { makeRng, randRange } from './random.js';

export const UPGRADES = [
  { id: 'damage',  name: 'HEAVY ROUNDS',  desc: '+35% bullet damage',        apply: (w) => { w.gun.damage *= 1.35; } },
  { id: 'rate',    name: 'RAPID CYCLER',  desc: '+22% fire rate',            apply: (w) => { w.gun.rate *= 1.22; } },
  { id: 'multi',   name: 'SPLIT CANNON',  desc: '+1 projectile per shot',    apply: (w) => { w.gun.projectiles += 1; } },
  { id: 'pierce',  name: 'LANCE ROUNDS',  desc: 'Bullets pierce +1 enemy',   apply: (w) => { w.gun.pierce += 1; } },
  { id: 'speed',   name: 'ION THRUSTERS', desc: '+12% move speed, faster dash recharge', apply: (w) => { w.player.speed *= 1.12; w.player.dashCooldownMax *= 0.88; } },
  { id: 'magnet',  name: 'TRACTOR FIELD', desc: '+70% gem magnet radius',    apply: (w) => { w.player.magnet *= 1.7; } },
  { id: 'vitality',name: 'NANO PLATING',  desc: '+25 max HP and heal 40',    apply: (w) => { w.player.maxHp += 25; w.player.hp = Math.min(w.player.maxHp, w.player.hp + 40); } },
  { id: 'orbit',   name: 'ORBIT BLADES',  desc: '+1 orbiting blade that shreds on contact', apply: (w) => { w.player.blades += 1; } },
];

export class World {
  constructor(seed = 1) {
    this.rng = makeRng(seed);
    this.reset();
  }

  reset() {
    const rng = this.rng;
    this.time = 0;
    this.state = 'title'; // title | playing | levelup | over | win | paused
    this.score = 0;
    this.kills = 0;
    this.gemsCollected = 0;
    this.shake = 0;
    this.flash = 0;
    this.slowmo = 0;

    this.player = {
      x: VIEW.w / 2, y: VIEW.h / 2, vx: 0, vy: 0,
      radius: PLAYER.radius, speed: PLAYER.speed,
      hp: PLAYER.hp, maxHp: PLAYER.hp,
      magnet: 74, blades: 0, bladeAngle: 0,
      dashTime: 0, dashCooldown: 0, dashCooldownMax: PLAYER.dashCooldown,
      invuln: 0, aim: 0, thrust: 0,
    };
    this.gun = {
      damage: GUN.damage, rate: GUN.rate, projectiles: 1, pierce: 0,
      cooldown: 0,
    };
    this.level = 1;
    this.xp = 0;
    this.xpNext = XP_CURVE(1);
    this.pendingLevels = 0;
    this.upgradeChoices = [];

    this.enemies = [];
    this.bullets = [];
    this.gems = [];
    this.particles = [];
    this.texts = [];
    this.spawnTimer = SPAWN.firstDelay;
    this.gemCombo = 0;
    this.gemComboTimer = 0;
    this.events = []; // sound cues for main.js: 'shoot','die','gem','hit','dash','levelup'
    this.stars = Array.from({ length: 130 }, () => ({
      x: rng() * VIEW.w, y: rng() * VIEW.h, z: 0.25 + rng() * 0.75, r: rng() * 1.6 + 0.4,
    }));
  }

  // ---------- spawning ----------
  spawnInterval() {
    const t = Math.min(1, this.time / RUN_SECONDS);
    return SPAWN.baseInterval + (SPAWN.minInterval - SPAWN.baseInterval) * t;
  }

  pickEnemyType() {
    const t = this.time / RUN_SECONDS;
    const r = this.rng();
    if (t > 0.22 && r < 0.10 + t * 0.05) return 'tank';
    if (t > 0.12 && r < 0.30) return 'splitter';
    if (r < 0.52) return 'dart';
    return 'chaser';
  }

  spawnEnemy(type = null, x = null, y = null) {
    const kind = type ?? this.pickEnemyType();
    const base = ENEMY[kind];
    const side = Math.floor(this.rng() * 4);
    let sx, sy;
    if (x !== null) { sx = x; sy = y; }
    else if (side === 0) { sx = randRange(this.rng, 0, VIEW.w); sy = -40; }
    else if (side === 1) { sx = randRange(this.rng, 0, VIEW.w); sy = VIEW.h + 40; }
    else if (side === 2) { sx = -40; sy = randRange(this.rng, 0, VIEW.h); }
    else { sx = VIEW.w + 40; sy = randRange(this.rng, 0, VIEW.h); }
    const hpScale = 1 + this.time * SPAWN.hpScalePerSecond;
    this.enemies.push({
      kind, x: sx, y: sy, vx: 0, vy: 0,
      hp: base.hp * hpScale, maxHp: base.hp * hpScale,
      speed: base.speed * randRange(this.rng, 0.88, 1.12),
      radius: base.radius, score: base.score, xp: base.xp, touch: base.touch,
      rot: this.rng() * Math.PI * 2, rotSpeed: randRange(this.rng, -1.6, 1.6),
      hitFlash: 0, wobble: this.rng() * Math.PI * 2, touchCooldown: 0,
    });
  }

  // ---------- fx ----------
  burst(x, y, color, n, speed = 260, life = 0.5, size = 3) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 650) return;
      const a = this.rng() * Math.PI * 2;
      const s = speed * (0.25 + this.rng() * 0.95);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.5 + this.rng() * 0.8), maxLife: life,
        size: size * (0.5 + this.rng()), color, drag: 3.2,
      });
    }
  }

  floatText(x, y, str, color, size = 15) {
    this.texts.push({ x, y, str, color, size, life: 0.9, maxLife: 0.9 });
  }

  // ---------- combat ----------
  fireGuns(dt, aimX, aimY) {
    const p = this.player, g = this.gun;
    g.cooldown -= dt;
    const dx = aimX - p.x, dy = aimY - p.y;
    const aim = Math.atan2(dy, dx);
    p.aim = aim;
    if (g.cooldown > 0) return;
    g.cooldown = Math.max(g.cooldown + 1 / g.rate, -0.05);
    const n = g.projectiles;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * GUN.spreadStep;
      const a = aim + off;
      this.bullets.push({
        x: p.x + Math.cos(aim) * (p.radius + 6), y: p.y + Math.sin(aim) * (p.radius + 6),
        vx: Math.cos(a) * GUN.bulletSpeed, vy: Math.sin(a) * GUN.bulletSpeed,
        life: GUN.bulletLife, damage: g.damage, pierce: g.pierce, radius: GUN.bulletRadius,
      });
    }
    p.thrust = 1;
    this.events.push('shoot');
  }

  damageEnemy(e, dmg, angle, knock = 3.2) {
    e.hp -= dmg;
    e.hitFlash = 1;
    e.x += Math.cos(angle) * knock;
    e.y += Math.sin(angle) * knock;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.kills += 1;
      this.score += e.score;
      const big = e.kind === 'tank';
      this.burst(e.x, e.y, enemyColor(e.kind), big ? 42 : 18, big ? 340 : 260, 0.6, big ? 4 : 3);
      this.floatText(e.x, e.y - e.radius, `+${e.score}`, '#ffe066', big ? 20 : 14);
      this.shake = Math.min(14, this.shake + (big ? 9 : 3));
      for (let i = 0; i < e.xp; i++) {
        this.gems.push({
          x: e.x + randRange(this.rng, -12, 12), y: e.y + randRange(this.rng, -12, 12),
          vx: randRange(this.rng, -60, 60), vy: randRange(this.rng, -60, 60), t: this.rng() * 9,
        });
      }
      if (e.kind === 'splitter') {
        for (let i = 0; i < 2; i++) {
          this.spawnEnemy('dart', e.x + (i === 0 ? -14 : 14), e.y + (i === 0 ? -8 : 8));
        }
      }
      this.events.push(big ? 'dieBig' : 'die');
    }
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (p.invuln > 0 || p.dashTime > 0 || this.state !== 'playing') return;
    p.hp -= dmg;
    p.invuln = PLAYER.invulnAfterHit;
    this.shake = Math.min(16, this.shake + 8);
    this.flash = 1;
    this.burst(p.x, p.y, '#ff4d5e', 16, 240, 0.45, 3);
    this.events.push('hit');
    if (p.hp <= 0) {
      p.hp = 0;
      this.state = 'over';
      this.burst(p.x, p.y, '#2ee6ff', 70, 380, 0.9, 4);
      this.burst(p.x, p.y, '#ffffff', 30, 240, 0.7, 3);
      this.shake = 18;
      this.events.push('lose');
    }
  }

  gainXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = XP_CURVE(this.level);
      this.pendingLevels += 1;
    }
  }

  rollUpgrades() {
    const pool = [...UPGRADES];
    const out = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const idx = Math.floor(this.rng() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  // ---------- main step ----------
  step(dt, input) {
    this.events.length = 0;
    const p = this.player;

    // ambient particles/stars always drift a little
    this.updateFx(dt);

    if (this.state !== 'playing') return;

    this.time += dt;
    if (this.time >= RUN_SECONDS) {
      this.time = RUN_SECONDS;
      this.state = 'win';
      this.score += 1000 + Math.round(p.hp) * 5;
      this.events.push('win');
      this.burst(p.x, p.y, '#ffe066', 80, 420, 1.0, 4);
      return;
    }

    // --- player movement & dash
    const mv = input.moveVector();
    if (input.dashPressed() && p.dashCooldown <= 0 && p.dashTime <= 0) {
      p.dashTime = PLAYER.dashTime;
      p.dashCooldown = p.dashCooldownMax;
      const dx = mv.x !== 0 || mv.y !== 0 ? mv.x : Math.cos(p.aim);
      const dy = mv.x !== 0 || mv.y !== 0 ? mv.y : Math.sin(p.aim);
      p.dashVx = dx; p.dashVy = dy;
      this.events.push('dash');
      this.burst(p.x, p.y, '#2ee6ff', 10, 140, 0.3, 3);
    }
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.dashVx * PLAYER.dashSpeed * dt;
      p.y += p.dashVy * PLAYER.dashSpeed * dt;
      this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.28, maxLife: 0.28, size: 9, color: 'rgba(46,230,255,0.5)', drag: 0 });
    } else {
      p.x += mv.x * p.speed * dt;
      p.y += mv.y * p.speed * dt;
    }
    p.x = Math.max(ARENA.pad, Math.min(VIEW.w - ARENA.pad, p.x));
    p.y = Math.max(ARENA.pad, Math.min(VIEW.h - ARENA.pad, p.y));
    p.thrust = Math.max(0, p.thrust - dt * 9);
    p.bladeAngle += dt * 2.6;

    // --- guns
    this.fireGuns(dt, input.mouse.x, input.mouse.y);

    // --- spawns
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval() * randRange(this.rng, 0.7, 1.3);
      this.spawnEnemy();
      if (this.time > 95 && this.rng() < 0.45) this.spawnEnemy();
    }

    // --- bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > VIEW.w + 20 || b.y < -20 || b.y > VIEW.h + 20) {
        this.bullets.splice(i, 1);
      }
    }

    // --- enemies
    for (const e of this.enemies) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.vx = (dx / d) * e.speed; e.vy = (dy / d) * e.speed;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.rot += e.rotSpeed * dt;
      e.wobble += dt * 5;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 7);
      e.touchCooldown = Math.max(0, e.touchCooldown - dt);
    }
    // gentle separation so the swarm reads as bodies, not a stack
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < rr * rr) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.5;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push * 0.5; a.y -= uy * push * 0.5;
          b.x += ux * push * 0.5; b.y += uy * push * 0.5;
        }
      }
    }

    // --- bullet vs enemy
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let consumed = false;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        const rr = e.radius + b.radius;
        if (dx * dx + dy * dy < rr * rr) {
          this.damageEnemy(e, b.damage, Math.atan2(b.vy, b.vx));
          this.burst(b.x, b.y, '#8ff4ff', 3, 150, 0.25, 2);
          if (b.pierce > 0) { b.pierce -= 1; } else { consumed = true; }
          break;
        }
      }
      if (consumed) this.bullets.splice(i, 1);
    }

    // --- orbit blades
    if (p.blades > 0) {
      for (let i = 0; i < p.blades; i++) {
        const a = p.bladeAngle + (i * Math.PI * 2) / p.blades;
        const bx = p.x + Math.cos(a) * 52, by = p.y + Math.sin(a) * 52;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - bx, dy = e.y - by;
          if (dx * dx + dy * dy < (e.radius + 13) * (e.radius + 13)) {
            this.damageEnemy(e, 95 * dt, a + Math.PI / 2, 0.2); // steady shred, ~95 dps
          }
        }
      }
    }

    // --- enemy contact with player
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const rr = e.radius + p.radius - 2;
      if (dx * dx + dy * dy < rr * rr && e.touchCooldown <= 0) {
        e.touchCooldown = 0.8;
        this.hurtPlayer(e.touch);
      }
    }

    // --- gems
    this.gemComboTimer -= dt;
    if (this.gemComboTimer <= 0) this.gemCombo = 0;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      g.t += dt * 6;
      g.x += g.vx * dt; g.y += g.vy * dt;
      g.vx *= (1 - 3 * dt); g.vy *= (1 - 3 * dt);
      const dx = p.x - g.x, dy = p.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < p.magnet * p.magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = 560 * (1 - d / (p.magnet * 1.6));
        g.x += (dx / d) * pull * dt; g.y += (dy / d) * pull * dt;
      }
      if (d2 < (p.radius + 12) * (p.radius + 12)) {
        this.gems.splice(i, 1);
        this.gemsCollected += 1;
        this.gemCombo += 1;
        this.gemComboTimer = 1.1;
        this.score += 5;
        this.gainXp(1);
        this.events.push('gem');
        this.burst(g.x, g.y, '#39ffb0', 4, 120, 0.3, 2);
      }
    }

    // --- reap the dead
    this.enemies = this.enemies.filter((e) => !e.dead);

    // --- level ups pause the action
    if (this.pendingLevels > 0 && this.state === 'playing') {
      this.pendingLevels -= 1;
      this.upgradeChoices = this.rollUpgrades();
      this.state = 'levelup';
      this.events.push('levelup');
      this.burst(p.x, p.y, '#37c8ff', 36, 300, 0.7, 3);
    }
  }

  updateFx(dt) {
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      const drag = Math.max(0, 1 - pt.drag * dt);
      pt.vx *= drag; pt.vy *= drag;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt; t.y -= dt * 44;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (const s of this.stars) {
      s.y += s.z * 6 * dt;
      if (s.y > VIEW.h) { s.y = -2; s.x = this.rng() * VIEW.w; }
    }
  }
}

export function enemyColor(kind) {
  return { chaser: '#ff3ea6', dart: '#ffb02e', tank: '#ff4757', splitter: '#52ffa8' }[kind] || '#fff';
}
