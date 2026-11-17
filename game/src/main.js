// NEON SWARM — entry point: canvas setup, the frame loop, screen flow,
// mouse/keyboard routing for menus, and sound dispatch.

import { VIEW } from './config.js';
import { World } from './world.js';
import { Renderer, UI } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 7) || 7;
const shot = params.get('shot');

const world = new World(seed);
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const sound = new Sound();
const uiState = { hoverStart: false };

if (shot) applyShot(world, shot, seed);

// Fit the 1280x720 stage into the window, keeping the aspect ratio.
function fit() {
  const scale = Math.min(innerWidth / VIEW.w, innerHeight / VIEW.h) * 0.985;
  canvas.style.width = `${Math.floor(VIEW.w * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.h * scale)}px`;
}
addEventListener('resize', fit);
fit();

function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

function startRun() {
  sound.ensure();
  world.reset();
  world.state = 'playing';
}

function chooseUpgrade(i) {
  const u = world.upgradeChoices[i];
  if (!u) return;
  u.apply(world);
  sound.pick();
  world.state = 'playing';
}

function routeSounds() {
  for (const ev of world.events) {
    if (ev === 'shoot') sound.shoot();
    else if (ev === 'die') sound.enemyDie(false);
    else if (ev === 'dieBig') sound.enemyDie(true);
    else if (ev === 'gem') sound.gem(world.gemCombo);
    else if (ev === 'hit') sound.playerHit();
    else if (ev === 'dash') sound.dash();
    else if (ev === 'levelup') sound.levelUp();
    else if (ev === 'win') sound.win();
    else if (ev === 'lose') sound.lose();
  }
}

function handleUi() {
  const { x, y } = input.mouse;
  uiState.hoverStart = world.state === 'title' && inRect(x, y, UI.startBtn);

  if (input.mutePressed()) { sound.muted = !sound.muted; }

  if (world.state === 'title') {
    if ((input.clicked && uiState.hoverStart) || input.pressed.has('enter')) startRun();
    return;
  }
  if (world.state === 'levelup') {
    if (input.clicked) {
      for (let i = 0; i < 3; i++) if (inRect(x, y, UI.cards[i])) { chooseUpgrade(i); return; }
    }
    for (let i = 0; i < 3; i++) if (input.pressed.has(String(i + 1))) { chooseUpgrade(i); return; }
    return;
  }
  if (world.state === 'over' || world.state === 'win') {
    if ((input.clicked && inRect(x, y, UI.restartBtn)) || input.restartPressed()) startRun();
    return;
  }
  if (world.state === 'playing' && input.pausePressed()) world.state = 'paused';
  else if (world.state === 'paused' && input.pausePressed()) world.state = 'playing';
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (shot) dt = 0; // staged scenes hold still for the camera

  handleUi();
  if (!shot) {
    world.step(dt, input);
    routeSounds();
  }
  renderer.draw(world, input, uiState);
  input.endFrame();
}
requestAnimationFrame(frame);
