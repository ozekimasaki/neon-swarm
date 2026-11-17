// NEON SWARM — tuning constants. Everything the game balances by lives here.

export const VIEW = { w: 1280, h: 720 };

export const RUN_SECONDS = 150;          // survive this long to win
export const ARENA = { pad: 26 };        // wall margin the player is clamped to

export const PLAYER = {
  radius: 13,
  speed: 268,
  hp: 100,
  dashSpeed: 880,
  dashTime: 0.16,
  dashCooldown: 2.1,
  invulnAfterHit: 0.65,
};

export const GUN = {
  damage: 12,
  rate: 6.5,              // shots per second
  bulletSpeed: 760,
  bulletLife: 0.85,
  bulletRadius: 4,
  spreadStep: 0.11,       // radians between projectiles past the first
};

export const ENEMY = {
  // type: hp, speed, radius, score, xp, damage on contact
  chaser:   { hp: 22,  speed: 118, radius: 15, score: 50,  xp: 1, touch: 10 },
  dart:     { hp: 10,  speed: 208, radius: 10, score: 80,  xp: 1, touch: 8 },
  tank:     { hp: 130, speed: 52,  radius: 30, score: 300, xp: 5, touch: 20 },
  splitter: { hp: 34,  speed: 92,  radius: 17, score: 120, xp: 2, touch: 12 },
};

export const SPAWN = {
  firstDelay: 0.7,
  baseInterval: 1.05,     // seconds between spawns at t=0
  minInterval: 0.24,      // ...and at the end of the run
  hpScalePerSecond: 0.011 // enemy hp multiplier growth
};

export const XP_CURVE = (level) => 6 + level * 5; // gems needed for next level

export const COLORS = {
  bg: '#05070f',
  grid: 'rgba(64,120,255,0.07)',
  player: '#2ee6ff',
  playerCore: '#e8fbff',
  bullet: '#8ff4ff',
  gem: '#39ffb0',
  hp: '#3dff8e',
  hpLow: '#ff4d5e',
  xp: '#37c8ff',
  text: '#dceeff',
  dim: '#7d90b8',
  chaser: '#ff3ea6',
  dart: '#ffb02e',
  tank: '#ff4757',
  splitter: '#52ffa8',
};
