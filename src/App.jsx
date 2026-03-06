import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

// ─── BRANDS ──────────────────────────────────────────────────────────────────
const BRANDS = [
  { id: "olay",         name: "Olay",          color: "#E8A87C", tier: "mass",    equity: 0.72, price: 18, innovation: 0.60, distribution: 0.90, bassP: 0.025, bassQ: 0.38 },
  { id: "cerave",       name: "CeraVe",        color: "#7EB8C9", tier: "mass",    equity: 0.78, price: 16, innovation: 0.70, distribution: 0.88, bassP: 0.020, bassQ: 0.45 },
  { id: "neutrogena",   name: "Neutrogena",    color: "#F2C94C", tier: "mass",    equity: 0.68, price: 15, innovation: 0.55, distribution: 0.92, bassP: 0.030, bassQ: 0.35 },
  { id: "lorealparis",  name: "L'Oréal Paris", color: "#BB6BD9", tier: "mass",    equity: 0.70, price: 22, innovation: 0.65, distribution: 0.85, bassP: 0.022, bassQ: 0.36 },
  { id: "aveeno",       name: "Aveeno",        color: "#A8C69F", tier: "mass",    equity: 0.65, price: 17, innovation: 0.50, distribution: 0.82, bassP: 0.018, bassQ: 0.30 },
  { id: "clinique",     name: "Clinique",      color: "#56CCF2", tier: "prestige",equity: 0.80, price: 45, innovation: 0.72, distribution: 0.60, bassP: 0.015, bassQ: 0.32 },
  { id: "estee",        name: "Estée Lauder",  color: "#F2994A", tier: "prestige",equity: 0.85, price: 65, innovation: 0.75, distribution: 0.50, bassP: 0.012, bassQ: 0.28 },
  { id: "skinceuticals",name: "SkinCeuticals", color: "#EB5757", tier: "prestige",equity: 0.88, price: 80, innovation: 0.90, distribution: 0.40, bassP: 0.010, bassQ: 0.42 },
  { id: "cetaphil",     name: "Cetaphil",      color: "#6FCF97", tier: "mass",    equity: 0.62, price: 14, innovation: 0.40, distribution: 0.87, bassP: 0.020, bassQ: 0.28 },
  { id: "tatcha",       name: "Tatcha",        color: "#9B51E0", tier: "luxury",  equity: 0.82, price: 95, innovation: 0.80, distribution: 0.30, bassP: 0.008, bassQ: 0.50 },
];

// ─── SEGMENTS ─────────────────────────────────────────────────────────────────
const SEGMENTS = [
  { id: "budget_basics",    label: "Budget Basics",    share: 0.22, priceWeight: 0.50, equityWeight: 0.20, innovWeight: 0.10, distWeight: 0.20, socialWeight: 0.30, loyaltyRate: 0.55, tierAffinity: "mass"     },
  { id: "value_seekers",    label: "Value Seekers",    share: 0.18, priceWeight: 0.30, equityWeight: 0.30, innovWeight: 0.20, distWeight: 0.20, socialWeight: 0.40, loyaltyRate: 0.50, tierAffinity: "mass"     },
  { id: "ingredient_nerds", label: "Ingredient Nerds", share: 0.15, priceWeight: 0.10, equityWeight: 0.20, innovWeight: 0.50, distWeight: 0.10, socialWeight: 0.20, loyaltyRate: 0.60, tierAffinity: "prestige" },
  { id: "brand_loyalists",  label: "Brand Loyalists",  share: 0.20, priceWeight: 0.10, equityWeight: 0.50, innovWeight: 0.10, distWeight: 0.10, socialWeight: 0.30, loyaltyRate: 0.80, tierAffinity: "mass"     },
  { id: "prestige_seekers", label: "Prestige Seekers", share: 0.13, priceWeight:-0.10, equityWeight: 0.40, innovWeight: 0.20, distWeight: 0.10, socialWeight: 0.40, loyaltyRate: 0.65, tierAffinity: "luxury"   },
  { id: "naturals",         label: "Clean & Natural",  share: 0.12, priceWeight: 0.15, equityWeight: 0.20, innovWeight: 0.30, distWeight: 0.10, socialWeight: 0.50, loyaltyRate: 0.55, tierAffinity: "mass"     },
];

