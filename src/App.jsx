import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

// ─── BRANDS ───────────────────────────────────────────────────────────────────
const BRANDS = [
  { id: "olay",         name: "Olay",          color: "#E8A87C", tier: "mass",    equity: 0.72, price: 18, innovation: 0.60, distribution: 0.90, bassP: 0.025, bassQ: 0.38, satisfaction: 0.70 },
  { id: "cerave",       name: "CeraVe",        color: "#7EB8C9", tier: "mass",    equity: 0.78, price: 16, innovation: 0.70, distribution: 0.88, bassP: 0.020, bassQ: 0.45, satisfaction: 0.82 },
  { id: "neutrogena",   name: "Neutrogena",    color: "#F2C94C", tier: "mass",    equity: 0.68, price: 15, innovation: 0.55, distribution: 0.92, bassP: 0.030, bassQ: 0.35, satisfaction: 0.68 },
  { id: "lorealparis",  name: "L'Oréal Paris", color: "#BB6BD9", tier: "mass",    equity: 0.70, price: 22, innovation: 0.65, distribution: 0.85, bassP: 0.022, bassQ: 0.36, satisfaction: 0.71 },
  { id: "aveeno",       name: "Aveeno",        color: "#A8C69F", tier: "mass",    equity: 0.65, price: 17, innovation: 0.50, distribution: 0.82, bassP: 0.018, bassQ: 0.30, satisfaction: 0.67 },
  { id: "clinique",     name: "Clinique",      color: "#56CCF2", tier: "prestige",equity: 0.80, price: 45, innovation: 0.72, distribution: 0.60, bassP: 0.015, bassQ: 0.32, satisfaction: 0.78 },
  { id: "estee",        name: "Estée Lauder",  color: "#F2994A", tier: "prestige",equity: 0.85, price: 65, innovation: 0.75, distribution: 0.50, bassP: 0.012, bassQ: 0.28, satisfaction: 0.80 },
  { id: "skinceuticals",name: "SkinCeuticals", color: "#EB5757", tier: "prestige",equity: 0.88, price: 80, innovation: 0.90, distribution: 0.40, bassP: 0.010, bassQ: 0.42, satisfaction: 0.88 },
  { id: "cetaphil",     name: "Cetaphil",      color: "#6FCF97", tier: "mass",    equity: 0.62, price: 14, innovation: 0.40, distribution: 0.87, bassP: 0.020, bassQ: 0.28, satisfaction: 0.72 },
  { id: "tatcha",       name: "Tatcha",        color: "#9B51E0", tier: "luxury",  equity: 0.82, price: 95, innovation: 0.80, distribution: 0.30, bassP: 0.008, bassQ: 0.50, satisfaction: 0.85 },
];

// ─── SEGMENTS ─────────────────────────────────────────────────────────────────
// salienceDecay: how fast salience fades per tick (higher = faster forgetting)
// considerationThreshold: min salience to enter active choice set
// experienceWeight: weight on realized satisfaction vs. prior equity in experience update
const SEGMENTS = [
  { id: "budget_basics",    label: "Budget Basics",    share: 0.22, priceWeight: 0.50, equityWeight: 0.20, innovWeight: 0.10, distWeight: 0.20, socialWeight: 0.30, loyaltyRate: 0.55, tierAffinity: "mass",    salienceDecay: 0.12, considerationThreshold: 0.25, experienceWeight: 0.5 },
  { id: "value_seekers",    label: "Value Seekers",    share: 0.18, priceWeight: 0.30, equityWeight: 0.30, innovWeight: 0.20, distWeight: 0.20, socialWeight: 0.40, loyaltyRate: 0.50, tierAffinity: "mass",    salienceDecay: 0.14, considerationThreshold: 0.28, experienceWeight: 0.6 },
  { id: "ingredient_nerds", label: "Ingredient Nerds", share: 0.15, priceWeight: 0.10, equityWeight: 0.20, innovWeight: 0.50, distWeight: 0.10, socialWeight: 0.20, loyaltyRate: 0.60, tierAffinity: "prestige",salienceDecay: 0.08, considerationThreshold: 0.35, experienceWeight: 0.7 },
  { id: "brand_loyalists",  label: "Brand Loyalists",  share: 0.20, priceWeight: 0.10, equityWeight: 0.50, innovWeight: 0.10, distWeight: 0.10, socialWeight: 0.30, loyaltyRate: 0.80, tierAffinity: "mass",    salienceDecay: 0.04, considerationThreshold: 0.20, experienceWeight: 0.4 },
  { id: "prestige_seekers", label: "Prestige Seekers", share: 0.13, priceWeight:-0.10, equityWeight: 0.40, innovWeight: 0.20, distWeight: 0.10, socialWeight: 0.40, loyaltyRate: 0.65, tierAffinity: "luxury",  salienceDecay: 0.10, considerationThreshold: 0.32, experienceWeight: 0.6 },
  { id: "naturals",         label: "Clean & Natural",  share: 0.12, priceWeight: 0.15, equityWeight: 0.20, innovWeight: 0.30, distWeight: 0.10, socialWeight: 0.50, loyaltyRate: 0.55, tierAffinity: "mass",    salienceDecay: 0.11, considerationThreshold: 0.30, experienceWeight: 0.65 },
];

// ─── TIERS ────────────────────────────────────────────────────────────────────
const TIERS = {
  mass:     { label: "Mass",     color: "#7EB8C9", baseEntryRate: 0.040, baseExitRate: 0.010, latentShare: 0.12 },
  prestige: { label: "Prestige", color: "#E8A87C", baseEntryRate: 0.020, baseExitRate: 0.015, latentShare: 0.10 },
  luxury:   { label: "Luxury",   color: "#9B51E0", baseEntryRate: 0.010, baseExitRate: 0.020, latentShare: 0.08 },
};

const TOTAL_AGENTS = 650;

// ─── API ──────────────────────────────────────────────────────────────────────
async function callClaude(body) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1400, ...body }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── SIMULATION ENGINE ────────────────────────────────────────────────────────

// Utility from brand attributes + segment weights
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

