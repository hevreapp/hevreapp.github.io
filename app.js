import { store, isLive, newId, newCode } from './store.js?v=20261008145109';
import { balances, transfers, shekels } from './split.js?v=20261008145109';
import { packs } from './ideas.js?v=20261008145109';
import { confetti, buzz, CARD_HUES } from './fx.js?v=20261008145109';
import { REGIONS, regionName, planFor, addMin } from './plan-data.js?v=20261008145109';
import { EXPLAIN } from './explain.js?v=20261008145109';
import { API, VAPID_KEY } from './api-config.js?v=20261008145109';

// The always-on server (AI + notifications). Fire and forget: the site works the same without it.
async function callApi(path, body) {
  if (!API || !isLive) return null;
  try {
    const token = await store.idToken();
    if (!token) return null;
    const r = await fetch(API + path, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.ok ? r.json() : null;
  } catch { return null; }
}
import { TASTES, LIMITS, PRICES, BUDGETS, ANY_BUDGET, tasteLabel, limitLabel, tagsOf, priceOf, ageCheck } from './tags.js?v=20261008145109';

const root = document.getElementById('app');
// Same falsy-skipping as h(), so `cond && el` works at the top level too.
const app = { replaceChildren: (...kids) => root.replaceChildren(...kids.flat().filter(k => k != null && k !== false)), querySelectorAll: s => root.querySelectorAll(s) };
let settleTimer;
function unsettle() {
  root.removeAttribute('data-settled');
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => root.setAttribute('data-settled', ''), 900);
}
const MAX_OPTIONS = 60;
const MAX_MEMBERS = 20;

/* ---------- tiny helpers ---------- */

// Builds DOM. Strings become text nodes, never HTML, so names can't inject anything.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el[k] = v;
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), msg.length > 40 ? 6000 : 2200);
}