// ─── TIER CONFIG ──────────────────────────────────────────────────────────────
const TIERS = {
  mass:     { label: "Mass",     color: "#7EB8C9", baseEntryRate: 0.04,  baseExitRate: 0.010, latentShare: 0.12 },
  prestige: { label: "Prestige", color: "#E8A87C", baseEntryRate: 0.02,  baseExitRate: 0.015, latentShare: 0.10 },
  luxury:   { label: "Luxury",   color: "#9B51E0", baseEntryRate: 0.01,  baseExitRate: 0.020, latentShare: 0.08 },
};

const TOTAL_AGENTS = 650;

// ─── API ──────────────────────────────────────────────────────────────────────
async function callClaude(body) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1200, ...body }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── SIMULATION ENGINE ────────────────────────────────────────────────────────
function computeUtility(brand, seg, brandMods = {}) {
  const b = { ...brand, ...(brandMods[brand.id] || {}) };
  const priceScore = 1 - b.price / 95;
  return (
    seg.priceWeight  * priceScore +
    seg.equityWeight * b.equity +
    seg.innovWeight  * b.innovation +
    seg.distWeight   * b.distribution
  );
}

function softmax(utilities, temp = 3) {
  const expU = utilities.map(u => Math.exp(u * temp));
  const total = expU.reduce((a, b) => a + b, 0);
  const probs = expU.map(u => u / total);
  let r = Math.random(), cum = 0;
  for (let i = 0; i < probs.length; i++) { cum += probs[i]; if (r <= cum) return i; }
  return probs.length - 1;
}

function initAgents() {
  const agents = [];
  let id = 0;

  // Active buyers (~500)
  for (const seg of SEGMENTS) {
    const count = Math.round(TOTAL_AGENTS * 0.77 * seg.share);
    for (let i = 0; i < count; i++) {
      const utils = BRANDS.map(b => Math.max(0.01, computeUtility(b, seg)));
      const idx = softmax(utils);
      const awareCount = 4 + Math.floor(Math.random() * 4);
      const awareness = new Set([BRANDS[idx].id]);
      while (awareness.size < Math.min(awareCount, BRANDS.length)) {
        awareness.add(BRANDS[Math.floor(Math.random() * BRANDS.length)].id);
      }
      agents.push({ id: id++, segment: seg.id, status: "active", brand: BRANDS[idx].id, loyalty: 0.5 + Math.random() * 0.3, awareness: [...awareness] });
    }
  }

  // Latent non-buyers (~150)
  for (const [tierId, tierCfg] of Object.entries(TIERS)) {
    const count = Math.round(TOTAL_AGENTS * tierCfg.latentShare);
    for (let i = 0; i < count; i++) {
      const awareCount = Math.floor(Math.random() * 3);
      const awareness = [];
      for (let j = 0; j < awareCount; j++) awareness.push(BRANDS[Math.floor(Math.random() * BRANDS.length)].id);
      const seg = SEGMENTS[Math.floor(Math.random() * SEGMENTS.length)];
      agents.push({ id: id++, segment: seg.id, status: "latent", tier: tierId, brand: null, loyalty: 0, awareness: [...new Set(awareness)] });
    }
  }
  return agents;
}

function buildSocialMap(agents, avg = 5) {
  const map = {};
  for (const a of agents) {
    const n = Math.round(avg + (Math.random() - 0.5) * 4);
    const pool = agents.filter(x => x.id !== a.id);
    const neighbors = [];
    for (let i = 0; i < n && i < pool.length; i++) neighbors.push(pool[Math.floor(Math.random() * pool.length)].id);
    map[a.id] = neighbors;
  }
  return map;
}

