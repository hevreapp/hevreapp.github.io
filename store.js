// One storage API, two backends:
//  - Firebase (Auth + Firestore) when firebase-config.js has a real config: shared between phones in real time.
//  - Local (localStorage) otherwise: only this browser, for testing before Firebase exists.
//    "Sign in" there is just a name, and you can switch users to play every friend yourself.
//
// users/{uid}          {name, likes, dislikes, limits, note, share, hidden: {gid: hid}, ts}
// codes/{CODE}         {gid}                                   join a group by its 6-letter code
// groups/{gid}         {name, code, owner, memberUids, people: {uid: name}, members: [names], createdAt}
//   round/state        {status: 'lobby'|'live', owner, spin, spinTs}
//   here/{name}        {ts}                 who walked into this round's lobby
//   profiles/{name}    {likes, dislikes, limits, note, share}   the part of my profile the group may see
//   hidden/{hid}       {tags, budget, born}       limits someone keeps to themselves, not linked to a name
//   options, votes/{name}, when/{name} {days}, chat/{id}, expenses {.., cat}, settlements
//   budget/state       {total, kittyPer}    trip budget and how much each puts in the kitty
//   kitty/{id}         {type: 'in'|'out', who, amount, desc, by, ts}
//   info/state         {region, meet}       where the group usually goes out from
//   plan/state         {optId, mode, travel, start, date}   this round's outing plan
//   bring/{name}       {items}              what I'm bringing
//   rides/{name}       {seats} if I drive, {with: driver} if I ride
//   mycards/{id}       {emoji, text, by}    the group's own ideas, kept between rounds
//   pollvotes/{poll__name}  {poll, opt}     answers to chat polls
//   reacts/{msg__name} {msg, e}             emoji reactions on chat messages
//   votes values: 0 no, 1 yes, 2 super like, -1 veto
//
// A group watcher gets: {group, round, here, profiles, hidden, options, votes, when, chat, expenses, settlements, budget, kitty, info, plan, bring, rides, mycards, pollvotes, reacts}

import { firebaseConfig } from './firebase-config.js';

export const isLive = !!(firebaseConfig && firebaseConfig.projectId);

const empty = () => ({
  group: null, round: null, here: {}, profiles: {}, hidden: [], options: [], votes: {},
  when: {}, chat: [], expenses: [], settlements: [], budget: null, kitty: [], info: null, plan: null,
  bring: {}, rides: {}, mycards: [], pollvotes: {}, reacts: {},
});

export function newId(len = 16) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => abc[b % abc.length]).join('');
}
// No 0/O/1/I/L: codes get read out loud and typed on phones.
export function newCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, b => abc[b % abc.length]).join('');
}
export const CHAT_MAX = 300;

/* ---------- local backend ---------- */