const cleanName = s => s.replace(/[\/\\.#$\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);

async function share(text, url) {
  if (navigator.share) {
    try { await navigator.share({ text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  open('https://wa.me/?text=' + encodeURIComponent(url ? text + '\n' + url : text), '_blank', 'noopener');
}

const groupUrl = gid => location.origin + location.pathname + '#g=' + gid;

/* ---------- who's signed in ---------- */

let user = null;       // {uid, name} from sign-in
let userDoc = null;    // users/{uid}: my name and my profile
let myGroups = [];     // groups I'm a member of
let unUser = null, unGroups = null;

function boot() {
  store.onAuth(u => {
    user = u;
    unUser?.(); unGroups?.(); unUser = unGroups = null;
    if (unwatch) { unwatch(); unwatch = null; }
    userDoc = null; myGroups = []; gid = null; state = null;
    if (!u) return renderSignIn();
    let first = true;
    unUser = store.watchUser(u.uid, d => { userDoc = d; if (first) { first = false; route(true); } else rerender(); });
    unGroups = store.watchMyGroups(u.uid, list => { myGroups = list; if (!gid) rerender(); });
  });
}

const myName = () => userDoc?.name || '';
// Birth date, not age: age goes stale, a birthday doesn't. Age is worked out fresh every time.
const ageOf = born => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(born || '');
  if (!m) return 0;
  const now = new Date();
  let a = now.getFullYear() - +m[1];
  if (now.getMonth() + 1 < +m[2] || (now.getMonth() + 1 === +m[2] && now.getDate() < +m[3])) a--;
  return a;
};
const validBorn = b => { const a = ageOf(b); return a >= 5 && a <= 120; };
// What the group gets: year and month only, set to the month's last day, so friends never see the exact
// birthday and the age only goes up once the birthday has surely passed (never early).
const roughBorn = b => {
  const m = /^(\d{4})-(\d{2})/.exec(b || '');
  return m ? `${m[1]}-${m[2]}-${new Date(+m[1], +m[2], 0).getDate()}` : '';
};
function rerender() {
  if (!user) return;
  if (!myName() || !validBorn(userDoc?.born)) return renderName();
  if (!gid && /^#g=/.test(location.hash)) return route(true); // came in through a link, just finished naming
  gid ? render() : location.hash === '#stats' ? renderStats() : renderHome();
}

/* ---------- routing ---------- */

let gid = null, state = null, unwatch = null;
let tab = ls.get('hevre:tab', 'decide');
let dragging = false, renderPending = false;

function route(force) {
  if (!user) return;
  if (!myName() || !validBorn(userDoc?.born)) return renderName();
  const m = location.hash.match(/^#g=([A-Za-z0-9]{16})$/);
  const next = m ? m[1] : null;
  if (next === gid && gid && !force) return;
  if (unwatch) { unwatch(); unwatch = null; }
  unsettle();
  gid = next; state = null; chatView = null;
  if (!gid) return location.hash === '#stats' ? renderStats() : renderHome();
  app.replaceChildren(h('p', { class: 'empty' }, 'טוען...'));
  unwatch = store.watch(gid, s => { state = s; render(); });
}
addEventListener('hashchange', () => route());

function render() {
  if (dragging || wheelBusy) { renderPending = true; return; }
  if (!state || !user) return;
  if (!state.group) {
    app.replaceChildren(
      h('div', { class: 'hero' },
        h('div', { class: 'wave' }, '🤷'),
        h('div', { class: 'logo sm' }, 'אופס'),
        h('p', { class: 'tag' }, 'לא מצאתי את הקבוצה הזאת אולי הקישור לא שלם?'),
      ),
      h('a', { class: 'btn wide', href: '#' }, 'לקבוצות שלי'),
    );
    return;
  }
  if (!state.group.memberUids?.includes(user.uid)) return renderJoin();
  renderGroup(state.group.people[user.uid]);
}

/* ---------- sign in ---------- */

function renderSignIn() {
  const err = h('div', { class: 'err' });
  const hero = h('div', { class: 'hero' },
    h('div', { class: 'wave' }, '🤙'),
    h('div', { class: 'logo' }, "חבר'ה"),
    h('p', { class: 'tag' }, 'מחליטים מה עושים ומי חייב למי בלי לריב בקבוצה'),
  );

  if (isLive) {
    const logo = h('span', { class: 'glogo', 'aria-hidden': 'true' });
    const go = h('button', { class: 'gbtn' }, logo, 'כניסה עם Google');
    // the Google "G" in its four colours (static markup, nothing from users)
    logo.innerHTML = '<svg viewBox="0 0 48 48" width="22" height="22"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
    go.onclick = async () => {
      go.disabled = true;
      try { await store.signIn(); } catch { err.textContent = 'הכניסה נתקעה תנסה שוב'; }
      go.disabled = false;
    };
    return app.replaceChildren(hero,
      h('div', { class: 'panel', style: 'text-align:center' },
        h('h3', { style: 'justify-content:center' }, 'יאללה נכנסים'),
        h('p', { class: 'muted' }, 'משתמש אחד לכל הקבוצות שלך'),
        go, err,
        h('a', { class: 'linkbtn', href: 'privacy.html' }, '🔒 מה נשמר עליך ומי רואה'),
      ),
    );
  }

  // test mode: a name is an account, so you can play every friend from one browser
  const name = h('input', { maxlength: 30, placeholder: 'השם שלך' });
  const go = async () => { const n = cleanName(name.value); if (!n) return err.textContent = 'איך קוראים לך?'; await store.signIn(n); };
  name.onkeydown = e => { if (e.key === 'Enter') go(); };
  const known = store.testUsers();
  app.replaceChildren(hero,
    h('div', { class: 'banner' }, 'מצב בדיקה: אין עדיין Firebase אז הכניסה היא רק עם שם'),
    h('div', { class: 'panel' },
      h('h3', null, '👋 כניסה'),
      h('div', { class: 'row' }, name, h('button', { class: 'btn', onclick: go }, 'כניסה')),
      err,
      known.length > 0 && [
        h('label', null, 'או להיכנס בתור'),
        h('div', { class: 'chips' }, known.map(u => h('button', { class: 'chip', onclick: () => store.signIn(u.name) }, u.name))),
      ],
    ),
  );
}

// First time in: the name your friends will see, and your birth date (required, it decides which ideas fit you).
// Someone who signed up before this existed only gets asked the date.
function renderName() {
  const hasName = !!myName();
  const name = h('input', { maxlength: 30, placeholder: 'השם שלך', value: myName() || (user?.name || '').split(' ')[0] });
  const age = h('input', { type: 'date', class: 'agein', max: isoDay(new Date()), min: '1900-01-01' });
  const err = h('div', { class: 'err' });
  const go = async () => {
    const n = cleanName(name.value);
    const a = age.value;
    if (!n) return err.textContent = 'איך קוראים לך?';
    if (!validBorn(a)) return err.textContent = 'מתי נולדת?';
    const fresh = hasName ? {} : { likes: [], dislikes: [], limits: [], note: '', share: 'group', hidden: {} };
    // age: null drops the number saved by the version before birth dates
    try { await store.saveUser(user.uid, { ...fresh, name: n, born: a, age: null, ts: Date.now() }); }
    catch { err.textContent = 'משהו נתקע בשמירה, תנסה שוב עוד רגע'; }
  };
  name.onkeydown = age.onkeydown = e => { if (e.key === 'Enter') go(); };
  app.replaceChildren(
    h('div', { class: 'hero' }, h('div', { class: 'wave' }, '👋'),
      h('div', { class: 'logo sm' }, hasName ? 'עוד שאלה אחת' : 'נעים מאוד'),
      h('p', { class: 'tag' }, hasName ? 'מתי נולדת? ככה נדע אילו יציאות מתאימות לך' : 'איך החבר\'ה קוראים לך ומתי נולדת?')),
    h('div', { class: 'panel' },
      !hasName && [h('label', null, 'שם'), name],
      h('label', null, 'תאריך לידה'), age,
      h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'החבר\'ה רואים רק את הגיל, לא את התאריך. הוא עוזר לסמן יציאות שלא מתאימות לגיל, כמו מסיבה מגיל 16'),
      err,
      h('button', { class: 'btn wide', onclick: go }, 'יאללה'),
    ),
  );
  (hasName ? age : name).focus();
}

/* ---------- home: my groups ---------- */

function renderHome() {
  const name = h('input', { maxlength: 30, placeholder: 'למשל: הכיתה / טיול אילת' });
  const err = h('div', { class: 'err' });
  const go = h('button', { class: 'btn wide' }, 'יאללה פתח');
  go.onclick = async () => {
    const n = cleanName(name.value);
    if (!n) return err.textContent = 'תן שם לקבוצה';
    go.disabled = true;
    const id = newId();
    try {
      await store.createGroup(id, {
        name: n, code: newCode(), owner: user.uid, memberUids: [user.uid],
        people: { [user.uid]: myName() }, members: [myName()], createdAt: Date.now(),
      });
      ls.set('hevre:owner:' + id, true); // this phone runs the lobby
      location.hash = 'g=' + id;
      setTimeout(() => syncProfile(), 300);
    } catch {
      err.textContent = 'משהו נתקע תנסה שוב';
      go.disabled = false;
    }
  };

  const code = h('input', { maxlength: 7, placeholder: 'ABC123', class: 'codein', autocapitalize: 'characters', autocomplete: 'off' });
  const codeErr = h('div', { class: 'err' });
  const join = async () => {
    const c = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 6) return codeErr.textContent = 'קוד זה 6 תווים';
    const g = await store.findCode(c);
    if (!g) return codeErr.textContent = 'לא מצאתי קבוצה עם הקוד הזה';
    location.hash = 'g=' + g;
  };
  code.onkeydown = e => { if (e.key === 'Enter') join(); };

  app.replaceChildren(
    h('div', { class: 'homebar' },
      h('span', { class: 'av', style: `--h:${hue(myName())}` }, [...myName()][0]),
      h('div', { style: 'flex:1' }, h('b', null, 'היי ' + myName()), h('div', { class: 'muted small', style: 'margin:0' }, 'הקבוצות שלך')),
      ls.get('hevre:siteadmin:' + user.uid, false) && h('a', { class: 'pushbtn', href: '#stats', 'aria-label': 'סטטיסטיקות', title: 'סטטיסטיקות' }, '📊'),
      isLive && pushButton(),
      h('button', { class: 'linkbtn', style: 'margin:0', onclick: () => store.signOut() }, isLive ? 'יציאה' : 'החלף משתמש'),
    ),
    !isLive && h('div', { class: 'banner' }, 'מצב בדיקה: הכל נשמר רק בדפדפן הזה'),
    myGroups.length > 0
      ? h('div', { class: 'groups' }, myGroups.map((g, i) => {
          const unread = unreadIn(g.gid, g.lastChat);
          return h('a', { class: 'gcard', href: '#g=' + g.gid, style: `--h:${hue(g.name)};animation-delay:${i * 50}ms` },
            h('span', { class: 'gav' }, [...g.name][0]),
            h('span', { class: 'gtx' }, h('b', null, g.name, isMuted(g.gid) && h('span', { class: 'mutedmark', title: 'בשקט' }, ' 🔕')), h('small', null, g.members.join(', '))),
            unread ? h('span', { class: 'badge' }, unread) : h('span', { class: 'arrow' }, '←'),
            h('button', {
              class: 'gdel', 'aria-label': g.owner === user.uid ? 'למחוק את ' + g.name : 'לצאת מ' + g.name,
              title: g.owner === user.uid ? 'מחק קבוצה' : 'יציאה מהקבוצה',
              onclick: e => { e.preventDefault(); e.stopPropagation(); removeGroup(g); },
            }, g.owner === user.uid ? '🗑️' : '🚪'),
          );
        }))
      : h('div', { class: 'done' }, h('div', { class: 'em' }, '👥'), h('h3', null, 'עוד אין לך קבוצות'), h('p', null, 'תפתח אחת או תצטרף עם קוד מחבר')),
    h('div', { class: 'panel' },
      h('h3', null, '✨ קבוצה חדשה'),
      h('div', { class: 'row' }, name, go),
      err,
    ),
    h('div', { class: 'panel' },
      h('h3', null, '🔑 יש לך קוד?'),
      h('div', { class: 'row' }, code, h('button', { class: 'btn', onclick: join }, 'הצטרף')),
      codeErr,
    ),
    h('div', { class: 'footlinks' },
      h('a', { href: 'privacy.html' }, '🔒 פרטיות'),
      h('button', { onclick: deleteAccount }, '🗑️ למחוק את החשבון שלי'),
    ),
  );
  go.classList.remove('wide');
}

// Anyone can leave. The admin can delete the group for everyone, or hand it to a friend and leave.
async function removeGroup(g) {
  const mine = g.owner === user.uid;
  if (mine && g.memberUids.length > 1) {
    openSheet('יציאה מהקבוצה', close => [
      h('div', { style: 'font-size:44px' }, '👑'),
      h('h3', { style: 'margin:6px 0 4px' }, g.name),
      h('p', { class: 'muted', style: 'margin:0 0 14px' }, 'אתה המנהל של הקבוצה הזאת. אפשר להעביר אותה לחבר ולצאת, או למחוק אותה לכולם'),
      h('button', { class: 'btn wide', onclick: () => { close(); pickAdmin(g, () => leave(g)); } }, '👑 להעביר את הניהול ולצאת'),
      h('button', { class: 'glassbtn wide', onclick: () => { close(); deleteForAll(g); } }, '🗑️ למחוק לכולם'),
      h('button', { class: 'linkbtn', onclick: close }, 'סגור'),
    ]);
    return;
  }
  if (mine) return deleteForAll(g);
  if (confirm(`לצאת מ"${g.name}"?
היא תיעלם מהרשימה שלך, ואפשר לחזור עם הקוד`)) leave(g);
}
async function leave(g) {
  try { await store.leaveGroup(g.gid, user.uid, g.people[user.uid], userDoc?.hidden?.[g.gid]); toast('יצאת מהקבוצה'); }
  catch { toast('משהו נתקע, תנסה שוב'); }
}
async function deleteForAll(g) {
  if (!confirm(`למחוק את "${g.name}" לכולם?
הצ'אט, הקלפים, ההוצאות והקופה יימחקו ואי אפשר להחזיר`)) return;
  try { await store.deleteGroup(g.gid, g.code); toast('הקבוצה נמחקה'); }
  catch { toast('משהו נתקע, תנסה שוב'); }
}

// Pick who gets the crown. then() runs after the handover (e.g. leaving).
function pickAdmin(g, then) {
  const others = g.memberUids.filter(u => u !== user.uid);
  openSheet('להעביר את הניהול', close => [
    h('div', { style: 'font-size:44px' }, '👑'),
    h('h3', { style: 'margin:6px 0 4px' }, 'למי להעביר את הניהול?'),
    h('p', { class: 'muted', style: 'margin:0 0 14px' }, 'המנהל יכול להוציא אנשים מהקבוצה ולמחוק אותה'),
    h('div', { class: 'chips', style: 'justify-content:center' }, others.map(u => h('button', {
      class: 'chip big', onclick: async () => {
        const n = g.people[u];
        if (!confirm(`להעביר את הניהול ל${n}?`)) return;
        close();
        try { await store.setOwner(g.gid, u); toast(`👑 ${n} המנהל עכשיו`); if (then) await then(); }
        catch { toast('משהו נתקע, תנסה שוב'); }
      },
    }, g.people[u]))),
    h('button', { class: 'linkbtn', onclick: close }, 'ביטול'),
  ]);
}

// A small dialog over everything. build(close) returns its contents.
function openSheet(label, build) {
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  const el = h('div', { class: 'matchscreen', role: 'dialog', 'aria-label': label }, h('div', { class: 'ms-inner sheet' }, build(close)));
  el.onclick = e => { if (e.target === el) close(); };
  document.body.append(el);
  return close;
}

// Delete my account: out of every group (my groups go to the next friend, or away if I'm alone), then my data and sign-in.
async function deleteAccount() {
  const owned = myGroups.filter(g => g.owner === user.uid);
  const alone = owned.filter(g => g.memberUids.length === 1);
  const handed = owned.filter(g => g.memberUids.length > 1);
  const lines = ['למחוק את החשבון שלך?', '', 'הפרופיל, תאריך הלידה וההתראות יימחקו, ותצא מכל הקבוצות.'];
  if (alone.length) lines.push(`קבוצות שאתה לבד בהן יימחקו: ${alone.map(g => g.name).join(', ')}`);
  if (handed.length) lines.push(`בקבוצות שאתה מנהל, הניהול יעבור לחבר הבא: ${handed.map(g => g.name).join(', ')}`);
  lines.push('', 'הודעות שכתבת והוצאות שרשמת נשארות אצל הקבוצה. אי אפשר לבטל את זה.');
  if (!confirm(lines.join('\n'))) return;
  toast('מוחק...');
  try {
    for (const g of [...myGroups]) {
      if (g.owner === user.uid && g.memberUids.length === 1) { await store.deleteGroup(g.gid, g.code); continue; }
      if (g.owner === user.uid) await store.setOwner(g.gid, g.memberUids.find(u => u !== user.uid));
      await store.leaveGroup(g.gid, user.uid, g.people[user.uid], userDoc?.hidden?.[g.gid]);
    }
    ls.set(pushKey(), false);
    ls.set('hevre:siteadmin:' + user.uid, false);
    await store.deleteAccount(user.uid);
    location.hash = '';
    toast('החשבון נמחק. להתראות 👋');
  } catch (e) {
    console.error('delete account', e);
    toast('משהו נתקע באמצע, תנסה שוב');
  }
}

// 🔔/🔕 in a group's header: notifications from this group on or off, for all my phones
const isMuted = id => !!userDoc?.muted?.[id];
async function toggleMute(id) {
  const on = !isMuted(id);
  try {
    await store.muteGroup(user.uid, id, on);
    buzz(10);
    toast(on ? '🔕 הקבוצה הזאת בשקט, לא יגיעו ממנה התראות' : '🔔 ההתראות מהקבוצה הזאת חזרו');
  } catch { toast('משהו נתקע, תנסה שוב'); }
}

/* ---------- stats: only for whoever runs the site (the server checks) ---------- */

let statsCache = null;
async function renderStats() {
  const body = h('div', null, h('p', { class: 'empty' }, 'סופר...'));
  app.replaceChildren(
    h('div', { class: 'top' },
      h('a', { class: 'glassbtn', href: '#', title: 'הקבוצות שלי', 'aria-label': 'הקבוצות שלי' }, '→'),
      h('div', { style: 'flex:1;min-width:0' }, h('h2', null, '📊 סטטיסטיקות'), h('div', { class: 'me' }, 'רק אתה רואה את הדף הזה')),
    ),
    body,
  );
  const fresh = statsCache && Date.now() - statsCache.at < 30e3;
  const s = fresh ? statsCache.data : await callApi('/stats', {});
  if (location.hash !== '#stats' || !document.body.contains(body)) return;
  if (!s?.ok) {
    body.replaceChildren(h('div', { class: 'done' }, h('div', { class: 'em' }, '🔒'), h('h3', null, 'הדף הזה רק למי שמנהל את האתר')));
    return;
  }
  if (!fresh) statsCache = { at: Date.now(), data: s };
  ls.set('hevre:siteadmin:' + user.uid, true);
  const num = n => (n == null ? '—' : Number(n).toLocaleString('he-IL'));
  const tile = (em, n, label) => h('div', { class: 'stat' }, h('span', { class: 'stat-em' }, em), h('b', null, num(n)), h('small', null, label));
  const today = s.days.at(-1) || {};
  const bars = (title, key) => {
    const max = Math.max(1, ...s.days.map(d => d[key] || 0));
    return h('div', { class: 'panel' },
      h('h3', null, title),
      h('div', { class: 'bars' }, s.days.map(d => h('div', { class: 'bar', title: `${d.date}: ${d[key] || 0}` },
        h('i', { style: `height:${Math.round(((d[key] || 0) / max) * 100)}%` }),
        h('small', null, Number(d.date.slice(8, 10))),
      ))),
    );
  };
  body.replaceChildren(
    h('div', { class: 'panel' },
      h('h3', null, '👥 משתמשים'),
      h('div', { class: 'stats' },
        tile('👥', s.users?.total, 'נרשמו'),
        tile('🟢', s.users?.activeToday, 'נכנסו היום'),
        tile('🆕', s.users?.newWeek, 'חדשים השבוע'),
      ),
    ),
    h('div', { class: 'panel' },
      h('h3', null, '🏠 קבוצות'),
      h('div', { class: 'stats' },
        tile('🏠', s.groups.total, 'קבוצות'),
        tile('✨', s.groups.newWeek, 'חדשות השבוע'),
        tile('👨‍👩‍👧', s.groups.avgMembers, 'חברים בממוצע'),
      ),
    ),
    h('div', { class: 'panel' },
      h('h3', null, '⚡ היום'),
      h('div', { class: 'stats' },
        tile('🔥', today.groups, 'קבוצות פעילות'),
        tile('🃏', today.rounds, 'סיבובים'),
        tile('💬', today.chats, 'הודעות'),
        tile('🤖', (today.ai || 0) + (today.suggest || 0) + (today.summary || 0), 'שימושים ב-AI'),
        tile('🔔', today.pushes, 'התראות'),
      ),
    ),
    bars('🔥 קבוצות פעילות, 14 ימים', 'groups'),
    bars('💬 הודעות ביום', 'chats'),
    h('p', { class: 'muted small', style: 'text-align:center' }, 'הספירה של הפעילות התחילה ב-8.10.2026'),
  );
}

// Unread chat count for the home list (local mode only knows the last message; that's enough for a dot).
function unreadIn(g, last) {
  if (!last || last.uid === user.uid) return 0;
  return last.ts > ls.get('hevre:read:' + user.uid + ':' + g, 0) ? '•' : 0;
}

/* ---------- joining from a link or a code ---------- */

function renderJoin() {
  const g = state.group;
  if (g.banned?.[user.uid]) {
    app.replaceChildren(
      h('div', { class: 'hero' },
        h('div', { class: 'wave' }, '🚪'),
        h('div', { class: 'logo sm' }, g.name),
        h('p', { class: 'tag' }, 'מנהל הקבוצה הוציא אותך ממנה'),
      ),
      h('a', { class: 'btn wide', href: '#' }, 'לקבוצות שלי'),
    );
    return;
  }
  const err = h('div', { class: 'err' });
  const go = h('button', { class: 'btn wide' }, 'יאללה אני בפנים');
  go.onclick = async () => {
    if (g.memberUids.length >= MAX_MEMBERS) return err.textContent = 'הקבוצה מלאה';
    go.disabled = true;
    // two friends called דני: the second one becomes "דני 2"
    let n = myName(), i = 2;
    while (g.members.includes(n)) n = `${myName()} ${i++}`;
    try { await store.joinGroup(gid, user.uid, n); buzz(30); setTimeout(() => syncProfile(), 300); }
    catch { err.textContent = 'משהו נתקע תנסה שוב'; go.disabled = false; }
  };
  app.replaceChildren(
    h('div', { class: 'hero' },
      h('div', { class: 'wave' }, '👋'),
      h('p', { class: 'tag', style: 'margin-bottom:6px' }, 'הוזמנת לקבוצה'),
      h('div', { class: 'logo sm' }, g.name),
    ),
    h('div', { class: 'chips pick', style: 'justify-content:center;margin-bottom:22px' },
      g.members.map((n, i) => h('span', { class: 'chip big', style: `animation-delay:${i * 60}ms` }, n))),
    go, err,
    h('a', { class: 'linkbtn', href: '#' }, 'לא עכשיו'),
  );
}

/* ---------- group ---------- */

// The tabs are rebuilt on every render, so the pill starts where it was and slides to the new tab.
let shownTab = null;
function slideTabs(el) {
  if (el.dataset.on !== tab) requestAnimationFrame(() => requestAnimationFrame(() => { el.dataset.on = tab; }));
  shownTab = tab;
  return el;
}

let setTab = () => {};
function renderGroup(me) {
  setTab = t => { if (t === tab) return; if (tab === 'chat') delete chatSince[gid]; tab = t; ls.set('hevre:tab', t); unsettle(); render(); };
  const g = state.group;
  once('sync:' + gid + ':' + (userDoc?.ts || 0), !!userDoc && state.profiles?.[me]?.ts !== userDoc.ts, () => syncProfileTo(gid, me));
  const unread = tab === 'chat' ? 0 : chatUnread();
  const content = tab === 'money' ? moneyTab(me) : tab === 'people' ? peopleTab(me) : tab === 'chat' ? chatArea(me) : decideTab(me);
  app.replaceChildren(
    h('div', { class: 'top' },
      h('a', { class: 'glassbtn', href: '#', title: 'הקבוצות שלי', 'aria-label': 'הקבוצות שלי' }, '→'),
      h('div', { style: 'flex:1;min-width:0' },
        h('h2', null, g.name),
        h('div', { class: 'me' }, `${g.members.length} חברים · קוד `, h('button', {
          class: 'code', onclick: async () => { try { await navigator.clipboard.writeText(g.code); toast('הקוד הועתק'); } catch {} },
        }, g.code)),
      ),
      isLive && h('button', {
        class: 'glassbtn bell', onclick: () => toggleMute(gid),
        'aria-label': isMuted(gid) ? 'להחזיר התראות מהקבוצה' : 'להשתיק את הקבוצה', title: isMuted(gid) ? 'הקבוצה בשקט' : 'להשתיק את הקבוצה',
      }, isMuted(gid) ? '🔕' : '🔔'),
      h('button', { class: 'glassbtn', onclick: () => inviteSheet(g) }, '📤 הזמן'),
    ),
    !isLive && h('div', { class: 'banner' }, 'מצב בדיקה: הכל נשמר רק בדפדפן הזה'),
    slideTabs(h('div', { class: 'tabs', 'data-on': shownTab || tab },
      h('span', { class: 'ind' }),
      h('button', { class: tab === 'decide' ? 'on' : '', onclick: () => setTab('decide') }, '🃏', h('span', null, 'מה עושים')),
      h('button', { class: tab === 'chat' ? 'on' : '', onclick: () => setTab('chat') }, '💬', h('span', null, 'צ\'אט'),
        unread > 0 && h('i', { class: 'badge' }, unread > 9 ? '9+' : unread)),
      h('button', { class: tab === 'people' ? 'on' : '', onclick: () => setTab('people') }, '🙋', h('span', null, 'החבר\'ה')),
      h('button', { class: tab === 'money' ? 'on' : '', onclick: () => setTab('money') }, '💸', h('span', null, 'מי חייב')),
    )),
    content,
  );
  if (tab === 'chat') chatMode === 'ai' ? aiAfterRender() : chatAfterRender();
  once('onboard:' + user.uid, !ls.get('hevre:onboarded:' + user.uid, false), showOnboarding);
}

/* ---------- decide tab ---------- */

const SUPER_LIKES = 3;
const yes = v => v === 1 || v === 2;      // 2 = super like
const VETO = -1;                            // one per person per round: the card is out
const score = v => (v === 2 ? 2 : v === 1 ? 1 : 0);
let lastVote = null;                        // {gid, optId}: what "↩️ חזור" takes back

// Who's playing this round: anyone who walked into the lobby or already voted.
// A friend who never opened the link doesn't block a match.
function roundInfo() {
  const { options, votes, group, here } = state;
  const members = group.members;
  const voted = m => votes[m] && Object.keys(votes[m]).length > 0;
  // When the timer runs out, whoever voted is who played; the rest don't hold anyone up.
  const closed = roundClosed();
  const players = members.filter(m => closed ? voted(m) : here?.[m] || voted(m));
  // A card drops out for whoever hasn't reached it yet once it can't win anyway:
  // someone vetoed it, or (3+ playing) half the group already said no.
  const vetoed = o => members.some(m => votes[m]?.[o.id] === VETO);
  const noes = o => players.filter(m => votes[m]?.[o.id] === 0 || votes[m]?.[o.id] === VETO).length;
  const skipped = o => vetoed(o) || (players.length >= 3 && noes(o) >= Math.ceil(players.length / 2));
  const pendingFor = m => options.filter(o => !(votes[m] && o.id in votes[m]) && !skipped(o));
  const doneCount = m => options.length - pendingFor(m).length;
  const finished = players.filter(m => pendingFor(m).length === 0);
  const allDone = options.length > 0 && players.length >= 2 && (closed || finished.length === players.length);
  // a match: everyone who voted on that card said yes (after the timer, cards some skipped still count)
  const voters = o => players.filter(m => votes[m] && o.id in votes[m]);
  const matches = players.length >= 2
    ? options.filter(o => !vetoed(o) && voters(o).length >= 2 && (closed || voters(o).length === players.length) && voters(o).every(m => yes(votes[m][o.id])))
    : [];
  const ranked = options
    .map(o => ({
      o,
      pts: members.reduce((a, m) => a + score(votes[m]?.[o.id]), 0),
      likes: members.filter(m => yes(votes[m]?.[o.id])).length,
      stars: members.filter(m => votes[m]?.[o.id] === 2).length,
    }))
    .filter(x => x.pts > 0 && !vetoed(x.o))
    .sort((a, b) => b.pts - a.pts || b.stars - a.stars);
  // the best match first, so the match screen leads with the strongest one
  const rankOf = o => ranked.findIndex(x => x.o === o);
  matches.sort((a, b) => rankOf(a) - rankOf(b));
  return { members, players, doneCount, pendingFor, finished, allDone, matches, ranked, closed, vetoed };
}

const roundClosed = () => !!state.round?.deadline && Date.now() > state.round.deadline;
const TIMERS = [[0, 'בלי טיימר'], [10, '10 דק׳'], [30, 'חצי שעה'], [60, 'שעה'], [1440, 'יום']];
const left = ms => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  if (t >= 3600) return `${Math.floor(t / 3600)}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')} שע׳`;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
// One ticker for every countdown on screen; when a deadline passes, redraw once so results open.
let tickClosed = null;
setInterval(() => {
  const dl = state?.round?.status === 'live' ? state.round.deadline : 0;
  document.querySelectorAll('[data-countdown]').forEach(el => { el.textContent = left(dl - Date.now()); });
  const c = dl ? Date.now() > dl : null;
  if (tickClosed === false && c === true) render();
  tickClosed = c;
}, 1000);

// Fire a side effect once per key, after the current render finishes.
const fired = new Set();
function once(key, cond, fn) {
  if (!cond || fired.has(key)) return;
  fired.add(key);
  setTimeout(fn, 0);
}

// When a group meets every week: past the set day and hour, the next person to open the group
// starts a fresh round seeded with what the group liked last time.
function lastOccurrence(rep) {
  const [hh, mm] = (rep.time || '18:00').split(':').map(Number);
  const d = new Date(); d.setHours(hh, mm, 0, 0);
  while (d.getDay() !== rep.day || d > new Date()) d.setDate(d.getDate() - 1);
  return d.getTime();
}
async function autoNewRound(me) {
  const liked = state.round?.status === 'live' ? roundInfo().ranked.slice(0, 8).map(x => x.o) : [];
  const keep = liked.length ? liked : state.options.slice(0, 8);
  await store.clearRound(gid);
  const t = Date.now();
  await Promise.all(keep.map((o, i) => store.addOption(gid, { id: newId(10), emoji: o.emoji || '✨', text: o.text, by: me, ts: t + i })));
  toast('🔁 נפתח סיבוב חדש עם מה שאהבתם');
}

function decideTab(me) {
  const rep = state.info?.repeat;
  if (rep && rep.day >= 0 && state.round?.ts) {
    const occ = lastOccurrence(rep);
    // only occurrences after it was switched on, so turning it on mid-week doesn't wipe this round
    once('repeat:' + gid + ':' + occ, occ > (rep.since || 0) && state.round.ts < occ, () => autoNewRound(me));
  }
  return state.round?.status === 'live' ? liveRound(me) : lobby(me);
}

function repeatPanel() {
  const rep = state.info?.repeat || { day: -1, time: '18:00' };
  const set = patch => { buzz(8); store.setInfo(gid, { repeat: { ...rep, ...patch, since: Date.now() }, ts: Date.now() }); };
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  return h('div', { class: 'panel repeat' },
    h('h3', null, '🔁 יציאה קבועה'),
    h('div', { class: 'chips' },
      h('button', { class: 'chip' + (rep.day < 0 ? ' on' : ''), onclick: () => set({ day: -1 }) }, 'בלי'),
      days.map((d, i) => h('button', { class: 'chip' + (rep.day === i ? ' on' : ''), onclick: () => set({ day: i }) }, d)),
    ),
    rep.day >= 0 && [
      h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'muted small' }, 'בשעה'),
        h('input', { type: 'time', class: 'timein', value: rep.time, onchange: e => set({ time: e.target.value || '18:00' }) })),
      h('p', { class: 'muted small', style: 'margin:8px 0 0' }, `כל יום ${days[rep.day]} ב-${rep.time} נפתח לבד סיבוב חדש עם מה שאהבתם בפעם הקודמת`),
    ],
  );
}

/* ----- 1. lobby ----- */

function lobby(me) {
  const { group, here, options, round } = state;
  // Writes go out after this render: the local store re-renders synchronously,
  // and a write from inside render would be painted over by this stale pass.
  const amOwner = state.group.owner === user.uid;
  once('here:' + gid + ':' + me + ':' + (round?.ts || 0), !here?.[me], () => store.markHere(gid, me)); // walking in counts as "I'm here"
  once('owner:' + gid, amOwner && !round?.owner, () => store.setRound(gid, { owner: me }));
  const owner = round?.owner;
  const inCount = group.members.filter(m => here?.[m]).length;

  const timer = ls.get('hevre:timer', 0);
  const start = async () => {
    if (options.length < 2) return toast('תוסיפו לפחות 2 קלפים');
    buzz(30);
    const deadline = timer ? Date.now() + timer * 60000 : 0;
    await store.setRound(gid, { status: 'live', startedBy: me, ts: Date.now(), deadline });
    callApi('/notify', { gid, type: 'round' });
  };

  const myProf = profileOf(me);
  return h('div', null,
    isEmptyProfile(myProf) && h('button', { class: 'nudge', onclick: () => setTab('people') },
      h('span', null, '🙋'),
      h('span', null, h('b', null, 'תספר מה בא לך ומה לא מתאים לך'), h('small', null, 'ככה הקלפים יתאימו לכולם')),
      h('span', null, '←'),
    ),
    h('div', { class: 'panel lobby' },
      h('div', { class: 'lobby-top' },
        h('div', { class: 'pulse' }),
        h('div', null,
          h('h3', null, 'הלובי'),
          h('p', null, `${inCount} מתוך ${group.members.length} כבר פה`),
        ),
      ),
      h('div', { class: 'seats' },
        group.members.map((m, i) => h('div', { class: 'seat' + (here?.[m] ? ' in' : ''), style: `animation-delay:${i * 50}ms` },
          h('span', { class: 'av', style: `--h:${hue(m)}` }, [...m][0]),
          h('span', { class: 'nm' }, m === me ? m + ' (אני)' : m),
          here?.[m] ? h('span', { class: 'st' }, 'פה ✓')
            : h('button', {
                class: 'remind', 'aria-label': 'תזכיר ל' + m,
                onclick: () => share(`${m} מחכים לך ב"${group.name}" 🤙 תכנס לעשות סוויפ`, groupUrl(gid)),
              }, '📲 תזכיר'),
        )),
      ),
      h('button', { class: 'glassbtn wide', onclick: () => share(`פתחתי לנו קבוצה ב"חבר'ה" תכנסו`, groupUrl(gid)) }, '📤 תזמין את מי שחסר'),
    ),
    addOptions(me),
    repeatPanel(),
    h('div', { class: 'startbar' },
      h('div', { class: 'deckcount' }, `🃏 ${options.length} קלפים על השולחן`),
      (amOwner || owner === me || !owner)
        ? [
            h('div', { class: 'chips timers' }, TIMERS.map(([v, l]) => h('button', {
              class: 'chip' + (timer === v ? ' on' : ''), onclick: () => { ls.set('hevre:timer', v); render(); },
            }, (v ? '⏱️ ' : '') + l))),
            h('button', { class: 'btn wide go', disabled: options.length < 2, onclick: start }, '🚀 יאללה מתחילים'),
          ]
        : [
            h('div', { class: 'waiting' }, `מחכים ש${owner} יתחיל`, h('span', { class: 'dots' }, h('i'), h('i'), h('i'))),
            h('button', { class: 'linkbtn', onclick: () => { if (confirm(`להתחיל בלי לחכות ל${owner}?`)) start(); } }, 'להתחיל בלי לחכות'),
          ],
    ),
  );
}

/* ----- live round: swipe, then results ----- */

function liveRound(me) {
  const { options } = state;
  const info = roundInfo();
  const pending = info.pendingFor(me);
  const wrap = h('div');
  const dl = state.round?.deadline;
  if (dl && !info.closed) {
    wrap.append(h('div', { class: 'timer' }, '⏱️ הסיבוב נסגר בעוד ', h('b', { 'data-countdown': '' }, left(dl - Date.now()))));
  }

  wrap.append(h('div', { class: 'who' },
    info.members.map(m => {
      const d = info.doneCount(m);
      const playing = info.players.includes(m);
      const fin = playing && info.pendingFor(m).length === 0;
      return h('span', { class: fin ? 'ok' : '' },
        fin ? '✓ ' + m : playing ? `${m} ${d}/${options.length}` : `${m} 💤`);
    }),
  ));

  if (pending.length && info.closed) {
    wrap.append(h('div', { class: 'done' }, h('div', { class: 'em' }, '⏰'), h('h3', null, 'הזמן נגמר'), h('p', null, 'הספקת ' + info.doneCount(me) + ' מתוך ' + options.length)));
  } else if (pending.length) {
    wrap.append(deck(me, pending));
    // 5. no peeking: results stay locked until you've swiped everything
    wrap.append(h('div', { class: 'locked' }, '🔒 התוצאות נפתחות כשתסיים את כל הקלפים'));
    wrap.append(h('button', {
      class: 'linkbtn',
      onclick: async () => { if (confirm('לעצור את הסיבוב באמצע ולחזור ללובי? הקלפים וההצבעות נמחקים')) await store.clearRound(gid); },
    }, '🔄 סיבוב חדש'));
    return wrap;
  }

  if (!info.allDone) {
    const waitingFor = info.players.filter(m => !info.finished.includes(m));
    wrap.append(h('div', { class: 'done' },
      h('div', { class: 'em' }, '✅'),
      h('h3', null, 'סיימת'),
      h('p', null, waitingFor.length ? 'מחכים ל' + waitingFor.join(', ') : 'מחכים לשאר החבר\'ה'),
      undoButton(me),
    ));
  }
  wrap.append(results(me, info));
  wrap.append(h('button', {
    class: 'glassbtn wide',
    onclick: async () => { if (confirm('לסגור את הסיבוב ולחזור ללובי? הקלפים וההצבעות נמחקים')) await store.clearRound(gid); },
  }, '🔄 סיבוב חדש'));
  return wrap;
}

/* ----- the deck (3. super like) ----- */

// Takes back my last swipe in this round (only while that card is still in the round).
function undoButton(me) {
  if (!lastVote || lastVote.gid !== gid) return null;
  const { optId } = lastVote;
  if (!(state.votes[me] && optId in state.votes[me])) return null;
  return h('button', {
    class: 'undo', onclick: async () => { lastVote = null; buzz(8); await store.unvote(gid, me, optId); },
  }, '↩️ חזור לקלף הקודם');
}

function deck(me, pending) {
  const o = pending[0];
  const total = state.options.length;
  const done = total - pending.length;
  const mine = state.votes[me] || {};
  const supersLeft = SUPER_LIKES - Object.values(mine).filter(v => v === 2).length;
  const vetoLeft = 1 - Object.values(mine).filter(v => v === VETO).length;
  const cast = val => { lastVote = { gid, optId: o.id }; return store.setVote(gid, me, o.id, val); };

  const yesStamp = h('div', { class: 'stamp yes' }, 'כן');
  const noStamp = h('div', { class: 'stamp no' }, 'לא');
  const superStamp = h('div', { class: 'stamp super' }, 'סופר ⭐');
  const vetoStamp = h('div', { class: 'stamp veto' }, 'וטו 🚫');
  const price = priceOf(o.text);
  const why = EXPLAIN[o.text];
  const explain = why && h('div', { class: 'explain' }, why);
  const card = h('div', { class: 'card', style: `--h:${hue(o.text)}` },
    yesStamp, noStamp, superStamp, vetoStamp,
    price != null && h('div', { class: 'price', title: PRICES[price][2] }, PRICES[price][1], h('small', null, PRICES[price][2])),
    why && h('div', { class: 'whatis' }, '❓ מה זה'),
    h('div', { class: 'em' }, o.emoji || '✨'),
    h('div', { class: 'tx' }, o.text),
    o.by && h('div', { class: 'by' }, '💡 הרעיון של ' + o.by),
    fitPills(o, me),
    explain,
  );
  const next = pending[1] && h('div', { class: 'card behind', style: `--h:${hue(pending[1].text)}` },
    h('div', { class: 'em' }, pending[1].emoji || '✨'),
    h('div', { class: 'tx' }, pending[1].text),
  );

  const snapBack = () => {
    card.style.transition = 'transform .25s';
    card.style.transform = '';
    yesStamp.style.opacity = noStamp.style.opacity = superStamp.style.opacity = vetoStamp.style.opacity = 0;
  };
  // val: 0 no, 1 yes, 2 super like, -1 veto
  let gone = false;
  const fly = val => {
    if (gone) return;
    if (val === 2 && supersLeft <= 0) { toast('נגמרו הסופר לייקים לסיבוב הזה'); return snapBack(); }
    if (val === VETO && vetoLeft <= 0) { toast('כבר השתמשת בוטו בסיבוב הזה'); return snapBack(); }
    gone = true;
    card.style.transition = 'transform .32s ease-in, opacity .32s';
    card.style.transform = val === 2 ? 'translateY(-140%) scale(.9)'
      : val === VETO ? 'translateY(140%) scale(.9)'
      : `translateX(${val ? 140 : -140}%) rotate(${val ? 24 : -24}deg)`;
    card.style.opacity = '0';
    if (val === 2) superStamp.style.opacity = 1;
    if (val === VETO) vetoStamp.style.opacity = 1;
    buzz(val === 2 ? [15, 40, 25] : val ? 18 : 8);
    setTimeout(() => cast(val), 220);
  };

  // Drag: right = yes, left = no, up = super like, down = veto (like Tinder, regardless of RTL).
  // A tap without moving opens the explanation.
  let x0 = null, y0 = 0, dx = 0, dy = 0;
  const isUp = () => dy < -30 && Math.abs(dy) > Math.abs(dx);
  const isDown = () => dy > 30 && Math.abs(dy) > Math.abs(dx);
  card.onpointerdown = e => {
    if (gone) return;
    x0 = e.clientX; y0 = e.clientY; dx = dy = 0; dragging = true;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
  };
  card.onpointermove = e => {
    if (x0 == null) return;
    dx = e.clientX - x0; dy = e.clientY - y0;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 14}deg)`;
    const vertical = isUp() || isDown();
    yesStamp.style.opacity = vertical ? 0 : Math.max(0, Math.min(1, dx / 90));
    noStamp.style.opacity = vertical ? 0 : Math.max(0, Math.min(1, -dx / 90));
    superStamp.style.opacity = isUp() ? Math.min(1, -dy / 100) : 0;
    vetoStamp.style.opacity = isDown() ? Math.min(1, dy / 100) : 0;
  };
  const release = () => {
    if (x0 == null) return;
    x0 = null; dragging = false;
    if (dy < -100 && isUp()) fly(2);
    else if (dy > 100 && isDown()) fly(VETO);
    else if (Math.abs(dx) > 90) fly(dx > 0 ? 1 : 0);
    else {
      snapBack();
      if (explain && Math.abs(dx) < 6 && Math.abs(dy) < 6) card.classList.toggle('open');
    }
    if (renderPending && !gone) { renderPending = false; render(); }
  };
  card.onpointerup = release;
  card.onpointercancel = release;

  return h('div', null,
    h('div', { class: 'count' }, `${done + 1} מתוך ${total}`),
    h('div', { class: 'progress' }, h('i', { style: `width:${(done / total) * 100}%` })),
    h('div', { class: 'deck' }, next, card),
    h('div', { class: 'vote' },
      h('button', { class: 'no', 'aria-label': 'לא', onclick: () => fly(0) }, '✕'),
      h('button', { class: 'veto' + (vetoLeft <= 0 ? ' out' : ''), 'aria-label': 'וטו', title: 'וטו: הקלף יוצא מהמשחק', onclick: () => fly(VETO) }, '🚫'),
      h('button', { class: 'star' + (supersLeft <= 0 ? ' out' : ''), 'aria-label': 'סופר לייק', onclick: () => fly(2) },
        '⭐', h('b', null, Math.max(0, supersLeft))),
      h('button', { class: 'yes', 'aria-label': 'כן', onclick: () => fly(1) }, '❤️'),
    ),
    h('div', { class: 'hint' }, 'ימינה כן · שמאלה לא · למעלה סופר · למטה וטו'),
    undoButton(me),
  );
}

// Arrow keys for desktop: right yes, left no, up super.
addEventListener('keydown', e => {
  if (tab !== 'decide' || !gid || e.target.closest('input,textarea,select')) return;
  const btn = c => app.querySelectorAll('.vote .' + c)[0];
  if (!btn('yes')) return;
  if (e.key === 'ArrowLeft') btn('no').click();
  if (e.key === 'ArrowUp') btn('star').click();
  if (e.key === 'ArrowDown') btn('veto').click();
  if (e.key === 'ArrowRight') btn('yes').click();
});

function results(me, info) {
  const { ranked, allDone, members } = info;
  // what fits everyone goes first
  const matches = [...info.matches].sort((a, b) => conflicts(a) - conflicts(b));
  const top = ranked[0]?.pts || 1;
  if (allDone && matches.length) showMatch(matches, me);
  const fitting = ranked.filter(x => !conflicts(x.o));
  const wheelPool = (fitting.length >= 2 ? fitting : ranked).slice(0, 4).map(x => x.o);

  return h('div', null,
    matches.length > 0 && h('div', { class: 'match' },
      h('h3', null, allDone ? '🎉 כולם רוצים' : '🎉 כולם רוצים בינתיים'),
      h('div', { class: 'chips' }, matches.map(o => h('span', { class: 'chip' }, (o.emoji || '') + ' ' + o.text))),
    ),
    allDone && !matches.length && ranked.length >= 2 && wheel(wheelPool),
    allDone && (matches[0] || landedPick()) && whenPanel(me, (matches[0] || landedPick()).text),
    allDone && (matches[0] || landedPick()) && planPanel(me, matches[0] || landedPick()),
    ranked.length > 0 && h('div', { class: 'panel' },
      h('h3', null, '🔥 הכי הרבה כן'),
      h('div', { class: 'rank' },
        ranked.slice(0, 10).map(({ o, likes, stars, pts }) => h('div', { class: 'r' },
          h('span', { style: 'font-size:22px' }, o.emoji || '✨'),
          h('div', { class: 'bar' }, h('i', { style: `width:${(pts / top) * 100}%` }), h('span', null, (conflicts(o) ? '⚠️ ' : '') + o.text)),
          h('span', { class: 'n' }, (stars ? '⭐'.repeat(Math.min(stars, 3)) + ' ' : '') + `${likes}/${members.length}`),
        )),
      ),
    ),
  );
}

const landedPick = () => state.options.find(o => o.id === state.round?.spin) || null;

/* ----- 2. It's a match ----- */

// Full screen, once per phone per set of matches, outside #app so live renders can't wipe it.
function showMatch(matches, me) {
  const key = 'hevre:matched:' + gid;
  const sig = matches.map(o => o.id).sort().join(',');
  if (ls.get(key, '') === sig || document.querySelector('.matchscreen')) return;
  ls.set(key, sig);

  const [best, ...rest] = matches;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  const el = h('div', { class: 'matchscreen', role: 'dialog', 'aria-label': 'יש התאמה' },
    h('div', { class: 'ms-inner' },
      h('div', { class: 'ms-title' }, 'יש התאמה!'),
      h('p', { class: 'ms-sub' }, 'כל החבר\'ה אמרו כן ל'),
      h('div', { class: 'ms-card', style: `--h:${hue(best.text)}` },
        h('div', { class: 'em' }, best.emoji || '✨'),
        h('div', { class: 'tx' }, best.text),
        fitPills(best, me),
      ),
      rest.length > 0 && h('div', { class: 'chips', style: 'justify-content:center' },
        h('span', { class: 'ms-also' }, 'וגם:'), rest.map(o => h('span', { class: 'chip' }, (o.emoji || '') + ' ' + o.text))),
      h('button', { class: 'btn wide', onclick: () => { close(); setTimeout(() => document.getElementById('when')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350); } }, '📅 יאללה, מתי?'),
      h('button', { class: 'glassbtn wide', onclick: () => share(`🎉 יש התאמה! כולם רוצים ${best.emoji || ''} ${best.text}`, groupUrl(gid)) }, '📤 שלח לקבוצה'),
      h('button', { class: 'linkbtn', onclick: close }, 'סגור'),
    ),
  );
  el.onclick = e => { if (e.target === el) close(); };
  document.body.append(el);
  setTimeout(() => { confetti(); buzz([30, 60, 30]); }, 200);
}

/* ----- 4. wheel when nobody matches ----- */

let spunTs = null;      // the spin this phone already animated
let wheelBusy = false;  // hold live re-renders while the wheel turns

function wheel(opts) {
  const round = state.round || {};
  const n = opts.length;
  const seg = 360 / n;
  const idx = opts.findIndex(o => o.id === round.spin);
  const landed = idx >= 0 ? opts[idx] : null;
  // Same final angle on every phone: 6 turns, then the picked slice under the pointer.
  const angle = i => 360 * 6 + (360 - (i + .5) * seg) + (((round.spinTs || 0) % 17) - 8);

  const colors = opts.map(o => `hsl(${hue(o.text)} 85% 62%)`);
  const disc = h('div', { class: 'wheel-disc', style: `background:conic-gradient(${colors.map((c, i) => `${c} ${i * seg}deg ${(i + 1) * seg}deg`).join(',')})` },
    opts.map((o, i) => h('span', { class: 'wl', style: `transform:rotate(${(i + .5) * seg}deg)` }, h('b', null, o.emoji || '✨'))),
  );
  const result = h('div', { class: 'wheel-result' });
  const showResult = () => {
    result.replaceChildren(h('div', { class: 'em' }, landed.emoji || '✨'), h('div', { class: 'tx' }, landed.text));
    result.classList.add('on');
  };

  // Animate only a fresh spin; whoever opens the page later just sees where it landed.
  const fresh = Date.now() - (round.spinTs || 0) < 8000;
  if (landed && spunTs !== round.spinTs && fresh) {
    spunTs = round.spinTs; wheelBusy = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      disc.style.transition = 'transform 4.2s cubic-bezier(.12,.7,.15,1)';
      disc.style.transform = `rotate(${angle(idx)}deg)`;
    }));
    setTimeout(() => {
      wheelBusy = false; showResult(); confetti(); buzz([20, 40, 60]);
      if (renderPending) { renderPending = false; render(); }
    }, 4300);
  } else if (landed) {
    disc.style.transform = `rotate(${angle(idx)}deg)`;
    showResult();
  }

  const spin = async () => {
    if (wheelBusy) return;
    const pick = opts[crypto.getRandomValues(new Uint32Array(1))[0] % n];
    await store.setRound(gid, { spin: pick.id, spinTs: Date.now() });
  };

  return h('div', { class: 'panel wheelbox' },
    h('h3', null, '😬 אין קלף שכולם אהבו'),
    h('p', { class: 'muted' }, landed ? 'הגלגל החליט' : 'הגלגל יחליט בין המובילים'),
    h('div', { class: 'wheel' }, h('div', { class: 'pointer' }), disc, h('div', { class: 'hub' }, '🎡')),
    result,
    h('button', { class: landed ? 'glassbtn wide' : 'btn wide', onclick: spin }, landed ? '🔁 עוד סיבוב לגלגל' : '🎡 תסובב'),
  );
}

// Stable colour per card, so the same idea always glows the same.
function hue(text) {
  let x = 0;
  for (const ch of text) x = (x * 31 + ch.codePointAt(0)) % 997;
  return CARD_HUES[x % CARD_HUES.length];
}

const DECKS = [10, 15, 25];
// How much the group is into an idea, from everyone's profile: likes up, dislikes down.
function groupLikes(text) {
  const tags = tagsOf(text);
  let x = 0;
  for (const m of state.group.members) {
    const p = profileOf(m);
    if (p.likes.some(t => tags.includes(t))) x += 2;
    if (p.dislikes.some(t => tags.includes(t))) x -= 2;
  }
  return x;
}

// The AI looks at everyone's profiles (likes, limits, ages, budget) and puts fresh ideas on the table.
let suggesting = false;
async function aiSuggest() {
  if (suggesting) return;
  suggesting = true; buzz(10);
  toast('🤖 חושב על רעיונות בשבילכם...');
  const r = await callApi('/suggest', { gid });
  suggesting = false;
  if (!r) return toast('לא הצלחתי, תנסו שוב עוד רגע');
  if (r.full) return toast('השולחן כבר מלא');
  if (r.capped) return toast('הגעתם ל-100 שימושים ב-AI להיום');
  if (r.error) return toast(r.error);
  toast(r.added ? `🤖 הוספתי ${r.added} רעיונות` : 'לא מצאתי רעיונות חדשים, תנסו שוב');
}

function addOptions(me) {
  const have = new Set(state.options.map(o => o.text));
  const deckSize = state.info?.deck || 15;
  const room = Math.min(MAX_OPTIONS, deckSize) - state.options.length;

  const fitsAll = ls.get('hevre:fitsall', true);
  const addMany = async items => {
    let fresh = items.filter(([, t]) => !have.has(t));
    if (!fresh.length) return toast('כבר הוספתם הכל מפה');
    let skipped = 0;
    if (fitsAll) {
      const ok = fresh.filter(([, text]) => !conflicts({ text }));
      skipped = fresh.length - ok.length;
      fresh = ok;
      if (!fresh.length) return toast('אין פה קלפים שמתאימים לכולם');
    }
    if (room <= 0) return toast(`השולחן מלא (${deckSize} קלפים)`);
    // what the group is into first, shuffled within the same level so packs still feel random
    const pickN = fresh.map(it => [it, groupLikes(it[1]) + Math.random()]).sort((a, b) => b[1] - a[1]).map(x => x[0])
      .slice(0, Math.min(10, room));
    const t = Date.now();
    await Promise.all(pickN.map(([emoji, text], i) =>
      store.addOption(gid, { id: newId(10), emoji, text, by: me, ts: t + i })));
    toast(`נוספו ${pickN.length} קלפים` + (skipped ? ` · דילגתי על ${skipped} שלא מתאימים` : ''));
  };

  const own = h('input', { maxlength: 40, placeholder: 'משהו משלך...' });
  const addOwn = async () => {
    const text = own.value.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!text) return;
    if (have.has(text)) return toast('זה כבר יש');
    if (room <= 0) return toast(`השולחן מלא (${deckSize} קלפים)`);
    own.value = '';
    await store.addOption(gid, { id: newId(10), emoji: '✨', text, by: me, ts: Date.now() });
    await store.addMyCard(gid, { id: newId(10), emoji: '✨', text, by: me, ts: Date.now() }); // kept for next rounds
  };
  own.onkeydown = e => { if (e.key === 'Enter') addOwn(); };

  const all = packs.flatMap(p => p.items);
  return h('div', { class: 'panel' },
    h('h3', null, '🃏 להוסיף קלפים'),
    h('div', { class: 'decksize' },
      h('span', null, 'כמה קלפים בסיבוב?'),
      h('div', { class: 'seg' }, DECKS.map(n => h('button', {
        class: deckSize === n ? 'on' : '', onclick: () => { buzz(8); store.setInfo(gid, { deck: n, ts: Date.now() }); },
      }, n))),
    ),
    h('p', { class: 'muted small', style: 'margin:8px 0 12px' }, `${state.options.length}/${deckSize} על השולחן. בכל חבילה נכנסים קודם הקלפים שהכי מתאימים לחבר'ה`),
    h('div', { class: 'chips' },
      API && isLive && h('button', { class: 'chip ai', onclick: aiSuggest }, '🤖 תציע לנו'),
      h('button', { class: 'chip on', onclick: () => addMany(all) }, '🎲 הפתעה'),
      state.mycards?.length > 0 && h('button', { class: 'chip ours', onclick: () => addMany(state.mycards.map(c => [c.emoji, c.text])) },
        `⭐ שלנו (${state.mycards.length})`),
      packs.map(p => h('button', { class: 'chip', onclick: () => addMany(p.items) }, p.emoji + ' ' + p.name)),
    ),
    h('button', {
      class: 'fitsall' + (fitsAll ? ' on' : ''), 'aria-pressed': fitsAll ? 'true' : 'false',
      onclick: () => { ls.set('hevre:fitsall', !fitsAll); render(); },
    }, h('span', { class: 'sw' }), 'רק קלפים שמתאימים לכולם'),
    h('div', { class: 'row', style: 'margin-top:12px' }, own, h('button', { class: 'btn', onclick: addOwn }, 'הוסף')),
  );
}

