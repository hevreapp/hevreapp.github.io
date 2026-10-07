// Everything that's only there to look good: day/night, background lines, spotlight, confetti.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- day / night (same switch + circle reveal as the bot's mini app) ---------- */

const THEME_KEY = 'hevre:theme';
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
const paintBar = () => {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
};

function switchTheme(mode) {
  const apply = () => { document.documentElement.dataset.theme = mode; paintBar(); };
  if (reduce || !document.startViewTransition) return apply();
  // The new theme grows out of wherever the sun/moon lands.
  const c = document.querySelector('.theme-switch__container').getBoundingClientRect();
  const x = mode === 'dark' ? c.right - c.height / 2 : c.left + c.height / 2;
  const y = c.top + c.height / 2;
  const r = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
  const t = document.startViewTransition(apply);
  t.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.22,.61,.36,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }, () => {});
}

const box = document.getElementById('theme-toggle');
box.checked = isDark(); // checked = night, matching the artwork
paintBar();
box.addEventListener('change', () => {
  const mode = box.checked ? 'dark' : 'light';
  switchTheme(mode);
  try { localStorage.setItem(THEME_KEY, mode); } catch {}
});

/* ---------- background paths (Kokonut UI, via 21st.dev) ---------- */

function fan(position) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-200 -200 1100 900');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  for (let i = 0; i < 36; i++) {
    const p = document.createElementNS(NS, 'path');
    const a = i * 5 * position, b = i * 6;
    p.setAttribute('d', `M-${380 - a} -${189 + b}C-${380 - a} -${189 + b} -${312 - a} ${216 - b} ${152 - a} ${343 - b}C${616 - a} ${470 - b} ${684 - a} ${875 - b} ${684 - a} ${875 - b}`);
    p.setAttribute('pathLength', '1');
    p.setAttribute('stroke-width', (0.5 + i * 0.03).toFixed(2));
    p.setAttribute('stroke-opacity', (0.06 + i * 0.012).toFixed(3));
    p.style.setProperty('--d', (20 + Math.random() * 10).toFixed(1) + 's');
    p.style.animationDelay = (-Math.random() * 30).toFixed(1) + 's';
    svg.append(p);
  }
  return svg;
}
document.querySelector('.bgpaths').append(fan(1), fan(-1));

/* ---------- spotlight on glass panels ---------- */

addEventListener('pointermove', e => {
  const p = e.target.closest?.('.panel');
  if (!p) return;
  const r = p.getBoundingClientRect();
  p.style.setProperty('--mx', e.clientX - r.left + 'px');
  p.style.setProperty('--my', e.clientY - r.top + 'px');
}, { passive: true });

/* ---------- confetti ---------- */

const cv = document.getElementById('confetti');
const ctx = cv.getContext('2d');
let bits = [], running = false;

export function confetti() {
  if (reduce) return;
  const dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.documentElement);
  const colors = ['--g1', '--g2', '--g3', '--yes'].map(v => css.getPropertyValue(v).trim()).concat('#ffffff');
  for (let i = 0; i < 160; i++) {
    const fromLeft = i % 2 === 0;
    bits.push({
      x: fromLeft ? -10 : innerWidth + 10, y: innerHeight * (.55 + Math.random() * .3),
      vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9), vy: -(9 + Math.random() * 11),
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
      c: colors[i % colors.length], life: 0, born: performance.now(),
    });
  }
  if (!running) { running = true; requestAnimationFrame(tick); }
}

function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  // by the clock, not by frames: a throttled phone (battery saver) would otherwise keep it falling for ages
  const now = performance.now();
  bits = bits.filter(b => b.y < innerHeight + 40 && now - b.born < 4000);
  for (const b of bits) {
    b.life++; b.vy += .32; b.vx *= .985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.r);
    ctx.fillStyle = b.c;
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.life / 8)));
    ctx.restore();
  }
  if (bits.length) requestAnimationFrame(tick);
  else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

// Browsers refuse (and log an error) before the first tap, e.g. a match arriving from a friend.
export function buzz(ms = 12) {
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { navigator.vibrate?.(ms); } catch {}
}
