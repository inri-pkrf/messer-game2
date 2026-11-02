import React, { useState, useEffect, useRef } from "react";
import "@fontsource/karantina/400.css";
import "@fontsource/karantina/700.css";
import "@fontsource/heebo/400.css";
import "@fontsource/heebo/700.css";
import "@fontsource/heebo/900.css";
import "./App.css";
import { CH } from "./data";
import { CFG, newGame, tick, decide, summary, unlock, sfx } from "./game";

const STAGE_W = 1080, STAGE_H = 1920; // מסך הטוטם (לאורך). לשינוי: ערכי הקבועים כאן
const ANG = [-90, -45, 0, 45, 90, 135, 180, 225];
const OUT = { great: "החלטה מצוינת", ok: "סביר, אבל…", bad: "פספוס", late: "הפנייה נעלמה" };
const clock = (t) => { const m = 21 * 60 + Math.min(60, Math.floor(t / 60)); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };

function useScale() {
  const [s, setS] = useState(1);
  useEffect(() => {
    const f = () => setS(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return s;
}
function useType(text, speed = 18) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return text.slice(0, n);
}

function Sheet({ q, G, mode, setMode, onDecide, onClose }) {
  const typed = useType(q.txt);
  const c = CH[q.ch];
  return (
    <div className="sheet">
      <button className="x" onClick={onClose}>חזרה ללוח</button>
      <div className="sh-head"><span className="ic">{c.ic}</span><div><b>{c.n}</b><br />{q.who}</div></div>
      <blockquote>{typed}<i className="caret" /></blockquote>
      <h3>מה את מחליטה?</h3>
      {mode === "main" && (
        <div className="acts">
          <button onClick={() => setMode("take")}><em>📞</em>לקחת עכשיו<small>איש צוות יהיה תפוס</small></button>
          <button onClick={() => onDecide("wait")}><em>⏳</em>להמתין<small>הודעת קבלה, הזמן מואט</small></button>
          <button onClick={() => setMode("refer")}><em>↗</em>להעביר הלאה<small>חירום, צוות בכיר, רשות, מידע</small></button>
          <button onClick={() => onDecide("close")}><em>✓</em>לסגור בקצרה<small>מענה קצר או הפניה למשרד</small></button>
        </div>
      )}
      {mode === "take" && (
        <div className="list">
          {G.vols.map((v, i) => {
            const busy = v.busy > G.t;
            return (
              <button key={i} disabled={busy} onClick={() => onDecide("take", i)}>
                <b>{v.n}</b> {v.lv === "vet" ? "איש/ת צוות מקצועי/ת" : "מתנדב/ת"}
                <small>{busy ? "בשיחה כרגע" : v.e < 25 ? "מותש/ת מאוד" : "אנרגיה " + Math.round(v.e) + "%"}</small>
              </button>
            );
          })}
          <button className="back" onClick={() => setMode("main")}>חזרה</button>
        </div>
      )}
      {mode === "refer" && (
        <div className="list">
          <button onClick={() => onDecide("refer", "emg")}>🚨 חירום: מד״א / משטרה / פקע״ר</button>
          <button disabled={G.sw <= 0} onClick={() => onDecide("refer", "sw")}>🧑‍⚕️ צוות פסיכו-סוציאלי בכיר <small>נותרו {G.sw}</small></button>
          <button onClick={() => onDecide("refer", "wel")}>🏛️ רשות מקומית ולוגיסטיקה</button>
          <button onClick={() => onDecide("refer", "sup")}>ℹ️ מידע וזכויות: קרן הפיצויים, מרכז חוסן</button>
          <button className="back" onClick={() => setMode("main")}>חזרה</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const scale = useScale();
  const [screen, setScreen] = useState("attract");
  const [G, setG] = useState(null);
  const [sel, setSel] = useState(null);
  const [mode, setMode] = useState("main");
  const [pick, setPick] = useState(null);
  const focus = useRef(false);
  const touched = useRef(Date.now());
  const q = G && sel ? G.q.find((x) => x.id === sel) : null;
  focus.current = !!(q || (G && G.card));

  const start = () => { unlock(); setG(newGame()); setSel(null); setMode("main"); setScreen("play"); };

  useEffect(() => {
    if (screen !== "play") return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      setG((g) => (!g || g.over ? g : tick(g, dt * CFG.SPEED * (focus.current ? CFG.SLOW : 1))));
    }, 100);
    return () => clearInterval(id);
  }, [screen]);

  useEffect(() => {
    if (!G) return;
    G.ev.forEach((e) => { if (e.k === "spawn") sfx.ping(e.u); if (e.k === "late") sfx.bad(); });
  }, [G && G.ev]); // eslint-disable-line

  useEffect(() => {
    if (G && G.over && screen === "play") {
      const id = setTimeout(() => { setPick(null); setScreen("end"); }, 900);
      return () => clearTimeout(id);
    }
  }, [G, screen]);

  useEffect(() => {
    if (!G || !G.card) return;
    const id = setTimeout(() => setG((g) => (g ? { ...g, card: null } : g)), 16000);
    return () => clearTimeout(id);
  }, [G && G.card]); // eslint-disable-line

  useEffect(() => {
    if (screen === "play") return;
    const id = setInterval(() => { if (screen === "end" && Date.now() - touched.current > 90000) setScreen("attract"); }, 5000);
    return () => clearInterval(id);
  }, [screen]);

  const onDecide = (act, arg) => {
    const ng = decide(G, sel, act, arg);
    setG(ng);
    if (act === "wait") { setSel(null); setMode("main"); return; }
    if (ng.card) sfx[ng.card.out === "great" ? "good" : ng.card.out === "ok" ? "ok" : "bad"]();
    setSel(null); setMode("main");
  };

  const pressure = G ? Math.min(1, G.q.length / 6) : 0;
  const sum = screen === "end" && G ? summary(G.res) : null;
  const shown = sum && (pick != null ? G.res.find((r) => r.id === pick) : sum.worst);

  return (
    <div className="root" onPointerDown={() => (touched.current = Date.now())}>
      <div className="stage" style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%,-50%) scale(${scale})` }}>
        {screen === "attract" && (
          <div className="attract" onClick={start}>
            <div className="ripples"><i /><i /><i /><i /></div>
            <h1>שעה אחת</h1>
            <h2>במרכז הסיוע</h2>
            <p className="lead">את מנהלת מרכז סיוע ראשוני (מס״ר), שעות אחרי אירוע רב-נפגעים. תושבים, משפחות של נעדרים וכוחות נכנסים בלי הפסקה.<br />הצוות מוגבל, והשעה קצרה. כל החלטה משאירה אחריה תוצאה.</p>
            <ul>
              <li><b>1</b>לחצי על פנייה כדי לקרוא אותה. הטבעת סביבה מראה כמה זמן נשאר.</li>
              <li><b>2</b>החליטי: לקחת, להמתין, להעביר או לסגור בקצרה.</li>
              <li><b>3</b>בזמן החלטה הזמן מואט. אנשי צוות מתעייפים, והצוות הפסיכו-סוציאלי הבכיר זמין פעמיים בלבד.</li>
            </ul>
            <button className="go">התחילי משמרת</button>
            <small className="disc">התרחישים מומצאים ומבוססים על חומרי ההכשרה למס״ר. הם אינם נוהל רשמי.</small>
          </div>
        )}

        {screen === "play" && G && (
          <div className={"play" + (focus.current ? " slow" : "")} style={{ "--beat": 2.4 - pressure * 1.6 + "s" }}>
            <header>
              <div className="ttl">שעה אחת<br /><span>במרכז הסיוע</span></div>
              <div className="clock">
                <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" className="tr" /><circle cx="100" cy="100" r="92" className="pr" strokeDasharray={578} strokeDashoffset={578 * (1 - Math.min(1, G.t / 3600))} /></svg>
                <b>{clock(G.t)}</b>
              </div>
              <div className="load"><span>עומס</span><div><i style={{ width: pressure * 100 + "%" }} /></div></div>
            </header>

            <div className="sonar">
              <div className="rg r1" /><div className="rg r2" /><div className="rg r3" /><div className="beam" />
              <div className="core"><b>המרכז</b><span>{G.res.filter((r) => r.out !== "late").length} טופלו · {G.res.filter((r) => r.out === "late").length} נשרו</span></div>
              {G.q.map((x) => {
                const f = Math.max(0, x.left / (x.p * 60)), r = 250 + 150 * f, a = (ANG[x.slot] * Math.PI) / 180;
                return (
                  <button key={x.id} className={"bub" + (f < 0.3 ? " hot" : "") + (x.held ? " held" : "")} style={{ left: 500 + r * Math.cos(a) - 85, top: 500 + r * Math.sin(a) - 85 }} onClick={() => { setSel(x.id); setMode("main"); }}>
                    <svg viewBox="0 0 170 170"><circle cx="85" cy="85" r="78" className="tr" /><circle cx="85" cy="85" r="78" style={{ stroke: `hsl(${10 + 150 * f} 85% 60%)` }} strokeDasharray={490} strokeDashoffset={490 * (1 - f)} /></svg>
                    <span className="ic">{x.held ? "⏳" : CH[x.ch].ic}</span><span className="cn">{CH[x.ch].n}</span>
                  </button>
                );
              })}
              {G.q.length === 0 && <div className="calm">הלוח שקט. לרגע.</div>}
            </div>

            <div className="vols">
              {G.vols.map((v, i) => {
                const busy = v.busy > G.t;
                return (
                  <div key={i} className={"vol" + (busy ? " busy" : "")}>
                    <div className="av" style={{ "--e": v.e + "%" }}><b>{v.n[0]}</b></div>
                    <strong>{v.n}</strong>
                    <small>{busy ? "בשיחה, עוד " + Math.ceil((v.busy - G.t) / 60) + " דק׳" : v.e < 25 ? "מותש/ת" : v.lv === "vet" ? "צוות מקצועי · פנוי" : "מתנדב/ת · פנוי/ה"}</small>
                  </div>
                );
              })}
              <div className="vol sw"><div className="av"><b>{G.sw}</b></div><strong>צוות בכיר</strong><small>{G.sw ? "זמינה" : "אזלה"}</small></div>
            </div>

            <div className="log">
              <h4>יומן השלכות</h4>
              {G.log.slice(0, 4).map((l, i) => (<p key={l.id} style={{ opacity: 1 - i * 0.2 }}><i className={"d " + l.out} />{l.who} · {OUT[l.out]}</p>))}
              {!G.log.length && <p className="mut">עוד לא התקבלו החלטות.</p>}
            </div>

            <div className="vig" style={{ opacity: pressure * 0.55 }} />
            {focus.current && <div className="slowtag">הזמן מואט</div>}
            {G.toast && Date.now() - G.toast.at < 4500 && <div className="toast">{G.toast.text}</div>}
            {q && <div className="dim" onClick={() => { setSel(null); setMode("main"); }} />}
            {q && <Sheet key={q.id} q={q} G={G} mode={mode} setMode={setMode} onDecide={onDecide} onClose={() => { setSel(null); setMode("main"); }} />}
            {G.card && !q && (
              <div className="cardwrap" onClick={() => setG({ ...G, card: null })}>
                <div className={"card " + G.card.out}>
                  <div className="ct">{OUT[G.card.out]}</div>
                  <h5>{CH[G.card.ch].ic} {G.card.who}</h5>
                  <label>מה קרה</label><p>{G.card.text}</p>
                  <label>העיקרון</label><p className="tip">{G.card.tip}</p>
                  <button>המשך משמרת</button>
                </div>
              </div>
            )}
          </div>
        )}

        {screen === "end" && sum && (
          <div className="end">
            <h2>סיכום המשמרת</h2>
            <div className="ring">
              <svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="130" className="tr" /><circle cx="150" cy="150" r="130" className="pr" strokeDasharray={817} strokeDashoffset={817 * (1 - sum.pct / 100)} /></svg>
              <b>{sum.pct}</b>
            </div>
            <h3>{sum.title}</h3>
            <div className="axes">
              {[["בטיחות בפניות הדחופות", sum.safety], ["זמינות: כמה פניות לא נשרו", sum.served], ["שיקול דעת: החלטות מדויקות", sum.judgment]].map(([n, v]) => (
                <div key={n}><span>{n}</span><div><i style={{ width: v + "%" }} /></div><b>{v}</b></div>
              ))}
            </div>
            <div className="tl">
              {G.res.map((r) => (<button key={r.id} className={"d " + r.out + (shown && shown.id === r.id ? " on" : "")} onClick={() => setPick(r.id)} title={r.who}>{r.id}</button>))}
            </div>
            {shown && (
              <div className={"card flat " + shown.out}>
                <div className="ct">{pick == null ? "הפספוס הגדול של המשמרת" : OUT[shown.out]}</div>
                <h5>{CH[shown.ch].ic} {shown.who}</h5>
                <p>{shown.text || "הפנייה לא טופלה בזמן ונסגרה."}</p>
                <label>העיקרון</label><p className="tip">{shown.tip}</p>
              </div>
            )}
            <button className="go" onClick={start}>משמרת חדשה</button>
            <small className="disc">התרחישים מומצאים ומבוססים על חומרי ההכשרה למס״ר. יש לאמת את התוכן מול הגורמים המקצועיים.</small>
          </div>
        )}
      </div>
    </div>
  );
}