/* ---------- people tab: what each person likes and what doesn't work for them ---------- */
// The profile lives on the user (users/{uid}) and is copied into each of their groups:
// likes/dislikes always; limits and note only if they share them. Hidden limits go into the
// group's hidden/ list under a random id, so cards can warn "not for someone" without a name.

const blankProfile = () => ({ likes: [], dislikes: [], limits: [], note: '', share: 'group', budget: ANY_BUDGET, born: '' });
const myProfile = () => ({ ...blankProfile(), ...(userDoc || {}) });
const profileOf = m => (m === state.group.people[user.uid] ? myProfile() : { ...blankProfile(), ...(state.profiles?.[m] || {}) });
const isEmptyProfile = p => !p.likes.length && !p.dislikes.length && !p.limits.length && !p.note;

function publicPart(p) {
  const shared = p.share === 'group';
  return { likes: p.likes, dislikes: p.dislikes, limits: shared ? p.limits : [], note: shared ? p.note : '', budget: shared ? p.budget : ANY_BUDGET, born: shared ? roughBorn(p.born) : '', share: p.share, ts: Date.now() };
}

// Copy my profile into one group (or all of mine).
async function syncProfileTo(g, name) {
  const p = myProfile();
  await store.setProfile(g, name, publicPart(p));
  let hid = userDoc?.hidden?.[g];
  if (!hid) { hid = newId(12); await store.saveUser(user.uid, { hidden: { ...(userDoc?.hidden || {}), [g]: hid } }); }
  const hide = p.share === 'hidden';
  await store.setHidden(g, hid, { tags: hide ? p.limits : [], budget: hide ? p.budget : ANY_BUDGET, born: hide ? roughBorn(p.born) : '' });
}
async function syncProfile() {
  for (const g of myGroups) await syncProfileTo(g.gid, g.people[user.uid]);
  if (gid && state?.group?.people?.[user.uid] && !myGroups.some(g => g.gid === gid)) await syncProfileTo(gid, state.group.people[user.uid]);
}

