// Deterministic staged scenes for the entry screenshots (?shot=<name>&seed=<n>).
// Each scene is built with the game's own systems and rendered by its own code —
// the same approach the kit's starter uses — so a screenshot never depends on
// how well anyone happened to play in the moment it was taken.

import { VIEW, XP_CURVE } from './config.js';
import { UPGRADES } from './world.js';

function stageBattle(world, rng, density) {
  const p = world.player;
  p.x = 430; p.y = 408; p.aim = -0.5;
  const kinds = ['chaser', 'dart', 'splitter', 'chaser', 'tank', 'dart', 'chaser', 'splitter', 'dart', 'chaser'];
  for (let i = 0; i < density; i++) {
    const kind = kinds[i % kinds.length];
    let x, y, tries = 0;
    do {
      x = 90 + rng() * (VIEW.w - 180);
      y = 90 + rng() * (VIEW.h - 180);
      tries++;
    } while (Math.hypot(x - p.x, y - p.y) < 190 && tries < 12);
    world.spawnEnemy(kind, x, y);
  }
  // bullets mid-flight toward the aim side
  for (let i = 0; i < 7; i++) {
    const a = p.aim + (rng() - 0.5) * 0.22;
    const d = 60 + i * 46 + rng() * 22;
    world.bullets.push({
      x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
      vx: Math.cos(a) * 760, vy: Math.sin(a) * 760,
      life: 0.8, damage: 16, pierce: 0, radius: 4,
    });
  }
  // gems scattered from recent kills
  for (let i = 0; i < 11; i++) {
    world.gems.push({
      x: 180 + rng() * (VIEW.w - 360), y: 140 + rng() * (VIEW.h - 280),
      vx: 0, vy: 0, t: rng() * 9,
    });
  }
  world.burst(p.x + 190, p.y - 130, '#ff3ea6', 22, 250, 0.6, 3);
  world.burst(p.x - 150, p.y + 120, '#ffb02e', 14, 210, 0.5, 3);
  world.floatText(p.x + 190, p.y - 168, '+50', '#ffe066', 15);
  world.floatText(p.x - 150, p.y + 84, '+80', '#ffe066', 15);
}

export function applyShot(world, name, seed) {
  const rng = world.rng;
  world.reset();
  if (name === 'title') {
    world.state = 'title';
    return;
  }
  if (name === 'play') {
    stageBattle(world, rng, 15);
    world.state = 'playing';
    world.time = 63;
    world.score = 4230; world.kills = 87; world.gemsCollected = 96;
    world.level = 6; world.xp = 9; world.xpNext = XP_CURVE(6);
    world.player.hp = 72; world.player.blades = 1;
    world.gun.projectiles = 3; world.gun.damage = 16;
    return;
  }
  if (name === 'upgrade') {
    stageBattle(world, rng, 10);
    world.time = 88;
    world.score = 6110; world.kills = 124; world.gemsCollected = 141;
    world.level = 7; world.xp = 2; world.xpNext = XP_CURVE(7);
    world.player.hp = 58; world.player.blades = 1;
    world.gun.projectiles = 2;
    world.upgradeChoices = ['multi', 'orbit', 'vitality'].map((id) => UPGRADES.find((u) => u.id === id));
    world.state = 'levelup';
    return;
  }
  if (name === 'end') {
    stageBattle(world, rng, 4);
    world.time = 150;
    world.score = 10870; world.kills = 231; world.gemsCollected = 268;
    world.level = 9; world.xp = 4; world.xpNext = XP_CURVE(9);
    world.player.hp = 41; world.player.blades = 2;
    world.state = 'win';
    return;
  }
  world.state = 'title';
}
