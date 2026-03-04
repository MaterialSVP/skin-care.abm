import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── BRAND DEFINITIONS ───────────────────────────────────────────────────────
const BRANDS = [
  { id: "olay",        name: "Olay",          color: "#E8A87C", tier: "mass",    equity: 0.72, price: 18, innovation: 0.6,  distribution: 0.9  },
  { id: "cerave",      name: "CeraVe",        color: "#7EB8C9", tier: "mass",    equity: 0.78, price: 16, innovation: 0.7,  distribution: 0.88 },
  { id: "neutrogena",  name: "Neutrogena",    color: "#F2C94C", tier: "mass",    equity: 0.68, price: 15, innovation: 0.55, distribution: 0.92 },
  { id: "lorealparis", name: "L'Oréal Paris", color: "#BB6BD9", tier: "mass",    equity: 0.70, price: 22, innovation: 0.65, distribution: 0.85 },
  { id: "aveeno",      name: "Aveeno",        color: "#A8C69F", tier: "mass",    equity: 0.65, price: 17, innovation: 0.5,  distribution: 0.82 },
  { id: "clinique",    name: "Clinique",      color: "#56CCF2", tier: "prestige",equity: 0.80, price: 45, innovation: 0.72, distribution: 0.60 },
  { id: "estee",       name: "Estée Lauder",  color: "#F2994A", tier: "prestige",equity: 0.85, price: 65, innovation: 0.75, distribution: 0.50 },
  { id: "skinceuticals",name:"SkinCeuticals", color: "#EB5757", tier: "prestige",equity: 0.88, price: 80, innovation: 0.90, distribution: 0.40 },
  { id: "cetaphil",    name: "Cetaphil",      color: "#6FCF97", tier: "mass",    equity: 0.62, price: 14, innovation: 0.40, distribution: 0.87 },
  { id: "tatcha",      name: "Tatcha",        color: "#9B51E0", tier: "luxury",  equity: 0.82, price: 95, innovation: 0.80, distribution: 0.30 },
];

// ─── SEGMENT DEFINITIONS ─────────────────────────────────────────────────────
const SEGMENTS = [
  { id: "budget_basics",    label: "Budget Basics",    share: 0.22, priceWeight: 0.5,  equityWeight: 0.2, innovWeight: 0.1, distWeight: 0.2, socialWeight: 0.3, loyaltyRate: 0.55 },
  { id: "value_seekers",    label: "Value Seekers",    share: 0.18, priceWeight: 0.3,  equityWeight: 0.3, innovWeight: 0.2, distWeight: 0.2, socialWeight: 0.4, loyaltyRate: 0.50 },
  { id: "ingredient_nerds", label: "Ingredient Nerds", share: 0.15, priceWeight: 0.1,  equityWeight: 0.2, innovWeight: 0.5, distWeight: 0.1, socialWeight: 0.2, loyaltyRate: 0.60 },
  { id: "brand_loyalists",  label: "Brand Loyalists",  share: 0.20, priceWeight: 0.1,  equityWeight: 0.5, innovWeight: 0.1, distWeight: 0.1, socialWeight: 0.3, loyaltyRate: 0.80 },
  { id: "prestige_seekers", label: "Prestige Seekers", share: 0.13, priceWeight: -0.1, equityWeight: 0.4, innovWeight: 0.2, distWeight: 0.1, socialWeight: 0.4, loyaltyRate: 0.65 },
  { id: "naturals",         label: "Clean & Natural",  share: 0.12, priceWeight: 0.15, equityWeight: 0.2, innovWeight: 0.3, distWeight: 0.1, socialWeight: 0.5, loyaltyRate: 0.55 },
];

// ─── API HELPER — routes through Vercel serverless proxy ─────────────────────
async function callClaude(body) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, ...body }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// ─── SIMULATION ENGINE ────────────────────────────────────────────────────────
function computeUtility(brand, seg, modifiers = {}) {
  const b = { ...brand, ...(modifiers[brand.id] || {}) };
  const maxPrice = 95;
  const priceScore = 1 - b.price / maxPrice;
  return (
    seg.priceWeight  * priceScore +
    seg.equityWeight * b.equity +
    seg.innovWeight  * b.innovation +
    seg.distWeight   * b.distribution
  );
}

function softmaxChoice(utilities, temperature = 3) {
  const expU = utilities.map(u => Math.exp(u * temperature));
  const total = expU.reduce((a, b) => a + b, 0);
  const probs = expU.map(u => u / total);
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (r <= cum) return i;
  }
  return probs.length - 1;
}