// How an idea sits with the group: who can't do it (named only if they share), who loves it.
function fitOf(o, me) {
  const tags = tagsOf(o.text);
  const price = priceOf(o.text);
  const out = { conflicts: [], hiddenConflict: false, fans: [], adult: [], hiddenAdult: false };
  if (!tags.length) return out;
  const myHid = userDoc?.hidden?.[gid];
  for (const m of state.group.members) {
    const p = profileOf(m);
    const hit = p.limits.filter(t => tags.includes(t));
    const visible = p.share === 'group' || m === me;
    const ag = ageCheck(o.text, ageOf(p.born));
    if (ag.hard && visible) out.conflicts.push({ m, label: ag.hard });
    else if (hit.length && visible) out.conflicts.push({ m, label: limitLabel[hit[0]] });
    else if (price > (p.budget ?? ANY_BUDGET) && visible) out.conflicts.push({ m, label: '💸 ' + BUDGETS[p.budget][1].replace(/^\S+ /, '') });
    if (ag.soft && visible) out.adult.push({ m, label: ag.soft });
    if (p.likes.some(t => tags.includes(t))) out.fans.push(m);
  }
  const others = (state.hidden || []).filter(x => x.id !== myHid);
  if (others.some(x => x.tags.some(t => tags.includes(t)) || price > (x.budget ?? ANY_BUDGET) || ageCheck(o.text, ageOf(x.born)).hard)) out.hiddenConflict = true;
  if (others.some(x => ageCheck(o.text, ageOf(x.born)).soft)) out.hiddenAdult = true;
  return out;
}
const conflicts = o => { const f = fitOf(o, state.group.people[user.uid]); return f.conflicts.length > 0 || f.hiddenConflict; };

