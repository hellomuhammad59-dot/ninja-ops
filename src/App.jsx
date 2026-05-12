import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

// ─── Theme (القديم) ───────────────────────────────────────────────────────────
const C = {
  bg: "#0a0d14", surface: "#111622", card: "#161d2e", border: "#1e2d47",
  accent: "#00c6ff", green: "#00e676", yellow: "#ffd740", red: "#ff4444",
  orange: "#ff9100", text: "#e8f0fe", muted: "#6b7fa3",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'Barlow Condensed', sans-serif; direction: rtl; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${C.surface}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  .mono { font-family: 'JetBrains Mono', monospace; }
  @keyframes slideIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .ai { animation: slideIn .35s ease forwards; }
  button { cursor:pointer; font-family:'Barlow Condensed',sans-serif; }
  input, select { font-family:'Barlow Condensed',sans-serif; }
  table { border-collapse:collapse; width:100%; }
  th { padding:9px 14px; text-align:right; font-size:11px; color:${C.muted}; font-weight:700; white-space:nowrap; background:${C.surface}; border-bottom:1px solid ${C.border}; letter-spacing:.05em; text-transform:uppercase; }
  td { padding:10px 14px; border-bottom:1px solid ${C.border}; vertical-align:middle; font-size:13px; }
  tr:hover td { background:${C.surface}; }
  tr:last-child td { border-bottom:none; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sc  = s => s >= 80 ? C.green : s >= 60 ? C.yellow : s >= 40 ? C.orange : C.red;
const sbg = s => s >= 80 ? "#00e67618" : s >= 60 ? "#ffd74018" : s >= 40 ? "#ff910018" : "#ff444418";
const tl  = s => s >= 80 ? "ممتاز" : s >= 60 ? "جيد" : s >= 40 ? "يحتاج تدريب" : "إيقاف";

const STORAGE_KEY = "ninja_ops_v5";
function loadDb()     { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
function saveDb(d)    { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

// ─── JSON Repair ──────────────────────────────────────────────────────────────
function repairJSON(s) {
  let str = s.trim().replace(/,(\s*[\]}])/g, "$1");
  const lc = Math.max(str.lastIndexOf("}"), str.lastIndexOf("]"));
  if (lc > 0 && lc < str.length - 1) str = str.substring(0, lc + 1);
  const oC=(str.match(/\{/g)||[]).length, cC=(str.match(/\}/g)||[]).length;
  const oS=(str.match(/\[/g)||[]).length, cS=(str.match(/\]/g)||[]).length;
  for (let i=0;i<oS-cS;i++) str+="]";
  for (let i=0;i<oC-cC;i++) str+="}";
  return str.replace(/,(\s*[\]}])/g,"$1");
}

async function callClaude(prompt, maxTokens = 1500) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error("API " + res.status + ": " + (d.error?.message || ""));
  const text = (d.content || []).map(b => b.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("لا يوجد JSON في الرد");
  try { return JSON.parse(m[0]); }
  catch { try { return JSON.parse(repairJSON(m[0])); } catch { throw new Error("JSON معطوب"); } }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Spinner({ msg }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"52vh", gap:14 }}>
      <div style={{ fontSize:48 }}>🤖</div>
      <div style={{ display:"flex", alignItems:"center", gap:10, color:C.muted }}>
        <div style={{ width:18,height:18,border:`2px solid ${C.border}`,borderTop:`2px solid ${C.accent}`,borderRadius:"50%",animation:"spin .7s linear infinite" }}/>
        <span style={{ fontSize:15 }}>{msg || "جاري التحليل بالذكاء الاصطناعي..."}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }) {
  return (
    <div className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"18px 20px", flex:1, minWidth:120 }}>
      <div style={{ fontSize:11, color:C.muted, letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:30, fontWeight:900, color:color||C.text, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:color||C.muted, marginTop:5, fontWeight:700 }}>{sub}</div>}
    </div>
  );
}

