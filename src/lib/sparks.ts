// Fire sparks and embers on a canvas: particles rise on buoyancy, get pushed around by a
// shifting wind field, flicker, cool from white-yellow to red and fade. Every few seconds a
// burst of fast sparks pops, like a log cracking in a fire.

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  seed: number;
  flicker: number;
  spin: number; // rad/s: sparks curl instead of flying straight
  kind: 'ember' | 'spark';
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Hot → cool colour ramp (t: 0 = just born, 1 = dying).
function colour(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [255, 246, 214]],
    [0.25, [255, 196, 92]],
    [0.6, [245, 120, 40]],
    [1, [170, 40, 20]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

function makeGlowSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** Starts the animation on `canvas`; returns a stop function. */
export function startSparks(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const glow = makeGlowSprite();
  const tinted = new Map<string, HTMLCanvasElement>();
  const tint = (rgb: [number, number, number]) => {
    // Quantise so the cache stays small.
    const key = rgb.map((v) => v & 0xf0).join(',');
    let sprite = tinted.get(key);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = 64;
      const g = sprite.getContext('2d')!;
      g.drawImage(glow, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = `rgb(${key})`;
      g.fillRect(0, 0, 64, 64);
      tinted.set(key, sprite);
    }
    return sprite;
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  const particles: Particle[] = [];
  let maxParticles = 70;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maxParticles = width < 640 ? 38 : 75;
  };

  const spawn = (kind: Particle['kind'], x = rand(0, width), y = height + rand(0, 30)) => {
    const ember = kind === 'ember';
    const life = ember ? rand(4, 9) : rand(0.5, 1.6);
    // Sparks fly out in a wide fan (±75° from straight up) at very different speeds.
    const angle = -Math.PI / 2 + rand(-1.3, 1.3);
    const speed = rand(60, 280) * (Math.random() < 0.2 ? 1.6 : 1);
    particles.push({
      x,
      y,
      px: x,
      py: y,
      vx: ember ? rand(-12, 12) : Math.cos(angle) * speed,
      vy: ember ? rand(-60, -25) : Math.sin(angle) * speed,
      size: ember ? rand(0.8, 3.2) : rand(0.5, 1.5),
      spin: ember ? 0 : rand(-4, 4),
      life: 0,
      maxLife: life,
      seed: rand(0, 1000),
      flicker: rand(6, 18),
      kind,
    });
  };

  const burst = () => {
    const x = rand(width * 0.1, width * 0.9);
    const y = height - rand(0, height * 0.15);
    const n = Math.round(rand(6, 18));
    for (let i = 0; i < n; i++) spawn('spark', x + rand(-14, 14), y + rand(-8, 8));
    for (let i = 0; i < 3; i++) spawn('ember', x + rand(-20, 20), y);
  };

  let last = performance.now();
  let time = 0;
  let nextBurst = rand(1, 3);
  let raf = 0;
  let running = false;

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    // Keep a steady trickle of embers; occasional bursts of sparks.
    const embers = particles.reduce((n, p) => n + (p.kind === 'ember' ? 1 : 0), 0);
    if (embers < maxParticles * 0.6 && Math.random() < dt * 14) spawn('ember');
    nextBurst -= dt;
    if (nextBurst <= 0 && particles.length < maxParticles * 1.5) {
      burst();
      nextBurst = rand(1.8, 5);
    }

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    // A slow gust that changes direction now and then.
    const gust = Math.sin(time * 0.23) * 18 + Math.sin(time * 0.61 + 1.3) * 10;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1 || p.y < -40 || p.x < -60 || p.x > width + 60) {
        particles.splice(i, 1);
        continue;
      }

      // Turbulence: layered sines sampled at the particle's position give swirly, uneven paths.
      const s = p.seed;
      const turbX =
        Math.sin(p.y * 0.012 + time * 1.7 + s) * 55 +
        Math.sin(p.y * 0.031 - time * 2.9 + s * 1.7) * 30 +
        Math.sin(time * 7 + s * 3) * 12;
      const turbY = Math.cos(p.x * 0.015 + time * 1.3 + s) * 18;

      const drag = p.kind === 'spark' ? 1.6 : 0.9;
      p.vx += (turbX + gust - p.vx * drag) * dt;
      p.vy += (turbY - (p.kind === 'ember' ? 22 : 40) - p.vy * drag * 0.35) * dt;
      if (p.kind === 'spark') {
        // Curl: rotate the velocity a little every frame, with a wobble, so each spark
        // traces its own bent, jittery path; they also lose lift and arc over.
        const a = (p.spin + Math.sin(time * 9 + s) * 2.5) * dt;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        [p.vx, p.vy] = [p.vx * cos - p.vy * sin, p.vx * sin + p.vy * cos];
        p.vy += 120 * dt * t;
      }

      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const [r, g, b] = colour(t);
      const flicker = 0.65 + 0.35 * Math.sin(time * p.flicker + s);
      const fadeIn = Math.min(1, p.life * 4);
      const alpha = fadeIn * (1 - t) ** 1.3 * flicker;

      if (p.kind === 'spark') {
        // Short streak along the direction of travel.
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.px - (p.x - p.px) * 0.6, p.py - (p.y - p.py) * 0.6);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        const glowSize = p.size * 7 * (1 - t * 0.4);
        ctx.globalAlpha = alpha * 0.55;
        ctx.drawImage(tint([r, g, b]), p.x - glowSize / 2, p.y - glowSize / 2, glowSize, glowSize);
        ctx.globalAlpha = Math.min(1, alpha * 1.2);
        ctx.fillStyle = `rgb(${Math.min(255, r + 30)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  resize();
  // Pre-warm so embers are already floating when the page appears.
  for (let i = 0; i < maxParticles * 0.4; i++) spawn('ember', rand(0, width), rand(height * 0.3, height));

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  let inView = true;
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView && !document.hidden) start();
    else pause();
  });
  io.observe(canvas);
  const onVisibility = () => (document.hidden || !inView ? pause() : start());
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    pause();
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