// Small pills under a card.
function fitPills(o, me) {
  const f = fitOf(o, me);
  const pills = [];
  for (const c of f.conflicts) pills.push(h('span', { class: 'fit warn' }, `⚠️ ${c.m === me ? 'לי' : c.m}: ${c.label}`));
  if (f.hiddenConflict) pills.push(h('span', { class: 'fit warn' }, '⚠️ לא מתאים למישהו בקבוצה'));
  // an adult along is a condition, not a no: one pill for everyone it applies to
  const adults = f.adult.map(a => a.m === me ? 'לי' : a.m);
  if (adults.length || f.hiddenAdult) pills.push(h('span', { class: 'fit adult' },
    (f.adult[0]?.label || '👨‍👩‍👦 רק עם מבוגר') + (adults.length ? ' · ' + adults.join(', ') : ' · למישהו בקבוצה')));
  const fans = f.fans.filter(m => m !== me);
  if (fans.length) pills.push(h('span', { class: 'fit fan' }, '💚 ' + fans.join(', ') + ' בעניין'));
  return pills.length ? h('div', { class: 'fits' }, pills) : null;
}

let noteDraft = null; // keeps what you're typing through live updates

function peopleTab(me) {
  const mine = myProfile();
  const save = async patch => {
    await store.saveUser(user.uid, { ...patch, ts: Date.now() });
    await syncProfile();
  };

  const toggle = (list, t, other) => {
    const cur = myProfile(); // fresh, so quick taps don't undo each other
    const on = cur[list].includes(t);
    const patch = { [list]: on ? cur[list].filter(x => x !== t) : [...cur[list], t] };
    if (other && !on) patch[other] = cur[other].filter(x => x !== t); // can't love and dislike the same thing
    buzz(8);
    save(patch);
  };
  const chipRow = (list, items, other, cls) => h('div', { class: 'chips' },
    items.map(([t, e, l]) => h('button', {
      class: 'chip ' + cls + (mine[list].includes(t) ? ' on' : ''),
      'aria-pressed': mine[list].includes(t) ? 'true' : 'false',
      onclick: () => toggle(list, t, other),
    }, e + ' ' + l)),
  );

  const note = h('textarea', {
    maxlength: 140, rows: 2, placeholder: 'למשל: אלרגי לבוטנים, לא רואה טוב בחושך, צריך הפסקות...',
    value: noteDraft ?? mine.note, oninput: () => { noteDraft = note.value; },
  });
  const saveNote = async () => {
    const v = note.value.replace(/\s+/g, ' ').trim().slice(0, 140);
    noteDraft = null;
    await save({ note: v });
    toast('נשמר');
  };

  const g = state.group;
  const others = g.members.filter(m => m !== me);
  const amAdmin = g.owner === user.uid;
  const admin = g.people[g.owner];
  const uidOf = n => Object.keys(g.people).find(u => g.people[u] === n);
  const kick = async m => {
    if (!confirm(`להוציא את ${m} מהקבוצה?
אי אפשר יהיה לחזור עם הקוד, עד שתחזיר מהרשימה של מי שהוצא`)) return;
    try { await store.kick(gid, uidOf(m), m); buzz(30); toast(`הוצאת את ${m}`); }
    catch { toast('משהו נתקע, תנסה שוב'); }
  };
  const unban = async (u, n) => {
    try { await store.unban(gid, u); toast(`${n} יכול לחזור עם הקוד`); }
    catch { toast('משהו נתקע, תנסה שוב'); }
  };
  const banned = Object.entries(g.banned || {});

  return h('div', null,
    h('div', { class: 'panel' },
      h('div', { class: 'prof-head' },
        h('span', { class: 'av big', style: `--h:${hue(me)}` }, [...me][0]),
        h('div', null, h('h3', { style: 'margin:0' }, 'הפרופיל שלי'), h('p', { class: 'muted', style: 'margin:2px 0 0' }, 'אותו פרופיל בכל הקבוצות שלך')),
      ),
      h('label', null, '💚 מה בא לי'),
      chipRow('likes', TASTES, 'dislikes', 'like'),
      h('label', null, '👎 מה פחות בא לי'),
      chipRow('dislikes', TASTES, 'likes', 'dislike'),
      h('label', null, '⚠️ מה לא מתאים לי'),
      chipRow('limits', LIMITS, null, 'limit'),
      h('label', null, `🎂 תאריך לידה${ageOf(mine.born) ? ` · בן ${ageOf(mine.born)}` : ''}`),
      h('input', {
        type: 'date', class: 'agein', value: mine.born || '', max: isoDay(new Date()),
        onchange: e => { if (validBorn(e.target.value)) save({ born: e.target.value }); else toast('תאריך לא הגיוני'); },
      }),
      h('label', null, '💸 כמה אני יכול להוציא על יציאה?'),
      h('div', { class: 'seg budgets' }, BUDGETS.map(([v, l]) => h('button', {
        class: (mine.budget ?? ANY_BUDGET) === v ? 'on' : '', onclick: () => { buzz(8); save({ budget: v }); },
      }, l))),
      h('label', null, 'עוד משהו שכדאי לדעת?'),
      note,
      h('button', { class: 'glassbtn wide', onclick: saveNote }, 'שמור'),
      h('label', null, '🔒 מי רואה את המגבלות וההערה שלי?'),
      h('div', { class: 'seg' },
        h('button', { class: mine.share === 'group' ? 'on' : '', onclick: () => save({ share: 'group' }) }, '👀 החבר\'ה שלי'),
        h('button', { class: mine.share === 'hidden' ? 'on' : '', onclick: () => save({ share: 'hidden' }) }, '🙈 רק אני'),
      ),
      h('p', { class: 'muted small' }, mine.share === 'hidden'
        ? 'אף אחד לא רואה מה סימנת. קלפים שלא מתאימים לך יסומנו רק "לא מתאים למישהו בקבוצה"'
        : 'החבר\'ה בקבוצות שלך רואים את זה ליד השם שלך, ככה הם יודעים לבחור משהו שמתאים גם לך'),
    ),
    others.length > 0 && h('div', { class: 'panel' },
      h('h3', null, '🙋 החבר\'ה'),
      h('p', { class: 'muted small' }, amAdmin ? '👑 אתה המנהל: רק אתה יכול להוציא אנשים ולמחוק את הקבוצה' : `👑 מנהל הקבוצה: ${admin}`),
      amAdmin && h('button', { class: 'linkbtn', style: 'margin:0 0 10px', onclick: () => pickAdmin(g) }, '👑 להעביר את הניהול למישהו אחר'),
      h('div', { class: 'people' }, others.map(m => personCard(m, { admin: m === admin, onKick: amAdmin ? () => kick(m) : null }))),
    ),
    amAdmin && banned.length > 0 && h('div', { class: 'panel' },
      h('h3', null, '🚫 מי שהוצאת'),
      h('p', { class: 'muted small' }, 'הם לא יכולים לחזור עם הקוד. להחזיר = שוב יוכלו להצטרף עם הקוד'),
      h('div', { class: 'kicked' }, banned.map(([u, n]) => h('div', { class: 'kick-row' },
        h('span', { class: 'av', style: `--h:${hue(n)}` }, [...n][0]),
        h('b', null, n),
        h('button', { class: 'chip', onclick: () => unban(u, n) }, '↩️ להחזיר'),
      ))),
    ),
  );
}

function personCard(m, { admin = false, onKick = null } = {}) {
  const p = profileOf(m);
  const shared = p.share === 'group';
  const empty = !p.likes.length && !p.dislikes.length && (!shared || (!p.limits.length && !p.note && (p.budget ?? ANY_BUDGET) === ANY_BUDGET));
  return h('div', { class: 'person' },
    h('div', { class: 'person-top' },
      h('span', { class: 'av', style: `--h:${hue(m)}` }, [...m][0]),
      h('b', null, m),
      admin && h('span', { class: 'crown', title: 'מנהל הקבוצה' }, '👑'),
      onKick && h('button', { class: 'kickbtn', 'aria-label': 'להוציא את ' + m, title: 'להוציא מהקבוצה', onclick: onKick }, '🚫'),
    ),
    empty
      ? h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'עוד לא מילא')
      : h('div', { class: 'chips small' },
          p.likes.map(t => h('span', { class: 'chip like on' }, tasteLabel[t])),
          p.dislikes.map(t => h('span', { class: 'chip dislike on' }, '👎 ' + tasteLabel[t])),
          shared && p.limits.map(t => h('span', { class: 'chip limit on' }, limitLabel[t])),
          shared && (p.budget ?? ANY_BUDGET) < ANY_BUDGET && h('span', { class: 'chip limit on' }, BUDGETS[p.budget][1]),
          shared && ageOf(p.born) > 0 && h('span', { class: 'chip' }, '🎂 ' + ageOf(p.born)),
        ),
    shared && p.note && h('p', { class: 'person-note' }, '📝 ' + p.note),
  );
}

/* ---------- chat ---------- */
// Built once per group and updated in place, so a new message never steals the keyboard.

let chatView = null;
const CHAT_LEN = 500;
const readKey = () => 'hevre:read:' + user.uid + ':' + gid;
function chatUnread() {
  const seen = ls.get(readKey(), 0);
  return (state.chat || []).filter(m => m.ts > seen && m.uid !== user.uid).length;
}
const hhmm = ts => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const dayLabel = ts => {
  const d = new Date(ts), t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'היום';
  if (d.toDateString() === y.toDateString()) return 'אתמול';
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
};

function chatTab(me) {
  if (!chatView || chatView.gid !== gid) {
    const list = h('div', { class: 'chatlist', role: 'log', 'aria-live': 'polite' });
    const input = h('textarea', { class: 'chatin', rows: 1, maxlength: CHAT_LEN, placeholder: 'תכתוב משהו...' });
    const send = h('button', { class: 'chatsend', 'aria-label': 'שלח' }, '➤');
    const pollBtn = h('button', { class: 'pollbtn', 'aria-label': 'סקר', title: 'סקר מהיר' }, '📊');
    const composer = pollComposer(() => composer.classList.remove('on'));
    pollBtn.onclick = () => { composer.classList.toggle('on'); composer.querySelector('input')?.focus(); };
    const go = async () => {
      const text = input.value.trim().slice(0, CHAT_LEN);
      if (!text) return;
      input.value = ''; input.style.height = '';
      buzz(8);
      const id = newId(12);
      await store.sendChat(gid, { id, uid: user.uid, from: state.group.people[user.uid], text, ts: Date.now() });
      callApi('/notify', { gid, type: 'chat', id });
    };
    send.onclick = go;
    input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
    input.oninput = () => { input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; };
    chatView = { gid, wrap: h('div', { class: 'chat' }, list, composer, h('div', { class: 'chatbar' }, pollBtn, input, send)), list, input, count: -1 };
  }
  const { list } = chatView;
  const msgs = state.chat || [];
  // redraw on a new message or a new poll vote
  const sig = msgs.length + '|' + Object.entries(state.pollvotes || {}).map(([k, v]) => k + v.opt).sort().join()
    + '|' + Object.entries(state.reacts || {}).map(([k, v]) => k + v.e).sort().join();
  if (sig !== chatView.count) {
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80 || chatView.count === -1;
    chatView.count = sig;
    const items = [];
    let lastDay = '', lastFrom = '';
    for (const m of msgs) {
      const day = dayLabel(m.ts);
      if (day !== lastDay) { items.push(h('div', { class: 'chatday' }, day)); lastDay = day; lastFrom = ''; }
      const mine = m.uid === user.uid;
      const bubble = h('div', { class: 'msg' + (mine ? ' mine' : '') + (m.from === lastFrom ? ' cont' : '') },
        !mine && m.from !== lastFrom && h('span', { class: 'from', style: `color:hsl(${hue(m.from)} 70% 50%)` }, m.from),
        m.kind === 'poll' ? pollBubble(m, me) : h('span', { class: 'txt' }, m.text),
        h('span', { class: 'time' }, hhmm(m.ts)),
        reactionRow(m, me),
      );
      holdToReact(bubble, m, me);
      items.push(bubble);
      lastFrom = m.from;
    }
    if (!msgs.length) items.push(h('div', { class: 'chatempty' }, h('div', null, '💬'), 'עוד אין הודעות תפתחו את השיחה'));
    list.replaceChildren(...items);
    chatView.stick = nearBottom;
  }
  return chatView.wrap;
}
function chatAfterRender() {
  const { list } = chatView;
  if (chatView.stick) list.scrollTop = list.scrollHeight;
  const last = (state.chat || []).at(-1);
  if (last) ls.set(readKey(), last.ts);
}


/* ---------- notifications ---------- */

const pushKey = () => 'hevre:push:' + user.uid;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

async function turnOnPush() {
  if (isIOS && !standalone) return toast('באייפון: קודם "הוסף למסך הבית" מתפריט השיתוף, ואז מהאייקון');
  if (!('Notification' in window)) return toast('הדפדפן הזה לא תומך בהתראות');
  if (Notification.permission === 'denied') return toast('חסמת התראות לאתר. אפשר להחזיר בהגדרות האתר בדפדפן');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return;
  try {
    if (await store.enablePush(user.uid, VAPID_KEY)) { ls.set(pushKey(), true); toast('🔔 התראות פועלות'); rerender(); }
    else toast('הדפדפן הזה לא תומך בהתראות');
  } catch (e) {
    // the exact code tells us which step failed (service worker, token, or saving it)
    toast('לא הצליח להדליק התראות: ' + String(e?.code || e?.message || e).slice(0, 80));
    console.error('push', e);
  }
}
function pushButton() {
  const on = ls.get(pushKey(), false) && 'Notification' in window && Notification.permission === 'granted';
  return h('button', { class: 'pushbtn' + (on ? ' on' : ''), onclick: on ? pushMenu : turnOnPush, 'aria-label': 'התראות' },
    on ? '🔔' : '🔕');
}
// 🔔 when on: turn off, or test
function pushMenu() {
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  const el = h('div', { class: 'matchscreen', role: 'dialog', 'aria-label': 'התראות' },
    h('div', { class: 'ms-inner sheet' },
      h('div', { style: 'font-size:44px' }, '🔔'),
      h('h3', { style: 'margin:6px 0 4px' }, 'ההתראות דלוקות בטלפון הזה'),
      h('p', { class: 'muted', style: 'margin:0 0 14px' }, "הודעות בצ'אט, סיבוב שהתחיל, ותזכורות של מחר יוצאים"),
      h('button', {
        class: 'btn wide', onclick: async () => {
          close();
          try { await store.disablePush(user.uid, VAPID_KEY); } catch {}
          ls.set(pushKey(), false); toast('🔕 ההתראות כבויות'); rerender();
        },
      }, '🔕 לכבות התראות'),
      h('button', { class: 'glassbtn wide', onclick: () => { close(); pushSelfTest(); } }, '🧪 בדיקה'),
      h('button', { class: 'linkbtn', onclick: close }, 'סגור'),
    ));
  el.onclick = e => { if (e.target === el) close(); };
  document.body.append(el);
}