// Initialize per-brand salience and experience maps for an agent
// salience[brandId]: 0-1, probability of retrieval at choice occasion
// experience[brandId]: 0-1, accumulated satisfaction belief (empirical Bayes prior = brand equity)
// purchaseCount[brandId]: how many times purchased (governs prior weight in Bayes update)
function initBrandState(awareBrands, currentBrand, seg) {
  const salience = {};
  const experience = {};
  const purchaseCount = {};
  for (const b of BRANDS) {
    if (awareBrands.includes(b.id)) {
      // Initial salience: higher for current brand, moderate for others in awareness
      salience[b.id] = b.id === currentBrand
        ? 0.65 + Math.random() * 0.20
        : 0.30 + Math.random() * 0.25;
      // Prior experience = brand equity (Bayesian prior)
      experience[b.id] = b.equity;
      purchaseCount[b.id] = b.id === currentBrand ? 2 : 0;
    }
  }
  return { salience, experience, purchaseCount };
}

function initAgents() {
  const agents = [];
  let id = 0;

  // Active buyers (~500)
  for (const seg of SEGMENTS) {
    const count = Math.round(TOTAL_AGENTS * 0.77 * seg.share);
    for (let i = 0; i < count; i++) {
      const utils = BRANDS.map(b => Math.max(0.01, computeUtility(b, seg)));
      const idx   = softmax(utils);
      const currentBrand = BRANDS[idx].id;

      const awareCount = 4 + Math.floor(Math.random() * 4);
      const awareness  = new Set([currentBrand]);
      while (awareness.size < Math.min(awareCount, BRANDS.length)) {
        awareness.add(BRANDS[Math.floor(Math.random() * BRANDS.length)].id);
      }
      const awarenessArr = [...awareness];
      const { salience, experience, purchaseCount } = initBrandState(awarenessArr, currentBrand, seg);

      agents.push({
        id: id++, segment: seg.id, status: "active",
        brand: currentBrand, loyalty: 0.5 + Math.random() * 0.3,
        awareness: awarenessArr, salience, experience, purchaseCount,
      });
    }
  }

  // Latent non-buyers (~150)
  for (const [tierId, tierCfg] of Object.entries(TIERS)) {
    const count = Math.round(TOTAL_AGENTS * tierCfg.latentShare);
    for (let i = 0; i < count; i++) {
      const awareCount = Math.floor(Math.random() * 3);
      const awareness  = [];
      for (let j = 0; j < awareCount; j++) awareness.push(BRANDS[Math.floor(Math.random() * BRANDS.length)].id);
      const seg = SEGMENTS[Math.floor(Math.random() * SEGMENTS.length)];
      const uniq = [...new Set(awareness)];
      const salience = Object.fromEntries(uniq.map(bid => [bid, 0.10 + Math.random() * 0.15]));
      const experience = Object.fromEntries(uniq.map(bid => [bid, BRANDS.find(b => b.id === bid)?.equity || 0.5]));
      const purchaseCount = Object.fromEntries(uniq.map(bid => [bid, 0]));
      agents.push({
        id: id++, segment: seg.id, status: "latent", tier: tierId,
        brand: null, loyalty: 0, awareness: uniq, salience, experience, purchaseCount,
      });
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

// Weighted-blend experience update (empirical Bayes)
// As purchaseCount grows, realized satisfaction gets more weight vs. equity prior
function updateExperience(currentExp, purchaseCount, realizedSatisfaction, experienceWeight) {
  const n = purchaseCount + 1;
  // Prior weight decays with experience: w_prior = 1/(1 + n*experienceWeight)
  const priorWeight = 1 / (1 + n * experienceWeight);
  const dataWeight  = 1 - priorWeight;
  return priorWeight * currentExp + dataWeight * realizedSatisfaction;
}

function simulateTick(agents, brandMods = {}, categoryMods = {}, socialMap = {}) {
  const segMap   = Object.fromEntries(SEGMENTS.map(s => [s.id, s]));
  const brandMap = Object.fromEntries(BRANDS.map(b => [b.id, b]));
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  // Active buyer counts per tier for social contagion
  const activeCounts = { mass: 0, prestige: 0, luxury: 0 };
  const totalByTier  = { mass: 0, prestige: 0, luxury: 0 };
  for (const a of agents) {
    const tier = a.status === "active" ? (brandMap[a.brand]?.tier || "mass") : (a.tier || "mass");
    if (a.status === "active") activeCounts[tier]++;
    totalByTier[tier]++;
  }

  return agents.map(agent => {
    const seg = segMap[agent.segment];

    // ── LAYER 1: Category participation (dynamic m) ───────────────────────────
    if (agent.status === "latent") {
      const tier    = agent.tier || "mass";
      const catMod  = categoryMods[tier] || {};
      const entryRate = Math.max(0, Math.min(0.99,
        (catMod.entryRate ?? TIERS[tier].baseEntryRate) +
        (activeCounts[tier] / Math.max(1, totalByTier[tier])) * 0.03
      ));

      // Salience update for latent agents via Bass p and neighbor WOM
      const newSalience = { ...agent.salience };
      const newAwareness = new Set(agent.awareness);
      for (const nId of (socialMap[agent.id] || [])) {
        const nb = agentMap[nId];
        if (nb?.status === "active" && nb.brand) {
          const b = brandMap[nb.brand];
          if (b) {
            const q = brandMods[b.id]?.bassQ ?? b.bassQ;
            if (!newAwareness.has(b.id) && Math.random() < q * 0.04) {
              newAwareness.add(b.id);
              newSalience[b.id] = 0.15;
              agent.experience[b.id] = b.equity;
              agent.purchaseCount[b.id] = 0;
            } else if (newAwareness.has(b.id)) {
              newSalience[b.id] = Math.min(1, (newSalience[b.id] || 0) + q * 0.02);
            }
          }
        }
      }
      for (const b of BRANDS) {
        const p = brandMods[b.id]?.bassP ?? b.bassP;
        if (!newAwareness.has(b.id) && Math.random() < p * 0.5) {
          newAwareness.add(b.id); newSalience[b.id] = 0.12;
          agent.experience[b.id] = b.equity; agent.purchaseCount[b.id] = 0;
        } else if (newAwareness.has(b.id)) {
          newSalience[b.id] = Math.min(1, (newSalience[b.id] || 0) + p * 0.15);
        }
      }

      if (Math.random() < entryRate && newAwareness.size > 0) {
        // Enter market: choose from brands above consideration threshold
        const awarenessArr = [...newAwareness];
        const eligible = BRANDS.filter(b => awarenessArr.includes(b.id) && (newSalience[b.id] || 0) >= seg.considerationThreshold);
        const pool = eligible.length > 0 ? eligible : BRANDS.filter(b => awarenessArr.includes(b.id));
        if (pool.length === 0) return { ...agent, awareness: awarenessArr, salience: newSalience };
        const utils = pool.map(b => Math.max(0.01, computeUtility(b, seg, brandMods)));
        const chosen = pool[softmax(utils)].id;
        return { ...agent, status: "active", brand: chosen, loyalty: 0.3, tier: undefined, awareness: awarenessArr, salience: newSalience };
      }
      return { ...agent, awareness: [...newAwareness], salience: newSalience };
    }

    // ── Active agent: possible exit ───────────────────────────────────────────
    const currentTier = brandMap[agent.brand]?.tier || "mass";
    const exitRate    = (categoryMods[currentTier]?.exitRate) ?? TIERS[currentTier]?.baseExitRate ?? 0.01;
    if (Math.random() < exitRate) {
      return { ...agent, status: "latent", tier: currentTier, brand: null, loyalty: 0 };
    }

    // ── LAYER 2: Bass awareness + salience dynamics ───────────────────────────
    const newSalience  = { ...agent.salience };
    const newAwareness = new Set(agent.awareness);
    const newExperience = { ...agent.experience };
    const newPurchaseCount = { ...agent.purchaseCount };

    // Salience decay — segment-specific forgetting
    for (const bid of Object.keys(newSalience)) {
      if (bid !== agent.brand) { // current brand doesn't decay (in-use recency)
        newSalience[bid] = Math.max(0, (newSalience[bid] || 0) - seg.salienceDecay * 0.1);
      }
    }

    // Salience boost from advertising (bassP) — all aware brands
    for (const b of BRANDS) {
      const bMod = brandMods[b.id] || {};
      const p    = bMod.bassP ?? b.bassP;
      if (newAwareness.has(b.id)) {
        newSalience[b.id] = Math.min(1, (newSalience[b.id] || 0) + p * 0.25);
      } else if (Math.random() < p * 0.3) {
        // New awareness via advertising
        newAwareness.add(b.id);
        newSalience[b.id] = 0.15;
        newExperience[b.id] = b.equity;
        newPurchaseCount[b.id] = 0;
      }
    }

    // Salience boost from neighbor WOM (bassQ) — social contagion
    for (const nId of (socialMap[agent.id] || [])) {
      const nb = agentMap[nId];
      if (nb?.status === "active" && nb.brand) {
        const b = brandMap[nb.brand];
        if (b) {
          const q = bMod_q(b, brandMods);
          if (!newAwareness.has(b.id) && Math.random() < q * 0.03) {
            newAwareness.add(b.id); newSalience[b.id] = 0.18;
            newExperience[b.id] = b.equity; newPurchaseCount[b.id] = 0;
          } else if (newAwareness.has(b.id)) {
            newSalience[b.id] = Math.min(1, (newSalience[b.id] || 0) + q * 0.03);
          }
        }
      }
    }

    // Experience boosts salience for current brand (recency + satisfaction loop)
    if (agent.brand && newExperience[agent.brand] != null) {
      const expBoost = newExperience[agent.brand] * 0.15;
      newSalience[agent.brand] = Math.min(1, (newSalience[agent.brand] || 0.5) + expBoost);
    }

    // ── LAYER 3: Dynamic consideration set → brand choice ─────────────────────
    // Consideration set = aware brands whose salience clears the segment threshold
    // Experience lowers the threshold for previously purchased brands
    const awarenessArr = [...newAwareness];
    const considerationSet = BRANDS.filter(b => {
      if (!awarenessArr.includes(b.id)) return false;
      const sal       = newSalience[b.id] || 0;
      const purchases = newPurchaseCount[b.id] || 0;
      // Experience-adjusted threshold: more purchases → easier to re-enter consideration
      const threshold = seg.considerationThreshold * Math.max(0.5, 1 - purchases * 0.08);
      return sal >= threshold;
    });

    // Always keep current brand in consideration (can't forget what you're using)
    const choiceSet = considerationSet.some(b => b.id === agent.brand)
      ? considerationSet
      : [...considerationSet, brandMap[agent.brand]].filter(Boolean);

    if (choiceSet.length === 0) return { ...agent, awareness: awarenessArr, salience: newSalience, experience: newExperience, purchaseCount: newPurchaseCount };

    // Loyalty check — if loyal, stay with current brand
    if (Math.random() < agent.loyalty * seg.loyaltyRate) {
      // Still update experience for current brand even without switching
      if (agent.brand) {
        const b = brandMap[agent.brand];
        const bMod = brandMods[agent.brand] || {};
        const realSat = bMod.satisfaction ?? b?.satisfaction ?? b?.equity ?? 0.7;
        newExperience[agent.brand] = updateExperience(newExperience[agent.brand] ?? b?.equity, newPurchaseCount[agent.brand] || 0, realSat, seg.experienceWeight);
        newPurchaseCount[agent.brand] = (newPurchaseCount[agent.brand] || 0) + 1;
      }
      return { ...agent, awareness: awarenessArr, salience: newSalience, experience: newExperience, purchaseCount: newPurchaseCount };
    }

    // Social boost within consideration set
    const socialBoost = {};
    for (const nId of (socialMap[agent.id] || [])) {
      const nb = agentMap[nId];
      if (nb?.status === "active" && nb.brand && choiceSet.some(b => b.id === nb.brand)) {
        socialBoost[nb.brand] = (socialBoost[nb.brand] || 0) + seg.socialWeight / (socialMap[agent.id].length || 1);
      }
    }

    // Utility over consideration set — experience-adjusted
    const utils = choiceSet.map(b => {
      const baseU  = computeUtility(b, seg, brandMods);
      const expAdj = (newExperience[b.id] ?? b.equity) * 0.20; // experience lifts utility
      const socAdj = (socialBoost[b.id] || 0) * 0.15;
      return baseU + expAdj + socAdj;
    });

    const chosen    = choiceSet[softmax(utils)].id;
    const chosenB   = brandMap[chosen];
    const bMod      = brandMods[chosen] || {};
    const realSat   = bMod.satisfaction ?? chosenB?.satisfaction ?? chosenB?.equity ?? 0.7;
    const newLoy    = chosen === agent.brand ? Math.min(0.95, agent.loyalty + 0.02) : Math.max(0.20, agent.loyalty - 0.10);

    // Update experience for chosen brand (weighted Bayes blend)
    newExperience[chosen]    = updateExperience(newExperience[chosen] ?? chosenB?.equity, newPurchaseCount[chosen] || 0, realSat, seg.experienceWeight);
    newPurchaseCount[chosen] = (newPurchaseCount[chosen] || 0) + 1;

    // Positive experience boosts salience; negative experience slightly dampens
    const expDelta = realSat - (newExperience[chosen] || 0.5);
    newSalience[chosen] = Math.min(1, Math.max(0, (newSalience[chosen] || 0.4) + expDelta * 0.2));

    return { ...agent, brand: chosen, loyalty: newLoy, awareness: awarenessArr, salience: newSalience, experience: newExperience, purchaseCount: newPurchaseCount };
  });
}

// helper — bassQ for a brand
function bMod_q(b, brandMods) { return brandMods[b.id]?.bassQ ?? b.bassQ; }

function getStats(agents) {
  const active = agents.filter(a => a.status === "active");
  const counts = Object.fromEntries(BRANDS.map(b => [b.id, 0]));
  for (const a of active) if (a.brand) counts[a.brand]++;
  const total = active.length || 1;
  const share = Object.fromEntries(BRANDS.map(b => [b.id, +(counts[b.id] / total * 100).toFixed(1)]));

  // Tier counts
  const tierActive = { mass: 0, prestige: 0, luxury: 0 };
  const tierLatent = { mass: 0, prestige: 0, luxury: 0 };
  for (const a of agents) {
    const tier = a.status === "active" ? (BRANDS.find(b => b.id === a.brand)?.tier || "mass") : (a.tier || "mass");
    if (a.status === "active") tierActive[tier]++; else tierLatent[tier]++;
  }

  // Consideration funnel: for each brand, how many active agents have it in consideration?
  // Consideration = in awareness AND salience >= segment threshold (experience-adjusted)
  const segMap = Object.fromEntries(SEGMENTS.map(s => [s.id, s]));
  const awarenessCount     = Object.fromEntries(BRANDS.map(b => [b.id, 0]));
  const considerationCount = Object.fromEntries(BRANDS.map(b => [b.id, 0]));

  for (const a of active) {
    const seg = segMap[a.segment];
    for (const b of BRANDS) {
      if (a.awareness?.includes(b.id)) {
        awarenessCount[b.id]++;
        const sal       = a.salience?.[b.id] || 0;
        const purchases = a.purchaseCount?.[b.id] || 0;
        const threshold = seg.considerationThreshold * Math.max(0.5, 1 - purchases * 0.08);
        if (sal >= threshold) considerationCount[b.id]++;
      }
    }
  }

  const awarenessP     = Object.fromEntries(BRANDS.map(b => [b.id, +(awarenessCount[b.id] / total * 100).toFixed(1)]));
  const considerationP = Object.fromEntries(BRANDS.map(b => [b.id, +(considerationCount[b.id] / total * 100).toFixed(1)]));
  const avgConsidSetSize = +(active.reduce((sum, a) => {
    const seg = segMap[a.segment];
    const inSet = BRANDS.filter(b => a.awareness?.includes(b.id) && (a.salience?.[b.id] || 0) >= seg.considerationThreshold * Math.max(0.5, 1 - (a.purchaseCount?.[b.id] || 0) * 0.08)).length;
    return sum + inSet;
  }, 0) / Math.max(1, active.length)).toFixed(2);

  return { share, activeTotal: active.length, tierActive, tierLatent, awarenessP, considerationP, avgConsidSetSize };
}

// ─── CLAUDE SCENARIO INTERPRETER ─────────────────────────────────────────────
async function interpretScenario(query, stats) {
  const shareStr  = Object.entries(stats.share).map(([id, p]) => `${BRANDS.find(b => b.id === id)?.name}: ${p}%`).join(", ");
  const funnelStr = BRANDS.map(b => `${b.name}: aware=${stats.awarenessP[b.id]}% consid=${stats.considerationP[b.id]}% share=${stats.share[b.id]}%`).join("; ");
  const tierStr   = Object.entries(stats.tierActive).map(([t, n]) => `${t}: ${n} active / ${stats.tierLatent[t]} latent`).join(", ");

  const data = await callClaude({
    system: `You are an expert consumer insights strategist in a 4-layer skincare ABM.

Current state:
- Funnel (awareness → consideration → share): ${funnelStr}
- Tier participation: ${tierStr}
- Avg consideration set size: ${stats.avgConsidSetSize} brands

Brand IDs: olay, cerave, neutrogena, lorealparis, aveeno, clinique, estee, skinceuticals, cetaphil, tatcha
Tiers: mass, prestige, luxury

FOUR LAYERS you can adjust:
1. categoryModifiers — entryRate/exitRate per tier (dynamic m)
2. Brand bassP (advertising reach, boosts salience) and bassQ (WOM imitation, spreads awareness)
3. Brand equity, price, innovation, distribution (utility/choice layer)
4. Brand satisfaction (0-1, drives experience update — high satisfaction locks brands into consideration sets)

Respond ONLY with valid JSON, no markdown:
{
  "brandModifiers": { "brandId": { "equity":0-1, "price":number, "innovation":0-1, "distribution":0-1, "bassP":0-0.1, "bassQ":0-0.8, "satisfaction":0-1 } },
  "categoryModifiers": { "tier": { "entryRate":0-0.15, "exitRate":0-0.08 } },
  "narrative": "2-3 sentences covering brand dynamics, category dynamics, AND consideration set effects",
  "scenarioTitle": "Max 5 words",
  "primaryEffect": "share_shift" | "category_expansion" | "category_contraction" | "consideration_shift" | "mixed"
}

Only include affected brands/tiers. Be bold — changes must produce visible simulation effects.
For sampling/trial scenarios: raise bassP + satisfaction to drive consideration set entry.
For negative PR scenarios: lower satisfaction to erode consideration set membership over time.
For viral/WOM scenarios: raise bassQ significantly to rapidly expand awareness and salience.`,
    messages: [{ role: "user", content: query }],
  });

  const text = data.content?.find(c => c.type === "text")?.text || "{}";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return { brandModifiers: {}, categoryModifiers: {}, narrative: "Scenario applied.", scenarioTitle: "Custom Scenario", primaryEffect: "mixed" }; }
}

async function getStrategicInsight(history, activeScenario) {
  const latest   = history[history.length - 1] || {};
  const earliest = history[0] || {};
  const shareChanges = BRANDS.map(b => ({ name: b.name, ds: +((latest.share?.[b.id]||0) - (earliest.share?.[b.id]||0)).toFixed(1), dc: +((latest.considerationP?.[b.id]||0) - (earliest.considerationP?.[b.id]||0)).toFixed(1) })).sort((a,b) => b.ds - a.ds);
  const activeDelta  = (latest.activeTotal||0) - (earliest.activeTotal||0);

  const data = await callClaude({
    messages: [{
      role: "user",
      content: `Senior brand strategist. Analyze these skincare simulation results.

Scenario: "${activeScenario || 'Baseline'}"

Share shifts + consideration shifts: ${shareChanges.map(c => `${c.name}: share ${c.ds>0?'+':''}${c.ds}pp, consideration ${c.dc>0?'+':''}${c.dc}pp`).join(' | ')}
Total active buyer change: ${activeDelta>0?'+':''}${activeDelta}
Avg consideration set size: ${earliest.avgConsidSetSize} → ${latest.avgConsidSetSize}

Write 3-4 sentences of incisive strategic commentary. Distinguish between: (1) share shift, (2) category expansion/contraction, and (3) consideration set dynamics — brands gaining/losing consideration without yet gaining share represent a leading indicator. Be specific about what the consideration data signals for future share trajectory. No bullets.`
    }],
  });
  return data.content?.find(c => c.type === "text")?.text || "";
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App() {
  const [agents,          setAgents]         = useState([]);
  const [socialMap,       setSocialMap]       = useState({});
  const [history,         setHistory]         = useState([]);
  const [tick,            setTick]            = useState(0);
  const [running,         setRunning]         = useState(false);
  const [brandMods,       setBrandMods]       = useState({});
  const [categoryMods,    setCategoryMods]    = useState({});
  const [scenarioQuery,   setScenarioQuery]   = useState("");
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [activeScenario,  setActiveScenario]  = useState(null);
  const [primaryEffect,   setPrimaryEffect]   = useState(null);
  const [narrative,       setNarrative]       = useState("");
  const [insight,         setInsight]         = useState("");
  const [insightLoading,  setInsightLoading]  = useState(false);
  const [activeChart,     setActiveChart]     = useState("share");

  const agentsRef   = useRef([]);
  const brandRef    = useRef({});
  const categoryRef = useRef({});
  const socialRef   = useRef({});
  const intervalRef = useRef(null);

  useEffect(() => { agentsRef.current   = agents;       }, [agents]);
  useEffect(() => { brandRef.current    = brandMods;    }, [brandMods]);
  useEffect(() => { categoryRef.current = categoryMods; }, [categoryMods]);
  useEffect(() => { socialRef.current   = socialMap;    }, [socialMap]);

  const buildHistoryEntry = (tick, s) => ({
    tick, ...s.share,
    activeTotal: s.activeTotal,
    avgConsidSetSize: parseFloat(s.avgConsidSetSize),
    ...Object.fromEntries(Object.entries(s.tierActive).map(([k,v]) => [`tier_${k}`, v])),
    ...Object.fromEntries(BRANDS.map(b => [`aware_${b.id}`, s.awarenessP[b.id]])),
    ...Object.fromEntries(BRANDS.map(b => [`consid_${b.id}`, s.considerationP[b.id]])),
    share: s.share, considerationP: s.considerationP, awarenessP: s.awarenessP,
  });

  const init = useCallback(() => {
    const a  = initAgents();
    const sm = buildSocialMap(a);
    agentsRef.current = a; socialRef.current = sm;
    setAgents(a); setSocialMap(sm);
    const s = getStats(a);
    setHistory([buildHistoryEntry(0, s)]);
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
    setHistory(h => [...h.slice(-49), buildHistoryEntry(h.length, s)]);
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    if (running) intervalRef.current = setInterval(step, 300);
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
    setScenarioQuery(""); setScenarioLoading(false);
    if (result.primaryEffect === "category_expansion" || result.primaryEffect === "category_contraction") setActiveChart("category");
    else if (result.primaryEffect === "consideration_shift") setActiveChart("funnel");
    else setActiveChart("share");
  };

  const resetScenario = () => {
    setBrandMods({}); brandRef.current = {};
    setCategoryMods({}); categoryRef.current = {};
    setActiveScenario(null); setNarrative(""); setInsight(""); setPrimaryEffect(null);
  };

  const currentStats = history[history.length - 1] || {};
  const sortedBrands = [...BRANDS].sort((a, b) => (currentStats[b.id] || 0) - (currentStats[a.id] || 0));

  const effectColors = { share_shift: "#E8A87C", category_expansion: "#6FCF97", category_contraction: "#EB5757", consideration_shift: "#56CCF2", mixed: "#BB6BD9" };
  const effectLabel  = { share_shift: "Share Shift", category_expansion: "Category Expansion", category_contraction: "Category Contraction", consideration_shift: "Consideration Shift", mixed: "Mixed Effects" };

  const PRESETS = [
    "Olay launches a mass sampling campaign, driving trial and first-hand experience",
    "CeraVe gets a viral TikTok dermatologist endorsement, rapidly expanding awareness and salience",
    "A product quality scandal hits Neutrogena, tanking satisfaction and eroding consideration",
    "An economic downturn causes prestige buyers to trade down or exit the category",
    "A clean beauty mega-trend pulls new consumers into prestige naturals",
    "SkinCeuticals drops prices 30% and expands retail, dramatically changing its consideration dynamics",
  ];

  // Funnel chart data: top 5 brands by share for clarity
  const top5 = sortedBrands.slice(0, 5);

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
        .tab{padding:6px 14px;border-radius:3px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;border:1px solid #2a2a2a;background:transparent;color:#555;transition:all .2s}
        .tab.on{background:#1a1a1e;color:#F0EDE8;border-color:#555}
      `}</style>

      {/* Header */}
      <div style={{padding:"24px 36px 18px",borderBottom:"1px solid #1e1e22",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",letterSpacing:".15em",marginBottom:5}}>MATERIAL+ INTELLIGENCE LAB · v3</div>
          <h1 style={{fontSize:"clamp(18px,2.2vw,28px)",fontWeight:400,letterSpacing:"-.02em",lineHeight:1.1}}>
            Skincare Market<br/><span style={{fontStyle:"italic",color:"#E8A87C"}}>Consumer Simulation</span>
          </h1>
        </div>
        <div style={{textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555"}}>
          <div style={{marginBottom:2}}>{agents.filter(a=>a.status==="active").length} active · {agents.filter(a=>a.status==="latent").length} latent</div>
          <div style={{marginBottom:2}}>avg consideration set <span style={{color:"#56CCF2"}}>{currentStats.avgConsidSetSize||"—"}</span></div>
          <div>tick <span style={{color:"#E8A87C"}}>{String(tick).padStart(4,"0")}</span></div>
          {activeScenario && primaryEffect && (
            <div style={{marginTop:5,padding:"3px 10px",background:"#0f0f12",border:`1px solid ${effectColors[primaryEffect]}`,borderRadius:3,fontSize:9,color:effectColors[primaryEffect]}}>
              {effectLabel[primaryEffect]}
            </div>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 310px",minHeight:"calc(100vh - 88px)"}}>

        {/* LEFT */}
        <div style={{padding:"24px 32px",borderRight:"1px solid #1e1e22",overflowY:"auto"}}>

          {/* Controls */}
          <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setRunning(r=>!r)} style={{padding:"8px 22px",background:running?"#2a1a1a":"#E8A87C",color:running?"#E8A87C":"#0D0D0F",border:running?"1px solid #E8A87C":"none",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",fontWeight:500}}>
              {running?"⏸ PAUSE":"▶ RUN"}
            </button>
            <button onClick={step} disabled={running} style={{padding:"8px 16px",background:"transparent",color:running?"#333":"#777",border:"1px solid",borderColor:running?"#2a2a2a":"#444",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:10}}>STEP</button>
            <button onClick={()=>{setRunning(false);setTimeout(init,50)}} style={{padding:"8px 16px",background:"transparent",color:"#555",border:"1px solid #2a2a2a",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:10}}>RESET</button>
            {activeScenario && (
              <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
                <span style={{padding:"4px 10px",background:"#1a1208",border:`1px solid ${effectColors[primaryEffect]||"#E8A87C"}`,borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:9,color:effectColors[primaryEffect]||"#E8A87C"}}>⚡ {activeScenario}</span>
                <button onClick={resetScenario} style={{padding:"4px 8px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:3,color:"#555",fontSize:9,fontFamily:"'DM Mono',monospace"}}>✕</button>
              </div>
            )}
          </div>

          {/* Narrative */}
          {narrative && (
            <div className="fade" style={{marginBottom:18,padding:"12px 16px",background:"#12100e",border:"1px solid #2a2018",borderLeft:`3px solid ${effectColors[primaryEffect]||"#E8A87C"}`,borderRadius:4}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:effectColors[primaryEffect]||"#E8A87C",letterSpacing:".12em",marginBottom:5}}>SCENARIO INTERPRETATION</div>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#ccc",lineHeight:1.6}}>{narrative}</p>
            </div>
          )}

          {/* Chart tabs */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            <button className={`tab${activeChart==="share"?" on":""}`} onClick={()=>setActiveChart("share")}>BRAND SHARE</button>
            <button className={`tab${activeChart==="category"?" on":""}`} onClick={()=>setActiveChart("category")}>CATEGORY SIZE</button>
            <button className={`tab${activeChart==="funnel"?" on":""}`} onClick={()=>setActiveChart("funnel")}>FUNNEL</button>
          </div>

          {/* Share chart */}
          {activeChart==="share" && (
            <div style={{marginBottom:20}}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={history} margin={{top:4,right:8,bottom:4,left:-22}}>
                  <XAxis dataKey="tick" tick={{fill:"#444",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={{stroke:"#222"}}/>
                  <YAxis tick={{fill:"#444",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={false} domain={[0,"auto"]}/>
                  <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:4,fontFamily:"DM Mono",fontSize:9}} labelStyle={{color:"#555"}} formatter={v=>[`${v}%`]}/>
                  {BRANDS.map(b=>(
                    <Line key={b.id} type="monotone" dataKey={b.id} stroke={b.color} dot={false} strokeWidth={1.5} name={b.name}
                      strokeOpacity={Object.keys(brandMods).length===0||brandMods[b.id]?1:0.18}/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category size chart */}
          {activeChart==="category" && (
            <div style={{marginBottom:20}}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={history} margin={{top:4,right:8,bottom:4,left:-22}}>
                  <XAxis dataKey="tick" tick={{fill:"#444",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={{stroke:"#222"}}/>
                  <YAxis tick={{fill:"#444",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:4,fontFamily:"DM Mono",fontSize:9}} labelStyle={{color:"#555"}}/>
                  <Area type="monotone" dataKey="tier_mass"     stroke={TIERS.mass.color}     fill={TIERS.mass.color}     fillOpacity={0.12} strokeWidth={2} name="Mass"     dot={false}/>
                  <Area type="monotone" dataKey="tier_prestige" stroke={TIERS.prestige.color} fill={TIERS.prestige.color} fillOpacity={0.12} strokeWidth={2} name="Prestige" dot={false}/>
                  <Area type="monotone" dataKey="tier_luxury"   stroke={TIERS.luxury.color}   fill={TIERS.luxury.color}   fillOpacity={0.12} strokeWidth={2} name="Luxury"   dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Funnel chart — awareness vs consideration vs share for top 5 brands */}
          {activeChart==="funnel" && (
            <div style={{marginBottom:20}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555",letterSpacing:".1em",marginBottom:10}}>AWARENESS → CONSIDERATION → SHARE (TOP 5 BRANDS)</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {top5.map(b => {
                  const aware  = currentStats[`aware_${b.id}`] || 0;
                  const consid = currentStats[`consid_${b.id}`] || 0;
                  const share  = currentStats[b.id] || 0;
                  const maxVal = Math.max(aware, 1);
                  return (
                    <div key={b.id}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:brandMods[b.id]?"#E8A87C":"#aaa"}}>{b.name}</span>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555"}}>
                          {aware}% → {consid}% → {share}%
                        </span>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        {[{label:"Aware",val:aware,color:"#444"},{label:"Consider",val:consid,color:b.color},{label:"Share",val:share,color:b.color}].map(row=>(
                          <div key={row.label} style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:50,fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555",textAlign:"right"}}>{row.label}</div>
                            <div style={{flex:1,height:4,background:"#1a1a1e",borderRadius:2,overflow:"hidden"}}>
                              <div className="bbar" style={{height:"100%",width:`${(row.val/maxVal)*100}%`,background:row.color,borderRadius:2,opacity:row.label==="Aware"?0.4:1}}/>
                            </div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555",width:30,textAlign:"right"}}>{row.val}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Avg consideration set size trend */}
              <div style={{marginTop:16}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555",letterSpacing:".1em",marginBottom:8}}>AVG CONSIDERATION SET SIZE OVER TIME</div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={history} margin={{top:2,right:8,bottom:2,left:-22}}>
                    <XAxis dataKey="tick" tick={{fill:"#444",fontSize:8,fontFamily:"DM Mono"}} tickLine={false} axisLine={{stroke:"#222"}}/>
                    <YAxis tick={{fill:"#444",fontSize:8,fontFamily:"DM Mono"}} tickLine={false} axisLine={false} domain={[0,"auto"]}/>
                    <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:4,fontFamily:"DM Mono",fontSize:9}} labelStyle={{color:"#555"}} formatter={v=>[`${v} brands`]}/>
                    <Line type="monotone" dataKey="avgConsidSetSize" stroke="#56CCF2" dot={false} strokeWidth={2} name="Avg Consideration Set"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tier meters */}
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555",letterSpacing:".12em",marginBottom:10}}>ACTIVE BUYERS BY TIER</div>
            <div style={{display:"flex",gap:10}}>
              {Object.entries(TIERS).map(([tid, tcfg]) => {
                const active = agents.filter(a=>a.status==="active"&&BRANDS.find(b=>b.id===a.brand)?.tier===tid).length;
                const latent = agents.filter(a=>a.status==="latent"&&a.tier===tid).length;
                const pct    = Math.round(active/Math.max(1,active+latent)*100);
                const hasMod = !!categoryMods[tid];
                return (
                  <div key={tid} style={{flex:1,padding:"10px",background:"#0f0f12",border:`1px solid ${hasMod?tcfg.color:"#1e1e22"}`,borderRadius:4}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:hasMod?tcfg.color:"#555",letterSpacing:".1em",marginBottom:5}}>{tcfg.label.toUpperCase()}{hasMod?" ⚡":""}</div>
                    <div style={{fontSize:18,fontWeight:400,color:tcfg.color,marginBottom:2}}>{active}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#555",marginBottom:5}}>{latent} latent</div>
                    <div style={{height:2,background:"#1a1a1e",borderRadius:1}}>
                      <div style={{height:"100%",width:`${pct}%`,background:tcfg.color,borderRadius:1,transition:"width .6s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Share + funnel bars */}
          <div style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555",letterSpacing:".12em"}}>BRAND FUNNEL SNAPSHOT</div>
              <div style={{display:"flex",gap:12,fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555"}}>
                <span style={{opacity:0.4}}>■ Aware</span>
                <span>■ Consider</span>
                <span style={{opacity:0.7}}>■ Share</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {sortedBrands.map((b,i)=>{
                const aware  = currentStats[`aware_${b.id}`] || 0;
                const consid = currentStats[`consid_${b.id}`] || 0;
                const share  = currentStats[b.id] || 0;
                const maxA   = currentStats[`aware_${sortedBrands[0].id}`] || 1;
                const hasmod = !!brandMods[b.id];
                return (
                  <div key={b.id} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",width:12,textAlign:"right"}}>{i+1}</div>
                    <div style={{width:100,fontFamily:"'DM Sans',sans-serif",fontSize:10,color:hasmod?"#E8A87C":"#888"}}>{b.name}{hasmod?" ⚡":""}</div>
                    <div style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
                      <div style={{height:3,background:"#1a1a1e",borderRadius:1,overflow:"hidden"}}>
                        <div className="bbar" style={{height:"100%",width:`${(aware/maxA)*100}%`,background:b.color,borderRadius:1,opacity:0.25}}/>
                      </div>
                      <div style={{height:3,background:"#1a1a1e",borderRadius:1,overflow:"hidden"}}>
                        <div className="bbar" style={{height:"100%",width:`${(consid/maxA)*100}%`,background:b.color,borderRadius:1,opacity:0.7}}/>
                      </div>
                      <div style={{height:3,background:"#1a1a1e",borderRadius:1,overflow:"hidden"}}>
                        <div className="bbar" style={{height:"100%",width:`${(share/maxA)*100}%`,background:b.color,borderRadius:1}}/>
                      </div>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555",width:52,textAlign:"right"}}>{consid}%→{share}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategic insight */}
          {history.length > 3 && (
            <div>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555",letterSpacing:".12em"}}>STRATEGIC ANALYSIS</div>
                <button onClick={async()=>{
                  setInsightLoading(true);
                  const t = await getStrategicInsight(
                    history.map(h=>({ share: Object.fromEntries(BRANDS.map(b=>[b.id,h[b.id]])), considerationP: Object.fromEntries(BRANDS.map(b=>[b.id,h[`consid_${b.id}`]])), activeTotal: h.activeTotal, avgConsidSetSize: h.avgConsidSetSize, tierActive: Object.fromEntries(["mass","prestige","luxury"].map(t=>[t,h[`tier_${t}`]])) })),
                    activeScenario
                  );
                  setInsight(t); setInsightLoading(false);
                }} disabled={insightLoading} style={{padding:"3px 10px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:3,color:insightLoading?"#333":"#666",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:".1em"}}>
                  {insightLoading?<span className="pulse">ANALYZING…</span>:"GENERATE INSIGHT →"}
                </button>
              </div>
              {insight && (
                <div className="fade" style={{padding:"12px 16px",background:"#0e1014",border:"1px solid #1e2530",borderLeft:"3px solid #56CCF2",borderRadius:4}}>
                  <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#ccc",lineHeight:1.7,fontStyle:"italic"}}>{insight}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Scenario Lab */}
        <div style={{padding:"24px 22px",background:"#0a0a0c",overflowY:"auto"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",letterSpacing:".15em",marginBottom:14}}>SCENARIO LAB</div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#666",lineHeight:1.6,marginBottom:14}}>
            Claude adjusts brand params, category entry/exit rates, <em>and</em> satisfaction scores that drive consideration set dynamics.
          </p>

          <textarea value={scenarioQuery} onChange={e=>setScenarioQuery(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleScenario();}}}
            placeholder="e.g. Olay launches a sampling campaign driving first-hand experience across mass tier…"
            rows={4}
            style={{width:"100%",padding:"11px",background:"#13131a",border:"1px solid #2a2a35",borderRadius:4,color:"#F0EDE8",fontFamily:"'DM Sans',sans-serif",fontSize:11,lineHeight:1.6,marginBottom:10}}
          />
          <button onClick={handleScenario} disabled={scenarioLoading||!scenarioQuery.trim()} style={{width:"100%",padding:"10px",background:scenarioLoading||!scenarioQuery.trim()?"#1a1a1e":"#E8A87C",color:scenarioLoading||!scenarioQuery.trim()?"#333":"#0D0D0F",border:"none",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",fontWeight:500,marginBottom:18}}>
            {scenarioLoading?<span className="pulse">INTERPRETING…</span>:"APPLY SCENARIO →"}
          </button>

          <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",letterSpacing:".12em",marginBottom:8}}>EXAMPLE SCENARIOS</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:20}}>
            {PRESETS.map((p,i)=><button key={i} className="chip" onClick={()=>setScenarioQuery(p)}>{p}</button>)}
          </div>

          {/* Category modifiers display */}
          {Object.keys(categoryMods).length > 0 && (
            <div className="fade" style={{marginBottom:16,padding:"10px 12px",background:"#0f0f12",border:"1px solid #1e2a1e",borderLeft:"3px solid #6FCF97",borderRadius:4}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#6FCF97",letterSpacing:".12em",marginBottom:6}}>CATEGORY MODIFIERS</div>
              {Object.entries(categoryMods).map(([tier, mod])=>(
                <div key={tier} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#888",textTransform:"capitalize"}}>{tier}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#6FCF97"}}>
                    {mod.entryRate!=null&&`entry ${(mod.entryRate*100).toFixed(1)}%`}
                    {mod.entryRate!=null&&mod.exitRate!=null&&" · "}
                    {mod.exitRate!=null&&`exit ${(mod.exitRate*100).toFixed(1)}%`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Theory legend */}
          <div style={{marginBottom:16,padding:"10px 12px",background:"#0d0d10",border:"1px solid #1e1e28",borderRadius:4}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",letterSpacing:".12em",marginBottom:8}}>MODEL ARCHITECTURE</div>
            {[
              {layer:"L1",label:"Category Participation",desc:"Dynamic m — tier entry/exit rates",color:"#6FCF97"},
              {layer:"L2",label:"Bass Awareness Diffusion",desc:"p (advertising) + q (WOM) → salience",color:"#E8A87C"},
              {layer:"L3",label:"Consideration Filtering",desc:"Salience threshold, experience-adjusted",color:"#56CCF2"},
              {layer:"L4",label:"Brand Choice (Softmax)",desc:"Utility over active consideration set",color:"#BB6BD9"},
            ].map(l=>(
              <div key={l.layer} style={{display:"flex",gap:8,marginBottom:5,alignItems:"flex-start"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:l.color,width:16,flexShrink:0,marginTop:1}}>{l.layer}</div>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#888"}}>{l.label}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#555"}}>{l.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Segments */}
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",letterSpacing:".12em",marginBottom:8}}>SEGMENTS · SALIENCE DECAY · CONSID. THRESHOLD</div>
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:18}}>
            {SEGMENTS.map(s=>{
              const count = agents.filter(a=>a.segment===s.id&&a.status==="active").length;
              return (
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#777",flex:1}}>{s.label}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",marginRight:8}}>{(s.salienceDecay*10).toFixed(0)}% · {Math.round(s.considerationThreshold*100)}%</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#555",width:28,textAlign:"right"}}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Brand key */}
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",letterSpacing:".12em",marginBottom:8}}>BRAND KEY</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px"}}>
            {BRANDS.map(b=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:b.color,flexShrink:0}}/>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:brandMods[b.id]?"#E8A87C":"#666"}}>{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