function localStore() {
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const key = gid => 'hevre:g:' + gid;
  const watchers = new Map(); // gid -> Set(cb)
  const bus = new Set();      // anything that lists groups or reads users

  const read = gid => ({ ...empty(), ...get(key(gid), {}) });
  const emit = gid => { const s = read(gid); (watchers.get(gid) || []).forEach(cb => cb(s)); bus.forEach(f => f()); };
  const write = (gid, fn) => { const s = read(gid); fn(s); put(key(gid), s); emit(gid); };
  const users = () => get('hevre:users', {});
  const authCbs = new Set();
  const me = () => { const uid = get('hevre:session', null); return uid && users()[uid] ? { uid, name: users()[uid].name } : null; };
  const fireAuth = () => authCbs.forEach(cb => cb(me()));

  addEventListener('storage', e => {
    if (!e.key) return;
    if (e.key.startsWith('hevre:g:')) emit(e.key.slice(8));
    if (e.key === 'hevre:users') bus.forEach(f => f());
    if (e.key === 'hevre:session') fireAuth();
  });

  return {
    /* auth */
    onAuth(cb) { authCbs.add(cb); cb(me()); return () => authCbs.delete(cb); },
    async signIn(name) {
      // test mode: a name is an account; the same name signs back into the same account
      const all = users();
      let uid = Object.keys(all).find(u => all[u].name === name);
      if (!uid) { uid = 'local-' + newId(10); all[uid] = { name, ts: Date.now() }; put('hevre:users', all); }
      put('hevre:session', uid); fireAuth();
    },
    async signOut() { localStorage.removeItem('hevre:session'); fireAuth(); },
    testUsers: () => Object.entries(users()).map(([uid, u]) => ({ uid, name: u.name })),

    /* users */
    watchUser(uid, cb) {
      const f = () => cb(users()[uid] || null);
      bus.add(f); f();
      return () => bus.delete(f);
    },
    async saveUser(uid, patch) {
      const all = users(); const u = { ...(all[uid] || {}), ...patch };
      for (const k of Object.keys(u)) if (u[k] === null) delete u[k]; // null = remove the field
      all[uid] = u; put('hevre:users', all); bus.forEach(f => f());
    },

    /* groups */
    watchMyGroups(uid, cb) {
      const f = () => {
        const list = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k.startsWith('hevre:g:')) continue;
          const s = read(k.slice(8));
          if (s.group?.memberUids?.includes(uid)) list.push({ gid: k.slice(8), ...s.group, lastChat: s.chat.at(-1) || null });
        }
        cb(list.sort((a, b) => (b.lastChat?.ts || b.createdAt) - (a.lastChat?.ts || a.createdAt)));
      };
      bus.add(f); f();
      return () => bus.delete(f);
    },
    async getGroup(gid) { return read(gid).group; },
    async findCode(code) { return get('hevre:codes', {})[code] || null; },
    async createGroup(gid, group) {
      const codes = get('hevre:codes', {}); codes[group.code] = gid; put('hevre:codes', codes);
      write(gid, s => { s.group = group; });
    },
    async deleteGroup(gid, code) {
      localStorage.removeItem(key(gid));
      const codes = get('hevre:codes', {}); delete codes[code]; put('hevre:codes', codes);
      emit(gid);
    },
    async leaveGroup(gid, uid, name) {
      write(gid, s => {
        s.group.memberUids = s.group.memberUids.filter(u => u !== uid);
        delete s.group.people[uid];
        s.group.members = s.group.members.filter(m => m !== name);
      });
    },
    async joinGroup(gid, uid, name) {
      write(gid, s => {
        if (s.group.memberUids.includes(uid)) return;
        s.group.memberUids.push(uid); s.group.people[uid] = name; s.group.members.push(name);
      });
    },

    watch(gid, cb) {
      if (!watchers.has(gid)) watchers.set(gid, new Set());
      watchers.get(gid).add(cb);
      cb(read(gid));
      return () => watchers.get(gid).delete(cb);
    },
    async addOption(gid, o) { write(gid, s => { s.options.push(o); }); },
    async setVote(gid, member, optId, val) {
      write(gid, s => {
        if (!Object.hasOwn(s.votes, member)) s.votes[member] = {};
        s.votes[member][optId] = val;
      });
    },
    async unvote(gid, member, optId) { write(gid, s => { if (Object.hasOwn(s.votes, member)) delete s.votes[member][optId]; }); },
    async react(gid, msg, name, e) { write(gid, s => { const k = msg + '__' + name; if (e) s.reacts[k] = { msg, e }; else delete s.reacts[k]; }); },
    async clearRound(gid) {
      write(gid, s => { s.options = []; s.votes = {}; s.here = {}; s.when = {}; s.plan = null; s.bring = {}; s.rides = {}; s.round = { status: 'lobby', owner: s.round?.owner || null, ts: Date.now() }; });
    },
    async setRound(gid, patch) { write(gid, s => { s.round = { status: 'lobby', ...(s.round || {}), ...patch }; }); },
    async setProfile(gid, member, prof) { write(gid, s => { s.profiles[member] = prof; }); },
    async setHidden(gid, hid, { tags, budget, born }) {
      write(gid, s => { s.hidden = s.hidden.filter(x => x.id !== hid); if (tags.length || budget < 4 /* 4 = whatever */ || born) s.hidden.push({ id: hid, tags, budget, born }); });
    },
    async setBudget(gid, patch) { write(gid, s => { s.budget = { ...(s.budget || {}), ...patch }; }); },
    async setInfo(gid, patch) { write(gid, s => { s.info = { ...(s.info || {}), ...patch }; }); },
    async setBring(gid, name, items) { write(gid, s => { s.bring[name] = { items }; }); },
    async setRide(gid, name, ride) { write(gid, s => { if (ride) s.rides[name] = ride; else delete s.rides[name]; }); },
    async addMyCard(gid, c) { write(gid, s => { if (!s.mycards.some(x => x.text === c.text)) s.mycards.push(c); }); },
    async deleteMyCard(gid, id) { write(gid, s => { s.mycards = s.mycards.filter(x => x.id !== id); }); },
    async votePoll(gid, poll, name, opt) { write(gid, s => { s.pollvotes[poll + '__' + name] = { poll, opt }; }); },
    async setPlan(gid, patch) { write(gid, s => { s.plan = { ...(s.plan || {}), ...patch }; }); },
    async addKitty(gid, x) { write(gid, s => { s.kitty.push(x); }); },
    async deleteKitty(gid, id) { write(gid, s => { s.kitty = s.kitty.filter(k => k.id !== id); }); },
    async markHere(gid, member) { write(gid, s => { s.here[member] = Date.now(); }); },
    async setWhen(gid, member, days) { write(gid, s => { s.when[member] = { days }; }); },
    async sendChat(gid, msg) { write(gid, s => { s.chat.push(msg); s.chat = s.chat.slice(-CHAT_MAX); }); },
    async addExpense(gid, e) { write(gid, s => { s.expenses.push(e); }); },
    async deleteExpense(gid, id) { write(gid, s => { s.expenses = s.expenses.filter(e => e.id !== id); }); },
    async addSettlement(gid, x) { write(gid, s => { s.settlements.push(x); }); },
    async deleteSettlement(gid, id) { write(gid, s => { s.settlements = s.settlements.filter(e => e.id !== id); }); },
  };
}