// Tapping 🔔 when it's on: show a notification from the phone itself (no server) and say what we see.
// Splits "the phone won't show notifications" from "pushes don't reach the phone".
async function pushSelfTest() {
  const info = [];
  try {
    info.push('הרשאה: ' + Notification.permission);
    const reg = await navigator.serviceWorker.getRegistration();
    info.push('sw: ' + (reg ? (reg.active ? 'פעיל' : 'לא פעיל') : 'אין'));
    const sub = reg && await reg.pushManager.getSubscription();
    info.push('מנוי: ' + (sub ? 'יש' : 'אין'));
    if (reg) await reg.showNotification("חבר'ה", { body: 'בדיקה מקומית 🔔 אם אתה רואה את זה, הטלפון מציג התראות', icon: 'icon-192.png', tag: 'selftest' });
    if (!sub) { await store.enablePush(user.uid, VAPID_KEY); info.push('נרשם מחדש'); }
    const tok = await store.currentToken(VAPID_KEY).catch(() => null);
    info.push('טביעה: ' + (tok ? tok.slice(0, 10) : 'אין'));
  } catch (e) { info.push('שגיאה: ' + String(e?.message || e).slice(0, 60)); }
  toast(info.join(' · '));
}
// keep this phone's token fresh, and show a small toast for other groups while the site is open
let pushBooted = false;
function bootPush() {
  if (pushBooted || !isLive || !user) return;
  pushBooted = true;
  if (ls.get(pushKey(), false) && 'Notification' in window && Notification.permission === 'granted') store.enablePush(user.uid, VAPID_KEY).catch(() => {});
  store.onForegroundPush(d => { if (!(gid && d.link?.endsWith('#g=' + gid))) toast(d.body || 'הודעה חדשה'); });
}

/* ---------- the chat tab: our chat, or the AI everyone can see ---------- */

let chatMode = 'people';
const chatSince = {}; // per group: what was already read when you opened the chat, so "what did I miss" knows
function chatArea(me) {
  bootPush();
  if (!(gid in chatSince)) chatSince[gid] = ls.get(readKey(), 0);
  const missed = (state.chat || []).filter(m => m.ts > chatSince[gid] && m.uid !== user.uid).length;
  const on = ls.get(pushKey(), false);
  return h('div', null,
    h('div', { class: 'seg chatseg' },
      h('button', { class: chatMode === 'people' ? 'on' : '', onclick: () => { chatMode = 'people'; render(); } }, '💬 החבר\'ה'),
      h('button', { class: chatMode === 'ai' ? 'on' : '', onclick: () => { chatMode = 'ai'; render(); } }, '🤖 שאל את ה-AI'),
    ),
    isLive && !on && h('button', { class: 'pushnudge', onclick: turnOnPush }, '🔔 תדליק התראות כדי לדעת כשכותבים בקבוצה'),
    chatMode === 'people' && API && isLive && (state.chat || []).length >= 5 && h('button', { class: 'missbtn', onclick: () => aiSummary(chatSince[gid]) },
      missed >= 5 ? `🤖 מה פספסתי? (${missed} הודעות חדשות)` : "🤖 תסכם לי את הצ'אט"),
    chatMode === 'ai' ? aiTab(me) : chatTab(me),
  );
}

async function aiSummary(since) {
  buzz(10);
  const body = h('p', { class: 'summary' }, "🤖 קורא את הצ'אט...");
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  const el = h('div', { class: 'matchscreen', role: 'dialog', 'aria-label': "סיכום הצ'אט" },
    h('div', { class: 'ms-inner sheet' },
      h('h3', { style: 'margin:0 0 10px' }, '🤖 מה פספסת'),
      body,
      h('button', { class: 'btn wide', onclick: close }, 'סבבה'),
    ));
  el.onclick = e => { if (e.target === el) close(); };
  document.body.append(el);
  const r = await callApi('/summary', { gid, since });
  body.textContent = r?.text || 'לא הצלחתי לסכם, תנסו שוב עוד רגע';
}

let aiView = null, aiReply = null; // aiReply: {id, from} when answering someone's question yourself
function aiTab(me) {
  if (!aiView || aiView.gid !== gid) {
    const list = h('div', { class: 'chatlist', role: 'log', 'aria-live': 'polite' });
    const replyBar = h('div', { class: 'replybar' });
    const input = h('textarea', { class: 'chatin', rows: 1, maxlength: CHAT_LEN, placeholder: 'תשאל משהו, כולם רואים...' });
    const send = h('button', { class: 'chatsend', 'aria-label': 'שלח' }, '➤');
    const go = async () => {
      const text = input.value.trim().slice(0, CHAT_LEN);
      if (!text) return;
      input.value = ''; input.style.height = '';
      buzz(8);
      const id = newId(12), from = state.group.people[user.uid];
      if (aiReply) {
        await store.sendAI(gid, { id, uid: user.uid, from, kind: 'a', replyTo: aiReply.id, text, ts: Date.now() });
        aiReply = null; drawReply();
        callApi('/notify', { gid, type: 'aiq', id });
      } else {
        await store.sendAI(gid, { id, uid: user.uid, from, kind: 'q', text, ts: Date.now() });
        callApi('/ai', { gid, id });
        callApi('/notify', { gid, type: 'aiq', id });
      }
    };
    const drawReply = () => replyBar.replaceChildren(...(aiReply ? [
      h('span', null, `↩️ עונה ל${aiReply.from}`),
      h('button', { class: 'x', onclick: () => { aiReply = null; drawReply(); input.placeholder = 'תשאל משהו, כולם רואים...'; } }, '×'),
    ] : []));
    send.onclick = go;
    input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
    input.oninput = () => { input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; };
    aiView = { gid, list, input, drawReply, count: -1,
      wrap: h('div', { class: 'chat ai' }, list, replyBar, h('div', { class: 'chatbar' }, input, send)) };
  }
  const { list } = aiView;
  const msgs = state.aichat || [];
  const answered = new Set(msgs.filter(m => m.kind === 'ai').map(m => m.replyTo));
  const lastQ = [...msgs].reverse().find(m => m.kind === 'q');
  const thinking = lastQ && !answered.has(lastQ.id) && Date.now() - lastQ.ts < 60000 && !!API && isLive;
  const sig = msgs.length + '|' + thinking;
  if (sig !== aiView.count) {
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80 || aiView.count === -1;
    aiView.count = sig;
    const byId = Object.fromEntries(msgs.map(m => [m.id, m]));
    const items = [h('div', { class: 'aihello' },
      h('b', null, '🤖 ה-AI של הקבוצה'),
      h('span', null, 'אפשר לשאול אותו על יציאות, מחירים בערך, מה להביא, חוקים של משחקים... כל החבר\'ה רואים את השאלות והתשובות ויכולים לענות גם'),
      (!API || !isLive) && h('small', null, 'ה-AI יופעל אחרי שנחבר את השרת'),
    )];
    for (const m of msgs) {
      const mine = m.uid === user.uid;
      const ai = m.kind === 'ai';
      const to = m.replyTo && byId[m.replyTo];
      items.push(h('div', { class: 'msg' + (mine ? ' mine' : '') + (ai ? ' aimsg' : '') },
        h('span', { class: 'from', style: ai || mine ? '' : `color:hsl(${hue(m.from)} 70% 50%)` }, ai ? '🤖 AI' : mine ? 'אני' : m.from,
          to && !ai ? ` ↩️ ל${to.uid === user.uid ? 'שאלה שלי' : to.from}` : ''),
        h('span', { class: 'txt' }, m.text),
        h('span', { class: 'time' }, hhmm(m.ts)),
        m.kind === 'q' && !mine && h('button', {
          class: 'answerbtn', onclick: () => { aiReply = { id: m.id, from: m.from }; aiView.drawReply(); aiView.input.placeholder = 'התשובה שלך...'; aiView.input.focus(); },
        }, '↩️ לענות'),
      ));
    }
    if (thinking) items.push(h('div', { class: 'msg aimsg typing' }, h('span', { class: 'from' }, '🤖 AI'), h('span', { class: 'dots' }, h('i'), h('i'), h('i'))));
    list.replaceChildren(...items);
    aiView.stick = nearBottom;
    // the "thinking" bubble gives up after a minute even if no update arrives
    if (thinking) setTimeout(() => { if (tab === 'chat' && chatMode === 'ai') render(); }, 60500 - (Date.now() - lastQ.ts));
  }
  return aiView.wrap;
}
function aiAfterRender() { if (aiView?.stick) aiView.list.scrollTop = aiView.list.scrollHeight; }

/* ---------- when? ---------- */
// After the group picked what to do: everyone taps the days they can, the best day lights up.

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function whenPanel(me, what) {
  const when = state.when || {};
  const mineDays = when[me]?.days || [];
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); return d; });
  const can = iso => state.group.members.filter(m => when[m]?.days?.includes(iso));
  const best = Math.max(0, ...days.map(d => can(isoDay(d)).length));
  const answered = state.group.members.filter(m => when[m]);
  const toggle = iso => {
    buzz(8);
    const cur = state.when?.[me]?.days || []; // fresh, not this render's copy: fast double taps both count
    store.setWhen(gid, me, cur.includes(iso) ? cur.filter(x => x !== iso) : [...cur, iso].sort());
  };
  const bestDays = best > 0 ? days.filter(d => can(isoDay(d)).length === best) : [];

  return h('div', { class: 'panel when', id: 'when' },
    h('h3', null, '📅 מתי?'),
    h('p', { class: 'muted' }, what ? `מתי עושים ${what}? תסמן את הימים שאתה יכול` : 'תסמן את הימים שאתה יכול'),
    h('div', { class: 'cal' },
      DAYS.map(d => h('span', { class: 'cal-h' }, d)),
      // pad so the first day sits under its weekday
      Array.from({ length: days[0].getDay() }, () => h('span')),
      days.map(d => {
        const iso = isoDay(d);
        const n = can(iso).length;
        return h('button', {
          class: 'cal-d' + (mineDays.includes(iso) ? ' on' : '') + (n && n === best ? ' best' : ''),
          'aria-pressed': mineDays.includes(iso) ? 'true' : 'false',
          'aria-label': `${d.getDate()}.${d.getMonth() + 1} ${n} יכולים`,
          title: can(iso).join(', '),
          onclick: () => toggle(iso),
        }, h('b', null, d.getDate()), n ? h('small', null, n) : null);
      }),
    ),
    bestDays.length > 0
      ? h('div', { class: 'whenbest' }, '👑 ',
          bestDays.slice(0, 3).map(d => `יום ${DAYS[d.getDay()].replace('׳', '')}׳ ${d.getDate()}.${d.getMonth() + 1}`).join(' / '),
          ` · ${best} מתוך ${state.group.members.length} יכולים`,
          best < state.group.members.length && h('small', null, 'חסרים: ' + state.group.members.filter(m => !can(isoDay(bestDays[0])).includes(m)).join(', ')))
      : h('div', { class: 'whenbest muted' }, 'עוד אף אחד לא סימן'),
    h('div', { class: 'muted small', style: 'margin-top:8px' }, `ענו ${answered.length} מתוך ${state.group.members.length}`),
  );
}

/* ---------- outing plan ---------- */
// After the group picked something: where you meet, when you leave, when you're back, what to bring.
// Real bus times and drive times come from Google Maps / Waze, opened with the route filled in.

let meetDraft = null, meetTimer = null;
const mapsSearch = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const mapsDir = (origin, dest, mode) => 'https://www.google.com/maps/dir/?api=1'
  + (origin ? '&origin=' + encodeURIComponent(origin) : '')
  + '&destination=' + encodeURIComponent(dest) + '&travelmode=' + mode;
const wazeTo = q => 'https://waze.com/ul?q=' + encodeURIComponent(q) + '&navigate=yes';
const openLink = url => open(url, '_blank', 'noopener');

function bestDay() {
  const when = state.when || {};
  const counts = {};
  for (const m of state.group.members) for (const d of when[m]?.days || []) counts[d] = (counts[d] || 0) + 1;
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (!best) return null;
  const d = new Date(best[0] + 'T12:00');
  return `יום ${DAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`;
}

