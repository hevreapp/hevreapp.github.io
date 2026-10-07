// Everything that's only there to feel good: confetti and a little vibration.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// The card colours: blue, violet, pink, coral, teal, sky, purple, orange. Picked by hand
// so every card reads with white text (a raw hue wheel gives muddy yellows and greens).
export const CARD_HUES = [228, 258, 332, 6, 168, 199, 282, 22];

/* ---------- confetti ---------- */

const cv = document.getElementById('confetti');
const ctx = cv.getContext('2d');
let bits = [], running = false;

export function confetti() {
  if (reduce) return;
  const dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = CARD_HUES.map(h => `hsl(${h} 72% 55%)`).concat('#0B0B10');
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