/* ---------- Firebase backend ---------- */

async function firebaseStore() {
  const V = '10.14.1';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const fa = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const fapp = initializeApp(firebaseConfig);
  const db = fs.getFirestore(fapp);
  const auth = fa.getAuth(fapp);
  const g = gid => fs.doc(db, 'groups', gid);
  const sub = (gid, name) => fs.collection(db, 'groups', gid, name);
  const byTs = (a, b) => (a.ts || 0) - (b.ts || 0);

  return {
    /* auth */
    onAuth(cb) {
      return fa.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, name: u.displayName || '' } : null));
    },
    async signIn() {
      const provider = new fa.GoogleAuthProvider();
      try { await fa.signInWithPopup(auth, provider); }
      catch (e) {
        // phones that block popups get the full-page flow instead
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await fa.signInWithRedirect(auth, provider);
        else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e;
      }
    },
    signOut: () => fa.signOut(auth),
    testUsers: () => [],

    /* users */
    watchUser: (uid, cb) => fs.onSnapshot(fs.doc(db, 'users', uid), d => cb(d.exists() ? d.data() : null), () => cb(null)),
    // null = remove the field (e.g. the old "age" that the rules no longer accept)
    saveUser: (uid, patch) => fs.setDoc(fs.doc(db, 'users', uid),
      Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null ? fs.deleteField() : v])), { merge: true }),

    /* groups */
    watchMyGroups(uid, cb) {
      const q = fs.query(fs.collection(db, 'groups'), fs.where('memberUids', 'array-contains', uid));
      return fs.onSnapshot(q, snap => cb(snap.docs.map(d => ({ gid: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt)), () => cb([]));
    },
    async getGroup(gid) { const d = await fs.getDoc(g(gid)); return d.exists() ? d.data() : null; },
    async findCode(code) { const d = await fs.getDoc(fs.doc(db, 'codes', code)); return d.exists() ? d.data().gid : null; },
    async createGroup(gid, group) {
      const batch = fs.writeBatch(db);
      batch.set(g(gid), group);
      batch.set(fs.doc(db, 'codes', group.code), { gid });
      await batch.commit();
    },
    // Everything inside first (Firestore doesn't delete sub-collections with their parent), then the code, then the group.
    async deleteGroup(gid, code) {
      const SUBS = ['round', 'here', 'profiles', 'hidden', 'options', 'votes', 'when', 'chat', 'expenses', 'settlements',
        'budget', 'kitty', 'info', 'plan', 'bring', 'rides', 'mycards', 'pollvotes', 'reacts'];
      const refs = [];
      for (const name of SUBS) (await fs.getDocs(sub(gid, name))).forEach(d => refs.push(d.ref));
      for (let i = 0; i < refs.length; i += 450) {
        const batch = fs.writeBatch(db);
        refs.slice(i, i + 450).forEach(r => batch.delete(r));
        await batch.commit();
      }
      if (code) await fs.deleteDoc(fs.doc(db, 'codes', code));
      await fs.deleteDoc(g(gid));
    },
    leaveGroup: (gid, uid, name) => fs.updateDoc(g(gid), {
      memberUids: fs.arrayRemove(uid), [`people.${uid}`]: fs.deleteField(), members: fs.arrayRemove(name),
    }),
    joinGroup: (gid, uid, name) => fs.updateDoc(g(gid), {
      memberUids: fs.arrayUnion(uid), [`people.${uid}`]: name, members: fs.arrayUnion(name),
    }),

    watch(gid, cb) {
      const s = empty();
      let ready = false;
      const push = () => { if (ready) cb({ ...s }); };
      const unsubs = [
        fs.onSnapshot(g(gid), d => { s.group = d.exists() ? d.data() : null; ready = true; push(); },
          () => { s.group = null; ready = true; push(); }),
        fs.onSnapshot(fs.doc(db, 'groups', gid, 'round', 'state'), d => { s.round = d.exists() ? d.data() : null; push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'profiles'), q => { s.profiles = Object.fromEntries(q.docs.map(d => [d.id, d.data()])); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'hidden'), q => { s.hidden = q.docs.map(d => ({ id: d.id, ...d.data() })); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'here'), q => { s.here = Object.fromEntries(q.docs.map(d => [d.id, d.data().ts])); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'options'), q => { s.options = q.docs.map(d => d.data()).sort(byTs); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'votes'), q => { s.votes = Object.fromEntries(q.docs.map(d => [d.id, d.data()])); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'when'), q => { s.when = Object.fromEntries(q.docs.map(d => [d.id, d.data()])); push(); }, () => {}),
        fs.onSnapshot(fs.query(sub(gid, 'chat'), fs.orderBy('ts', 'desc'), fs.limit(CHAT_MAX)),
          q => { s.chat = q.docs.map(d => d.data()).reverse(); push(); }, () => {}),
        fs.onSnapshot(fs.doc(db, 'groups', gid, 'budget', 'state'), d => { s.budget = d.exists() ? d.data() : null; push(); }, () => {}),
        fs.onSnapshot(fs.doc(db, 'groups', gid, 'info', 'state'), d => { s.info = d.exists() ? d.data() : null; push(); }, () => {}),
        fs.onSnapshot(fs.doc(db, 'groups', gid, 'plan', 'state'), d => { s.plan = d.exists() ? d.data() : null; push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'bring'), q => { s.bring = Object.fromEntries(q.docs.map(d => [d.id, d.data()])); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'rides'), q => { s.rides = Object.fromEntries(q.docs.map(d => [d.id, d.data()])); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'mycards'), q => { s.mycards = q.docs.map(d => d.data()).sort(byTs); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'reacts'), q => { s.reacts = Object.fromEntries(q.docs.map(d => [d.id, d.data()])); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'pollvotes'), q => { s.pollvotes = Object.fromEntries(q.docs.map(d => [d.id, d.data()])); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'kitty'), q => { s.kitty = q.docs.map(d => d.data()).sort(byTs); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'expenses'), q => { s.expenses = q.docs.map(d => d.data()).sort(byTs); push(); }, () => {}),
        fs.onSnapshot(sub(gid, 'settlements'), q => { s.settlements = q.docs.map(d => d.data()).sort(byTs); push(); }, () => {}),
      ];
      return () => unsubs.forEach(u => u());
    },
    addOption: (gid, o) => fs.setDoc(fs.doc(sub(gid, 'options'), o.id), o),
    unvote: (gid, member, optId) => fs.setDoc(fs.doc(sub(gid, 'votes'), member), { [optId]: fs.deleteField() }, { merge: true }),
    react: (gid, msg, name, e) => e
      ? fs.setDoc(fs.doc(sub(gid, 'reacts'), msg + '__' + name), { msg, e, ts: Date.now() })
      : fs.deleteDoc(fs.doc(sub(gid, 'reacts'), msg + '__' + name)),
    setVote: (gid, member, optId, val) => fs.setDoc(fs.doc(sub(gid, 'votes'), member), { [optId]: val }, { merge: true }),
    async clearRound(gid) {
      const batch = fs.writeBatch(db);
      for (const name of ['options', 'votes', 'here', 'when', 'plan', 'bring', 'rides']) {
        (await fs.getDocs(sub(gid, name))).forEach(d => batch.delete(d.ref));
      }
      // owner stays: the same person runs the next round
      batch.set(fs.doc(db, 'groups', gid, 'round', 'state'), { status: 'lobby', ts: Date.now(), spin: fs.deleteField(), spinTs: fs.deleteField() }, { merge: true });
      await batch.commit();
    },
    // merge, never a default status: a spin patch must not knock a live round back to the lobby
    setRound: (gid, patch) => fs.setDoc(fs.doc(db, 'groups', gid, 'round', 'state'), patch, { merge: true }),
    setProfile: (gid, member, prof) => fs.setDoc(fs.doc(sub(gid, 'profiles'), member), prof),
    setHidden: (gid, hid, { tags, budget, born }) => (tags.length || budget < 4 /* 4 = whatever */ || born)
      ? fs.setDoc(fs.doc(sub(gid, 'hidden'), hid), { tags, budget, born, ts: Date.now() })
      : fs.deleteDoc(fs.doc(sub(gid, 'hidden'), hid)),
    setBring: (gid, name, items) => fs.setDoc(fs.doc(sub(gid, 'bring'), name), { items, ts: Date.now() }),
    setRide: (gid, name, ride) => ride ? fs.setDoc(fs.doc(sub(gid, 'rides'), name), { ...ride, ts: Date.now() }) : fs.deleteDoc(fs.doc(sub(gid, 'rides'), name)),
    async addMyCard(gid, c) {
      const all = await fs.getDocs(sub(gid, 'mycards'));
      if (!all.docs.some(d => d.data().text === c.text)) await fs.setDoc(fs.doc(sub(gid, 'mycards'), c.id), c);
    },
    deleteMyCard: (gid, id) => fs.deleteDoc(fs.doc(sub(gid, 'mycards'), id)),
    votePoll: (gid, poll, name, opt) => fs.setDoc(fs.doc(sub(gid, 'pollvotes'), poll + '__' + name), { poll, opt, ts: Date.now() }),
    setInfo: (gid, patch) => fs.setDoc(fs.doc(db, 'groups', gid, 'info', 'state'), patch, { merge: true }),
    setPlan: (gid, patch) => fs.setDoc(fs.doc(db, 'groups', gid, 'plan', 'state'), patch, { merge: true }),
    setBudget: (gid, patch) => fs.setDoc(fs.doc(db, 'groups', gid, 'budget', 'state'), patch, { merge: true }),
    addKitty: (gid, x) => fs.setDoc(fs.doc(sub(gid, 'kitty'), x.id), x),
    deleteKitty: (gid, id) => fs.deleteDoc(fs.doc(sub(gid, 'kitty'), id)),
    markHere: (gid, member) => fs.setDoc(fs.doc(sub(gid, 'here'), member), { ts: Date.now() }),
    setWhen: (gid, member, days) => fs.setDoc(fs.doc(sub(gid, 'when'), member), { days, ts: Date.now() }),
    sendChat: (gid, msg) => fs.setDoc(fs.doc(sub(gid, 'chat'), msg.id), msg),
    addExpense: (gid, e) => fs.setDoc(fs.doc(sub(gid, 'expenses'), e.id), e),
    deleteExpense: (gid, id) => fs.deleteDoc(fs.doc(sub(gid, 'expenses'), id)),
    addSettlement: (gid, x) => fs.setDoc(fs.doc(sub(gid, 'settlements'), x.id), x),
    deleteSettlement: (gid, id) => fs.deleteDoc(fs.doc(sub(gid, 'settlements'), id)),
  };
}

export const store = isLive ? await firebaseStore() : localStore();
