import Matter from 'matter-js';
import { splitName } from './names.js';

const { Engine, Bodies, Body, Composite, Events } = Matter;

export const WORLD_W = 800;
const WALL = 60;
const STEP_MS = 1000 / 60;
const MAP_LENGTH = { short: 2800, normal: 4000, long: 5600 };
const SIZE_MUL = { small: 0.8, normal: 1, large: 1.25 };

const COLORS = {
  peg: '#7383bd',
  spinner: '#ff5c8a',
  bumper: '#ffc94d',
  slider: '#45d0ff',
  ramp: '#8f9bd0',
  funnel: '#b3bde6',
  wall: '#3a4170',
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ballColor = (i) => `hsl(${(i * 137.508) % 360}, 80%, 62%)`;

/**
 * 공 레이스 시뮬레이션. React와 분리된 순수 클래스.
 * update()로 물리를 진행하고 draw()로 캔버스에 그린다.
 */
export class Race {
  constructor({ names, mapLength = 'normal', obstacles, ballSize = 'auto', onFinish }) {
    this.onFinish = onFinish;
    this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
    this.engine.gravity.y = 1;
    this.world = this.engine.world;
    this.H = MAP_LENGTH[mapLength] ?? MAP_LENGTH.normal;

    const n = names.length;
    const base = n <= 12 ? 15 : n <= 24 ? 13 : n <= 40 ? 11 : n <= 60 ? 9.5 : 8;
    this.r = base * (SIZE_MUL[ballSize] ?? 1);

    this.tick = 0;
    this.speed = 1;
    this.started = false;
    this.paused = false;
    this.camY = 0;
    this.camMode = 'leader';
    this.shapes = []; // { body, kind, hub? }
    this.movers = []; // (tick) => void
    this.balls = [];
    this.ballByBodyId = new Map();
    this.finished = [];
    this.finishQueue = [];
    this.effects = [];
    this.minimapRect = null;

    this.spawnBalls(shuffle(names));
    this.buildMap(obstacles);

    this.collisionHandler = (e) => this.handleCollisions(e.pairs);
    Events.on(this.engine, 'collisionStart', this.collisionHandler);
  }

  destroy() {
    Events.off(this.engine, 'collisionStart', this.collisionHandler);
    Composite.clear(this.world, false);
    Engine.clear(this.engine);
  }

  // ───────────────────────── 생성 ─────────────────────────

  spawnBalls(names) {
    const r = this.r;
    const gap = r * 2.7;
    const cols = Math.max(1, Math.floor((WORLD_W - 80) / gap));
    const usedCols = Math.min(cols, names.length);
    const startX = WORLD_W / 2 - ((usedCols - 1) * gap) / 2;
    const rows = Math.ceil(names.length / cols);

    names.forEach((name, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * gap + rand(-2, 2);
      const y = 50 + row * gap;
      const body = Bodies.circle(x, y, r, {
        label: 'ball',
        restitution: 0.45,
        friction: 0.005,
        frictionStatic: 0,
        frictionAir: 0.008,
        density: 0.0015,
      });
      const ball = { name, label: splitName(name).main, color: ballColor(i), body, still: 0, done: false };
      this.balls.push(ball);
      this.ballByBodyId.set(body.id, ball);
      Composite.add(this.world, body);
    });

    this.spawnBottom = 50 + (rows - 1) * gap + r + 40;
  }

  add(body, kind, extra = {}) {
    Composite.add(this.world, body);
    this.shapes.push({ body, kind, ...extra });
    return body;
  }

  segment(x1, y1, x2, y2, thick, kind) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const body = Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len, thick, {
      isStatic: true,
      label: kind,
      angle: Math.atan2(y2 - y1, x2 - x1),
      chamfer: { radius: thick / 2 - 1 },
    });
    return this.add(body, kind);
  }

  buildMap(obstacles = {}) {
    const W = WORLD_W;
    const H = this.H;
    const wallOpt = { isStatic: true, label: 'wall' };
    this.add(Bodies.rectangle(-WALL / 2, H / 2, WALL, H * 2, wallOpt), 'wall');
    this.add(Bodies.rectangle(W + WALL / 2, H / 2, WALL, H * 2, wallOpt), 'wall');
    this.add(Bodies.rectangle(W / 2, -WALL / 2, W + WALL * 2, WALL, wallOpt), 'wall');

    const funnelTop = H - 520;
    const types = Object.entries(obstacles)
      .filter(([, on]) => on)
      .map(([k]) => k);

    let y = this.spawnBottom + 140;
    let last = null;
    while (types.length && y < funnelTop - 300) {
      let type = pick(types);
      while (types.length > 1 && type === last) type = pick(types);
      const used = this.buildSection(type, y, funnelTop - 80 - y);
      y += used + 110;
      last = type;
    }

    this.buildFunnel(funnelTop);
  }

  buildSection(type, y, maxH) {
    switch (type) {
      case 'pegs':
        return this.buildPegs(y, maxH);
      case 'spinners':
        return this.buildSpinners(y, maxH);
      case 'bumpers':
        return this.buildBumpers(y, maxH);
      case 'sliders':
        return this.buildSliders(y, maxH);
      case 'ramps':
        return this.buildRamps(y, maxH);
      default:
        return 0;
    }
  }

  buildPegs(y, maxH) {
    const W = WORLD_W;
    // 벽과 핀 사이에 공이 끼지 않도록 간격을 공 크기에 맞춘다
    const sp = Math.max(62, this.r * 4.8 + 12);
    const vy = sp * 0.85;
    const rows = Math.max(2, Math.min(Math.floor(rand(5, 9)), Math.floor(maxH / vy)));
    for (let row = 0; row < rows; row++) {
      const start = row % 2 ? sp / 2 : sp;
      for (let x = start; x <= W - sp / 2 + 0.1; x += sp) {
        this.add(
          Bodies.circle(x, y + row * vy, 6, { isStatic: true, label: 'peg', restitution: 0.6 }),
          'peg',
        );
      }
    }
    return rows * vy;
  }

  buildSpinners(y, maxH) {
    const W = WORLD_W;
    const rowGap = 230;
    const rowsN = maxH > 520 ? 2 : 1;
    for (let row = 0; row < rowsN; row++) {
      const count = pick([2, 3]);
      const cell = W / count;
      const len = cell - this.r * 4.5 - 16;
      const cy = y + 110 + row * rowGap;
      for (let i = 0; i < count; i++) {
        const body = Bodies.rectangle(cell * (i + 0.5), cy, len, 14, {
          isStatic: true,
          label: 'spinner',
          angle: rand(0, Math.PI),
          chamfer: { radius: 6 },
        });
        const w = ((i + row) % 2 ? 1 : -1) * rand(0.028, 0.045);
        this.add(body, 'spinner', { hub: true });
        this.movers.push(() => Body.setAngle(body, body.angle + w, true));
      }
    }
    return 220 + (rowsN - 1) * rowGap;
  }

  buildBumpers(y, maxH) {
    const W = WORLD_W;
    const h = Math.min(maxH, rand(380, 520));
    const want = Math.floor(rand(5, 8));
    const margin = this.r * 2.5 + 10;
    const placed = [];
    for (let tries = 0; placed.length < want && tries < 300; tries++) {
      const R = rand(24, 40);
      const x = rand(R + margin, W - R - margin);
      const cy = rand(y + R, y + h - R);
      if (placed.every((p) => Math.hypot(p.x - x, p.y - cy) > p.R + R + this.r * 3)) {
        placed.push({ x, y: cy, R });
      }
    }
    for (const p of placed) {
      this.add(
        Bodies.circle(p.x, p.y, p.R, { isStatic: true, label: 'bumper', restitution: 1 }),
        'bumper',
      );
    }
    return h;
  }

  buildSliders(y, maxH) {
    const W = WORLD_W;
    const gapY = 170;
    const n = Math.max(1, Math.min(3, Math.floor(maxH / gapY)));
    for (let i = 0; i < n; i++) {
      const cy = y + 60 + i * gapY;
      const w = rand(180, 260);
      const amp = (W - w) / 2 - (this.r * 3 + 10);
      const tilt = (i % 2 ? 1 : -1) * 0.12;
      const freq = rand(0.015, 0.03);
      const phase = rand(0, Math.PI * 2);
      const body = Bodies.rectangle(W / 2, cy, w, 14, {
        isStatic: true,
        label: 'slider',
        angle: tilt,
        chamfer: { radius: 6 },
      });
      this.add(body, 'slider');
      this.movers.push((t) =>
        Body.setPosition(body, { x: W / 2 + amp * Math.sin(t * freq + phase), y: cy }, true),
      );
    }
    return 60 + (n - 1) * gapY + 60;
  }

  buildRamps(y, maxH) {
    const W = WORLD_W;
    const spacing = 220;
    const n = Math.max(2, Math.min(4, Math.floor(maxH / spacing)));
    const len = W * 0.7;
    const drop = len * Math.tan(0.2);
    const firstLeft = Math.random() < 0.5;
    for (let i = 0; i < n; i++) {
      const cy = y + spacing / 2 + i * spacing;
      const fromLeft = (i % 2 === 0) === firstLeft;
      if (fromLeft) this.segment(-10, cy - drop / 2, len, cy + drop / 2, 16, 'ramp');
      else this.segment(W + 10, cy - drop / 2, W - len, cy + drop / 2, 16, 'ramp');
    }
    return n * spacing;
  }

  buildFunnel(fy) {
    const W = WORLD_W;
    const gapW = Math.max(this.r * 2 * 1.7, 40);
    const half = (W - gapW) / 2;
    const ang = 0.5;
    const drop = half * Math.tan(ang);
    const bottom = fy + drop;

    this.segment(-20, fy - 20 * Math.tan(ang), half, bottom, 16, 'funnel');
    this.segment(W + 20, fy - 20 * Math.tan(ang), W - half, bottom, 16, 'funnel');

    const chuteLen = 70;
    const chuteOpt = { isStatic: true, label: 'funnel' };
    this.add(Bodies.rectangle(half - 8, bottom + chuteLen / 2, 16, chuteLen, chuteOpt), 'funnel');
    this.add(Bodies.rectangle(W - half + 8, bottom + chuteLen / 2, 16, chuteLen, chuteOpt), 'funnel');

    this.finishY = bottom + 110;
    this.chute = { x1: half, x2: W - half };
    Composite.add(
      this.world,
      Bodies.rectangle(W / 2, this.finishY, W, 40, { isStatic: true, isSensor: true, label: 'finish' }),
    );
    // 센서를 혹시 지나쳐도 떨어지지 않도록 바닥
    Composite.add(
      this.world,
      Bodies.rectangle(W / 2, this.finishY + 120, W + 200, 40, { isStatic: true, label: 'floor' }),
    );
  }

  // ───────────────────────── 진행 ─────────────────────────

  start() {
    if (this.started) return;
    this.started = true;
    for (const b of this.balls) Body.setVelocity(b.body, { x: rand(-1.5, 1.5), y: 0 });
  }

  active() {
    return this.balls.filter((b) => !b.done);
  }

  handleCollisions(pairs) {
    for (const { bodyA, bodyB } of pairs) {
      for (const [a, b] of [
        [bodyA, bodyB],
        [bodyB, bodyA],
      ]) {
        const ball = this.ballByBodyId.get(a.id);
        if (!ball) continue;
        if (b.label === 'finish') {
          this.queueFinish(ball);
        } else if (b.label === 'bumper') {
          const dx = a.position.x - b.position.x;
          const dy = a.position.y - b.position.y;
          const d = Math.hypot(dx, dy) || 1;
          const k = 7;
          Body.setVelocity(a, {
            x: (dx / d) * k + a.velocity.x * 0.3,
            y: (dy / d) * k + a.velocity.y * 0.3,
          });
          b.plugin.flash = 1;
        }
      }
    }
  }

  queueFinish(ball) {
    if (ball.done) return;
    ball.done = true;
    this.finishQueue.push(ball);
  }

  flushFinished() {
    while (this.finishQueue.length) {
      const ball = this.finishQueue.shift();
      Composite.remove(this.world, ball.body);
      this.finished.push(ball);
      const rank = this.finished.length;
      this.effects.push({ x: ball.body.position.x, y: this.finishY, t: 0, rank, ball });
      this.onFinish?.(ball, rank);
    }
  }

  update() {
    if (!this.started || this.paused) return;
    const W = WORLD_W;
    for (let s = 0; s < this.speed; s++) {
      this.tick++;
      for (const m of this.movers) m(this.tick);
      Engine.update(this.engine, STEP_MS);

      for (const ball of this.balls) {
        if (ball.done) continue;
        const b = ball.body;
        if (b.position.y > this.finishY + 10) {
          this.queueFinish(ball);
          continue;
        }
        if (b.position.x < 0 || b.position.x > W) {
          Body.setPosition(b, { x: clamp(b.position.x, this.r, W - this.r), y: b.position.y });
        }
        if (b.speed > 20) {
          const f = 20 / b.speed;
          Body.setVelocity(b, { x: b.velocity.x * f, y: b.velocity.y * f });
        }
        // 멈춰 있는 공은 살짝 튕겨준다
        if (b.speed < 0.25) ball.still++;
        else ball.still = Math.max(0, ball.still - 2);
        if (ball.still > 70) {
          Body.setVelocity(b, { x: rand(-6, 6), y: -rand(3, 6) });
          ball.still = 0;
        }
      }
      this.flushFinished();
      if (this.finished.length === this.balls.length) break;
    }
  }

  scrollBy(dyWorld) {
    this.camMode = 'free';
    this.camY += dyWorld;
  }

  /** 미니맵 좌표(캔버스 CSS px)를 클릭하면 해당 위치로 카메라를 옮긴다. 성공 시 true. */
  minimapJump(x, y, viewH) {
    const m = this.minimapRect;
    if (!m || x < m.x - 6 || x > m.x + m.w + 6 || y < m.y || y > m.y + m.h) return false;
    this.camMode = 'free';
    this.camY = ((y - m.y) / m.h) * this.H - viewH / 2;
    return true;
  }

  updateCamera(viewH) {
    const maxCam = Math.max(0, this.H - viewH + 40);
    if (this.camMode !== 'free') {
      let target = this.camY;
      const act = this.active();
      if (!this.started) target = 0;
      else if (act.length) {
        const ys = act.map((b) => b.body.position.y);
        const focus = this.camMode === 'leader' ? Math.max(...ys) : Math.min(...ys);
        target = focus - viewH * 0.4;
      } else target = maxCam;
      this.camY += (target - this.camY) * 0.08;
    }
    this.camY = clamp(this.camY, 0, maxCam);
  }

  // ───────────────────────── 렌더링 ─────────────────────────

  draw(ctx, cw, ch, dpr, { showNames = true } = {}) {
    const W = WORLD_W;
    const scale = cw / W;
    const viewH = ch / scale;
    this.updateCamera(viewH);
    const top = this.camY;
    const bottom = this.camY + viewH;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#0d1022');
    bg.addColorStop(1, '#141833');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(0, -top);

    // 배경 격자
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1 / scale;
    for (let gy = Math.floor(top / 100) * 100; gy < bottom; gy += 100) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    // 출발선
    if (top < this.spawnBottom + 20) {
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = 'rgba(120,255,180,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, this.spawnBottom);
      ctx.lineTo(W - 10, this.spawnBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(120,255,180,0.7)';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('START', 14, this.spawnBottom + 20);
    }

    // 장애물
    for (const s of this.shapes) {
      const b = s.body;
      if (s.kind === 'wall') continue;
      if (b.bounds.max.y < top - 50 || b.bounds.min.y > bottom + 50) continue;
      let color = COLORS[s.kind] ?? '#888';
      ctx.shadowBlur = 0;
      if (s.kind === 'bumper') {
        const f = b.plugin.flash || 0;
        ctx.shadowColor = COLORS.bumper;
        ctx.shadowBlur = 10 + f * 30;
        if (f > 0) {
          color = '#fff3c4';
          b.plugin.flash = Math.max(0, f - 0.06);
        }
      } else if (s.kind === 'spinner' || s.kind === 'slider') {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = color;
      drawBody(ctx, b);
      ctx.fill();
      if (s.hub) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1a1d35';
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;

    // 좌우 벽 가장자리
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, top, 4, viewH);
    ctx.fillRect(W - 4, top, 4, viewH);

    // 결승선
    this.drawFinish(ctx);

    // 공
    const fontSize = Math.min(26, 12 / scale);
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const ball of this.balls) {
      if (ball.done) continue;
      const { x, y } = ball.body.position;
      if (y < top - 40 || y > bottom + 40) continue;
      const r = this.r;
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      if (showNames) {
        ctx.lineWidth = 3 / scale;
        ctx.strokeStyle = 'rgba(8,10,25,0.9)';
        ctx.strokeText(ball.label, x, y - r - 3);
        ctx.fillStyle = '#fff';
        ctx.fillText(ball.label, x, y - r - 3);
      }
    }

    // 도착 이펙트
    ctx.textBaseline = 'middle';
    for (const e of this.effects) {
      e.t++;
      const p = e.t / 70;
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = e.ball.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 10 + p * 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(30, 16 / scale)}px system-ui, sans-serif`;
      ctx.fillText(`${e.rank}등 ${e.ball.label}`, W / 2, e.y - 60 - p * 50);
    }
    ctx.globalAlpha = 1;
    this.effects = this.effects.filter((e) => e.t < 70);

    ctx.restore();
    this.drawMinimap(ctx, cw, ch, viewH);
  }

  drawFinish(ctx) {
    const { x1, x2 } = this.chute;
    const y = this.finishY - 12;
    const sq = 12;
    for (let x = x1, i = 0; x < x2; x += sq, i++) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = (i + row) % 2 ? '#fff' : '#111';
        ctx.fillRect(x, y + row * sq, Math.min(sq, x2 - x), sq);
      }
    }
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('FINISH', WORLD_W / 2, this.finishY + 24);
  }

  drawMinimap(ctx, cw, ch, viewH) {
    const mh = Math.min(ch * 0.5, 280);
    const mw = Math.max(36, (mh * WORLD_W) / this.H);
    const mx = cw - mw - 12;
    const my = 12;
    const s = mh / this.H;
    this.minimapRect = { x: mx, y: my, w: mw, h: mh };

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);

    const sx = mw / WORLD_W;
    ctx.fillStyle = 'rgba(255,215,94,0.9)';
    ctx.fillRect(mx, my + this.finishY * s - 1, mw, 2);

    for (const ball of this.balls) {
      if (ball.done) continue;
      ctx.fillStyle = ball.color;
      ctx.fillRect(mx + ball.body.position.x * sx - 1.5, my + ball.body.position.y * s - 1.5, 3, 3);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.strokeRect(mx + 0.5, my + this.camY * s, mw - 1, Math.max(4, viewH * s));
  }
}

function drawBody(ctx, body) {
  ctx.beginPath();
  if (body.circleRadius) {
    ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
    return;
  }
  const v = body.vertices;
  ctx.moveTo(v[0].x, v[0].y);
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
  ctx.closePath();
}
