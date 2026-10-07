// Who-owes-whom math. All amounts are integer agorot (1₪ = 100) so nothing rounds wrong.

// Positive balance = the group owes you; negative = you owe the group.
export function balances(members, expenses, settlements) {
  const bal = Object.fromEntries(members.map(m => [m, 0]));
  const has = m => Object.hasOwn(bal, m); // not `in`: a name like "constructor" would hit the prototype
  const add = (m, v) => { if (has(m)) bal[m] += v; };

  for (const e of expenses) {
    const among = (e.among || []).filter(has);
    if (!among.length || !has(e.payer)) continue;
    add(e.payer, e.amount);
    // Even split; the leftover agorot go one each to the first people in the list.
    const share = Math.floor(e.amount / among.length);
    let rest = e.amount - share * among.length;
    for (const m of among) {
      add(m, -(share + (rest > 0 ? 1 : 0)));
      if (rest > 0) rest--;
    }
  }
  // A settlement is a real payment: "from" handed money to "to", so from owes less and to is owed less.
  for (const s of settlements) {
    add(s.from, s.amount);
    add(s.to, -s.amount);
  }
  return bal;
}

// Greedy: the biggest debtor pays the biggest creditor until someone hits zero.
// Gives at most n-1 transfers, which is what a group of friends actually wants.
export function transfers(bal) {
  const debt = [], cred = [];
  for (const [m, v] of Object.entries(bal)) {
    if (v < 0) debt.push({ m, v: -v });
    else if (v > 0) cred.push({ m, v });
  }
  const out = [];
  while (debt.length && cred.length) {
    debt.sort((a, b) => b.v - a.v);
    cred.sort((a, b) => b.v - a.v);
    const d = debt[0], c = cred[0];
    const amt = Math.min(d.v, c.v);
    out.push({ from: d.m, to: c.m, amount: amt });
    d.v -= amt; c.v -= amt;
    if (!d.v) debt.shift();
    if (!c.v) cred.shift();
  }
  return out;
}

export function shekels(agorot) {
  const s = (agorot / 100).toFixed(2).replace(/\.00$/, '');
  // Wrapped in a left-to-right isolate so Hebrew text around it doesn't flip it to "₪10".
  return '\u2066' + s + '₪' + '\u2069';
}