function ScoreBar({ score }) {
  const s = Math.min(100, Math.max(0, Number(score)||0));
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${s}%`, height:"100%", background:sc(s), borderRadius:3, transition:"width .5s ease" }}/>
      </div>
      <span className="mono" style={{ fontSize:12, color:sc(s), minWidth:24 }}>{s}</span>
    </div>
  );
}

function Tag({ children, color }) {
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:700, background:color+"20", color, border:`1px solid ${color}40`, whiteSpace:"nowrap" }}>{children}</span>;
}

function DeltaTag({ d }) {
  if (d === null || d === undefined) return <span style={{ color:C.muted }}>—</span>;
  const n = Number(d);
  if (n > 2)  return <Tag color={C.green}>↑ +{n} تحسّن ✅</Tag>;
  if (n < -2) return <Tag color={C.red}>↓ {n} تدهور ❌</Tag>;
  return <Tag color={C.yellow}>→ ثابت ⚠️</Tag>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]       = useState("upload");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [error, setError]     = useState("");
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [plan, setPlan]       = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [db, setDb]           = useState(loadDb);
  const [tFilter, setTFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const fileRef = useRef();

  useEffect(() => { saveDb(db); }, [db]);

  // History derived from db
  const history = db.history || [];
  const trend = history.length >= 2 ? history[history.length-1].branchScore - history[history.length-2].branchScore : null;

  // ── Upload & Analysis ─────────────────────────────────────────────────────
  const handleFile = async (file) => {
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf);
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!raw.length) { setError("الملف فارغ"); return; }
      await runAnalysis(raw, Object.keys(raw[0]));
    } catch(e) { setError("خطأ: " + e.message); setLoading(false); }
  };

  const runAnalysis = async (data, cols) => {
    setLoading(true); setView("dashboard"); setError(""); setPlan(null);
    try {
      const colStr = cols.join(", ");
      const total  = data.length;

      // ── Step 1: Branch summary ──
      setLoadMsg("تحليل أداء الفرع...");
      const sample = data.slice(0, 30);
      const sumPrompt = `أنت محلل لوجستيات. بيانات أداء كباتن توصيل.
الأعمدة: ${colStr}
البيانات (عينة): ${JSON.stringify(sample)}
العدد الكلي: ${total}
أرجع JSON فقط بدون أي نص خارجه بهذا الشكل:
{"branchScore":75,"branchGrade":"جيد","totalCaptains":${total},"topPerformers":["اسم1","اسم2","اسم3"],"bottomPerformers":["اسم1","اسم2","اسم3"],"branchWeakPoints":["نقطة1","نقطة2","نقطة3"],"summaryInsight":"ملخص تنفيذي للوضع"}`;

      const summary = await callClaude(sumPrompt, 900);

      // ── Step 2: Captain scores in batches ──
      const BATCH = 15;
      let allCaptains = [];
      const totalBatches = Math.ceil(data.length / BATCH);

      for (let i = 0; i < data.length; i += BATCH) {
        const bn = Math.floor(i / BATCH) + 1;
        setLoadMsg(`تقييم الكباتن ${bn}/${totalBatches}...`);
        const batch = data.slice(i, i + BATCH);
        const capPrompt = `أنت محلل لوجستيات. قيّم كل كابتن بناءً على بياناته.
الأعمدة: ${colStr}
البيانات: ${JSON.stringify(batch)}
أرجع JSON فقط. كل نص قصير جداً (أقل من 15 كلمة):
{"captains":[{"name":"اسم","score":80,"strengths":["قوة"],"weaknesses":["ضعف"],"recommendation":"توصية","impactOnBranch":"إيجابي"}]}`;
        try {
          const r = await callClaude(capPrompt, 3500);
          if (r.captains && Array.isArray(r.captains)) allCaptains = allCaptains.concat(r.captains);
        } catch(e) { console.warn("Batch failed:", e.message); }
      }

      const captains = allCaptains.sort((a, b) => (Number(b.score)||0) - (Number(a.score)||0));
      const parsed = { ...summary, totalCaptains: captains.length || total, captains };
      setAnalysis(parsed);

      // ── Update tracking DB ──
      const now = new Date().toISOString();
      const sid = Date.now();
      const newDb = { ...db, captains: { ...(db.captains||{}) }, history: [...(db.history||[])] };

      captains.forEach(cap => {
        const ex   = newDb.captains[cap.name];
        const prev = ex?.snapshots?.slice(-1)[0];
        const delta = prev ? (Number(cap.score)||0) - prev.score : null;

        if (!ex) {
          newDb.captains[cap.name] = { id:cap.name, firstSeen:now, trainingFlag:false, trainingDate:null, trainingSnapshot:null, snapshots:[] };
        }
        const rec = newDb.captains[cap.name];
        if ((Number(cap.score)||0) < 60 && !rec.trainingFlag) {
          rec.trainingFlag     = true;
          rec.trainingDate     = now;
          rec.trainingSnapshot = { score:Number(cap.score)||0, date:now };
        }
        rec.snapshots = [...(rec.snapshots||[]).slice(-9), { sid, score:Number(cap.score)||0, date:now, impact:cap.impactOnBranch }];
        if (delta !== null) rec.lastDelta = delta;
      });

      const entry = {
        id: sid, date: new Date().toLocaleDateString("ar-SA"), dateISO: now,
        branchScore: parsed.branchScore, branchGrade: parsed.branchGrade,
        totalCaptains: parsed.totalCaptains,
        topPerformers: parsed.topPerformers, bottomPerformers: parsed.bottomPerformers,
        branchWeakPoints: parsed.branchWeakPoints, summaryInsight: parsed.summaryInsight,
      };
      newDb.history = [...newDb.history.slice(-19), entry];
      setDb(newDb);

    } catch(e) { setError("خطأ في التحليل: " + e.message); }
    setLoading(false); setLoadMsg("");
  };

  // ── Generate Plan ─────────────────────────────────────────────────────────
  const generatePlan = async () => {
    if (!analysis) return;
    setPlanLoading(true); setView("plan");
    try {
      const prompt = `أنت مدير عمليات لوجستية خبير. بناءً على:
نسبة الفرع: ${analysis.branchScore}%
نقاط الضعف: ${(analysis.branchWeakPoints||[]).join(", ")}
أسوأ كباتن: ${(analysis.bottomPerformers||[]).join(", ")}
يحتاج تدريب: ${(analysis.captains||[]).filter(c=>c.score>=40&&c.score<60).length}
يحتاج إيقاف: ${(analysis.captains||[]).filter(c=>c.score<40).length}
أرجع JSON فقط:
{"weeklyPlan":[{"day":"الأحد","actions":["إجراء1","إجراء2"]},{"day":"الاثنين","actions":["إجراء"]},{"day":"الثلاثاء","actions":["إجراء"]},{"day":"الأربعاء","actions":["إجراء"]},{"day":"الخميس","actions":["إجراء"]}],"immediateActions":["إجراء فوري1","إجراء فوري2","إجراء فوري3"],"trainingPlan":"خطة تدريب مفصلة","kpiTargets":[{"metric":"مؤشر","current":"الحالي","target":"الهدف خلال شهر"}],"expectedImprovement":"التحسن المتوقع خلال 30 يوم"}`;
      const p = await callClaude(prompt, 1800);
      setPlan(p);
    } catch(e) { setError("خطأ في توليد الخطة: " + e.message); }
    setPlanLoading(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredCaptains = (analysis?.captains || []).filter(c => {
    const s = Number(c.score) || 0;
    const fm = filter==="all" || (filter==="excellent"&&s>=80) || (filter==="good"&&s>=60&&s<80) || (filter==="training"&&s>=40&&s<60) || (filter==="stop"&&s<40);
    return fm && (!search || String(c.name).toLowerCase().includes(search.toLowerCase()));
  });

  const trainedCaptains = Object.values(db.captains||{}).filter(c => {
    if (tFilter==="trained" && !c.trainingFlag) return false;
    if (tFilter==="improved" && !(c.lastDelta > 2)) return false;
    if (tFilter==="declined" && !(c.lastDelta < -2)) return false;
    return c.snapshots?.length >= 1;
  }).map(c => {
    const snaps = c.snapshots || [];
    const latest = snaps.slice(-1)[0];
    const prev   = snaps.slice(-2)[0];
    const delta  = latest && prev ? latest.score - prev.score : null;
    const trainDelta = c.trainingSnapshot && latest ? latest.score - c.trainingSnapshot.score : null;
    return { ...c, latest, prev, delta, trainDelta };
  }).sort((a,b) => (b.latest?.score||0)-(a.latest?.score||0));

  const trainedCount = Object.values(db.captains||{}).filter(c=>c.trainingFlag).length;

  // ─ Nav ─
  const Nav = ({ id, icon, label, badge }) => (
    <button onClick={()=>setView(id)} style={{ position:"relative", padding:"7px 13px", borderRadius:7, border:"none", fontSize:13, fontWeight:700, background:view===id?C.accent:C.card, color:view===id?"#000":C.muted, transition:"all .2s" }}>
      {icon} {label}
      {badge ? <span style={{ position:"absolute", top:2, left:2, background:C.red, color:"#fff", borderRadius:10, fontSize:9, padding:"0 4px", fontWeight:900 }}>{badge}</span> : null}
    </button>
  );

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh", background:C.bg }}>

        {/* ── Header ── */}
        <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, background:"linear-gradient(135deg,#00c6ff,#0072ff)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>⚡</div>
            <div>
              <div style={{ fontWeight:900, fontSize:17, letterSpacing:1 }}>NINJA OPS</div>
              <div style={{ fontSize:9, color:C.muted, letterSpacing:2 }}>CAPTAIN PERFORMANCE SYSTEM</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            <Nav id="upload"    icon="📂" label="رفع" />
            <Nav id="dashboard" icon="📊" label="الداشبورد" />
            <Nav id="tracking"  icon="🎯" label="التتبع" badge={trainedCount||null} />
            <Nav id="reports"   icon="📋" label="التقارير" />
            <Nav id="plan"      icon="🗓" label="الخطة" />
          </div>
          <button onClick={()=>{if(confirm("مسح كل البيانات المحفوظة؟")){setDb({});setAnalysis(null);setView("upload");}}} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:12 }}>🗑 مسح</button>
        </div>

        {/* ════ UPLOAD ════ */}
        {view==="upload" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"78vh", padding:32 }}>
            <div className="ai" style={{ textAlign:"center", maxWidth:440 }}>
              <div style={{ fontSize:56, marginBottom:14 }}>📊</div>
              <h1 style={{ fontSize:38, fontWeight:900, marginBottom:8 }}>رفع ملف الأداء</h1>
              <p style={{ color:C.muted, marginBottom:28, fontSize:15 }}>ارفع أي ملف Excel — الذكاء الاصطناعي يحلله مهما كانت أعمدته</p>
              <div onClick={()=>fileRef.current?.click()}
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
                style={{ border:`2px dashed ${C.border}`, borderRadius:14, padding:"44px 30px", cursor:"pointer", background:C.card, transition:"border-color .2s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{ fontSize:36, marginBottom:10 }}>⬆️</div>
                <div style={{ fontWeight:700, fontSize:17 }}>اسحب الملف هنا أو اضغط للاختيار</div>
                <div style={{ color:C.muted, fontSize:12, marginTop:6 }}>يدعم .xlsx .xls .csv</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])} />
              {error && <div style={{ marginTop:14, color:C.red, fontSize:13, background:"#ff444415", padding:"10px 16px", borderRadius:8 }}>⚠️ {error}</div>}
              {history.length > 0 && (
                <div style={{ marginTop:22, display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                  <Tag color={C.accent}>{Object.keys(db.captains||{}).length} كابتن محفوظ</Tag>
                  <Tag color={C.yellow}>{trainedCount} تحت المتابعة</Tag>
                  <Tag color={C.muted}>{history.length} جلسة سابقة</Tag>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ DASHBOARD ════ */}
        {view==="dashboard" && (
          <div style={{ padding:20 }}>
            {loading && <Spinner msg={loadMsg} />}
            {error && !loading && <div style={{ color:C.red, background:"#ff444415", padding:"12px 18px", borderRadius:10, margin:"18px 0", fontSize:14 }}>⚠️ {error}</div>}

            {!loading && analysis && (
              <>
                {/* Stats */}
                <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                  <StatCard label="نسبة الفرع" value={`${analysis.branchScore}%`} color={sc(analysis.branchScore)} sub={analysis.branchGrade} />
                  <StatCard label="إجمالي الكباتن" value={analysis.totalCaptains} />
                  <StatCard label="ممتاز / جيد" value={(analysis.captains||[]).filter(c=>c.score>=60).length} color={C.green} />
                  <StatCard label="يحتاج تدريب" value={(analysis.captains||[]).filter(c=>c.score>=40&&c.score<60).length} color={C.yellow} />
                  <StatCard label="يحتاج إيقاف" value={(analysis.captains||[]).filter(c=>c.score<40).length} color={C.red} />
                </div>

                {/* AI Summary */}
                <div className="ai" style={{ background:"linear-gradient(135deg,#00c6ff08,#0072ff08)", border:"1px solid #00c6ff30", borderRadius:12, padding:"14px 18px", marginBottom:16, borderRight:"4px solid #00c6ff" }}>
                  <div style={{ fontSize:11, color:C.accent, letterSpacing:2, marginBottom:6 }}>🤖 تحليل الذكاء الاصطناعي</div>
                  <div style={{ fontSize:14, lineHeight:1.75 }}>{analysis.summaryInsight}</div>
                </div>

                {/* Weak points */}
                <div className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
                  <div style={{ fontWeight:900, fontSize:15, color:C.orange, marginBottom:10 }}>⚠️ نقاط ضعف الفرع</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {(analysis.branchWeakPoints||[]).map((w,i) => (
                      <div key={i} style={{ background:"#ff910015", border:"1px solid #ff910040", borderRadius:7, padding:"5px 12px", fontSize:13, color:C.orange }}>{w}</div>
                    ))}
                  </div>
                </div>

                {/* Top / Bottom */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                  <div className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:14 }}>
                    <div style={{ fontWeight:900, fontSize:14, color:C.green, marginBottom:10 }}>🏆 أفضل الكباتن</div>
                    {(analysis.topPerformers||[]).map((n,i) => (
                      <div key={i} style={{ padding:"5px 0", borderBottom:i<2?`1px solid ${C.border}`:"none", fontSize:13 }}>
                        <span style={{ color:C.green, marginLeft:6, fontWeight:900 }}>#{i+1}</span>{n}
                      </div>
                    ))}
                  </div>
                  <div className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:14 }}>
                    <div style={{ fontWeight:900, fontSize:14, color:C.red, marginBottom:10 }}>🔴 مؤثرون سلباً</div>
                    {(analysis.bottomPerformers||[]).map((n,i) => (
                      <div key={i} style={{ padding:"5px 0", borderBottom:i<2?`1px solid ${C.border}`:"none", fontSize:13 }}>
                        <span style={{ color:C.red, marginLeft:6, fontWeight:900 }}>#{i+1}</span>{n}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Captain Table */}
                <div className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", marginBottom:16 }}>
                  <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                    <div style={{ fontWeight:900, fontSize:15, flex:1 }}>📋 تفاصيل الكباتن</div>
                    <input placeholder="🔍 بحث..." value={search} onChange={e=>setSearch(e.target.value)}
                      style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 12px", color:C.text, fontSize:13, outline:"none", width:140 }} />
                    {["all","excellent","good","training","stop"].map(f => (
                      <button key={f} onClick={()=>setFilter(f)}
                        style={{ padding:"5px 10px", borderRadius:6, border:"none", fontSize:12, fontWeight:700, background:filter===f?C.accent:C.surface, color:filter===f?"#000":C.muted, transition:"all .2s" }}>
                        {f==="all"?"الكل":f==="excellent"?"ممتاز ⭐":f==="good"?"جيد ✅":f==="training"?"تدريب 📚":"إيقاف 🚫"}
                      </button>
                    ))}
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table>
                      <thead>
                        <tr>
                          {["الكابتن","النتيجة","الحالة","نقاط القوة","نقاط الضعف","التوصية","تأثير الفرع","المتابعة"].map(h => <th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCaptains.map((c, i) => {
                          const dbCap = db.captains?.[c.name];
                          const snaps = dbCap?.snapshots || [];
                          const prev  = snaps.slice(-2)[0];
                          const cur   = snaps.slice(-1)[0];
                          const delta = prev && cur ? cur.score - prev.score : null;
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight:700, whiteSpace:"nowrap" }}>
                                {c.name}
                                {dbCap?.trainingFlag && <div style={{ marginTop:3 }}><Tag color={C.orange}>🎓 تدريب</Tag></div>}
                              </td>
                              <td style={{ minWidth:110 }}><ScoreBar score={c.score}/></td>
                              <td><span style={{ background:sbg(c.score), color:sc(c.score), padding:"3px 9px", borderRadius:5, fontSize:11, fontWeight:700, border:`1px solid ${sc(c.score)}40` }}>{tl(c.score)}</span></td>
                              <td style={{ fontSize:12, color:C.green, maxWidth:150 }}>{(c.strengths||[]).join(" • ")}</td>
                              <td style={{ fontSize:12, color:C.orange, maxWidth:150 }}>{(c.weaknesses||[]).join(" • ")}</td>
                              <td style={{ fontSize:12, color:C.muted, maxWidth:180 }}>{c.recommendation}</td>
                              <td><span style={{ color:c.impactOnBranch==="إيجابي"?C.green:c.impactOnBranch==="سلبي"?C.red:C.muted, fontWeight:700, fontSize:12 }}>{c.impactOnBranch==="إيجابي"?"▲ إيجابي":c.impactOnBranch==="سلبي"?"▼ سلبي":"◆ محايد"}</span></td>
                              <td><DeltaTag d={delta}/></td>
                            </tr>
                          );
                        })}
                        {filteredCaptains.length===0 && <tr><td colSpan={8} style={{ textAlign:"center", padding:32, color:C.muted }}>لا توجد نتائج</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display:"flex", justifyContent:"center" }}>
                  <button onClick={generatePlan} style={{ background:"linear-gradient(135deg,#00c6ff,#0072ff)", color:"#000", border:"none", borderRadius:10, padding:"12px 30px", fontWeight:900, fontSize:15, letterSpacing:1 }}>
                    🗓 توليد خطة التحسين
                  </button>
                </div>
              </>
            )}
            {!loading && !analysis && !error && (
              <div style={{ textAlign:"center", padding:80, color:C.muted }}>
                <div style={{ fontSize:44, marginBottom:14 }}>📂</div>
                <div>ارفع ملف Excel من قسم "رفع" لبدء التحليل</div>
              </div>
            )}
          </div>
        )}

        {/* ════ TRACKING ════ */}
        {view==="tracking" && (
          <div style={{ padding:20 }}>
            <div style={{ fontWeight:900, fontSize:24, marginBottom:6 }}>🎯 نظام التتبع والمتابعة</div>
            <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>مقارنة الأداء عبر الجلسات + تتبع ما بعد التدريب</div>

            {/* Summary stats */}
            <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
              <StatCard label="تحت التدريب" value={Object.values(db.captains||{}).filter(c=>c.trainingFlag).length} color={C.orange} />
              <StatCard label="تحسّنوا" value={trainedCaptains.filter(c=>c.delta>2).length} color={C.green} />
              <StatCard label="ثابتون" value={trainedCaptains.filter(c=>c.delta!==null&&Math.abs(c.delta)<=2).length} color={C.yellow} />
              <StatCard label="تدهوروا" value={trainedCaptains.filter(c=>c.delta<-2).length} color={C.red} />
              <StatCard label="إجمالي محفوظ" value={Object.keys(db.captains||{}).length} color={C.muted} />
            </div>

            {/* Filters */}
            <div style={{ marginBottom:12, display:"flex", gap:6, flexWrap:"wrap" }}>
              {[["all","الكل"],["trained","تحت التدريب 🎓"],["improved","تحسّن ✅"],["declined","تدهور ❌"]].map(([f,l]) => (
                <button key={f} onClick={()=>setTFilter(f)}
                  style={{ padding:"5px 12px", borderRadius:7, border:"none", fontSize:13, fontWeight:700, background:tFilter===f?C.accent:C.card, color:tFilter===f?"#000":C.muted, transition:"all .2s" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Post-training section */}
            {trainedCaptains.filter(c=>c.trainingFlag&&c.trainDelta!==null).length > 0 && (
              <div className="ai" style={{ background:"linear-gradient(135deg,#ff910010,#a855f710)", border:"1px solid #ff910040", borderRadius:12, padding:"14px 18px", marginBottom:14 }}>
                <div style={{ fontWeight:900, fontSize:15, color:C.orange, marginBottom:12 }}>📈 تحليل ما بعد التدريب</div>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {trainedCaptains.filter(c=>c.trainingFlag&&c.trainDelta!==null).map(c => (
                    <div key={c.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", minWidth:160 }}>
                      <div style={{ fontWeight:900, fontSize:13, marginBottom:6 }}>{c.id}</div>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                        <span className="mono" style={{ color:sc(c.trainingSnapshot?.score||0) }}>{c.trainingSnapshot?.score||"—"}</span>
                        <span style={{ color:C.muted }}>→</span>
                        <span className="mono" style={{ color:sc(c.latest?.score||0) }}>{c.latest?.score||"—"}</span>
                      </div>
                      <DeltaTag d={c.trainDelta}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tracking table */}
            {trainedCaptains.length === 0
              ? <div style={{ textAlign:"center", padding:60, color:C.muted }}><div style={{ fontSize:40, marginBottom:12 }}>📭</div><div>ارفع ملفين على الأقل لبدء المقارنة</div></div>
              : (
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
                <div style={{ overflowX:"auto" }}>
                  <table>
                    <thead>
                      <tr>{["الكابتن","قبل","بعد","التغيير","حالة التدريب","التحسن بعد التدريب","تاريخ التدريب","جلسات"].map(h=><th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {trainedCaptains.map(c => (
                        <>
                          <tr key={c.id} onClick={()=>setExpandedId(expandedId===c.id?null:c.id)} style={{ cursor:"pointer" }}>
                            <td style={{ fontWeight:700 }}>{c.id}</td>
                            <td><span className="mono" style={{ color:c.prev?sc(c.prev.score):C.muted }}>{c.prev?.score||"—"}</span></td>
                            <td><span className="mono" style={{ color:c.latest?sc(c.latest.score):C.muted, fontWeight:700 }}>{c.latest?.score||"—"}</span></td>
                            <td><DeltaTag d={c.delta}/></td>
                            <td>{c.trainingFlag?<Tag color={C.orange}>🎓 تحت التدريب</Tag>:<Tag color={C.green}>✅ لا يحتاج</Tag>}</td>
                            <td>{c.trainDelta!==null?<DeltaTag d={c.trainDelta}/>:<span style={{ color:C.muted }}>—</span>}</td>
                            <td style={{ fontSize:12, color:C.muted }}>{c.trainingDate?new Date(c.trainingDate).toLocaleDateString("ar-SA"):"—"}</td>
                            <td><span className="mono" style={{ color:C.accent, fontWeight:700 }}>{c.snapshots?.length||0}</span></td>
                          </tr>
                          {expandedId===c.id && (
                            <tr key={c.id+"_exp"}>
                              <td colSpan={8} style={{ background:C.surface, padding:"14px 16px" }}>
                                <div style={{ fontSize:12, color:C.accent, fontWeight:700, marginBottom:10 }}>تاريخ الأداء — {c.id}</div>
                                <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:56, overflowX:"auto", marginBottom:10 }}>
                                  {(c.snapshots||[]).map((s,i) => (
                                    <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, minWidth:34 }}>
                                      <span className="mono" style={{ fontSize:9, color:sc(s.score) }}>{s.score}</span>
                                      <div style={{ width:26, height:`${s.score*0.5}px`, background:sc(s.score), borderRadius:"3px 3px 0 0", minHeight:3 }}/>
                                      <span style={{ fontSize:8, color:C.muted }}>#{i+1}</span>
                                    </div>
                                  ))}
                                </div>
                                {c.trainingSnapshot && (
                                  <div style={{ display:"flex", gap:14 }}>
                                    <div style={{ background:C.card, border:`1px solid ${C.orange}40`, borderRadius:8, padding:"8px 14px" }}>
                                      <div style={{ fontSize:10, color:C.orange, marginBottom:3 }}>قبل التدريب</div>
                                      <span className="mono" style={{ fontSize:20, fontWeight:900, color:C.orange }}>{c.trainingSnapshot.score}</span>
                                    </div>
                                    {c.latest && (
                                      <div style={{ background:C.card, border:`1px solid ${sc(c.latest.score)}40`, borderRadius:8, padding:"8px 14px" }}>
                                        <div style={{ fontSize:10, color:sc(c.latest.score), marginBottom:3 }}>الآن</div>
                                        <span className="mono" style={{ fontSize:20, fontWeight:900, color:sc(c.latest.score) }}>{c.latest.score}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ REPORTS ════ */}
        {view==="reports" && (
          <div style={{ padding:20 }}>
            <div style={{ fontWeight:900, fontSize:24, marginBottom:18 }}>📋 سجل التقارير</div>
            {history.length === 0
              ? <div style={{ textAlign:"center", padding:80, color:C.muted }}><div style={{ fontSize:44, marginBottom:14 }}>📭</div><div>لا توجد تقارير بعد</div></div>
              : (
              <>
                {trend !== null && (
                  <div className="ai" style={{ background:trend>=0?"#00e67610":"#ff444410", border:`1px solid ${trend>=0?C.green:C.red}40`, borderRadius:12, padding:"13px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:26 }}>{trend>=0?"📈":"📉"}</span>
                    <div>
                      <div style={{ fontWeight:900, color:trend>=0?C.green:C.red }}>{trend>=0?`تحسن +${trend} نقطة`:`انخفاض ${trend} نقطة`}</div>
                      <div style={{ fontSize:12, color:C.muted }}>مقارنة بالتقرير السابق</div>
                    </div>
                  </div>
                )}

                {history.length > 1 && (
                  <div className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
                    <div style={{ fontWeight:900, fontSize:14, marginBottom:12 }}>📈 تطور نسبة الفرع</div>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:80 }}>
                      {history.map((h,i) => (
                        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                          <div className="mono" style={{ fontSize:9, color:sc(h.branchScore) }}>{h.branchScore}%</div>
                          <div style={{ width:"100%", height:`${h.branchScore}%`, background:sc(h.branchScore), borderRadius:"3px 3px 0 0", minHeight:3 }}/>
                          <div style={{ fontSize:8, color:C.muted }}>{h.date.split("/").slice(0,2).join("/")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[...history].reverse().map((h, i) => (
                    <div key={i} className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"13px 18px", cursor:"pointer" }}
                      onClick={()=>setExpandedId(expandedId===h.id?null:h.id)}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ width:48, height:48, borderRadius:9, background:sbg(h.branchScore), display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <div style={{ fontWeight:900, fontSize:16, color:sc(h.branchScore) }}>{h.branchScore}%</div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700 }}>تقرير {h.date}</div>
                          <div style={{ fontSize:12, color:C.muted }}>{h.totalCaptains} كابتن • {h.branchGrade}</div>
                        </div>
                        <div style={{ color:C.muted }}>{expandedId===h.id?"▲":"▼"}</div>
                      </div>
                      {expandedId===h.id && (
                        <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:13, color:C.muted, lineHeight:1.7, marginBottom:10 }}>{h.summaryInsight}</div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                            <div>
                              <div style={{ fontSize:11, color:C.green, marginBottom:4, fontWeight:700 }}>🏆 الأفضل</div>
                              {(h.topPerformers||[]).map((n,j)=><div key={j} style={{ fontSize:12, color:C.muted }}>{n}</div>)}
                            </div>
                            <div>
                              <div style={{ fontSize:11, color:C.red, marginBottom:4, fontWeight:700 }}>⚠️ يحتاج اهتمام</div>
                              {(h.bottomPerformers||[]).map((n,j)=><div key={j} style={{ fontSize:12, color:C.muted }}>{n}</div>)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════ PLAN ════ */}
        {view==="plan" && (
          <div style={{ padding:20 }}>
            <div style={{ fontWeight:900, fontSize:24, marginBottom:18 }}>🗓 خطة التحسين</div>
            {planLoading && <Spinner msg="يولد خطة التحسين..." />}
            {!planLoading && !plan && (
              <div style={{ textAlign:"center", padding:80, color:C.muted }}>
                <div style={{ fontSize:44, marginBottom:14 }}>📋</div>
                <div style={{ marginBottom:22 }}>ارفع ملف أولاً ثم اضغط "توليد خطة التحسين" من الداشبورد</div>
                {analysis && (
                  <button onClick={generatePlan} style={{ background:"linear-gradient(135deg,#00c6ff,#0072ff)", color:"#000", border:"none", borderRadius:10, padding:"12px 28px", fontWeight:900, fontSize:15 }}>
                    🗓 توليد الخطة الآن
                  </button>
                )}
              </div>
            )}
            {!planLoading && plan && (
              <>
                {/* Immediate actions */}
                <div className="ai" style={{ background:"linear-gradient(135deg,#ff444410,#ff910010)", border:"1px solid #ff444440", borderRadius:12, padding:"14px 18px", marginBottom:14 }}>
                  <div style={{ fontWeight:900, fontSize:15, color:C.red, marginBottom:12 }}>🚨 إجراءات فورية</div>
                  {(plan.immediateActions||[]).map((a,i) => (
                    <div key={i} style={{ display:"flex", gap:8, marginBottom:8, fontSize:14 }}>
                      <span style={{ color:C.red, fontWeight:900, minWidth:18 }}>{i+1}.</span><span>{a}</span>
                    </div>
                  ))}
                </div>

                {/* Weekly plan */}
                <div className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", marginBottom:14 }}>
                  <div style={{ fontWeight:900, fontSize:15, marginBottom:12 }}>📅 الخطة الأسبوعية</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:10 }}>
                    {(plan.weeklyPlan||[]).map((day, i) => (
                      <div key={i} style={{ background:C.surface, borderRadius:9, padding:12, border:`1px solid ${C.border}` }}>
                        <div style={{ fontWeight:900, color:C.accent, marginBottom:8, fontSize:14 }}>{day.day}</div>
                        {(day.actions||[]).map((a,j) => (
                          <div key={j} style={{ fontSize:12, color:C.muted, marginBottom:5, paddingRight:8, borderRight:`2px solid ${C.border}` }}>{a}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* KPI targets */}
                {plan.kpiTargets && (
                  <div className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", marginBottom:14, overflowX:"auto" }}>
                    <div style={{ fontWeight:900, fontSize:15, marginBottom:12 }}>📊 أهداف المؤشرات</div>
                    <table>
                      <thead><tr>{["المؤشر","الحالي","الهدف (30 يوم)"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {plan.kpiTargets.map((k,i) => (
                          <tr key={i}>
                            <td style={{ fontWeight:700 }}>{k.metric}</td>
                            <td className="mono" style={{ color:C.orange }}>{k.current}</td>
                            <td className="mono" style={{ color:C.green, fontWeight:700 }}>{k.target}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Training + Expected */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div className="ai" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px" }}>
                    <div style={{ fontWeight:900, fontSize:14, color:C.yellow, marginBottom:10 }}>📚 خطة التدريب</div>
                    <div style={{ fontSize:13, color:C.muted, lineHeight:1.8 }}>{plan.trainingPlan}</div>
                  </div>
                  <div className="ai" style={{ background:"linear-gradient(135deg,#00e67610,#00c6ff10)", border:"1px solid #00e67640", borderRadius:12, padding:"14px 18px" }}>
                    <div style={{ fontWeight:900, fontSize:14, color:C.green, marginBottom:10 }}>✅ التحسن المتوقع</div>
                    <div style={{ fontSize:13, lineHeight:1.8 }}>{plan.expectedImprovement}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </>
  );
}