function initAgents(n = 500) {
  const agents = [];
  let id = 0;
  for (const seg of SEGMENTS) {
    const count = Math.round(n * seg.share);
    for (let i = 0; i < count; i++) {
      const utilities = BRANDS.map(b => Math.max(0.01, computeUtility(b, seg)));
      const idx = softmaxChoice(utilities);
      agents.push({
        id: id++,
        segment: seg.id,
        brand: BRANDS[idx].id,
        loyalty: 0.5 + Math.random() * 0.3,
      });
    }
  }
  return agents;
}

function buildSocialMap(agents, avgConnections = 5) {
  const map = {};
  for (const a of agents) {
    map[a.id] = [];
    const n = Math.round(avgConnections + (Math.random() - 0.5) * 4);
    const pool = agents.filter(x => x.id !== a.id);
    for (let i = 0; i < n && i < pool.length; i++) {
      map[a.id].push(pool[Math.floor(Math.random() * pool.length)].id);
    }
  }
  return map;
}

function simulateTick(agents, modifiers = {}, socialMap = {}) {
  const segMap = Object.fromEntries(SEGMENTS.map(s => [s.id, s]));
  return agents.map(agent => {
    const s = segMap[agent.segment];
    if (Math.random() < agent.loyalty * s.loyaltyRate) return { ...agent };

    // social influence boost
    const socialBoost = {};
    for (const nId of (socialMap[agent.id] || [])) {
      const n = agents[nId];
      if (n) socialBoost[n.brand] = (socialBoost[n.brand] || 0) + s.socialWeight / (socialMap[agent.id].length || 1);
    }

    const utilities = BRANDS.map(b => {
      const u = computeUtility(b, s, modifiers);
      return u + (socialBoost[b.id] || 0) * 0.15;
    });

    const idx = softmaxChoice(utilities);
    const chosen = BRANDS[idx].id;
    const newLoyalty = chosen === agent.brand
      ? Math.min(0.95, agent.loyalty + 0.02)
      : Math.max(0.20, agent.loyalty - 0.10);

    return { ...agent, brand: chosen, loyalty: newLoyalty };
  });
}

function getMarketShare(agents) {
  const counts = Object.fromEntries(BRANDS.map(b => [b.id, 0]));
  for (const a of agents) counts[a.brand]++;
  const total = agents.length;
  return Object.fromEntries(BRANDS.map(b => [b.id, +(counts[b.id] / total * 100).toFixed(1)]));
}

// ─── CLAUDE-POWERED SCENARIO INTERPRETER ─────────────────────────────────────
async function interpretScenario(userQuery, currentShare) {
  const shareStr = Object.entries(currentShare)
    .map(([id, pct]) => `${BRANDS.find(b => b.id === id)?.name}: ${pct}%`)
    .join(", ");

  const data = await callClaude({
    system: `You are an expert consumer insights strategist embedded in an agent-based simulation of the skincare market.
The simulation has 500 consumer agents across 6 psychographic segments, and 10 competing brands (Olay, CeraVe, Neutrogena, L'Oréal Paris, Aveeno, Clinique, Estée Lauder, SkinCeuticals, Cetaphil, Tatcha).

Current market shares: ${shareStr}

Brand IDs: olay, cerave, neutrogena, lorealparis, aveeno, clinique, estee, skinceuticals, cetaphil, tatcha

Each brand has modifiable attributes (0–1 scale except price in USD):
- equity, price, innovation, distribution

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "modifiers": { "brandId": { "equity": 0.0-1.0, "price": number, "innovation": 0.0-1.0, "distribution": 0.0-1.0 } },
  "narrative": "2-3 sentence strategic interpretation",
  "scenarioTitle": "Short title (5 words max)"
}
Only include brands/attributes that actually change. Be bold to show visible effects.`,
    messages: [{ role: "user", content: userQuery }],
  });

  const text = data.content?.find(c => c.type === "text")?.text || "{}";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { modifiers: {}, narrative: "Scenario applied.", scenarioTitle: "Custom Scenario" };
  }
}

