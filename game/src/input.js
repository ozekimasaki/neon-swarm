// Keyboard + mouse state. Movement is WASD / arrows, aim is the mouse,
// dash is Space or Shift, restart is R, mute is M, pause is P or Esc.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 640, y: 300, down: false };
    this.pressed = new Set(); // keys that went down this frame (edge triggers)
    this.clicked = false;     // a mouse click landed this frame

    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('pointerdown', (e) => {
      this.mouse.down = true;
      this.clicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    addEventListener('pointerup', () => { this.mouse.down = false; });
  }

  moveVector() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) { const inv = Math.SQRT1_2; x *= inv; y *= inv; }
    return { x, y };
  }

  dashPressed() { return this.pressed.has(' ') || this.pressed.has('shift'); }
  restartPressed() { return this.pressed.has('r'); }
  pausePressed() { return this.pressed.has('p') || this.pressed.has('escape'); }
  mutePressed() { return this.pressed.has('m'); }

  endFrame() { this.pressed.clear(); this.clicked = false; }
}
