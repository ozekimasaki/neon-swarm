// NEON SWARM — canvas rendering: arena, entities, HUD and every screen.
// All art is drawn in code (vector shapes + glow); there are no image assets.

import { VIEW, RUN_SECONDS, COLORS } from './config.js';
import { enemyColor } from './world.js';

export const UI = {
  startBtn: { x: VIEW.w / 2 - 130, y: 470, w: 260, h: 62 },
  restartBtn: { x: VIEW.w / 2 - 130, y: 452, w: 260, h: 58 },
  cards: [0, 1, 2].map((i) => ({ x: 240 + i * 272, y: 296, w: 240, h: 168 })),
};

const TAU = Math.PI * 2;

function poly(ctx, x, y, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function glowText(ctx, str, x, y, font, color, align = 'center', blur = 18) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color, back = 'rgba(255,255,255,0.10)') {
  ctx.save();
  ctx.fillStyle = back;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2); ctx.fill();
  }
  ctx.restore();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
  }

  draw(world, input, uiState) {
    const ctx = this.ctx;
    this.t += 1 / 60;
    ctx.save();
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);

    // screen shake
    if (world.shake > 0.2) {
      const s = world.shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.drawBackground(world);
    if (world.state !== 'title') {
      this.drawGems(world);
      this.drawEnemies(world);
      this.drawBullets(world);
      this.drawPlayer(world);
      this.drawParticles(world);
      this.drawTexts(world);
    } else {
      this.drawTitleBackdrop(world);
    }
    ctx.restore();

    // red damage vignette
    if (world.flash > 0) {
      const g = ctx.createRadialGradient(640, 360, 240, 640, 360, 720);
      g.addColorStop(0, 'rgba(255,40,60,0)');
      g.addColorStop(1, `rgba(255,40,60,${0.35 * world.flash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }

    if (world.state !== 'title') this.drawHud(world);
    if (world.state === 'title') this.drawTitle(world, uiState);
    if (world.state === 'levelup') this.drawLevelUp(world, input);
    if (world.state === 'over') this.drawEnd(world, false);
    if (world.state === 'win') this.drawEnd(world, true);
    if (world.state === 'paused') this.drawPaused();
  }

  drawBackground(world) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(-24, -24, VIEW.w + 48, VIEW.h + 48);
    // nebula washes
    const n1 = ctx.createRadialGradient(300, 180, 40, 300, 180, 520);
    n1.addColorStop(0, 'rgba(64,40,160,0.20)'); n1.addColorStop(1, 'rgba(64,40,160,0)');
    ctx.fillStyle = n1; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    const n2 = ctx.createRadialGradient(1010, 560, 40, 1010, 560, 520);
    n2.addColorStop(0, 'rgba(0,120,160,0.16)'); n2.addColorStop(1, 'rgba(0,120,160,0)');
    ctx.fillStyle = n2; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= VIEW.w; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, VIEW.h); }
    for (let y = 0; y <= VIEW.h; y += 64) { ctx.moveTo(0, y); ctx.lineTo(VIEW.w, y); }
    ctx.stroke();
    // stars
    ctx.fillStyle = '#cfe8ff';
    for (const s of world.stars) {
      ctx.globalAlpha = 0.25 + s.z * 0.55;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // arena border
    ctx.strokeStyle = 'rgba(46,230,255,0.35)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#2ee6ff'; ctx.shadowBlur = 12;
    ctx.strokeRect(14, 14, VIEW.w - 28, VIEW.h - 28);
    ctx.shadowBlur = 0;
  }

  drawTitleBackdrop(world) {
    // a slow decorative swarm drifting behind the title
    const ctx = this.ctx;
    for (let i = 0; i < 26; i++) {
      const a = this.t * 0.24 + i * 0.77;
      const r = 190 + (i % 5) * 46 + Math.sin(this.t * 0.7 + i) * 12;
      const x = 640 + Math.cos(a) * r * 1.55;
      const y = 350 + Math.sin(a) * r * 0.72;
      const kind = ['chaser', 'dart', 'splitter', 'tank'][i % 4];
      ctx.save();
      ctx.globalAlpha = 0.5;
      this.drawEnemyShape(world, { kind, x, y, radius: kind === 'tank' ? 26 : 14, rot: a * 2, hitFlash: 0, wobble: i });
      ctx.restore();
    }
    this.drawPlayerAt(640, 350, -Math.PI / 2, 0);
  }

  drawGems(world) {
    const ctx = this.ctx;
    for (const g of world.gems) {
      const pulse = 1 + Math.sin(g.t * 2.2) * 0.16;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(Math.PI / 4 + Math.sin(g.t) * 0.2);
      ctx.shadowColor = COLORS.gem; ctx.shadowBlur = 12;
      ctx.fillStyle = COLORS.gem;
      const s = 6.4 * pulse;
      ctx.fillRect(-s / 1.4, -s / 1.4, s * 1.43, s * 1.43);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);
      ctx.restore();
    }
  }

  drawEnemyShape(world, e) {
    const ctx = this.ctx;
    const color = enemyColor(e.kind);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = e.hitFlash > 0.3 ? '#ffffff' : color;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.6;
    if (e.kind === 'chaser') {
      const wob = 1 + Math.sin(e.wobble) * 0.07;
      poly(ctx, 0, 0, e.radius * wob, 3, e.rot);
      ctx.fill(); ctx.stroke();
    } else if (e.kind === 'dart') {
      poly(ctx, 0, 0, e.radius, 3, e.rot);
      ctx.fill();
      poly(ctx, 0, 0, e.radius * 0.5, 3, e.rot + 0.4);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
    } else if (e.kind === 'tank') {
      poly(ctx, 0, 0, e.radius, 6, e.rot);
      ctx.fill(); ctx.stroke();
      poly(ctx, 0, 0, e.radius * 0.58, 6, -e.rot * 1.4);
      ctx.fillStyle = 'rgba(10,6,20,0.55)'; ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, TAU); ctx.fill();
    } else { // splitter
      const wob = 1 + Math.sin(e.wobble * 1.3) * 0.06;
      poly(ctx, 0, 0, e.radius * wob, 4, e.rot);
      ctx.fill(); ctx.stroke();
      poly(ctx, 0, 0, e.radius * 0.45, 4, -e.rot);
      ctx.fillStyle = 'rgba(10,20,14,0.6)'; ctx.fill();
    }
    ctx.restore();
    // hp arc for the tough ones
    if ((e.kind === 'tank' || e.kind === 'splitter') && e.hp < e.maxHp) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, e.hp / e.maxHp));
      ctx.stroke();
      ctx.restore();
    }
  }

  drawEnemies(world) {
    for (const e of world.enemies) this.drawEnemyShape(world, e);
  }

  drawBullets(world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = COLORS.bullet; ctx.shadowBlur = 10;
    for (const b of world.bullets) {
      ctx.fillStyle = COLORS.bullet;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(143,244,255,0.35)';
      ctx.beginPath();
      ctx.arc(b.x - b.vx * 0.016, b.y - b.vy * 0.016, b.radius * 0.9, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawPlayerAt(x, y, aim, thrust) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(aim);
    // engine flame
    if (thrust > 0) {
      ctx.fillStyle = `rgba(255,170,60,${0.75 * thrust})`;
      ctx.shadowColor = '#ffaa3c'; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(-12, 5); ctx.lineTo(-22 - 8 * thrust, 0); ctx.lineTo(-12, -5);
      ctx.closePath(); ctx.fill();
    }
    ctx.shadowColor = COLORS.player; ctx.shadowBlur = 20;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-10, 11); ctx.lineTo(-5, 0); ctx.lineTo(-10, -11);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.playerCore;
    ctx.beginPath(); ctx.arc(3, 0, 4.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawPlayer(world) {
    const p = world.player;
    const ctx = this.ctx;
    // orbit blades
    if (p.blades > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(140,240,255,0.20)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 52, 0, TAU); ctx.stroke();
      for (let i = 0; i < p.blades; i++) {
        const a = p.bladeAngle + (i * TAU) / p.blades;
        const bx = p.x + Math.cos(a) * 52, by = p.y + Math.sin(a) * 52;
        ctx.save();
        ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2);
        ctx.shadowColor = '#8ff4ff'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#c9f7ff';
        poly(ctx, 0, 0, 11, 3, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    // dash / invulnerability blink
    if (p.invuln > 0 && Math.floor(this.t * 16) % 2 === 0 && p.dashTime <= 0) {
      ctx.globalAlpha = 0.45;
    }
    this.drawPlayerAt(p.x, p.y, p.aim, p.thrust);
    ctx.globalAlpha = 1;
    // aim guide
    ctx.save();
    ctx.strokeStyle = 'rgba(143,244,255,0.16)';
    ctx.setLineDash([4, 9]);
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aim) * 26, p.y + Math.sin(p.aim) * 26);
    ctx.lineTo(p.x + Math.cos(p.aim) * 74, p.y + Math.sin(p.aim) * 74);
    ctx.stroke();
    ctx.restore();
  }

  drawParticles(world) {
    const ctx = this.ctx;
    ctx.save();
    for (const pt of world.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.4 + a * 0.6), 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawTexts(world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of world.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = `700 ${t.size}px "Avenir Next", system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color; ctx.shadowBlur = 8;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawHud(world) {
    const ctx = this.ctx;
    const p = world.player;
    // HP
    ctx.save();
    ctx.font = '700 13px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('HULL', 30, 34);
    const hpFrac = p.hp / p.maxHp;
    bar(ctx, 78, 26, 230, 15, hpFrac, hpFrac < 0.3 ? COLORS.hpLow : COLORS.hp);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 318, 34);
    // dash pip
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('DASH', 30, 58);
    bar(ctx, 78, 51, 110, 9, 1 - p.dashCooldown / p.dashCooldownMax, '#2ee6ff');
    // timer
    const remain = Math.max(0, RUN_SECONDS - world.time);
    const mm = Math.floor(remain / 60), ss = Math.floor(remain % 60);
    glowText(ctx, `${mm}:${String(ss).padStart(2, '0')}`, 640, 40, '800 40px "Avenir Next", system-ui, sans-serif', remain <= 15 ? '#ff4d5e' : COLORS.text, 'center', 14);
    ctx.font = '600 12px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim; ctx.textAlign = 'center';
    ctx.fillText('SURVIVE', 640, 70);
    // score + level
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '700 13px "Avenir Next", system-ui, sans-serif';
    ctx.fillText('SCORE', 1250, 30);
    ctx.fillStyle = '#ffe066';
    ctx.font = '800 26px "Avenir Next", system-ui, sans-serif';
    ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 10;
    ctx.fillText(String(world.score), 1250, 58);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.dim;
    ctx.font = '700 13px "Avenir Next", system-ui, sans-serif';
    ctx.fillText(`KILLS ${world.kills}`, 1250, 84);
    // XP bar along the bottom
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 15px "Avenir Next", system-ui, sans-serif';
    ctx.fillText(`LV ${world.level}`, 30, 690);
    bar(ctx, 92, 682, 1090, 13, world.xp / world.xpNext, COLORS.xp);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '600 12px "Avenir Next", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('M — SOUND ON/OFF', 1250, 690);
    ctx.restore();
  }

  drawTitle(world, uiState) {
    const ctx = this.ctx;
    glowText(ctx, 'NEON SWARM', 640, 168, '900 92px "Avenir Next", system-ui, sans-serif', '#2ee6ff', 'center', 30);
    glowText(ctx, '1 5 0   S E C O N D S', 640, 232, '700 25px "Avenir Next", system-ui, sans-serif', '#ff3ea6', 'center', 16);
    ctx.save();
    ctx.font = '500 19px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('The swarm is coming. Your ship, one arena, 150 seconds on the clock.', 640, 292);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '500 16px "Avenir Next", system-ui, sans-serif';
    ctx.fillText('WASD / ARROWS — move      MOUSE — aim (auto-fire)      SPACE — dash      Collect shards, level up, survive.', 640, 326);
    ctx.restore();
    // start button
    const b = UI.startBtn;
    const hover = uiState.hoverStart;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 14);
    ctx.fillStyle = hover ? 'rgba(46,230,255,0.28)' : 'rgba(46,230,255,0.14)';
    ctx.shadowColor = '#2ee6ff'; ctx.shadowBlur = hover ? 26 : 14;
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#2ee6ff'; ctx.stroke();
    ctx.restore();
    glowText(ctx, '▶  START', 640, b.y + b.h / 2 + 1, '800 26px "Avenir Next", system-ui, sans-serif', '#e8fbff', 'center', 10);
    ctx.save();
    ctx.font = '500 13px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(125,144,184,0.9)'; ctx.textAlign = 'center';
    ctx.fillText('an original arcade survival game — art, code and sound made for this entry', 640, 664);
    ctx.restore();
  }

  drawLevelUp(world, input) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(3,6,18,0.72)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    glowText(ctx, 'LEVEL UP', 640, 196, '900 52px "Avenir Next", system-ui, sans-serif', '#37c8ff', 'center', 24);
    ctx.font = '600 17px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`Level ${world.level} — choose one upgrade (click, or press 1 / 2 / 3)`, 640, 244);
    world.upgradeChoices.forEach((u, i) => {
      const c = UI.cards[i];
      const hover = input.mouse.x >= c.x && input.mouse.x <= c.x + c.w && input.mouse.y >= c.y && input.mouse.y <= c.y + c.h;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 16);
      ctx.fillStyle = hover ? 'rgba(55,200,255,0.20)' : 'rgba(16,26,54,0.92)';
      ctx.shadowColor = '#37c8ff'; ctx.shadowBlur = hover ? 24 : 8;
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = hover ? '#8ff4ff' : 'rgba(55,200,255,0.55)'; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#37c8ff';
      ctx.font = '800 15px "Avenir Next", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[ ${i + 1} ]`, c.x + c.w / 2, c.y + 30);
      ctx.fillStyle = '#e8fbff';
      ctx.font = '800 20px "Avenir Next", system-ui, sans-serif';
      const words = u.name.split(' ');
      if (words.length > 1 && u.name.length > 13) {
        ctx.fillText(words[0], c.x + c.w / 2, c.y + 66);
        ctx.fillText(words.slice(1).join(' '), c.x + c.w / 2, c.y + 92);
      } else {
        ctx.fillText(u.name, c.x + c.w / 2, c.y + 78);
      }
      ctx.fillStyle = COLORS.dim;
      ctx.font = '500 14.5px "Avenir Next", system-ui, sans-serif';
      wrapText(ctx, u.desc, c.x + c.w / 2, c.y + 126, c.w - 30, 19);
      ctx.restore();
    });
    ctx.restore();
  }

  drawEnd(world, won) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(3,6,18,0.66)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    if (won) {
      glowText(ctx, 'YOU SURVIVED', 640, 218, '900 68px "Avenir Next", system-ui, sans-serif', '#3dff8e', 'center', 28);
      ctx.font = '600 19px "Avenir Next", system-ui, sans-serif';
      ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('The swarm breaks against the dawn. The arena is quiet — for now.', 640, 272);
    } else {
      glowText(ctx, 'SHIP DOWN', 640, 218, '900 68px "Avenir Next", system-ui, sans-serif', '#ff4d5e', 'center', 28);
      ctx.font = '600 19px "Avenir Next", system-ui, sans-serif';
      ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`You held the line for ${Math.floor(world.time)} seconds. The swarm keeps the rest.`, 640, 272);
    }
    ctx.font = '800 24px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 12;
    ctx.fillText(`SCORE  ${world.score}`, 640, 336);
    ctx.shadowBlur = 0;
    ctx.font = '600 17px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`Kills ${world.kills}    Shards ${world.gemsCollected}    Level ${world.level}`, 640, 372);
    const b = UI.restartBtn;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 14);
    ctx.fillStyle = 'rgba(46,230,255,0.14)';
    ctx.shadowColor = '#2ee6ff'; ctx.shadowBlur = 14;
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#2ee6ff'; ctx.stroke();
    ctx.shadowBlur = 0;
    glowText(ctx, '↻  RETRY  (R)', 640, b.y + b.h / 2 + 1, '800 23px "Avenir Next", system-ui, sans-serif', '#e8fbff', 'center', 8);
    ctx.restore();
  }

  drawPaused() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(3,6,18,0.6)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    glowText(ctx, 'PAUSED', 640, 340, '900 54px "Avenir Next", system-ui, sans-serif', '#dceeff', 'center', 20);
    ctx.font = '600 16px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim; ctx.textAlign = 'center';
    ctx.fillText('P or Esc to resume', 640, 392);
    ctx.restore();
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = w; yy += lineHeight;
    } else line = trial;
  }
  if (line) ctx.fillText(line, x, yy);
}