async function getStrategicInsight(shareHistory, activeScenario) {
  const latest   = shareHistory[shareHistory.length - 1] || {};
  const earliest = shareHistory[0] || {};
  const changes = BRANDS
    .map(b => ({ name: b.name, start: earliest[b.id] || 0, end: latest[b.id] || 0, delta: ((latest[b.id] || 0) - (earliest[b.id] || 0)).toFixed(1) }))
    .sort((a, b) => b.delta - a.delta);

  const data = await callClaude({
    messages: [{
      role: "user",
      content: `You are a senior brand strategist. Analyze these skincare simulation results.

Active scenario: "${activeScenario || 'Baseline'}"

Market share shifts:
${changes.map(c => `${c.name}: ${c.start}% → ${c.end}% (${c.delta > 0 ? '+' : ''}${c.delta}pp)`).join('\n')}

Write 3–4 sentences of incisive strategic commentary. What's the most important finding? Who won, who lost, and why does it matter for brand strategy? Be specific. No bullet points.`,
    }],
  });

  return data.content?.find(c => c.type === "text")?.text || "";
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App() {
  const [agents,           setAgents]           = useState([]);
  const [socialMap,        setSocialMap]         = useState({});
  const [shareHistory,     setShareHistory]      = useState([]);
  const [tick,             setTick]              = useState(0);
  const [running,          setRunning]           = useState(false);
  const [modifiers,        setModifiers]         = useState({});
  const [scenarioQuery,    setScenarioQuery]     = useState("");
  const [scenarioLoading,  setScenarioLoading]   = useState(false);
  const [activeScenario,   setActiveScenario]    = useState(null);
  const [scenarioNarrative,setScenarioNarrative] = useState("");
  const [insight,          setInsight]           = useState("");
  const [insightLoading,   setInsightLoading]    = useState(false);

  const agentsRef    = useRef([]);
  const modifiersRef = useRef({});
  const socialMapRef = useRef({});
  const intervalRef  = useRef(null);

  useEffect(() => { agentsRef.current    = agents;   }, [agents]);
  useEffect(() => { modifiersRef.current = modifiers; }, [modifiers]);
  useEffect(() => { socialMapRef.current = socialMap; }, [socialMap]);

  const init = useCallback(() => {
    const a  = initAgents(500);
    const sm = buildSocialMap(a);
    agentsRef.current    = a;
    socialMapRef.current = sm;
    setAgents(a);
    setSocialMap(sm);
    const share = getMarketShare(a);
    setShareHistory([share]);
    setTick(0);
    setModifiers({});
    modifiersRef.current = {};
    setActiveScenario(null);
    setScenarioNarrative("");
    setInsight("");
  }, []);

  useEffect(() => { init(); }, []);

  const step = useCallback(() => {
    const next  = simulateTick(agentsRef.current, modifiersRef.current, socialMapRef.current);
    agentsRef.current = next;
    setAgents([...next]);
    const share = getMarketShare(next);
    setShareHistory(h => [...h.slice(-39), share]);
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    if (running) { intervalRef.current = setInterval(step, 300); }
    else         { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [running, step]);

  const handleScenario = async () => {
    if (!scenarioQuery.trim()) return;
    setScenarioLoading(true);
    setRunning(false);
    const currentShare = getMarketShare(agentsRef.current);
    const result = await interpretScenario(scenarioQuery, currentShare);
    setModifiers(result.modifiers || {});
    modifiersRef.current = result.modifiers || {};
    setActiveScenario(result.scenarioTitle || "Custom Scenario");
    setScenarioNarrative(result.narrative || "");
    setScenarioQuery("");
    setScenarioLoading(false);
  };

  const handleInsight = async () => {
    if (shareHistory.length < 2) return;
    setInsightLoading(true);
    const text = await getStrategicInsight(shareHistory, activeScenario);
    setInsight(text);
    setInsightLoading(false);
  };

  const resetScenario = () => {
    setModifiers({});
    modifiersRef.current = {};
    setActiveScenario(null);
    setScenarioNarrative("");
    setInsight("");
  };

  const chartData    = shareHistory.map((s, i) => ({ tick: i, ...s }));
  const currentShare = shareHistory[shareHistory.length - 1] || {};
  const sortedBrands = [...BRANDS].sort((a, b) => (currentShare[b.id] || 0) - (currentShare[a.id] || 0));

  const PRESETS = [
    "Olay launches a clinically-proven retinol serum at $35, backed by a major influencer campaign",
    "CeraVe gets a viral TikTok endorsement from dermatologists, tripling awareness among Gen Z",
    "SkinCeuticals drops prices by 30% and expands into mass retail distribution",
    "A clean beauty trend causes consumers to question synthetic ingredients in Neutrogena and L'Oréal",
    "Tatcha launches a mass-market diffusion line at $25, competing directly with Olay",
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0D0D0F", color:"#F0EDE8", fontFamily:"'DM Serif Display', Georgia, serif", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#1a1a1e} ::-webkit-scrollbar-thumb{background:#444;border-radius:2px}
        .brand-bar{transition:width 0.6s cubic-bezier(0.4,0,0.2,1)}
        .pulse{animation:pulse 2s infinite} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .fade-in{animation:fadeIn 0.4s ease} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        textarea,input{outline:none;resize:none} button{cursor:pointer;font-family:inherit}
        .chip{transition:all 0.2s;border:1px solid #333;background:#18181c;padding:8px 14px;border-radius:4px;font-family:'DM Sans',sans-serif;font-size:12px;color:#aaa;text-align:left;cursor:pointer}
        .chip:hover{border-color:#E8A87C;color:#F0EDE8;background:#1e1e22}
      `}</style>

      {/* Header */}
      <div style={{padding:"32px 40px 24px",borderBottom:"1px solid #1e1e22",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#666",letterSpacing:"0.15em",marginBottom:8}}>MATERIAL+ INTELLIGENCE LAB</div>
          <h1 style={{fontSize:"clamp(22px,3vw,34px)",fontWeight:400,letterSpacing:"-0.02em",lineHeight:1.1}}>
            Skincare Market<br/><span style={{fontStyle:"italic",color:"#E8A87C"}}>Consumer Simulation</span>
          </h1>
        </div>
        <div style={{textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:11,color:"#555"}}>
          <div>{agents.length || 500} agents · {BRANDS.length} brands</div>
          <div style={{marginTop:4}}>tick <span style={{color:"#E8A87C"}}>{String(tick).padStart(4,"0")}</span></div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",minHeight:"calc(100vh - 105px)"}}>

        {/* LEFT */}
        <div style={{padding:"32px 40px",borderRight:"1px solid #1e1e22"}}>

          {/* Controls */}
          <div style={{display:"flex",gap:12,marginBottom:28,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={() => setRunning(r => !r)} style={{padding:"10px 28px",background:running?"#2a1a1a":"#E8A87C",color:running?"#E8A87C":"#0D0D0F",border:running?"1px solid #E8A87C":"none",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.1em",fontWeight:500}}>
              {running ? "⏸ PAUSE" : "▶ RUN"}
            </button>
            <button onClick={step} disabled={running} style={{padding:"10px 20px",background:"transparent",color:running?"#444":"#888",border:"1px solid",borderColor:running?"#333":"#555",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.1em"}}>STEP</button>
            <button onClick={() => { setRunning(false); setTimeout(init, 50); }} style={{padding:"10px 20px",background:"transparent",color:"#666",border:"1px solid #333",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.1em"}}>RESET</button>
            {activeScenario && (
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
                <span style={{padding:"6px 14px",background:"#1a1208",border:"1px solid #E8A87C",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:11,color:"#E8A87C"}}>⚡ {activeScenario}</span>
                <button onClick={resetScenario} style={{padding:"6px 10px",background:"transparent",border:"1px solid #333",borderRadius:3,color:"#666",fontSize:11,fontFamily:"'DM Mono',monospace"}}>✕</button>
              </div>
            )}
          </div>

          {/* Scenario narrative */}
          {scenarioNarrative && (
            <div className="fade-in" style={{marginBottom:24,padding:"16px 20px",background:"#12100e",border:"1px solid #2a2018",borderLeft:"3px solid #E8A87C",borderRadius:4}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#E8A87C",letterSpacing:"0.12em",marginBottom:8}}>SCENARIO INTERPRETATION</div>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#ccc",lineHeight:1.6}}>{scenarioNarrative}</p>
            </div>
          )}

          {/* Chart */}
          <div style={{marginBottom:28}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555",letterSpacing:"0.12em",marginBottom:14}}>MARKET SHARE DYNAMICS</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{top:5,right:10,bottom:5,left:-20}}>
                <XAxis dataKey="tick" tick={{fill:"#444",fontSize:10,fontFamily:"DM Mono"}} tickLine={false} axisLine={{stroke:"#222"}}/>
                <YAxis tick={{fill:"#444",fontSize:10,fontFamily:"DM Mono"}} tickLine={false} axisLine={false} domain={[0,"auto"]}/>
                <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:4,fontFamily:"DM Mono",fontSize:11}} labelStyle={{color:"#666"}} formatter={v=>[`${v}%`]}/>
                {BRANDS.map(b => (
                  <Line key={b.id} type="monotone" dataKey={b.id} stroke={b.color} dot={false} strokeWidth={1.5} name={b.name}
                    strokeOpacity={Object.keys(modifiers).length===0||modifiers[b.id]?1:0.25}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Share bars */}
          <div style={{marginBottom:28}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555",letterSpacing:"0.12em",marginBottom:14}}>CURRENT SHARE RANKING</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {sortedBrands.map((b,i) => {
                const pct    = currentShare[b.id] || 0;
                const maxPct = currentShare[sortedBrands[0].id] || 1;
                const hasmod = !!modifiers[b.id];
                return (
                  <div key={b.id} style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555",width:16,textAlign:"right"}}>{i+1}</div>
                    <div style={{width:118,fontFamily:"'DM Sans',sans-serif",fontSize:12,color:hasmod?"#E8A87C":"#aaa"}}>{b.name}{hasmod?" ⚡":""}</div>
                    <div style={{flex:1,height:6,background:"#1a1a1e",borderRadius:3,overflow:"hidden"}}>
                      <div className="brand-bar" style={{height:"100%",width:`${(pct/maxPct)*100}%`,background:b.color,borderRadius:3,opacity:hasmod||Object.keys(modifiers).length===0?1:0.3}}/>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:hasmod?"#E8A87C":"#666",width:40,textAlign:"right"}}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategic insight */}
          {shareHistory.length > 3 && (
            <div>
              <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555",letterSpacing:"0.12em"}}>STRATEGIC ANALYSIS</div>
                <button onClick={handleInsight} disabled={insightLoading} style={{padding:"5px 14px",background:"transparent",border:"1px solid #333",borderRadius:3,color:insightLoading?"#444":"#888",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.1em"}}>
                  {insightLoading ? <span className="pulse">ANALYZING…</span> : "GENERATE INSIGHT →"}
                </button>
              </div>
              {insight && (
                <div className="fade-in" style={{padding:"16px 20px",background:"#0e1014",border:"1px solid #1e2530",borderLeft:"3px solid #56CCF2",borderRadius:4}}>
                  <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#ccc",lineHeight:1.7,fontStyle:"italic"}}>{insight}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Scenario Lab */}
        <div style={{padding:"32px 28px",background:"#0a0a0c"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555",letterSpacing:"0.15em",marginBottom:20}}>SCENARIO LAB</div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#666",lineHeight:1.6,marginBottom:20}}>
            Describe any market scenario in plain language. Claude will translate it into simulation parameters.
          </p>

          <textarea value={scenarioQuery} onChange={e=>setScenarioQuery(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleScenario();}}}
            placeholder="e.g. Olay launches a premium anti-aging line at $40 with heavy TV advertising…"
            rows={4}
            style={{width:"100%",padding:"14px",background:"#13131a",border:"1px solid #2a2a35",borderRadius:4,color:"#F0EDE8",fontFamily:"'DM Sans',sans-serif",fontSize:12,lineHeight:1.6,marginBottom:12}}
          />

          <button onClick={handleScenario} disabled={scenarioLoading||!scenarioQuery.trim()} style={{width:"100%",padding:"12px",background:scenarioLoading||!scenarioQuery.trim()?"#1a1a1e":"#E8A87C",color:scenarioLoading||!scenarioQuery.trim()?"#444":"#0D0D0F",border:"none",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.1em",fontWeight:500,marginBottom:24}}>
            {scenarioLoading ? <span className="pulse">INTERPRETING…</span> : "APPLY SCENARIO →"}
          </button>

          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#444",letterSpacing:"0.12em",marginBottom:12}}>EXAMPLE SCENARIOS</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:32}}>
            {PRESETS.map((p,i) => <button key={i} className="chip" onClick={()=>setScenarioQuery(p)}>{p}</button>)}
          </div>

          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#444",letterSpacing:"0.12em",marginBottom:12}}>CONSUMER SEGMENTS</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:28}}>
            {SEGMENTS.map(s => {
              const count = agents.filter(a=>a.segment===s.id).length || Math.round(500*s.share);
              return (
                <div key={s.id} style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#777"}}>{s.label}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555"}}>{count}</span>
                </div>
              );
            })}
          </div>

          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#444",letterSpacing:"0.12em",marginBottom:12}}>BRAND KEY</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 12px"}}>
            {BRANDS.map(b => (
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:b.color,flexShrink:0}}/>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#666"}}>{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