function simulateTick(agents, brandMods = {}, categoryMods = {}, socialMap = {}) {
  const segMap   = Object.fromEntries(SEGMENTS.map(s => [s.id, s]));
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  // Count active buyers per tier for social contagion into category
  const activeCounts = { mass: 0, prestige: 0, luxury: 0 };
  const totalByTier  = { mass: 0, prestige: 0, luxury: 0 };
  for (const a of agents) {
    const tier = a.status === "active" ? (BRANDS.find(b => b.id === a.brand)?.tier || "mass") : (a.tier || "mass");
    if (a.status === "active") activeCounts[tier]++;
    totalByTier[tier]++;
  }

  return agents.map(agent => {
    const seg = segMap[agent.segment];

    // ── LAYER 1: Category participation (dynamic m) ──────────────────────────
    if (agent.status === "latent") {
      const tier    = agent.tier || "mass";
      const tierCfg = TIERS[tier];
      const catMod  = categoryMods[tier] || {};
      const entryRate = Math.max(0, Math.min(0.99,
        (catMod.entryRate ?? tierCfg.baseEntryRate) +
        (activeCounts[tier] / Math.max(1, totalByTier[tier])) * 0.03
      ));

      // Bass awareness diffusion for latent agents
      const newAwareness = new Set(agent.awareness);
      for (const nId of (socialMap[agent.id] || [])) {
        const neighbor = agentMap[nId];
        if (neighbor?.status === "active" && neighbor.brand && Math.random() < 0.08) newAwareness.add(neighbor.brand);
      }
      for (const b of BRANDS) {
        const p = (brandMods[b.id]?.bassP ?? b.bassP);
        if (!newAwareness.has(b.id) && Math.random() < p * 0.5) newAwareness.add(b.id);
      }

      if (Math.random() < entryRate && newAwareness.size > 0) {
        const awarenessArr = [...newAwareness];
        const awareBrands  = BRANDS.filter(b => awarenessArr.includes(b.id));
        const utils = awareBrands.map(b => Math.max(0.01, computeUtility(b, seg, brandMods)));
        const idx   = softmax(utils);
        return { ...agent, status: "active", brand: awareBrands[idx].id, loyalty: 0.3, tier: undefined, awareness: awarenessArr };
      }
      return { ...agent, awareness: [...newAwareness] };
    }

    // ── Active agent: possible exit ──────────────────────────────────────────
    const currentTier = BRANDS.find(b => b.id === agent.brand)?.tier || "mass";
    const catMod      = categoryMods[currentTier] || {};
    const exitRate    = catMod.exitRate ?? TIERS[currentTier]?.baseExitRate ?? 0.01;
    if (Math.random() < exitRate) {
      return { ...agent, status: "latent", tier: currentTier, brand: null, loyalty: 0 };
    }

    // ── LAYER 2: Bass awareness diffusion (active agents) ───────────────────
    const newAwareness = new Set(agent.awareness);
    for (const nId of (socialMap[agent.id] || [])) {
      const neighbor = agentMap[nId];
      if (neighbor?.status === "active" && neighbor.brand) {
        const b = BRANDS.find(x => x.id === neighbor.brand);
        if (b) {
          const q = brandMods[b.id]?.bassQ ?? b.bassQ;
          if (!newAwareness.has(b.id) && Math.random() < q * 0.04) newAwareness.add(b.id);
        }
      }
    }
    for (const b of BRANDS) {
      const p = brandMods[b.id]?.bassP ?? b.bassP;
      if (!newAwareness.has(b.id) && Math.random() < p * 0.3) newAwareness.add(b.id);
    }

    // ── LAYER 3: Brand choice among aware brands (softmax utility) ───────────
    if (Math.random() < agent.loyalty * seg.loyaltyRate) {
      return { ...agent, awareness: [...newAwareness] };
    }

    const socialBoost = {};
    for (const nId of (socialMap[agent.id] || [])) {
      const n = agentMap[nId];
      if (n?.status === "active" && n.brand) {
        socialBoost[n.brand] = (socialBoost[n.brand] || 0) + seg.socialWeight / (socialMap[agent.id].length || 1);
      }
    }

    const awareBrands = BRANDS.filter(b => newAwareness.has(b.id));
    if (awareBrands.length === 0) return { ...agent, awareness: [...newAwareness] };

    const utils = awareBrands.map(b => computeUtility(b, seg, brandMods) + (socialBoost[b.id] || 0) * 0.15);
    const idx   = softmax(utils);
    const chosen = awareBrands[idx].id;

    return {
      ...agent,
      brand: chosen,
      loyalty: chosen === agent.brand ? Math.min(0.95, agent.loyalty + 0.02) : Math.max(0.20, agent.loyalty - 0.10),
      awareness: [...newAwareness],
    };
  });
}

function getStats(agents) {
  const active = agents.filter(a => a.status === "active");
  const counts = Object.fromEntries(BRANDS.map(b => [b.id, 0]));
  for (const a of active) if (a.brand) counts[a.brand]++;
  const total  = active.length || 1;
  const share  = Object.fromEntries(BRANDS.map(b => [b.id, +(counts[b.id] / total * 100).toFixed(1)]));
  const tierActive = { mass: 0, prestige: 0, luxury: 0 };
  const tierLatent = { mass: 0, prestige: 0, luxury: 0 };
  for (const a of agents) {
    const tier = a.status === "active" ? (BRANDS.find(b => b.id === a.brand)?.tier || "mass") : (a.tier || "mass");
    if (a.status === "active") tierActive[tier]++; else tierLatent[tier]++;
  }
  return { share, activeTotal: active.length, tierActive, tierLatent };
}