function planPanel(me, what) {
  const info = state.info || {};
  const base = planFor(what.text);
  const saved = state.plan?.optId === what.id ? state.plan : {};
  const mode = saved.mode || 'bus';
  const travel = saved.travel ?? (mode === 'car' ? 30 : 45);
  const start = saved.start || base.start;
  const set = patch => { buzz(8); store.setPlan(gid, { optId: what.id, mode, travel, start, ...patch, ts: Date.now() }); };

  const region = h('select', { onchange: () => store.setInfo(gid, { region: region.value, ts: Date.now() }) },
    h('option', { value: '' }, 'איזה אזור?'),
    REGIONS.map(([v, l]) => h('option', { value: v, selected: info.region === v }, l)));
  // Saves a moment after you stop typing: blur alone is lost when a live update redraws the field.
  const saveMeet = () => {
    clearTimeout(meetTimer);
    if (meetDraft == null) return;
    const v = meetDraft.replace(/\s+/g, ' ').trim().slice(0, 40);
    meetDraft = null;
    if (v !== ((state.info || {}).meet || '')) store.setInfo(gid, { meet: v, ts: Date.now() }).then(() => toast('נשמר'));
  };
  const meet = h('input', {
    maxlength: 40, placeholder: 'נקודת מפגש, למשל: תחנת רכבת מודיעין',
    value: meetDraft ?? info.meet ?? '',
    oninput: () => { meetDraft = meet.value; clearTimeout(meetTimer); meetTimer = setTimeout(saveMeet, 900); },
  });
  meet.onblur = saveMeet;
  meet.onkeydown = e => { if (e.key === 'Enter') saveMeet(); };

  const area = info.meet || regionName[info.region] || '';
  const dest = (base.search || what.text) + (area ? ` ליד ${area}` : ''); // "near the meeting point" lands on the closest one
  const day = bestDay();

  // the timeline, counted back from when you want to be there
  const steps = base.trip
    ? [
        ['🤝', 'נפגשים' + (info.meet ? ` ב${info.meet}` : ''), addMin(start, -travel - 15)],
        [mode === 'car' ? '🚗' : '🚌', 'יוצאים', addMin(start, -travel)],
        ['📍', 'מגיעים', start],
        ['🏁', 'נגמר', addMin(start, base.hours * 60)],
        ['🏠', 'בבית בערך', addMin(start, base.hours * 60 + travel)],
      ]
    : [
        ['🏠', 'נפגשים אצל מישהו', start],
        ['🏁', 'נגמר', addMin(start, base.hours * 60)],
      ];
  const endTime = steps.at(-1)[2];
  const late = endTime >= '22:30' || endTime < '05:00';
  const earlyBirds = late ? state.group.members.filter(m => {
    const p = profileOf(m);
    return p.limits.includes('late') && (p.share === 'group' || m === me);
  }) : [];

  const planText = () => [
    `🗺️ תוכנית: ${what.emoji || ''} ${what.text}`,
    day && `📅 ${day}`,
    ...steps.map(([e, l, t]) => `${t} ${e} ${l}`),
    `🎒 להביא: ${base.bring.join(', ')}`,
  ].filter(Boolean).join('\n');

  return h('div', { class: 'panel plan', id: 'plan' },
    h('h3', null, '🗺️ תוכנית ליציאה'),
    h('div', { class: 'plan-what' }, h('span', null, what.emoji || '✨'), h('b', null, what.text), day && h('small', null, '📅 ' + day)),

    h('label', null, '📍 מאיפה יוצאים?'),
    h('div', { class: 'plan-where' }, region, meet),
    h('p', { class: 'muted small', style: 'margin:6px 0 0' }, 'עדיף מקום ציבורי כמו תחנה או קניון, לא כתובת של בית'),

    base.trip && [
      h('label', null, 'איך מגיעים?'),
      h('div', { class: 'seg' },
        h('button', { class: mode === 'bus' ? 'on' : '', onclick: () => set({ mode: 'bus', travel: saved.mode === 'bus' ? travel : 45 }) }, '🚌 תחבורה ציבורית'),
        h('button', { class: mode === 'car' ? 'on' : '', onclick: () => set({ mode: 'car', travel: saved.mode === 'car' ? travel : 30 }) }, '🚗 אוטו'),
      ),
      h('label', null, 'כמה זמן הנסיעה בערך?'),
      h('div', { class: 'chips' }, [15, 30, 45, 60, 90, 120].map(n => h('button', {
        class: 'chip' + (travel === n ? ' on' : ''), onclick: () => set({ travel: n }),
      }, n < 60 ? `${n} דק׳` : n === 60 ? 'שעה' : n === 90 ? 'שעה וחצי' : 'שעתיים'))),
    ],
    h('label', null, base.trip ? 'מתי רוצים להיות שם?' : 'מתי מתחילים?'),
    h('input', { type: 'time', value: start, class: 'timein', onchange: e => set({ start: e.target.value || base.start }) }),

    h('div', { class: 'timeline' }, steps.map(([e, l, t]) => h('div', { class: 'step' },
      h('b', { class: 'tm' }, t), h('span', { class: 'dot' }, e), h('span', null, l),
    ))),
    earlyBirds.length > 0 && h('div', { class: 'fit warn', style: 'display:block;margin-top:10px;font-size:13px' },
      `⚠️ ${earlyBirds.map(m => m === me ? 'אני' : m).join(', ')} צריך לחזור מוקדם`),
    base.trip && h('p', { class: 'muted small', style: 'margin:8px 0 0' }, 'הזמנים בערך. השעה המדויקת של האוטובוס או משך הנסיעה בכפתורים למטה'),

    bringPanel(me, base),
    base.trip && mode === 'car' && ridesPanel(me),

    h('div', { class: 'plan-btns' },
      base.search && h('button', { class: 'glassbtn wide', onclick: () => openLink(mapsSearch(dest)) },
        `🔎 ${base.search} באזור`),
      base.trip && (mode === 'bus'
        ? h('button', { class: 'btn wide', onclick: () => openLink(mapsDir(info.meet, dest, 'transit')) }, '🚌 מסלול בתחבורה ציבורית')
        : [
            h('button', { class: 'btn wide', onclick: () => openLink(mapsDir(info.meet, dest, 'driving')) }, '🚗 מסלול בגוגל מפות'),
            h('button', { class: 'glassbtn wide', onclick: () => openLink(wazeTo(dest)) }, '🧭 לפתוח בוויז'),
          ]),
      h('button', {
        class: 'glassbtn wide',
        onclick: async () => {
          const id = newId(12);
          await store.sendChat(gid, { id, uid: user.uid, from: me, text: planText().slice(0, 500), ts: Date.now() });
          callApi('/notify', { gid, type: 'chat', id });
          toast('נשלח לצ\'אט 💬');
        },
      }, '💬 שלח את התוכנית לצ\'אט'),
    ),
  );
}


/* ---------- first time: three quick slides ---------- */

const SLIDES = [
  ['👉', 'סוויפ', 'ימינה כן, שמאלה לא, למעלה ⭐ סופר לייק ולמטה 🚫 וטו. לוחצים על קלף כדי לראות מה זה'],
  ['🙋', 'מה מתאים לך', 'בלשונית "החבר\'ה" מסמנים מה בא לך, מה לא מתאים, גיל ותקציב. קלפים שלא מתאימים למישהו מקבלים ⚠️'],
  ['🎉', 'ואז יוצאים', 'כשיש התאמה בוחרים מתי, מקבלים תוכנית עם לוח זמנים ומסלול, ובמי חייב מסדרים את הכסף'],
];
function showOnboarding() {
  let i = 0;
  const art = h('div', { class: 'ob-art' });
  const title = h('h2');
  const text = h('p');
  const dots = h('div', { class: 'ob-dots' }, SLIDES.map(() => h('i')));
  const next = h('button', { class: 'btn wide' });
  const done = () => { ls.set('hevre:onboarded:' + user.uid, true); el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  const draw = () => {
    const [e, t, x] = SLIDES[i];
    art.textContent = e; title.textContent = t; text.textContent = x;
    art.style.animation = 'none'; void art.offsetWidth; art.style.animation = '';
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
    next.textContent = i < SLIDES.length - 1 ? 'הבא' : 'יאללה מתחילים 🤙';
  };
  next.onclick = () => { buzz(8); if (i < SLIDES.length - 1) { i++; draw(); } else done(); };
  const el = h('div', { class: 'matchscreen onboard', role: 'dialog', 'aria-label': 'איך זה עובד' },
    h('div', { class: 'ms-inner' }, art, title, text, dots, next, h('button', { class: 'linkbtn', onclick: done }, 'דלג')));
  document.body.append(el);
  draw();
}

/* ---------- 4. who brings what ---------- */

let extraDraft = '';
function bringPanel(me, base) {
  const bring = state.bring || {};
  const mine = bring[me]?.items || [];
  const takenBy = {};
  for (const [m, b] of Object.entries(bring)) for (const it of b.items || []) takenBy[it] = m;
  const all = [...base.bring, ...Object.keys(takenBy).filter(it => !base.bring.includes(it))];
  const toggle = it => {
    const cur = state.bring?.[me]?.items || [];
    if (takenBy[it] && takenBy[it] !== me) return toast(`${takenBy[it]} כבר מביא את זה`);
    buzz(8);
    store.setBring(gid, me, cur.includes(it) ? cur.filter(x => x !== it) : [...cur, it]);
  };
  const extra = h('input', { maxlength: 30, placeholder: 'עוד משהו? למשל רמקול', value: extraDraft, oninput: () => { extraDraft = extra.value; } });
  const addExtra = () => {
    const v = extra.value.replace(/\s+/g, ' ').trim().slice(0, 30);
    if (!v) return;
    extraDraft = '';
    if (takenBy[v]) return toast('זה כבר ברשימה');
    store.setBring(gid, me, [...(state.bring?.[me]?.items || []), v]);
  };
  extra.onkeydown = e => { if (e.key === 'Enter') addExtra(); };
  const missing = all.filter(it => !takenBy[it]).length;

  return h('div', { class: 'bring' },
    h('label', null, '🎒 מי מביא מה', h('span', { class: 'muted small' }, missing ? ` · עוד חסר ${missing}` : ' · הכל מכוסה ✓')),
    h('div', { class: 'bringlist' }, all.map(it => {
      const who = takenBy[it];
      return h('button', { class: 'bitem' + (who ? ' taken' : '') + (who === me ? ' mine' : ''), onclick: () => toggle(it) },
        h('span', null, it), h('small', null, who ? (who === me ? 'אני ✓' : who) : 'מי מביא?'));
    })),
    h('div', { class: 'row', style: 'margin-top:8px' }, extra, h('button', { class: 'btn small', onclick: addExtra }, 'הוסף')),
  );
}

/* ---------- 5. who rides with whom ---------- */

function ridesPanel(me) {
  const rides = state.rides || {};
  const drivers = Object.entries(rides).filter(([, r]) => r.seats > 0).map(([m, r]) => ({ m, seats: r.seats, riders: Object.entries(rides).filter(([, x]) => x.with === m).map(([n]) => n) }));
  const myRide = rides[me];
  const sorted = new Set([...drivers.map(d => d.m), ...drivers.flatMap(d => d.riders)]);
  const noRide = state.group.members.filter(m => !sorted.has(m));

  return h('div', { class: 'rides' },
    h('label', null, '🚗 מי נוסע עם מי'),
    drivers.length === 0 && h('p', { class: 'muted small', style: 'margin:0 0 8px' }, 'עוד אף אחד לא אמר שהוא נוהג'),
    h('div', { class: 'cars' }, drivers.map(d => {
      const full = d.riders.length >= d.seats;
      const imIn = d.riders.includes(me);
      return h('div', { class: 'car' },
        h('div', { class: 'car-top' }, h('b', null, '🚗 ' + (d.m === me ? 'אני נוהג' : d.m)), h('small', null, `${d.riders.length}/${d.seats} מקומות`)),
        h('div', { class: 'seatsrow' },
          Array.from({ length: d.seats }, (_, i) => h('span', { class: 'seatdot' + (d.riders[i] ? ' on' : '') }, d.riders[i] ? [...d.riders[i]][0] : '')),
        ),
        d.riders.length > 0 && h('small', { class: 'muted' }, d.riders.join(', ')),
        d.m !== me && !imIn && !full && !(myRide?.seats > 0) && h('button', { class: 'btn small', onclick: () => { buzz(10); store.setRide(gid, me, { with: d.m }); } }, 'אני איתך'),
        imIn && h('button', { class: 'linkbtn', style: 'margin:6px 0 0', onclick: () => store.setRide(gid, me, null) }, 'לצאת מהאוטו'),
      );
    })),
    myRide?.seats > 0
      ? h('button', { class: 'linkbtn', onclick: () => store.setRide(gid, me, null) }, 'אני כבר לא נוהג')
      : !myRide?.with && h('div', { class: 'drive' },
          h('span', null, 'אני נוהג ויש לי'),
          [1, 2, 3, 4, 5, 6].map(n => h('button', { class: 'chip', onclick: () => { buzz(10); store.setRide(gid, me, { seats: n }); } }, n)),
          h('span', null, 'מקומות'),
        ),
    noRide.length > 0 && h('p', { class: 'muted small', style: 'margin:8px 0 0' }, '🙋 עוד בלי הסעה: ' + noRide.join(', ')),
  );
}

/* ---------- chat reactions: hold a message (or right-click) to react ---------- */

const REACTS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
function reactionRow(m, me) {
  const all = Object.entries(state.reacts || {}).filter(([, r]) => r.msg === m.id).map(([k, r]) => ({ who: k.slice(m.id.length + 2), e: r.e }));
  if (!all.length) return null;
  const counts = {};
  for (const r of all) (counts[r.e] ||= []).push(r.who);
  return h('div', { class: 'reacts' }, Object.entries(counts).map(([e, who]) => h('button', {
    class: 'react' + (who.includes(me) ? ' mine' : ''), title: who.join(', '),
    onclick: ev => { ev.stopPropagation(); store.react(gid, m.id, me, who.includes(me) ? null : e); },
  }, e, who.length > 1 ? h('b', null, who.length) : null)));
}
function holdToReact(el, m, me) {
  let t = null;
  const open = () => {
    document.querySelectorAll('.reactpick').forEach(x => x.remove());
    buzz(10);
    const mineNow = state.reacts?.[m.id + '__' + me]?.e;
    const pick = h('div', { class: 'reactpick' }, REACTS.map(e => h('button', {
      class: mineNow === e ? 'on' : '',
      onclick: ev => { ev.stopPropagation(); pick.remove(); store.react(gid, m.id, me, mineNow === e ? null : e); },
    }, e)));
    el.append(pick);
    setTimeout(() => addEventListener('pointerdown', function off(ev) {
      if (!pick.contains(ev.target)) { pick.remove(); removeEventListener('pointerdown', off); }
    }), 0);
  };
  el.onpointerdown = () => { t = setTimeout(open, 450); };
  el.onpointerup = el.onpointerleave = el.onpointercancel = () => clearTimeout(t);
  el.oncontextmenu = e => { e.preventDefault(); open(); };
}

/* ---------- 7. quick polls in the chat ---------- */

function pollComposer(close) {
  const q = h('input', { maxlength: 80, placeholder: 'השאלה, למשל: פיצה או סושי?' });
  const opts = [0, 1, 2, 3].map(i => h('input', { maxlength: 30, placeholder: i < 2 ? `תשובה ${i + 1}` : `תשובה ${i + 1} (לא חובה)` }));
  const go = async () => {
    const question = q.value.trim().slice(0, 80);
    const answers = opts.map(o => o.value.trim().slice(0, 30)).filter(Boolean);
    if (!question) return toast('מה השאלה?');
    if (answers.length < 2) return toast('צריך לפחות 2 תשובות');
    const from = state.group.people[user.uid];
    const id = newId(12);
    await store.sendChat(gid, { id, uid: user.uid, from, kind: 'poll', q: question, opts: answers, text: '📊 ' + question, ts: Date.now() });
    callApi('/notify', { gid, type: 'chat', id });
    q.value = ''; opts.forEach(o => { o.value = ''; });
    close();
  };
  return h('div', { class: 'pollcomp' },
    h('b', null, '📊 סקר מהיר'), q, h('div', { class: 'pollopts' }, opts),
    h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: go }, 'שלח סקר'), h('button', { class: 'linkbtn', style: 'margin:0', onclick: close }, 'ביטול')),
  );
}

function pollBubble(m, me) {
  const votes = Object.entries(state.pollvotes || {}).filter(([, v]) => v.poll === m.id).map(([k, v]) => ({ who: k.slice(m.id.length + 2), opt: v.opt }));
  const mineOpt = votes.find(v => v.who === me)?.opt;
  const total = votes.length || 1;
  return h('div', { class: 'poll' },
    h('b', { class: 'pq' }, '📊 ' + m.q),
    (m.opts || []).map((o, i) => {
      const who = votes.filter(v => v.opt === i).map(v => v.who);
      return h('button', { class: 'popt' + (mineOpt === i ? ' on' : ''), onclick: () => { buzz(8); store.votePoll(gid, m.id, me, i); } },
        h('i', { style: `width:${(who.length / total) * 100}%` }),
        h('span', null, o), h('small', null, who.length ? who.join(', ') : ''));
    }),
    h('small', { class: 'pfoot' }, `${votes.length} ענו`),
  );
}

/* ---------- 8. invite: share, code, QR ---------- */

let qrLib = null;
function loadQr() {
  qrLib ||= new Promise((ok, fail) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    sc.onload = () => ok(window.QRCode); sc.onerror = () => { qrLib = null; fail(); };
    document.head.append(sc);
  });
  return qrLib;
}
function inviteSheet(g) {
  const url = groupUrl(gid);
  const box = h('div', { class: 'qrbox' }, h('span', { class: 'muted small' }, 'טוען...'));
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  const el = h('div', { class: 'matchscreen', role: 'dialog', 'aria-label': 'הזמנה' },
    h('div', { class: 'ms-inner' },
      h('h2', { class: 'inv-title' }, 'תזמין חברים'),
      h('p', { class: 'muted' }, 'שיסרקו עם המצלמה'),
      box,
      h('div', { class: 'invcode' }, h('small', null, 'או קוד'), h('b', null, g.code)),
      h('button', { class: 'btn wide', onclick: () => share(`בואו ל"${g.name}" ב"חבר'ה" 🤙 הקוד: ${g.code}`, url) }, '📤 שלח קישור'),
      h('button', { class: 'linkbtn', onclick: close }, 'סגור'),
    ));
  el.onclick = e => { if (e.target === el) close(); };
  document.body.append(el);
  loadQr().then(QR => {
    box.replaceChildren();
    new QR(box, { text: url, width: 220, height: 220, colorDark: '#17112e', colorLight: '#ffffff', correctLevel: QR.CorrectLevel.M });
  }).catch(() => { box.replaceChildren(h('span', { class: 'muted small' }, 'לא הצלחתי לטעון את הקוד, תשלח קישור')); });
}

