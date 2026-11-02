import { INQ } from "./data";
export const CFG = { SPEED: 10, SLOW: 0.3, END: 3660, SW: 2 }; // SPEED: שניות משחק לכל שנייה אמיתית
export const W = { crit: 3, high: 2, med: 1.3, low: 0.8 };
const PTS = { great: 1, ok: 0.55, bad: 0.1, late: 0 };
const GEN = {
  o: "הפנייה טופלה, אבל לא בדרך האופטימלית.",
  b: "ההחלטה לא התאימה למה שהפונה היה צריך. הפנייה נסגרה בלי מענה אמיתי.",
  l: "הפונה ויתר והפנייה נסגרה. לא ידוע אם פנה למקום אחר.",
};
const VOLS = [
  { n: "נועה", lv: "vet" }, { n: "אורי", lv: "vet" },
  { n: "מיכל", lv: "new" }, { n: "דניאל", lv: "new" },
];
const ORDER = [0, 4, 2, 6, 1, 5, 3, 7];
export const newGame = () => ({
  t: 0, q: [], res: [], log: [], card: null, toast: null, over: false, ev: [], sw: CFG.SW,
  vols: VOLS.map((v) => ({ ...v, e: 100, busy: 0, job: "" })),
});
const freeSlot = (q) => ORDER.find((i) => !q.some((x) => x.slot === i)) ?? 0;
const clone = (g) => ({ ...g, q: g.q.map((x) => ({ ...x })), vols: g.vols.map((v) => ({ ...v })), res: [...g.res], log: [...g.log], ev: [] });

function resolve(g, q, out, text, act, silent) {
  g.q = g.q.filter((x) => x.id !== q.id);
  g.res.push({ id: q.id, who: q.who, u: q.u, out, text, tip: q.tip, act, ch: q.ch });
  g.log.unshift({ id: q.id, out, who: q.who });
  if (silent) return;
  if (out === "late") g.toast = { text: "הפנייה נעלמה: " + q.who, at: Date.now() };
  else g.card = { id: q.id, who: q.who, ch: q.ch, out, text, tip: q.tip, at: Date.now() };
}

export function tick(G, dt) {
  const g = clone(G);
  g.t += dt;
  INQ.forEach((d) => {
    if (g.t >= d.at * 60 && !g.q.some((x) => x.id === d.id) && !g.res.some((r) => r.id === d.id)) {
      g.q.push({ ...d, left: d.p * 60, held: false, holds: 0, slot: freeSlot(g.q) });
      g.ev.push({ k: "spawn", u: d.u });
    }
  });
  [...g.q].forEach((x) => {
    x.left -= dt * (x.held ? 0.35 : 1);
    if (x.left <= 0) { resolve(g, x, "late", x.l || GEN.l, "timeout"); g.ev.push({ k: "late" }); }
  });
  g.vols.forEach((v) => {
    if (v.busy > g.t) return;
    v.job = "";
    v.e = Math.min(100, v.e + dt * 0.012);
  });
  if (g.t >= CFG.END) {
    [...g.q].forEach((x) => resolve(g, x, "late", "", "timeout", true));
    g.over = true; g.t = CFG.END;
  }
  return g;
}

export function decide(G, id, act, arg) {
  const g = clone(G);
  const q = g.q.find((x) => x.id === id);
  if (!q) return G;
  if (act === "wait") {
    q.held = true; q.holds++;
    g.toast = { text: "נשלחה הודעת קבלה: ״אנחנו איתך, מישהו יתפנה בקרוב״", at: Date.now() };
    return g;
  }
  const alt = q.alt || [];
  const needTake = ["vet", "any", "new"].includes(q.need);
  let out, text;
  if (act === "take") {
    const v = g.vols[arg];
    if (!v || v.busy > g.t) return G;
    if (needTake) {
      if (q.need === "vet" && v.lv === "new") { out = "bad"; text = q.n || GEN.b; }
      else if (q.need === "new" && v.lv === "vet") { out = "ok"; text = q.o || GEN.o; }
      else {
        out = "great"; text = q.g;
        if (v.e < 25) { out = "ok"; text += " אך המתנדב/ת היה/תה מותש/ת, ואיכות המענה נפגעה."; }
      }
    } else if (alt.includes("take") || (alt.includes("vet") && v.lv === "vet")) { out = "ok"; text = q.o || GEN.o; }
    else { out = "bad"; text = q.b || GEN.b; }
    v.e = Math.max(0, v.e - q.h * (q.u === "crit" ? 3 : 2.2));
    v.busy = g.t + q.h * 60; v.job = q.who;
  } else if (act === "refer") {
    if (arg === "sw") { if (g.sw <= 0) return G; g.sw--; }
    if (q.need === arg) { out = "great"; text = q.g; }
    else if (alt.includes(arg)) { out = "ok"; text = q.o || GEN.o; }
    else { out = "bad"; text = q.b || GEN.b; }
  } else {
    if (q.need === "close") { out = "great"; text = q.g; }
    else if (alt.includes("close")) { out = "ok"; text = q.o || GEN.o; }
    else { out = "bad"; text = q.b || GEN.b; }
  }
  if (out === "great" && q.holds > 0 && (q.u === "crit" || q.u === "high")) {
    out = "ok"; text = "ההמתנה הקודמת עלתה בזמן יקר. " + text;
  }
  resolve(g, q, out, text, act);
  return g;
}

const score = (rs) => {
  const t = rs.reduce((a, r) => a + W[r.u], 0);
  return t ? Math.round((100 * rs.reduce((a, r) => a + W[r.u] * PTS[r.out], 0)) / t) : 0;
};
export function summary(res) {
  const n = Math.max(1, res.length);
  const pct = score(res);
  return {
    pct,
    safety: score(res.filter((r) => r.u === "crit" || r.u === "high")),
    served: Math.round((100 * res.filter((r) => r.out !== "late").length) / n),
    judgment: Math.round((100 * res.filter((r) => r.out === "great").length) / n),
    worst: [...res].sort((a, b) => PTS[a.out] - PTS[b.out] || W[b.u] - W[a.u])[0],
    title: pct >= 85 ? "מנהלת משמרת בכירה" : pct >= 65 ? "מנהלת משמרת מנוסה" : pct >= 45 ? "משמרת מאתגרת" : "משמרת קשה, ובשביל זה מתאמנים",
  };
}

// צלילים: נוצרים בקוד, בלי קבצים חיצוניים
let ac;
export const unlock = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch (e) {} };
const tone = (f, d = 0.15, type = "sine", v = 0.06, delay = 0) => {
  if (!ac) return;
  const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime + delay;
  o.type = type; o.frequency.value = f;
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + d + 0.05);
};
export const sfx = {
  ping: (u) => (u === "crit" ? (tone(220, 0.5, "sawtooth", 0.04), tone(233, 0.5, "sawtooth", 0.03)) : tone(660, 0.18)),
  good: () => { tone(523, 0.15); tone(784, 0.28, "sine", 0.06, 0.12); },
  ok: () => tone(440, 0.22),
  bad: () => { tone(196, 0.35, "triangle", 0.08); tone(147, 0.45, "triangle", 0.07, 0.15); },
};
