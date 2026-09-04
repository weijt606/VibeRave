// Six-layer sun for the /stage big screen (docs/booth/Stage.dc.html,
// System.dc.html "光的做法"). Pure canvas 2D, drawn at device pixel ratio.
//
//   ambient bloom → halo → red/blue chromatic fringe (±3 px, screen)
//   → feathered core → hairline corona rings → horizon + reflection
//   + film grain + vignette + drifting dust.
//
// createSunRenderer(canvas) → { render(state, audio, tNow), resize(), dispose() }
//   state: { phase, attract } (phase from StageState; attract = attract mode)
//   audio: StageAudio { rms, bands[8], onset, ts } | null
//   tNow:  performance.now() milliseconds

const SKY = {
  night: [
    [0, '#03051A'],
    [0.42, '#0A1236'],
    [0.68, '#1B1C4E'],
    [1, '#3A1F45'],
  ],
  twilight: [
    [0, '#06071A'],
    [1, '#1C1230'],
  ],
  afternoon: [
    [0, '#1A1226'],
    [1, '#2E1A2E'],
  ],
  day: [
    [0, '#FBF8F1'],
    [1, '#F2EBE0'],
  ],
};

// The mockup's CSS gradient is farthest-corner sized and clipped by the
// circle, so its visible rim lands in the orange stops; the stops are
// compressed here to keep that look while the 93%→100% tail feathers.
const SUN_STOPS = [
  [0, '#FFF8E8'],
  [0.2, '#FBDA8A'],
  [0.42, '#F6B45A'],
  [0.74, '#F0865E'],
  [0.93, 'rgba(242,139,184,.85)'],
  [1, 'rgba(242,139,184,0)'],
];

const RING_COLORS = ['#F6C85F', '#F28BB8', '#B8C0FF'];
const RING_ALPHA = [0.22, 0.13, 0.08];
const RING_RATIO = [1.43, 1.91, 2.43];