/* ---------- money tab ---------- */
// Three things live here: who owes whom, the group's budget (how much the trip may cost),
// and the kitty (money everyone put in up front; spending from it creates no debts).

const KITTY = '__kitty';
const CATS = [
  ['food', '🍕', 'אוכל'],
  ['travel', '🚗', 'נסיעות'],
  ['sleep', '🛏️', 'לינה'],
  ['fun', '🎉', 'בילוי'],
  ['other', '📦', 'אחר'],
];
const catLabel = Object.fromEntries(CATS.map(([c, e, l]) => [c, e + ' ' + l]));
const toAgorot = v => Math.round(parseFloat(String(v).replace(',', '.')) * 100);

// Remembered between renders so a friend's live update doesn't wipe what you're typing.
let amongSel = null;
const draft = { payer: null, amount: '', desc: '', cat: 'other' };
let editingBudget = false;

function moneyTab(me) {
  const { group, expenses, settlements } = state;
  const members = group.members;
  const kitty = state.kitty || [];
  const budget = state.budget || {};
  const kittyOn = budget.kittyPer > 0;
  if (!amongSel) amongSel = new Set(members);
  for (const m of [...amongSel]) if (!members.includes(m)) amongSel.delete(m);

  const bal = balances(members, expenses, settlements);
  const tr = transfers(bal);

  // form
  const fromKitty = kittyOn && draft.payer === KITTY;
  const who = fromKitty || members.includes(draft.payer) ? draft.payer : me;
  const payer = h('select', { onchange: () => { draft.payer = payer.value; render(); } },
    members.map(m => h('option', { value: m, selected: m === who }, m)),
    kittyOn && h('option', { value: KITTY, selected: who === KITTY }, '🏦 הקופה'));
  const amount = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.01', placeholder: '0',
    value: draft.amount, oninput: () => { draft.amount = amount.value; } });
  const desc = h('input', { maxlength: 40, placeholder: 'פיצה, מונית, כרטיסים...',
    value: draft.desc, oninput: () => { draft.desc = desc.value; } });
  const err = h('div', { class: 'err' });
  const amongChips = h('div', { class: 'chips' });
  const drawAmong = () => amongChips.replaceChildren(
    ...members.map(m => h('button', {
      class: 'chip' + (amongSel.has(m) ? ' on' : ''),
      onclick: () => { amongSel.has(m) ? amongSel.delete(m) : amongSel.add(m); drawAmong(); },
    }, m)),
  );
  drawAmong();
  const catChips = h('div', { class: 'chips' });
  const drawCats = () => catChips.replaceChildren(
    ...CATS.map(([c, e, l]) => h('button', { class: 'chip' + (draft.cat === c ? ' on' : ''), onclick: () => { draft.cat = c; drawCats(); } }, e + ' ' + l)),
  );
  drawCats();

  const add = async () => {
    const ag = toAgorot(amount.value);
    if (!ag || ag <= 0) return err.textContent = 'כמה זה עלה?';
    if (ag > 10_000_000) return err.textContent = 'זה קצת הרבה לא?';
    if (!fromKitty && !amongSel.size) return err.textContent = 'בין מי מתחלקים?';
    if (fromKitty && ag > kittyLeft) return err.textContent = `בקופה יש רק ${shekels(kittyLeft)}`;
    err.textContent = '';
    const text = desc.value.replace(/\s+/g, ' ').trim().slice(0, 40);
    draft.amount = draft.desc = ''; // clear first: the save re-renders the form
    const base = { id: newId(10), amount: ag, desc: text, cat: draft.cat, by: me, ts: Date.now() };
    if (fromKitty) await store.addKitty(gid, { ...base, type: 'out', who: '' });
    else await store.addExpense(gid, { ...base, payer: payer.value, among: members.filter(m => amongSel.has(m)) });
    toast('נוסף');
  };

  // kitty math
  const putIn = m => kitty.filter(k => k.type === 'in' && k.who === m).reduce((a, k) => a + k.amount, 0);
  const kittyIn = kitty.filter(k => k.type === 'in').reduce((a, k) => a + k.amount, 0);
  const kittyOut = kitty.filter(k => k.type === 'out').reduce((a, k) => a + k.amount, 0);
  const kittyLeft = kittyIn - kittyOut;

  const summary = () => {
    const lines = tr.map(t => `${t.from} מעביר ל${t.to} ${shekels(t.amount)}`);
    let text = `💸 מי חייב למי - ${group.name}\n` + (lines.length ? lines.join('\n') : 'כולם מאוזנים');
    if (kittyOn) {
      const missing = members.filter(m => putIn(m) < budget.kittyPer);
      text += `\n\n🏦 בקופה: ${shekels(kittyLeft)}` + (missing.length ? `\nעוד לא שמו: ${missing.join(', ')}` : '');
    }
    return text + '\n\nפרטים פה:';
  };

  // newest first: expenses, payments and kitty moves mixed
  const hist = [
    ...expenses.map(e => ({ ...e, kind: 'e' })),
    ...settlements.map(s => ({ ...s, kind: 's' })),
    ...kitty.map(k => ({ ...k, kind: 'k' })),
  ].sort((a, b) => (b.ts || 0) - (a.ts || 0));

  return h('div', null,
    budgetPanel(me, budget, [...expenses, ...kitty.filter(k => k.type === 'out')]),
    kittyPanel(me, budget, { putIn, kittyIn, kittyOut, kittyLeft }),
    h('div', { class: 'panel' },
      h('h3', null, '🔁 מי מעביר למי'),
      tr.length
        ? tr.map(t => h('div', { class: 'tr' },
            h('div', { class: 't' }, t.from, ' ← ', h('b', null, shekels(t.amount)), ' ← ', t.to),
            h('button', {
              class: 'btn small',
              onclick: async () => {
                if (!confirm(`${t.from} העביר ל${t.to} ${shekels(t.amount)}?`)) return;
                await store.addSettlement(gid, { id: newId(10), from: t.from, to: t.to, amount: t.amount, by: me, ts: Date.now() });
                toast('סומן ✅');
                buzz(20);
              },
            }, 'שולם'),
          ))
        : h('div', { class: 'empty' }, expenses.length ? 'כולם מאוזנים אף אחד לא חייב כלום 🙌' : 'אין עדיין הוצאות'),
      (expenses.length > 0 || kittyOn) && h('button', { class: 'glassbtn wide', onclick: () => share(summary(), groupUrl(gid)) }, 'שלח סיכום לקבוצה'),
    ),
    h('div', { class: 'panel' },
      h('h3', null, '🧾 הוצאה חדשה'),
      h('label', null, 'מי שילם?'), payer,
      h('label', null, 'כמה ₪?'), amount,
      h('label', null, 'על מה?'), desc,
      h('label', null, 'סוג'), catChips,
      fromKitty
        ? h('p', { class: 'muted small', style: 'margin-top:12px' }, `🏦 יוצא מהקופה, אף אחד לא חייב כלום. בקופה עכשיו ${shekels(kittyLeft)}`)
        : [h('label', null, 'בין מי?'), amongChips],
      err,
      h('button', { class: 'btn wide', onclick: add }, 'תוסיף'),
    ),
    expenses.length > 0 && h('div', { class: 'panel' },
      h('h3', null, '⚖️ כמה כל אחד'),
      h('div', { class: 'bal' }, members.map(m => {
        const v = bal[m];
        return h('div', { class: 'b' },
          h('span', null, m),
          h('span', { class: v > 0 ? 'plus' : v < 0 ? 'minus' : 'zero' },
            v > 0 ? 'מקבל ' + shekels(v) : v < 0 ? 'חייב ' + shekels(-v) : 'מאוזן'),
        );
      })),
    ),
    hist.length > 0 && h('div', { class: 'panel hist' },
      h('h3', null, '🕓 היסטוריה'),
      hist.map(x => h('div', { class: 'h' },
        h('span', null, x.kind === 'e' ? (catLabel[x.cat] || '🧾').split(' ')[0] : x.kind === 's' ? '✅' : '🏦'),
        h('div', { class: 't' },
          x.kind === 'e'
            ? [x.desc || 'הוצאה', h('small', null, `${x.payer} שילם ${shekels(x.amount)} · ${x.among.length === members.length ? 'כולם' : x.among.join(', ')}`)]
            : x.kind === 's'
              ? [`${x.from} העביר ל${x.to}`, h('small', null, shekels(x.amount))]
              : x.type === 'in'
                ? [`${x.who} שם בקופה`, h('small', null, shekels(x.amount))]
                : [x.desc || 'הוצאה מהקופה', h('small', null, `מהקופה ${shekels(x.amount)}`)],
        ),
        h('button', {
          class: 'x', 'aria-label': 'מחק',
          onclick: async () => {
            if (!confirm('למחוק?')) return;
            if (x.kind === 'e') await store.deleteExpense(gid, x.id);
            else if (x.kind === 's') await store.deleteSettlement(gid, x.id);
            else await store.deleteKitty(gid, x.id);
          },
        }, '×'),
      )),
    ),
  );
}

/* ----- group budget: how much the whole thing may cost ----- */

function budgetPanel(me, budget, spends) {
  const total = budget.total || 0;
  const input = h('input', { type: 'number', inputmode: 'decimal', min: '0', placeholder: 'למשל 1500', value: total ? total / 100 : '' });
  const err = h('div', { class: 'err' });
  const saveTotal = async () => {
    const ag = toAgorot(input.value || 0);
    if (ag < 0 || ag > 100_000_000) return err.textContent = 'סכום לא הגיוני';
    editingBudget = false;
    await store.setBudget(gid, { total: ag, ts: Date.now() });
    toast(ag ? 'התקציב נקבע' : 'התקציב בוטל');
  };
  input.onkeydown = e => { if (e.key === 'Enter') saveTotal(); };

  if (!total || editingBudget) {
    return h('div', { class: 'panel' },
      h('h3', null, '🎯 תקציב לקבוצה'),
      h('p', { class: 'muted' }, 'כמה מקסימום כל הטיול או היציאה יעלו? רואים כמה כבר הלך וכמה נשאר'),
      h('div', { class: 'row' }, input, h('button', { class: 'btn', onclick: saveTotal }, total ? 'שמור' : 'קבע')),
      err,
      total > 0 && h('button', { class: 'linkbtn', onclick: () => { input.value = ''; saveTotal(); } }, 'לבטל את התקציב'),
    );
  }

  const spent = spends.reduce((a, x) => a + x.amount, 0);
  const pct = Math.min(100, Math.round((spent / total) * 100));
  const left = total - spent;
  const level = spent > total ? 'over' : spent > total * 0.8 ? 'warn' : 'ok';
  const byCat = CATS.map(([c]) => [c, spends.filter(x => (x.cat || 'other') === c).reduce((a, x) => a + x.amount, 0)]).filter(([, v]) => v > 0);
  const top = Math.max(1, ...byCat.map(([, v]) => v));

  return h('div', { class: 'panel budget ' + level },
    h('div', { class: 'budget-top' },
      h('h3', { style: 'margin:0' }, '🎯 תקציב'),
      h('button', { class: 'linkbtn', style: 'margin:0', onclick: () => { editingBudget = true; render(); } }, 'שנה'),
    ),
    h('div', { class: 'budget-big' },
      h('b', null, shekels(spent)), h('span', null, ' מתוך ', shekels(total)),
    ),
    h('div', { class: 'meter' }, h('i', { style: `width:${pct}%` })),
    h('div', { class: 'budget-row' },
      h('span', null, left >= 0 ? `נשאר ${shekels(left)}` : `חרגתם ב-${shekels(-left)} 😬`),
      h('span', null, `${shekels(Math.round(total / state.group.members.length))} לאחד`),
    ),
    byCat.length > 0 && h('div', { class: 'cats' },
      byCat.map(([c, v]) => h('div', { class: 'cat' },
        h('span', null, catLabel[c]),
        h('div', { class: 'catbar' }, h('i', { style: `width:${(v / top) * 100}%` })),
        h('b', null, shekels(v)),
      )),
    ),
  );
}

/* ----- kitty: everyone puts in up front ----- */

function kittyPanel(me, budget, k) {
  const per = budget.kittyPer || 0;
  const members = state.group.members;

  if (!per) {
    const input = h('input', { type: 'number', inputmode: 'decimal', min: '0', placeholder: 'כמה כל אחד שם? למשל 100' });
    const open = async () => {
      const ag = toAgorot(input.value);
      if (!ag || ag <= 0 || ag > 10_000_000) return toast('כמה כל אחד שם?');
      await store.setBudget(gid, { kittyPer: ag, ts: Date.now() });
      toast('הקופה נפתחה 🏦');
    };
    return h('div', { class: 'panel' },
      h('h3', null, '🏦 קופה משותפת'),
      h('p', { class: 'muted' }, 'כולם שמים סכום מראש, ומשלמים ממנה על דברים של כולם. בלי חובות ובלי חשבונות'),
      h('div', { class: 'row' }, input, h('button', { class: 'btn', onclick: open }, 'פתח קופה')),
    );
  }

  const paid = members.filter(m => k.putIn(m) >= per);
  const rows = members.map(m => {
    const got = k.putIn(m);
    const due = per - got;
    return h('div', { class: 'krow' + (due <= 0 ? ' ok' : '') },
      h('span', { class: 'av', style: `--h:${hue(m)}` }, [...m][0]),
      h('b', null, m),
      due <= 0
        ? h('span', { class: 'kst' }, '✓ שם ' + shekels(got))
        : [
            h('span', { class: 'kst' }, got ? `שם ${shekels(got)} · חסר ${shekels(due)}` : `חסר ${shekels(due)}`),
            h('button', {
              class: 'btn small',
              onclick: async () => {
                if (!confirm(`${m} שם ${shekels(due)} בקופה?`)) return;
                await store.addKitty(gid, { id: newId(10), type: 'in', who: m, amount: due, desc: '', cat: 'other', by: me, ts: Date.now() });
                buzz(20); toast('נכנס לקופה 🏦');
              },
            }, 'שם ✓'),
          ],
    );
  });

  return h('div', { class: 'panel kitty' },
    h('h3', null, '🏦 הקופה'),
    h('div', { class: 'kitty-big' },
      h('div', { class: 'coin' }, '🪙'),
      h('div', null, h('b', null, shekels(k.kittyLeft)), h('small', null, `נכנסו ${shekels(k.kittyIn)} · יצאו ${shekels(k.kittyOut)}`)),
    ),
    h('div', { class: 'muted small', style: 'margin:10px 0 6px' }, `${shekels(per)} מכל אחד · ${paid.length} מתוך ${members.length} שמו`),
    h('div', { class: 'krows' }, rows),
    // what's left goes back by what each one put in, not evenly
    k.kittyLeft > 0 && k.kittyOut > 0 && h('p', { class: 'muted small', style: 'margin:10px 0 0' },
      'אם נגמר עכשיו מקבלים בחזרה: ' + members.filter(m => k.putIn(m) > 0)
        .map(m => `${m} ${shekels(Math.floor(k.kittyLeft * k.putIn(m) / k.kittyIn))}`).join(' · ')),
    h('button', {
      class: 'linkbtn',
      onclick: async () => { if (confirm('לסגור את הקופה? מה שנרשם נשאר בהיסטוריה')) await store.setBudget(gid, { kittyPer: 0, ts: Date.now() }); },
    }, 'לסגור את הקופה'),
  );
}

boot();