// ─── CLAUDE SCENARIO INTERPRETER ─────────────────────────────────────────────
async function interpretScenario(query, stats) {
  const shareStr = Object.entries(stats.share).map(([id, p]) => `${BRANDS.find(b => b.id === id)?.name}: ${p}%`).join(", ");
  const tierStr  = Object.entries(stats.tierActive).map(([t, n]) => `${t}: ${n} active / ${stats.tierLatent[t]} latent`).join(", ");

  const data = await callClaude({
    system: `You are an expert consumer insights strategist in a 3-layer skincare ABM.

Current state — Market shares: ${shareStr} | Tier participation: ${tierStr} | Total active: ${stats.activeTotal}

Brand IDs: olay, cerave, neutrogena, lorealparis, aveeno, clinique, estee, skinceuticals, cetaphil, tatcha
Tiers: mass, prestige, luxury

THREE LAYERS you can adjust:
1. categoryModifiers — entryRate and exitRate per tier (dynamic market potential m)
2. brandModifiers bassP (advertising/innovation reach) and bassQ (word-of-mouth imitation)
3. brandModifiers equity, price, innovation, distribution (utility layer)

Respond ONLY with valid JSON, no markdown:
{
  "brandModifiers": { "brandId": { "equity":0-1, "price":number, "innovation":0-1, "distribution":0-1, "bassP":0-0.1, "bassQ":0-0.8 } },
  "categoryModifiers": { "mass":{"entryRate":0-0.15,"exitRate":0-0.08}, "prestige":{"entryRate":0-0.10,"exitRate":0-0.08}, "luxury":{"entryRate":0-0.08,"exitRate":0-0.08} },
  "narrative": "2-3 sentences covering both brand AND category dynamics",
  "scenarioTitle": "Max 5 words",
  "primaryEffect": "share_shift" | "category_expansion" | "category_contraction" | "mixed"
}

Only include affected brands/tiers. Be bold — changes must be large enough to create visible simulation effects.
Category-expansion scenarios: raise entryRates significantly (2-4x baseline).
Recession/contraction: raise exitRates for premium tiers, lower entryRates.`,
    messages: [{ role: "user", content: query }],
  });

  const text = data.content?.find(c => c.type === "text")?.text || "{}";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return { brandModifiers: {}, categoryModifiers: {}, narrative: "Scenario applied.", scenarioTitle: "Custom Scenario", primaryEffect: "mixed" }; }
}