const GRAIN_TILE = 256;
const GRAIN_TILES = 4;
const GRAIN_ALPHA = 0.3;
const DUST_COUNT = 14;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function makeGrainTile(seed) {
  const c = document.createElement('canvas');
  c.width = GRAIN_TILE;
  c.height = GRAIN_TILE;
  const g = c.getContext('2d');
  const img = g.createImageData(GRAIN_TILE, GRAIN_TILE);
  const d = img.data;
  // Cheap xorshift so the four tiles differ deterministically.
  let s = (seed * 2654435761) >>> 0 || 1;
  for (let i = 0; i < d.length; i += 4) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    // Boosted contrast around mid grey — overlay with 128 is a no-op, so
    // only the deviation shows (mirrors the SVG feComponentTransfer in the
    // mockup: slope 2.2, intercept -0.6).
    const v = 128 + (((s >>> 0) % 256) - 128) * 0.55;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function createSunRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let dpr = 1;
  let W = 0;
  let H = 0;

  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!mq?.matches;
  const onMq = () => {
    reduced = !!mq?.matches;
  };
  mq?.addEventListener?.('change', onMq);

  const grainTiles = [];
  const grainPatterns = [];
  for (let i = 0; i < GRAIN_TILES; i++) {
    const tile = makeGrainTile(i + 1);
    grainTiles.push(tile);
    grainPatterns.push(ctx.createPattern(tile, 'repeat'));
  }
  let grainIdx = 0;

  const dust = Array.from({ length: DUST_COUNT }, (_, i) => ({
    x: Math.random(),
    y: Math.random() * 0.65,
    r: 0.9 + Math.random() * 1.4,
    a: 0.35 + Math.random() * 0.4,
    vx: (Math.random() - 0.5) * 0.004,
    vy: (Math.random() - 0.5) * 0.002,
    ph: i * 0.7,
  }));

  // Smoothed audio state.
  let rmsS = 0;
  let bassS = 0;
  let pulse = 0;
  let lastOnsetTs = -1;
  let lastT = 0;

  function resize() {
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    W = canvas.clientWidth || window.innerWidth || 1920;
    H = canvas.clientHeight || window.innerHeight || 1080;
    const pw = Math.round(W * dpr);
    const ph = Math.round(H * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
  }

  function radial(cx, cy, r0, r1, stops) {
    const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }

  function fillCircle(cx, cy, r, style, blend, alpha = 1) {
    ctx.save();
    ctx.globalCompositeOperation = blend;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render(state, audio, tNow) {
    if (!W || !H) resize();
    const phase = SKY[state?.phase] ? state.phase : 'night';
    const attract = !!state?.attract;
    const day = phase === 'day';
    const t = (tNow || 0) / 1000;
    const dt = lastT ? Math.min(0.1, t - lastT) : 0.016;
    lastT = t;

    // --- audio smoothing ---------------------------------------------------
    const rms = clamp01(audio?.rms ?? 0);
    const bands = Array.isArray(audio?.bands) ? audio.bands : null;
    const bass = bands ? clamp01((bands[0] ?? 0) * 0.7 + (bands[1] ?? 0) * 0.3) : 0;
    rmsS += (rms - rmsS) * (rms > rmsS ? 0.35 : 0.08);
    bassS += (bass - bassS) * (bass > bassS ? 0.4 : 0.1);
    if (audio?.onset && audio.ts !== lastOnsetTs) {
      lastOnsetTs = audio.ts;
      pulse = 1;
    }
    pulse *= Math.exp(-dt * 4.5);

    // --- geometry ----------------------------------------------------------
    const breathe = reduced ? 0 : -14 * (0.5 - 0.5 * Math.cos((Math.PI * t) / 5));
    const horizonY = attract ? H * 0.76 : H * 0.74;
    const baseR = attract ? H * 0.278 : H * 0.213;
    const R = baseR * (1 + 0.06 * rmsS);
    const cx = W / 2;
    const cy = (attract ? horizonY : H * 0.55) + breathe;
    const bright = 0.72 + 0.28 * rmsS;
    const screen = day ? 'source-over' : 'screen';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // --- sky ---------------------------------------------------------------
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    for (const [o, c] of SKY[phase]) sky.addColorStop(o, c);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // --- background light leaks -------------------------------------------
    if (day) {
      fillCircle(cx, H * 0.85, W * 0.5, radial(cx, H * 0.85, 0, W * 0.5, [
        [0, 'rgba(246,200,95,.40)'],
        [0.5, 'rgba(246,200,95,.14)'],
        [1, 'rgba(246,200,95,0)'],
      ]), 'source-over');
    } else {
      ctx.save();
      ctx.translate(cx, H * 0.8);
      ctx.scale(1, 0.64);
      fillCircle(0, 0, W * 0.37, radial(0, 0, 0, W * 0.37, [
        [0, 'rgba(255,115,90,.5)'],
        [0.45, 'rgba(245,158,66,.24)'],
        [0.7, 'rgba(242,139,184,.11)'],
        [1, 'rgba(0,0,0,0)'],
      ]), 'screen');
      ctx.restore();
      fillCircle(W + 60, -80, W * 0.3, radial(W + 60, -80, 0, W * 0.3, [
        [0, 'rgba(23,123,255,.28)'],
        [1, 'rgba(23,123,255,0)'],
      ]), 'screen');
      fillCircle(W * 0.05, H * 0.08, W * 0.22, radial(W * 0.05, H * 0.08, 0, W * 0.22, [
        [0, 'rgba(184,192,255,.13)'],
        [1, 'rgba(184,192,255,0)'],
      ]), 'screen');
    }

    // --- 1. ambient bloom ---------------------------------------------------
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.78);
    fillCircle(0, 0, R * 2.6, radial(0, 0, 0, R * 2.6, day
      ? [
          [0, 'rgba(246,200,95,.55)'],
          [0.45, 'rgba(246,200,95,.22)'],
          [1, 'rgba(246,200,95,0)'],
        ]
      : [
          [0, 'rgba(255,115,90,.6)'],
          [0.45, 'rgba(245,158,66,.28)'],
          [1, 'rgba(0,0,0,0)'],
        ]), screen, bright);
    ctx.restore();

    // --- 2. halo ------------------------------------------------------------
    fillCircle(cx, cy, R * 1.45, radial(cx, cy, R * 0.6, R * 1.45, day
      ? [
          [0, 'rgba(251,218,138,.9)'],
          [0.6, 'rgba(246,180,90,.4)'],
          [1, 'rgba(246,180,90,0)'],
        ]
      : [
          [0, 'rgba(246,200,95,.9)'],
          [0.6, 'rgba(255,115,90,.45)'],
          [1, 'rgba(0,0,0,0)'],
        ]), screen, bright);

    // --- 3. chromatic fringe (red left, blue right, offset ±3 px) -----------
    const fr = R * 1.013;
    const fringe = (ox, color) => {
      fillCircle(cx + ox, cy, fr, radial(cx + ox, cy, fr * 0.88, fr, [
        [0, 'rgba(0,0,0,0)'],
        [0.65, color.replace('A)', '.4)')],
        [1, 'rgba(0,0,0,0)'],
      ]), day ? 'source-over' : 'screen', day ? 0.5 : 1);
    };
    fringe(-3, 'rgba(255,80,80,A)');
    fringe(3, 'rgba(120,150,255,A)');

    // --- 4. feathered core --------------------------------------------------
    // Highlight sits at 40% height (off-centre inner circle), the outer edge
    // is the true rim so the 93%→100% stops give a 7% soft feather.
    const core = ctx.createRadialGradient(cx, cy - R * 0.2, 0, cx, cy, R);
    for (const [o, c] of SUN_STOPS) core.addColorStop(o, c);
    fillCircle(cx, cy, R, core, 'source-over', 1);

    // --- 5. corona rings ----------------------------------------------------
    ctx.save();
    ctx.lineWidth = 0.8;
    const spacing = R * 0.48 * (1 + 0.3 * bassS);
    for (let i = 0; i < 3; i++) {
      const r = R * RING_RATIO[0] + i * spacing + pulse * (22 + 12 * i);
      ctx.strokeStyle = RING_COLORS[i];
      ctx.globalAlpha = (day ? RING_ALPHA[i] * 1.6 : RING_ALPHA[i]) * (1 + 0.8 * pulse);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // --- 6. horizon, haze, reflection --------------------------------------
    if (attract) {
      const water = ctx.createLinearGradient(0, horizonY, 0, H);
      water.addColorStop(0, day ? 'rgba(242,235,224,.55)' : 'rgba(8,10,34,.55)');
      water.addColorStop(1, day ? 'rgba(232,222,206,.9)' : 'rgba(8,10,34,.92)');
      ctx.fillStyle = water;
      ctx.fillRect(0, horizonY, W, H - horizonY);
    }
    const inkLine = day ? '26,23,20' : '245,241,232';
    const hair = ctx.createLinearGradient(0, 0, W, 0);
    hair.addColorStop(0, `rgba(${inkLine},0)`);
    hair.addColorStop(0.25, `rgba(${inkLine},.5)`);
    hair.addColorStop(0.75, `rgba(${inkLine},.5)`);
    hair.addColorStop(1, `rgba(${inkLine},0)`);
    ctx.fillStyle = hair;
    ctx.fillRect(0, Math.round(horizonY), W, 1);

    ctx.save();
    ctx.translate(cx, horizonY);
    ctx.scale(1, 0.09);
    fillCircle(0, 0, W * 0.34, radial(0, 0, 0, W * 0.34, [
      [0, 'rgba(255,236,190,.45)'],
      [1, 'rgba(255,236,190,0)'],
    ]), screen);
    ctx.restore();

    // Reflection: clip below the horizon, mirrored blurred ellipse + streaks.
    const reflH = H - horizonY - 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY + 1, W, reflH);
    ctx.clip();
    ctx.save();
    ctx.translate(cx, horizonY + R * 0.13);
    ctx.scale(1, 0.35);
    fillCircle(0, 0, R * 1.56, radial(0, 0, 0, R * 1.56, day
      ? [
          [0, 'rgba(246,200,95,.6)'],
          [0.55, 'rgba(240,134,94,.3)'],
          [1, 'rgba(0,0,0,0)'],
        ]
      : [
          [0, 'rgba(246,200,95,.8)'],
          [0.55, 'rgba(255,115,90,.4)'],
          [1, 'rgba(0,0,0,0)'],
        ]), screen, 0.8 + 0.4 * rmsS);
    ctx.restore();

    const streakW = W * 0.6;
    const halfEll = streakW * 0.48; // ellipse 48% of the streak box, as in the mockup mask
    const streakAlpha = (day ? 0.32 : 0.42) * (0.85 + 0.3 * rmsS);
    ctx.globalCompositeOperation = 'source-over';
    for (let y = 0; y < reflH; y += 11) {
      const v = y / reflH;
      const vert = 0.95 * (1 - v);
      if (vert <= 0.02) break;
      const g = ctx.createLinearGradient(cx - streakW / 2, 0, cx + streakW / 2, 0);
      for (let s = 0; s <= 8; s++) {
        const u = ((s / 8) * streakW - streakW / 2) / halfEll;
        const m = Math.max(0, 1 - Math.sqrt(u * u + v * v));
        g.addColorStop(s / 8, `rgba(255,205,160,${(m * vert * streakAlpha).toFixed(3)})`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(cx - streakW / 2, horizonY + 1 + y, streakW, 2);
    }
    ctx.restore();

    // --- dust ---------------------------------------------------------------
    ctx.save();
    ctx.fillStyle = day ? '#1A1714' : '#F5F1E8';
    for (const p of dust) {
      if (!reduced) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
        if (p.y < -0.02) p.y = 0.7;
        if (p.y > 0.7) p.y = -0.02;
      }
      const tw = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 0.9 + p.ph);
      ctx.globalAlpha = p.a * tw * (day ? 0.5 : 1);
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // --- grain (device pixels) ---------------------------------------------
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = GRAIN_ALPHA;
    grainIdx = reduced ? 0 : (grainIdx + 1) % GRAIN_TILES;
    const ox = reduced ? 0 : Math.floor(Math.random() * GRAIN_TILE);
    const oy = reduced ? 0 : Math.floor(Math.random() * GRAIN_TILE);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = grainPatterns[grainIdx];
    ctx.fillRect(0, 0, canvas.width + ox, canvas.height + oy);
    ctx.restore();

    // --- vignette -----------------------------------------------------------
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(W * 0.5, H * 0.55);
    ctx.scale(W * 0.75, H * 0.7);
    const vg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    vg.addColorStop(0, 'rgba(2,3,12,0)');
    vg.addColorStop(0.45, 'rgba(2,3,12,0)');
    vg.addColorStop(1, day ? 'rgba(26,23,20,.14)' : 'rgba(2,3,12,.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function dispose() {
    mq?.removeEventListener?.('change', onMq);
    grainTiles.length = 0;
    grainPatterns.length = 0;
  }

  resize();
  return { render, resize, dispose };
}