async function getStrategicInsight(history, activeScenario) {
  const latest   = history[history.length - 1] || {};
  const earliest = history[0] || {};
  const shareChanges = BRANDS
    .map(b => ({ name: b.name, d: +((latest.share?.[b.id] || 0) - (earliest.share?.[b.id] || 0)).toFixed(1) }))
    .sort((a, b) => b.d - a.d);
  const activeDelta  = (latest.activeTotal || 0) - (earliest.activeTotal || 0);
  const tierChanges  = ["mass", "prestige", "luxury"].map(t => ({ tier: t, d: (latest.tierActive?.[t] || 0) - (earliest.tierActive?.[t] || 0) }));

  const data = await callClaude({
    messages: [{
      role: "user",
      content: `Senior brand strategist. Analyze these skincare simulation results.

Scenario: "${activeScenario || 'Baseline'}"
Share shifts: ${shareChanges.map(c => `${c.name}: ${c.d > 0 ? '+' : ''}${c.d}pp`).join(', ')}
Total active buyer change: ${activeDelta > 0 ? '+' : ''}${activeDelta} (${activeDelta > 0 ? 'category expansion' : 'category contraction'})
Tier participation shifts: ${tierChanges.map(t => `${t.tier}: ${t.d > 0 ? '+' : ''}${t.d}`).join(', ')}

Write 3-4 sentences of incisive strategic commentary. Explicitly distinguish between share shift dynamics and category expansion/contraction — these require fundamentally different strategic responses. Be specific. No bullets.`
    }],
  });
  return data.content?.find(c => c.type === "text")?.text || "";
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App() {
  const [agents,          setAgents]          = useState([]);
  const [socialMap,       setSocialMap]        = useState({});
  const [history,         setHistory]          = useState([]);
  const [tick,            setTick]             = useState(0);
  const [running,         setRunning]          = useState(false);
  const [brandMods,       setBrandMods]        = useState({});
  const [categoryMods,    setCategoryMods]     = useState({});
  const [scenarioQuery,   setScenarioQuery]    = useState("");
  const [scenarioLoading, setScenarioLoading]  = useState(false);
  const [activeScenario,  setActiveScenario]   = useState(null);
  const [primaryEffect,   setPrimaryEffect]    = useState(null);
  const [narrative,       setNarrative]        = useState("");
  const [insight,         setInsight]          = useState("");
  const [insightLoading,  setInsightLoading]   = useState(false);
  const [activeChart,     setActiveChart]      = useState("share");

  const agentsRef   = useRef([]);
  const brandRef    = useRef({});
  const categoryRef = useRef({});
  const socialRef   = useRef({});
  const intervalRef = useRef(null);

  useEffect(() => { agentsRef.current   = agents;       }, [agents]);
  useEffect(() => { brandRef.current    = brandMods;    }, [brandMods]);
  useEffect(() => { categoryRef.current = categoryMods; }, [categoryMods]);
  useEffect(() => { socialRef.current   = socialMap;    }, [socialMap]);

  const init = useCallback(() => {
    const a  = initAgents();
    const sm = buildSocialMap(a);
    agentsRef.current = a; socialRef.current = sm;
    setAgents(a); setSocialMap(sm);
    const s = getStats(a);
    setHistory([{ tick: 0, share: s.share, activeTotal: s.activeTotal, tierActive: s.tierActive, tierLatent: s.tierLatent, ...s.share, ...Object.fromEntries(Object.entries(s.tierActive).map(([k,v])=>[`tier_${k}`,v])) }]);
    setTick(0);
    setBrandMods({}); brandRef.current = {};
    setCategoryMods({}); categoryRef.current = {};
    setActiveScenario(null); setNarrative(""); setInsight(""); setPrimaryEffect(null);
  }, []);

  useEffect(() => { init(); }, []);

  const step = useCallback(() => {
    const next = simulateTick(agentsRef.current, brandRef.current, categoryRef.current, socialRef.current);
    agentsRef.current = next;
    setAgents([...next]);
    const s = getStats(next);
    setHistory(h => [...h.slice(-49), { tick: h.length, share: s.share, activeTotal: s.activeTotal, tierActive: s.tierActive, tierLatent: s.tierLatent, ...s.share, ...Object.fromEntries(Object.entries(s.tierActive).map(([k,v])=>[`tier_${k}`,v])) }]);
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    if (running) intervalRef.current = setInterval(step, 280);
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [running, step]);

  const handleScenario = async () => {
    if (!scenarioQuery.trim()) return;
    setScenarioLoading(true); setRunning(false);
    const stats  = getStats(agentsRef.current);
    const result = await interpretScenario(scenarioQuery, stats);
    setBrandMods(result.brandModifiers || {}); brandRef.current = result.brandModifiers || {};
    setCategoryMods(result.categoryModifiers || {}); categoryRef.current = result.categoryModifiers || {};
    setActiveScenario(result.scenarioTitle || "Custom");
    setNarrative(result.narrative || "");
    setPrimaryEffect(result.primaryEffect || "mixed");
    setScenarioQuery("");
    setScenarioLoading(false);
    if (result.primaryEffect === "category_expansion" || result.primaryEffect === "category_contraction") setActiveChart("category");
    else setActiveChart("share");
  };

  const resetScenario = () => {
    setBrandMods({}); brandRef.current = {};
    setCategoryMods({}); categoryRef.current = {};
    setActiveScenario(null); setNarrative(""); setInsight(""); setPrimaryEffect(null);
  };

  const currentStats = history[history.length - 1] || {};
  const sortedBrands = [...BRANDS].sort((a, b) => (currentStats[b.id] || 0) - (currentStats[a.id] || 0));

  const effectColors = { share_shift: "#E8A87C", category_expansion: "#6FCF97", category_contraction: "#EB5757", mixed: "#BB6BD9" };
  const effectLabel  = { share_shift: "Share Shift", category_expansion: "Category Expansion", category_contraction: "Category Contraction", mixed: "Mixed Effects" };

  const PRESETS = [
    "A dermatologist-led movement normalizes daily SPF skincare for men, expanding the mass tier",
    "An economic downturn causes prestige and luxury buyers to trade down or exit the category",
    "CeraVe gets a viral TikTok endorsement from dermatologists, tripling Gen Z awareness",
    "Olay launches a clinically-proven retinol serum at $35 with heavy influencer marketing",
    "A clean beauty mega-trend pulls new consumers into prestige naturals, expanding the category",
    "SkinCeuticals drops prices by 30% and expands into mass retail distribution",
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0D0D0F", color:"#F0EDE8", fontFamily:"'DM Serif Display',Georgia,serif", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#1a1a1e} ::-webkit-scrollbar-thumb{background:#444;border-radius:2px}
        .bbar{transition:width .6s cubic-bezier(.4,0,.2,1)}
        .pulse{animation:pulse 2s infinite} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .fade{animation:fadeIn .4s ease} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        textarea{outline:none;resize:none} button{cursor:pointer;font-family:inherit}
        .chip{transition:all .2s;border:1px solid #333;background:#18181c;padding:7px 12px;border-radius:4px;font-family:'DM Sans',sans-serif;font-size:11px;color:#999;text-align:left}
        .chip:hover{border-color:#E8A87C;color:#F0EDE8;background:#1e1e22}
        .tab{padding:6px 16px;border-radius:3px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.1em;border:1px solid #2a2a2a;background:transparent;color:#555;transition:all .2s}
        .tab.on{background:#1a1a1e;color:#F0EDE8;border-color:#555}
      `}</style>

      {/* Header */}
      <div style={{padding:"28px 40px 20px",borderBottom:"1px solid #1e1e22",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555",letterSpacing:".15em",marginBottom:6}}>MATERIAL+ INTELLIGENCE LAB · v2</div>
          <h1 style={{fontSize:"clamp(20px,2.5vw,30px)",fontWeight:400,letterSpacing:"-.02em",lineHeight:1.1}}>
            Skincare Market<br/><span style={{fontStyle:"italic",color:"#E8A87C"}}>Consumer Simulation</span>
          </h1>
        </div>
        <div style={{textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:11,color:"#555"}}>
          <div style={{marginBottom:3}}>{agents.filter(a=>a.status==="active").length} active · {agents.filter(a=>a.status==="latent").length} latent</div>
          <div>tick <span style={{color:"#E8A87C"}}>{String(tick).padStart(4,"0")}</span></div>
          {activeScenario && primaryEffect && (
            <div style={{marginTop:5,padding:"3px 10px",background:"#0f0f12",border:`1px solid ${effectColors[primaryEffect]}`,borderRadius:3,fontSize:10,color:effectColors[primaryEffect]}}>
              {effectLabel[primaryEffect]}
            </div>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",minHeight:"calc(100vh - 96px)"}}>

        {/* LEFT */}
        <div style={{padding:"28px 36px",borderRight:"1px solid #1e1e22",overflowY:"auto"}}>

          {/* Controls */}
          <div style={{display:"flex",gap:10,marginBottom:22,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setRunning(r=>!r)} style={{padding:"9px 24px",background:running?"#2a1a1a":"#E8A87C",color:running?"#E8A87C":"#0D0D0F",border:running?"1px solid #E8A87C":"none",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:".1em",fontWeight:500}}>
              {running?"⏸ PAUSE":"▶ RUN"}
            </button>
            <button onClick={step} disabled={running} style={{padding:"9px 18px",background:"transparent",color:running?"#333":"#777",border:"1px solid",borderColor:running?"#2a2a2a":"#444",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:11}}>STEP</button>
            <button onClick={()=>{setRunning(false);setTimeout(init,50)}} style={{padding:"9px 18px",background:"transparent",color:"#555",border:"1px solid #2a2a2a",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:11}}>RESET</button>
            {activeScenario && (
              <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
                <span style={{padding:"5px 12px",background:"#1a1208",border:`1px solid ${effectColors[primaryEffect]||"#E8A87C"}`,borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:10,color:effectColors[primaryEffect]||"#E8A87C"}}>⚡ {activeScenario}</span>
                <button onClick={resetScenario} style={{padding:"5px 9px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:3,color:"#555",fontSize:10,fontFamily:"'DM Mono',monospace"}}>✕</button>
              </div>
            )}
          </div>

          {/* Narrative */}
          {narrative && (
            <div className="fade" style={{marginBottom:20,padding:"14px 18px",background:"#12100e",border:"1px solid #2a2018",borderLeft:`3px solid ${effectColors[primaryEffect]||"#E8A87C"}`,borderRadius:4}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:effectColors[primaryEffect]||"#E8A87C",letterSpacing:".12em",marginBottom:6}}>SCENARIO INTERPRETATION</div>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#ccc",lineHeight:1.6}}>{narrative}</p>
            </div>
          )}

          {/* Chart tabs */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button className={`tab${activeChart==="share"?" on":""}`} onClick={()=>setActiveChart("share")}>BRAND SHARE</button>
            <button className={`tab${activeChart==="category"?" on":""}`} onClick={()=>setActiveChart("category")}>CATEGORY SIZE</button>
          </div>

          {activeChart==="share" && (
            <div style={{marginBottom:24}}>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={history} margin={{top:4,right:8,bottom:4,left:-22}}>
                  <XAxis dataKey="tick" tick={{fill:"#444",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={{stroke:"#222"}}/>
                  <YAxis tick={{fill:"#444",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={false} domain={[0,"auto"]}/>
                  <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:4,fontFamily:"DM Mono",fontSize:10}} labelStyle={{color:"#555"}} formatter={v=>[`${v}%`]}/>
                  {BRANDS.map(b=>(
                    <Line key={b.id} type="monotone" dataKey={b.id} stroke={b.color} dot={false} strokeWidth={1.5} name={b.name}
                      strokeOpacity={Object.keys(brandMods).length===0||brandMods[b.id]?1:0.2}/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeChart==="category" && (
            <div style={{marginBottom:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",letterSpacing:".1em",marginBottom:8}}>ACTIVE BUYERS OVER TIME BY TIER</div>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={history} margin={{top:4,right:8,bottom:4,left:-22}}>
                  <XAxis dataKey="tick" tick={{fill:"#444",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={{stroke:"#222"}}/>
                  <YAxis tick={{fill:"#444",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:4,fontFamily:"DM Mono",fontSize:10}} labelStyle={{color:"#555"}}/>
                  <Area type="monotone" dataKey="tier_mass"     stroke={TIERS.mass.color}     fill={TIERS.mass.color}     fillOpacity={0.12} strokeWidth={2} name="Mass"     dot={false}/>
                  <Area type="monotone" dataKey="tier_prestige" stroke={TIERS.prestige.color} fill={TIERS.prestige.color} fillOpacity={0.12} strokeWidth={2} name="Prestige" dot={false}/>
                  <Area type="monotone" dataKey="tier_luxury"   stroke={TIERS.luxury.color}   fill={TIERS.luxury.color}   fillOpacity={0.12} strokeWidth={2} name="Luxury"   dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tier meters */}
          <div style={{marginBottom:24}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",letterSpacing:".12em",marginBottom:12}}>ACTIVE BUYERS BY TIER</div>
            <div style={{display:"flex",gap:12}}>
              {Object.entries(TIERS).map(([tid, tcfg]) => {
                const active = agents.filter(a=>a.status==="active"&&BRANDS.find(b=>b.id===a.brand)?.tier===tid).length;
                const latent = agents.filter(a=>a.status==="latent"&&a.tier===tid).length;
                const total  = active + latent || 1;
                const pct    = Math.round(active/total*100);
                const hasMod = !!categoryMods[tid];
                return (
                  <div key={tid} style={{flex:1,padding:"12px",background:"#0f0f12",border:`1px solid ${hasMod?tcfg.color:"#1e1e22"}`,borderRadius:4}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:hasMod?tcfg.color:"#555",letterSpacing:".1em",marginBottom:6}}>{tcfg.label.toUpperCase()}{hasMod?" ⚡":""}</div>
                    <div style={{fontSize:20,fontWeight:400,color:tcfg.color,marginBottom:3}}>{active}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#555",marginBottom:6}}>{latent} latent</div>
                    <div style={{height:3,background:"#1a1a1e",borderRadius:2}}>
                      <div style={{height:"100%",width:`${pct}%`,background:tcfg.color,borderRadius:2,transition:"width .6s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Share bars */}
          <div style={{marginBottom:24}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",letterSpacing:".12em",marginBottom:12}}>SHARE RANKING</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {sortedBrands.map((b,i)=>{
                const pct    = currentStats[b.id]||0;
                const maxPct = currentStats[sortedBrands[0].id]||1;
                const hasmod = !!brandMods[b.id];
                return (
                  <div key={b.id} style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",width:14,textAlign:"right"}}>{i+1}</div>
                    <div style={{width:112,fontFamily:"'DM Sans',sans-serif",fontSize:11,color:hasmod?"#E8A87C":"#999"}}>{b.name}{hasmod?" ⚡":""}</div>
                    <div style={{flex:1,height:5,background:"#1a1a1e",borderRadius:2,overflow:"hidden"}}>
                      <div className="bbar" style={{height:"100%",width:`${(pct/maxPct)*100}%`,background:b.color,borderRadius:2,opacity:hasmod||Object.keys(brandMods).length===0?1:0.25}}/>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:hasmod?"#E8A87C":"#555",width:38,textAlign:"right"}}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategic insight */}
          {history.length > 3 && (
            <div>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",letterSpacing:".12em"}}>STRATEGIC ANALYSIS</div>
                <button onClick={async()=>{
                  setInsightLoading(true);
                  const t = await getStrategicInsight(
                    history.map(h=>({ share: Object.fromEntries(BRANDS.map(b=>[b.id,h[b.id]])), activeTotal: h.activeTotal, tierActive: Object.fromEntries(["mass","prestige","luxury"].map(t=>[t,h[`tier_${t}`]])) })),
                    activeScenario
                  );
                  setInsight(t); setInsightLoading(false);
                }} disabled={insightLoading} style={{padding:"4px 12px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:3,color:insightLoading?"#333":"#666",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:".1em"}}>
                  {insightLoading?<span className="pulse">ANALYZING…</span>:"GENERATE INSIGHT →"}
                </button>
              </div>
              {insight && (
                <div className="fade" style={{padding:"14px 18px",background:"#0e1014",border:"1px solid #1e2530",borderLeft:"3px solid #56CCF2",borderRadius:4}}>
                  <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#ccc",lineHeight:1.7,fontStyle:"italic"}}>{insight}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Scenario Lab */}
        <div style={{padding:"28px 24px",background:"#0a0a0c",overflowY:"auto"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",letterSpacing:".15em",marginBottom:16}}>SCENARIO LAB</div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#666",lineHeight:1.6,marginBottom:16}}>
            Describe any scenario. Claude adjusts brand parameters <em>and</em> category entry/exit rates across tiers simultaneously.
          </p>

          <textarea value={scenarioQuery} onChange={e=>setScenarioQuery(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleScenario();}}}
            placeholder="e.g. A recession causes luxury buyers to trade down, contracting the prestige tier…"
            rows={4}
            style={{width:"100%",padding:"12px",background:"#13131a",border:"1px solid #2a2a35",borderRadius:4,color:"#F0EDE8",fontFamily:"'DM Sans',sans-serif",fontSize:11,lineHeight:1.6,marginBottom:10}}
          />
          <button onClick={handleScenario} disabled={scenarioLoading||!scenarioQuery.trim()} style={{width:"100%",padding:"11px",background:scenarioLoading||!scenarioQuery.trim()?"#1a1a1e":"#E8A87C",color:scenarioLoading||!scenarioQuery.trim()?"#333":"#0D0D0F",border:"none",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:".1em",fontWeight:500,marginBottom:20}}>
            {scenarioLoading?<span className="pulse">INTERPRETING…</span>:"APPLY SCENARIO →"}
          </button>

          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",letterSpacing:".12em",marginBottom:10}}>EXAMPLE SCENARIOS</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:24}}>
            {PRESETS.map((p,i)=><button key={i} className="chip" onClick={()=>setScenarioQuery(p)}>{p}</button>)}
          </div>

          {/* Category modifiers display */}
          {Object.keys(categoryMods).length > 0 && (
            <div className="fade" style={{marginBottom:20,padding:"12px 14px",background:"#0f0f12",border:"1px solid #1e2a1e",borderLeft:"3px solid #6FCF97",borderRadius:4}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#6FCF97",letterSpacing:".12em",marginBottom:8}}>CATEGORY MODIFIERS</div>
              {Object.entries(categoryMods).map(([tier, mod])=>(
                <div key={tier} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#888",textTransform:"capitalize"}}>{tier}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#6FCF97"}}>
                    {mod.entryRate!=null&&`entry ${(mod.entryRate*100).toFixed(1)}%`}
                    {mod.entryRate!=null&&mod.exitRate!=null&&" · "}
                    {mod.exitRate!=null&&`exit ${(mod.exitRate*100).toFixed(1)}%`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Segments */}
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",letterSpacing:".12em",marginBottom:10}}>CONSUMER SEGMENTS</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:22}}>
            {SEGMENTS.map(s=>{
              const count = agents.filter(a=>a.segment===s.id&&a.status==="active").length;
              return (
                <div key={s.id} style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#777"}}>{s.label}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555"}}>{count} active</span>
                </div>
              );
            })}
          </div>

          {/* Brand key */}
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",letterSpacing:".12em",marginBottom:10}}>BRAND KEY</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 10px"}}>
            {BRANDS.map(b=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:b.color,flexShrink:0}}/>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:brandMods[b.id]?"#E8A87C":"#666"}}>{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
