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
const MAX_PRICE     = 95; // normalisation denominator for price score

// ─── EVENT SCHEDULE HELPERS ───────────────────────────────────────────────────
// priceEvents:        [{ brandId, startTick, endTick, modifier }]  modifier multiplies base price
//   e.g. 20% promo → modifier: 0.80
// availabilityEvents: [{ brandId, startTick, endTick, availability }] 0-1
//   availability < AVAIL_GATE removes brand from consideration set entirely
const AVAIL_GATE = 0.20; // below this → brand excluded from consideration

function getEffectivePrice(brandId, tick, basePrice, priceEvents) {
  const active = priceEvents.filter(e => e.brandId === brandId && tick >= e.startTick && tick <= e.endTick);
  if (!active.length) return basePrice;
  // stack modifiers multiplicatively (rare to have two at once, but handle gracefully)
  return basePrice * active.reduce((acc, e) => acc * e.modifier, 1);
}

function getEffectiveAvailability(brandId, tick, availabilityEvents) {
  const active = availabilityEvents.filter(e => e.brandId === brandId && tick >= e.startTick && tick <= e.endTick);
  if (!active.length) return 1.0; // default: fully available
  return Math.min(...active.map(e => e.availability)); // take the most restrictive
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function callClaude(body) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1800, ...body }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── SIMULATION ENGINE ────────────────────────────────────────────────────────

function computeUtility(brand, seg, brandMods = {}, effectivePrice = null) {
  const b = { ...brand, ...(brandMods[brand.id] || {}) };
  const price     = effectivePrice != null ? effectivePrice : b.price;
  const priceScore = 1 - price / MAX_PRICE;
  return (
    seg.priceWeight  * priceScore +
    seg.equityWeight * b.equity +
    seg.innovWeight  * b.innovation +
    seg.distWeight   * b.distribution
  );
}

function softmax(utilities, temp = 3) {
  const expU  = utilities.map(u => Math.exp(u * temp));
  const total = expU.reduce((a, b) => a + b, 0);
  const probs = expU.map(u => u / total);
  let r = Math.random(), cum = 0;
  for (let i = 0; i < probs.length; i++) { cum += probs[i]; if (r <= cum) return i; }
  return probs.length - 1;
}

function updateExperience(prior, n, realSat, expWeight) {
  const priorWeight = 1 / (1 + n * expWeight);
  return prior * priorWeight + realSat * (1 - priorWeight);
}

function initBrandState(awareBrands, currentBrand, seg) {
  const salience      = {};
  const experience    = {};
  const purchaseCount = {};
  for (const b of BRANDS) {
    if (awareBrands.includes(b.id)) {
      salience[b.id]      = b.id === currentBrand ? 0.7 : 0.2 + Math.random() * 0.3;
      experience[b.id]    = b.id === currentBrand ? b.satisfaction : b.equity;
      purchaseCount[b.id] = b.id === currentBrand ? 3 : 0;
    }
  }
  return { salience, experience, purchaseCount };
}

function initAgents() {
  const agents = [];
  let id = 0;
  for (const tier of Object.keys(TIERS)) {
    const cfg       = TIERS[tier];
    const tierBrands = BRANDS.filter(b => b.tier === tier);
    const tierTotal  = Math.round(TOTAL_AGENTS * (tier === "mass" ? 0.60 : tier === "prestige" ? 0.25 : 0.15));
    const latentN    = Math.round(tierTotal * cfg.latentShare);
    const activeN    = tierTotal - latentN;
    const segs       = SEGMENTS.filter(s => s.tierAffinity === tier || (tier === "mass" && s.tierAffinity === "mass"));
    const allSegs    = SEGMENTS;

    for (let i = 0; i < activeN; i++) {
      const seg       = allSegs[Math.floor(Math.random() * allSegs.length)];
      const brand     = tierBrands[Math.floor(Math.random() * tierBrands.length)];
      const aware     = [brand.id, ...BRANDS.filter(b => b.id !== brand.id && Math.random() < 0.4).map(b => b.id)];
      const { salience, experience, purchaseCount } = initBrandState(aware, brand.id, seg);
      agents.push({ id: id++, status: "active", segment: seg.id, brand: brand.id, loyalty: 0.3 + Math.random() * 0.4, awareness: aware, salience, experience, purchaseCount });
    }
    for (let i = 0; i < latentN; i++) {
      const seg   = allSegs[Math.floor(Math.random() * allSegs.length)];
      const aware = BRANDS.filter(() => Math.random() < 0.2).map(b => b.id);
      const salience = {}; const experience = {}; const purchaseCount = {};
      for (const bid of aware) { salience[bid] = Math.random() * 0.15; experience[bid] = BRANDS.find(b => b.id === bid)?.equity || 0.5; purchaseCount[bid] = 0; }
      agents.push({ id: id++, status: "latent", segment: seg.id, brand: null, loyalty: 0, tier, awareness: aware, salience, experience, purchaseCount });
    }
  }
  return agents;
}

function buildSocialMap(agents) {
  const map = {};
  const ids = agents.map(a => a.id);
  for (const a of agents) {
    const peers = [];
    while (peers.length < 5) {
      const pid = ids[Math.floor(Math.random() * ids.length)];
      if (pid !== a.id && !peers.includes(pid)) peers.push(pid);
    }
    map[a.id] = peers;
  }
  return map;
}

// ─── MAIN TICK ────────────────────────────────────────────────────────────────
function simulateTick(agents, brandMods = {}, categoryMods = {}, socialMap = {}, tick = 0, priceEvents = [], availabilityEvents = []) {
  const segMap   = Object.fromEntries(SEGMENTS.map(s => [s.id, s]));
  const brandMap = Object.fromEntries(BRANDS.map(b => [b.id, b]));
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  // Pre-compute effective prices and availability for this tick
  const effectivePrices = Object.fromEntries(BRANDS.map(b => {
    const base = brandMods[b.id]?.price ?? b.price;
    return [b.id, getEffectivePrice(b.id, tick, base, priceEvents)];
  }));

  const effectiveAvailability = Object.fromEntries(BRANDS.map(b => [
    b.id, getEffectiveAvailability(b.id, tick, availabilityEvents)
  ]));

  const activeCounts = { mass: 0, prestige: 0, luxury: 0 };
  const totalByTier  = { mass: 0, prestige: 0, luxury: 0 };
  for (const a of agents) {
    const tier = a.status === "active" ? (brandMap[a.brand]?.tier || "mass") : (a.tier || "mass");
    if (a.status === "active") activeCounts[tier]++;
    totalByTier[tier]++;
  }

  return agents.map(agent => {
    const seg = segMap[agent.segment];

    // ── LAYER 1: Category participation ──────────────────────────────────────
    if (agent.status === "latent") {
      const tier     = agent.tier || "mass";
      const catMod   = categoryMods[tier] || {};
      const entryRate = Math.max(0, Math.min(0.99,
        (catMod.entryRate ?? TIERS[tier].baseEntryRate) +
        (activeCounts[tier] / Math.max(1, totalByTier[tier])) * 0.03
      ));

      const newSalience  = { ...agent.salience };
      const newAwareness = new Set(agent.awareness);
      for (const nId of (socialMap[agent.id] || [])) {
        const nb = agentMap[nId];
        if (nb?.status === "active" && nb.brand) {
          const b = brandMap[nb.brand];
          if (b) {
            const q = brandMods[b.id]?.bassQ ?? b.bassQ;
            if (!newAwareness.has(b.id) && Math.random() < q * 0.04) {
              newAwareness.add(b.id); newSalience[b.id] = 0.15;
              agent.experience[b.id] = b.equity; agent.purchaseCount[b.id] = 0;
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
        const awarenessArr = [...newAwareness];
        // Filter by availability: don't enter market to buy an out-of-stock brand
        const eligible = BRANDS.filter(b =>
          awarenessArr.includes(b.id) &&
          (newSalience[b.id] || 0) >= seg.considerationThreshold &&
          effectiveAvailability[b.id] >= AVAIL_GATE
        );
        const pool = eligible.length > 0
          ? eligible
          : BRANDS.filter(b => awarenessArr.includes(b.id) && effectiveAvailability[b.id] >= AVAIL_GATE);
        if (pool.length === 0) return { ...agent, awareness: awarenessArr, salience: newSalience };
        const utils  = pool.map(b => Math.max(0.01, computeUtility(b, seg, brandMods, effectivePrices[b.id])));
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
    const newSalience     = { ...agent.salience };
    const newAwareness    = new Set(agent.awareness);
    const newExperience   = { ...agent.experience };
    const newPurchaseCount = { ...agent.purchaseCount };

    for (const bid of Object.keys(newSalience)) {
      if (bid !== agent.brand) {
        newSalience[bid] = Math.max(0, (newSalience[bid] || 0) - seg.salienceDecay * 0.1);
      }
    }

    for (const b of BRANDS) {
      const bMod = brandMods[b.id] || {};
      const p    = bMod.bassP ?? b.bassP;
      if (newAwareness.has(b.id)) {
        newSalience[b.id] = Math.min(1, (newSalience[b.id] || 0) + p * 0.25);
      } else if (Math.random() < p * 0.3) {
        newAwareness.add(b.id); newSalience[b.id] = 0.15;
        newExperience[b.id] = b.equity; newPurchaseCount[b.id] = 0;
      }
    }

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

    if (agent.brand && newExperience[agent.brand] != null) {
      const expBoost = newExperience[agent.brand] * 0.15;
      newSalience[agent.brand] = Math.min(1, (newSalience[agent.brand] || 0.5) + expBoost);
    }

    // ── LAYER 3: Consideration set — with availability gate ───────────────────
    const awarenessArr = [...newAwareness];
    const considerationSet = BRANDS.filter(b => {
      if (!awarenessArr.includes(b.id)) return false;
      // Hard availability gate: stockout removes brand from consideration set
      if (effectiveAvailability[b.id] < AVAIL_GATE) return false;
      const sal       = newSalience[b.id] || 0;
      const purchases = newPurchaseCount[b.id] || 0;
      const threshold = seg.considerationThreshold * Math.max(0.5, 1 - purchases * 0.08);
      return sal >= threshold;
    });

    // Always keep current brand in consideration unless it's stocked out
    const currentAvail = effectiveAvailability[agent.brand] ?? 1.0;
    const choiceSet = (considerationSet.some(b => b.id === agent.brand) || currentAvail < AVAIL_GATE)
      ? considerationSet
      : [...considerationSet, brandMap[agent.brand]].filter(Boolean);

    // If current brand is stocked out and it's the only option, agent can't buy
    if (choiceSet.length === 0) {
      return { ...agent, awareness: awarenessArr, salience: newSalience, experience: newExperience, purchaseCount: newPurchaseCount };
    }

    // Loyalty check — if loyal AND current brand is available, stay
    if (currentAvail >= AVAIL_GATE && Math.random() < agent.loyalty * seg.loyaltyRate) {
      if (agent.brand) {
        const b    = brandMap[agent.brand];
        const bMod = brandMods[agent.brand] || {};
        const realSat = bMod.satisfaction ?? b?.satisfaction ?? b?.equity ?? 0.7;
        newExperience[agent.brand]    = updateExperience(newExperience[agent.brand] ?? b?.equity, newPurchaseCount[agent.brand] || 0, realSat, seg.experienceWeight);
        newPurchaseCount[agent.brand] = (newPurchaseCount[agent.brand] || 0) + 1;
      }
      return { ...agent, awareness: awarenessArr, salience: newSalience, experience: newExperience, purchaseCount: newPurchaseCount };
    }

    // ── LAYER 4: Softmax brand choice ─────────────────────────────────────────
    const socialBoost = {};
    for (const nId of (socialMap[agent.id] || [])) {
      const nb = agentMap[nId];
      if (nb?.status === "active" && nb.brand && choiceSet.some(b => b.id === nb.brand)) {
        socialBoost[nb.brand] = (socialBoost[nb.brand] || 0) + seg.socialWeight / (socialMap[agent.id].length || 1);
      }
    }

    // Use effective (event-adjusted) prices in utility computation
    const utils = choiceSet.map(b => {
      const baseU  = computeUtility(b, seg, brandMods, effectivePrices[b.id]);
      const expAdj = (newExperience[b.id] ?? b.equity) * 0.20;
      const socAdj = (socialBoost[b.id] || 0) * 0.15;
      return baseU + expAdj + socAdj;
    });

    const chosen  = choiceSet[softmax(utils)].id;
    const chosenB = brandMap[chosen];
    const bMod    = brandMods[chosen] || {};
    const realSat = bMod.satisfaction ?? chosenB?.satisfaction ?? chosenB?.equity ?? 0.7;
    const newLoy  = chosen === agent.brand
      ? Math.min(0.95, agent.loyalty + 0.02)
      : Math.max(0.20, agent.loyalty - 0.10);

    newExperience[chosen]    = updateExperience(newExperience[chosen] ?? chosenB?.equity, newPurchaseCount[chosen] || 0, realSat, seg.experienceWeight);
    newPurchaseCount[chosen] = (newPurchaseCount[chosen] || 0) + 1;

    const expDelta = realSat - (newExperience[chosen] || 0.5);
    newSalience[chosen] = Math.min(1, Math.max(0, (newSalience[chosen] || 0.4) + expDelta * 0.2));

    return { ...agent, brand: chosen, loyalty: newLoy, awareness: awarenessArr, salience: newSalience, experience: newExperience, purchaseCount: newPurchaseCount };
  });
}

function bMod_q(b, brandMods) { return brandMods[b.id]?.bassQ ?? b.bassQ; }

function getStats(agents) {
  const active = agents.filter(a => a.status === "active");
  const counts = Object.fromEntries(BRANDS.map(b => [b.id, 0]));
  for (const a of active) if (a.brand) counts[a.brand]++;
  const total = active.length || 1;
  const share = Object.fromEntries(BRANDS.map(b => [b.id, +(counts[b.id] / total * 100).toFixed(1)]));

  const tierActive = { mass: 0, prestige: 0, luxury: 0 };
  const tierLatent = { mass: 0, prestige: 0, luxury: 0 };
  for (const a of agents) {
    const tier = a.status === "active" ? (BRANDS.find(b => b.id === a.brand)?.tier || "mass") : (a.tier || "mass");
    if (a.status === "active") tierActive[tier]++; else tierLatent[tier]++;
  }

  const segMap             = Object.fromEntries(SEGMENTS.map(s => [s.id, s]));
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
    const seg   = segMap[a.segment];
    const inSet = BRANDS.filter(b => a.awareness?.includes(b.id) && (a.salience?.[b.id] || 0) >= seg.considerationThreshold * Math.max(0.5, 1 - (a.purchaseCount?.[b.id] || 0) * 0.08)).length;
    return sum + inSet;
  }, 0) / Math.max(1, active.length)).toFixed(2);

  return { share, activeTotal: active.length, tierActive, tierLatent, awarenessP, considerationP, avgConsidSetSize };
}

// ─── CLAUDE SCENARIO INTERPRETER (v4) ────────────────────────────────────────
async function interpretScenario(query, stats, currentTick) {
  const shareStr  = Object.entries(stats.share).map(([id, p]) => `${BRANDS.find(b => b.id === id)?.name}: ${p}%`).join(", ");
  const funnelStr = BRANDS.map(b => `${b.name}: aware=${stats.awarenessP[b.id]}% consid=${stats.considerationP[b.id]}% share=${stats.share[b.id]}%`).join("; ");
  const tierStr   = Object.entries(stats.tierActive).map(([t, n]) => `${t}: ${n} active / ${stats.tierLatent[t]} latent`).join(", ");

  const data = await callClaude({
    system: `You are an expert consumer insights strategist configuring a 4-layer skincare ABM. Current tick: ${currentTick}.

Current state:
- Funnel (awareness → consideration → share): ${funnelStr}
- Tier participation: ${tierStr}
- Avg consideration set size: ${stats.avgConsidSetSize} brands

Brand IDs: olay, cerave, neutrogena, lorealparis, aveeno, clinique, estee, skinceuticals, cetaphil, tatcha
Tiers: mass, prestige, luxury

BASE PRICES (for reference when setting price events):
olay:$18, cerave:$16, neutrogena:$15, lorealparis:$22, aveeno:$17, clinique:$45, estee:$65, skinceuticals:$80, cetaphil:$14, tatcha:$95

You can adjust FIVE parameter types:
1. brandModifiers — persistent brand attribute changes: equity(0-1), innovation(0-1), distribution(0-1), bassP(0-0.1), bassQ(0-0.8), satisfaction(0-1)
   NOTE: Do NOT include price in brandModifiers — use priceEvents instead.
2. categoryModifiers — entryRate/exitRate per tier
3. priceEvents — time-limited price changes: [{brandId, startTick, endTick, modifier}]
   modifier multiplies base price: 0.80 = 20% discount, 1.20 = 20% increase
   Events should span realistic durations (e.g. a 4-week promo = 4 ticks)
4. availabilityEvents — time-limited availability changes: [{brandId, startTick, endTick, availability}]
   availability 0-1: 0 = full stockout (removed from consideration), 0.5 = partial/constrained
   Gate threshold is 0.20 — below this the brand is excluded from consideration sets entirely
5. brand satisfaction — set in brandModifiers to drive experience update dynamics

Respond ONLY with valid JSON, no markdown:
{
  "brandModifiers": { "brandId": { "equity":0-1, "innovation":0-1, "distribution":0-1, "bassP":0-0.1, "bassQ":0-0.8, "satisfaction":0-1 } },
  "categoryModifiers": { "tier": { "entryRate":0-0.15, "exitRate":0-0.08 } },
  "priceEvents": [{ "brandId": "id", "startTick": N, "endTick": N, "modifier": 0.0-2.0, "label": "short description" }],
  "availabilityEvents": [{ "brandId": "id", "startTick": N, "endTick": N, "availability": 0.0-1.0, "label": "short description" }],
  "narrative": "2-3 sentences covering brand dynamics, price/availability effects, and consideration set implications",
  "scenarioTitle": "Max 5 words",
  "primaryEffect": "share_shift" | "category_expansion" | "category_contraction" | "consideration_shift" | "price_event" | "mixed"
}

Only include affected brands/tiers/events. Be bold — changes must produce visible simulation effects.
For promotional pricing: use priceEvents with startTick=${currentTick}, endTick=${currentTick + 4}, modifier 0.70-0.85
For stockouts: use availabilityEvents with availability 0.0, realistic duration 3-6 ticks
For distribution gains: raise distribution in brandModifiers (persistent) AND optionally add bassP boost`,
    messages: [{ role: "user", content: query }],
  });

  const text = data.content?.find(c => c.type === "text")?.text || "{}";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { brandModifiers: {}, categoryModifiers: {}, priceEvents: [], availabilityEvents: [], narrative: "Scenario applied.", scenarioTitle: "Custom Scenario", primaryEffect: "mixed" };
  }
}

async function getStrategicInsight(history, activeScenario) {
  const latest   = history[history.length - 1] || {};
  const earliest = history[0] || {};
  const shareChanges = BRANDS.map(b => ({ name: b.name, ds: +((latest.share?.[b.id]||0) - (earliest.share?.[b.id]||0)).toFixed(1), dc: +((latest.considerationP?.[b.id]||0) - (earliest.considerationP?.[b.id]||0)).toFixed(1) })).sort((a, b) => b.ds - a.ds);
  const activeDelta  = (latest.activeTotal||0) - (earliest.activeTotal||0);

  const data = await callClaude({
    messages: [{
      role: "user",
      content: `Senior brand strategist. Analyze these skincare simulation results.

Scenario: "${activeScenario || 'Baseline'}"

Share shifts + consideration shifts: ${shareChanges.map(c => `${c.name}: share ${c.ds>0?'+':''}${c.ds}pp, consideration ${c.dc>0?'+':''}${c.dc}pp`).join(' | ')}
Total active buyer change: ${activeDelta>0?'+':''}${activeDelta}
Avg consideration set size: ${earliest.avgConsidSetSize} → ${latest.avgConsidSetSize}

Write 3-4 sentences of incisive strategic commentary. Distinguish between: (1) share shift, (2) category expansion/contraction, (3) consideration set dynamics, and (4) price/availability event effects — temporary price promotions create share bumps that may or may not persist; stockouts create consideration set erosion that outlasts the stockout itself. Be specific about what the data signals for future trajectory. No bullets.`
    }],
  });
  return data.content?.find(c => c.type === "text")?.text || "";
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App() {
  const [agents,              setAgents]             = useState([]);
  const [socialMap,           setSocialMap]           = useState({});
  const [history,             setHistory]             = useState([]);
  const [tick,                setTick]                = useState(0);
  const [running,             setRunning]             = useState(false);
  const [brandMods,           setBrandMods]           = useState({});
  const [categoryMods,        setCategoryMods]        = useState({});
  const [priceEvents,         setPriceEvents]         = useState([]);
  const [availabilityEvents,  setAvailabilityEvents]  = useState([]);
  const [scenarioQuery,       setScenarioQuery]       = useState("");
  const [scenarioLoading,     setScenarioLoading]     = useState(false);
  const [activeScenario,      setActiveScenario]      = useState(null);
  const [primaryEffect,       setPrimaryEffect]       = useState(null);
  const [narrative,           setNarrative]           = useState("");
  const [insight,             setInsight]             = useState("");
  const [insightLoading,      setInsightLoading]      = useState(false);
  const [activeChart,         setActiveChart]         = useState("share");

  const agentsRef       = useRef([]);
  const brandRef        = useRef({});
  const categoryRef     = useRef({});
  const socialRef       = useRef({});
  const priceRef        = useRef([]);
  const availRef        = useRef([]);
  const tickRef         = useRef(0);
  const intervalRef     = useRef(null);

  useEffect(() => { agentsRef.current   = agents;             }, [agents]);
  useEffect(() => { brandRef.current    = brandMods;          }, [brandMods]);
  useEffect(() => { categoryRef.current = categoryMods;       }, [categoryMods]);
  useEffect(() => { socialRef.current   = socialMap;          }, [socialMap]);
  useEffect(() => { priceRef.current    = priceEvents;        }, [priceEvents]);
  useEffect(() => { availRef.current    = availabilityEvents; }, [availabilityEvents]);

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
    setTick(0); tickRef.current = 0;
    setBrandMods({}); brandRef.current = {};
    setCategoryMods({}); categoryRef.current = {};
    setPriceEvents([]); priceRef.current = [];
    setAvailabilityEvents([]); availRef.current = [];
    setActiveScenario(null); setNarrative(""); setInsight(""); setPrimaryEffect(null);
  }, []);

  useEffect(() => { init(); }, []);

  const step = useCallback(() => {
    const currentTick = tickRef.current;
    const next = simulateTick(agentsRef.current, brandRef.current, categoryRef.current, socialRef.current, currentTick, priceRef.current, availRef.current);
    agentsRef.current = next;
    setAgents([...next]);
    const s = getStats(next);
    const newTick = currentTick + 1;
    tickRef.current = newTick;
    setHistory(h => [...h.slice(-49), buildHistoryEntry(newTick, s)]);
    setTick(newTick);
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
    const result = await interpretScenario(scenarioQuery, stats, tickRef.current);
    setBrandMods(result.brandModifiers || {}); brandRef.current = result.brandModifiers || {};
    setCategoryMods(result.categoryModifiers || {}); categoryRef.current = result.categoryModifiers || {};
    const newPE = result.priceEvents || [];
    const newAE = result.availabilityEvents || [];
    setPriceEvents(newPE); priceRef.current = newPE;
    setAvailabilityEvents(newAE); availRef.current = newAE;
    setActiveScenario(result.scenarioTitle || "Custom");
    setNarrative(result.narrative || "");
    setPrimaryEffect(result.primaryEffect || "mixed");
    setScenarioQuery(""); setScenarioLoading(false);
    if (result.primaryEffect === "category_expansion" || result.primaryEffect === "category_contraction") setActiveChart("category");
    else if (result.primaryEffect === "consideration_shift") setActiveChart("funnel");
    else if (result.primaryEffect === "price_event") setActiveChart("params");
    else setActiveChart("share");
  };

  const resetScenario = () => {
    setBrandMods({}); brandRef.current = {};
    setCategoryMods({}); categoryRef.current = {};
    setPriceEvents([]); priceRef.current = [];
    setAvailabilityEvents([]); availRef.current = [];
    setActiveScenario(null); setNarrative(""); setInsight(""); setPrimaryEffect(null);
  };

  const currentStats = history[history.length - 1] || {};
  const sortedBrands = [...BRANDS].sort((a, b) => (currentStats[b.id] || 0) - (currentStats[a.id] || 0));

  const effectColors = { share_shift: "#E8A87C", category_expansion: "#6FCF97", category_contraction: "#EB5757", consideration_shift: "#56CCF2", price_event: "#F2C94C", mixed: "#BB6BD9" };
  const effectLabel  = { share_shift: "Share Shift", category_expansion: "Category Expansion", category_contraction: "Category Contraction", consideration_shift: "Consideration Shift", price_event: "Price / Availability Event", mixed: "Mixed Effects" };

  const PRESETS = [
    "Olay runs a 4-week 25% promotional price cut to drive trial in the mass tier",
    "CeraVe gets a viral TikTok dermatologist endorsement, rapidly expanding awareness and salience",
    "Neutrogena faces a 5-week supply chain disruption causing stockouts at major retailers",
    "An economic downturn causes prestige buyers to trade down or exit the category",
    "SkinCeuticals launches a limited-time 20% loyalty discount for repeat buyers",
    "A clean beauty mega-trend pulls new consumers into prestige naturals",
  ];

  const top5 = sortedBrands.slice(0, 5);

  // ── Parameter table data ───────────────────────────────────────────────────
  const paramRows = BRANDS.map(b => {
    const mod  = brandMods[b.id] || {};
    const ep   = priceEvents.filter(e => e.brandId === b.id && tick >= e.startTick && tick <= e.endTick);
    const ae   = availabilityEvents.filter(e => e.brandId === b.id && tick >= e.startTick && tick <= e.endTick);
    const effectivePrice  = ep.length ? (mod.price ?? b.price) * ep.reduce((acc, e) => acc * e.modifier, 1) : (mod.price ?? b.price);
    const effectiveAvail  = ae.length ? Math.min(...ae.map(e => e.availability)) : 1.0;
    const hasMod = Object.keys(mod).length > 0 || ep.length > 0 || ae.length > 0;
    return {
      brand: b,
      hasMod,
      params: [
        { label: "Price ($)",      base: b.price,        current: +effectivePrice.toFixed(2),     unit: "$",  isPrice: true,  changed: ep.length > 0 || (mod.price != null && mod.price !== b.price) },
        { label: "Equity",         base: b.equity,       current: mod.equity ?? b.equity,         unit: "",   isPrice: false, changed: mod.equity != null && mod.equity !== b.equity },
        { label: "Innovation",     base: b.innovation,   current: mod.innovation ?? b.innovation, unit: "",   isPrice: false, changed: mod.innovation != null && mod.innovation !== b.innovation },
        { label: "Distribution",   base: b.distribution, current: mod.distribution ?? b.distribution, unit: "", isPrice: false, changed: mod.distribution != null && mod.distribution !== b.distribution },
        { label: "Satisfaction",   base: b.satisfaction, current: mod.satisfaction ?? b.satisfaction, unit: "", isPrice: false, changed: mod.satisfaction != null && mod.satisfaction !== b.satisfaction },
        { label: "Availability",   base: 1.0,            current: +effectiveAvail.toFixed(2),     unit: "",   isPrice: false, changed: ae.length > 0 },
        { label: "bassP",          base: b.bassP,        current: mod.bassP ?? b.bassP,           unit: "",   isPrice: false, changed: mod.bassP != null && mod.bassP !== b.bassP },
        { label: "bassQ",          base: b.bassQ,        current: mod.bassQ ?? b.bassQ,           unit: "",   isPrice: false, changed: mod.bassQ != null && mod.bassQ !== b.bassQ },
      ],
    };
  });

  // Active events summary
  const activePriceEvents = priceEvents.filter(e => tick >= e.startTick && tick <= e.endTick);
  const activeAvailEvents = availabilityEvents.filter(e => tick >= e.startTick && tick <= e.endTick);
  const pendingPriceEvents = priceEvents.filter(e => tick < e.startTick);
  const pendingAvailEvents = availabilityEvents.filter(e => tick < e.startTick);

  return (
    <div style={{ minHeight:"100vh", background:"#F7F6F3", color:"#1A1A1A", fontFamily:"'DM Serif Display',Georgia,serif", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#E8E6E0} ::-webkit-scrollbar-thumb{background:#B0ADA6;border-radius:2px}
        .bbar{transition:width .6s cubic-bezier(.4,0,.2,1)}
        .pulse{animation:pulse 2s infinite} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .fade{animation:fadeIn .4s ease} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        textarea{outline:none;resize:none} button{cursor:pointer;font-family:inherit}
        .chip{transition:all .2s;border:1px solid #D8D5CE;background:#FFFFFF;padding:7px 12px;border-radius:4px;font-family:'DM Sans',sans-serif;font-size:11px;color:#666;text-align:left}
        .chip:hover{border-color:#C07A4A;color:#1A1A1A;background:#FDF5EE}
        .tab{padding:6px 14px;border-radius:3px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;border:1px solid #D8D5CE;background:transparent;color:#999;transition:all .2s}
        .tab.on{background:#FFFFFF;color:#1A1A1A;border-color:#888;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
        .ptable td,.ptable th{padding:4px 8px;font-family:'DM Mono',monospace;font-size:9px;border-bottom:1px solid #ECEAE4;white-space:nowrap}
        .ptable th{color:#999;font-weight:400;letter-spacing:.08em}
        .changed{color:#B07A20}
        .unavail{color:#C0392B}
        .evt-badge{display:inline-block;padding:2px 6px;border-radius:2px;font-family:'DM Mono',monospace;font-size:8px;margin-right:4px;margin-bottom:3px}
      `}</style>

      {/* Header */}
      <div style={{padding:"24px 36px 18px",borderBottom:"1px solid #E0DDD6",background:"#FFFFFF",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#999",letterSpacing:".15em",marginBottom:5}}>MATERIAL+ INTELLIGENCE LAB · v4</div>
          <h1 style={{fontSize:"clamp(18px,2.2vw,28px)",fontWeight:400,letterSpacing:"-.02em",lineHeight:1.1}}>
            Skincare Market<br/><span style={{fontStyle:"italic",color:"#C07A4A"}}>Consumer Simulation</span>
          </h1>
        </div>
        <div style={{textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:10,color:"#888"}}>
          <div style={{marginBottom:2}}>{agents.filter(a=>a.status==="active").length} active · {agents.filter(a=>a.status==="latent").length} latent</div>
          <div style={{marginBottom:2}}>avg consideration set <span style={{color:"#2980B9"}}>{currentStats.avgConsidSetSize||"—"}</span></div>
          <div>tick <span style={{color:"#C07A4A"}}>{String(tick).padStart(4,"0")}</span></div>
          {activePriceEvents.length > 0 && (
            <div style={{marginTop:4,fontSize:8,color:"#B07A20"}}>⚡ {activePriceEvents.length} price event{activePriceEvents.length>1?"s":""} active</div>
          )}
          {activeAvailEvents.length > 0 && (
            <div style={{marginTop:2,fontSize:8,color:"#C0392B"}}>⚠ {activeAvailEvents.length} availability event{activeAvailEvents.length>1?"s":""} active</div>
          )}
          {activeScenario && primaryEffect && (
            <div style={{marginTop:5,padding:"3px 10px",background:"#FDF8F2",border:`1px solid ${effectColors[primaryEffect]}`,borderRadius:3,fontSize:9,color:effectColors[primaryEffect]}}>
              {effectLabel[primaryEffect]}
            </div>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 310px",minHeight:"calc(100vh - 88px)"}}>

        {/* LEFT */}
        <div style={{padding:"24px 32px",borderRight:"1px solid #E0DDD6",overflowY:"auto",background:"#F7F6F3"}}>

          {/* Controls */}
          <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setRunning(r=>!r)} style={{padding:"8px 22px",background:running?"#FDE8E8":"#C07A4A",color:running?"#C0392B":"#FFFFFF",border:running?"1px solid #C0392B":"none",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",fontWeight:500}}>
              {running?"⏸ PAUSE":"▶ RUN"}
            </button>
            <button onClick={step} disabled={running} style={{padding:"8px 16px",background:"transparent",color:running?"#CCC":"#555",border:"1px solid",borderColor:running?"#E0DDD6":"#B0ADA6",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:10}}>STEP</button>
            <button onClick={()=>{setRunning(false);setTimeout(init,50)}} style={{padding:"8px 16px",background:"transparent",color:"#888",border:"1px solid #D8D5CE",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:10}}>RESET</button>
            {activeScenario && (
              <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
                <span style={{padding:"4px 10px",background:"#FDF5EE",border:`1px solid ${effectColors[primaryEffect]||"#C07A4A"}`,borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:9,color:effectColors[primaryEffect]||"#C07A4A"}}>⚡ {activeScenario}</span>
                <button onClick={resetScenario} style={{padding:"4px 8px",background:"transparent",border:"1px solid #D8D5CE",borderRadius:3,color:"#888",fontSize:9,fontFamily:"'DM Mono',monospace"}}>✕</button>
              </div>
            )}
          </div>

          {/* Narrative */}
          {narrative && (
            <div className="fade" style={{marginBottom:18,padding:"12px 16px",background:"#FFFFFF",border:"1px solid #E8E4DC",borderLeft:`3px solid ${effectColors[primaryEffect]||"#C07A4A"}`,borderRadius:4}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:effectColors[primaryEffect]||"#C07A4A",letterSpacing:".12em",marginBottom:5}}>SCENARIO INTERPRETATION</div>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#333",lineHeight:1.6}}>{narrative}</p>
            </div>
          )}

          {/* Chart tabs */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            <button className={`tab${activeChart==="share"?" on":""}`} onClick={()=>setActiveChart("share")}>BRAND SHARE</button>
            <button className={`tab${activeChart==="category"?" on":""}`} onClick={()=>setActiveChart("category")}>CATEGORY SIZE</button>
            <button className={`tab${activeChart==="funnel"?" on":""}`} onClick={()=>setActiveChart("funnel")}>FUNNEL</button>
            <button className={`tab${activeChart==="params"?" on":""}`} onClick={()=>setActiveChart("params")}>PARAMETERS</button>
          </div>

          {/* Share chart */}
          {activeChart==="share" && (
            <div style={{marginBottom:20}}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={history} margin={{top:4,right:8,bottom:4,left:-22}}>
                  <XAxis dataKey="tick" tick={{fill:"#AAA",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={{stroke:"#DDD"}}/>
                  <YAxis tick={{fill:"#AAA",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={false} domain={[0,"auto"]}/>
                  <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #D8D5CE",borderRadius:4,fontFamily:"DM Mono",fontSize:9}} labelStyle={{color:"#888"}} formatter={v=>[`${v}%`]}/>
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
                  <XAxis dataKey="tick" tick={{fill:"#AAA",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={{stroke:"#DDD"}}/>
                  <YAxis tick={{fill:"#AAA",fontSize:9,fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #D8D5CE",borderRadius:4,fontFamily:"DM Mono",fontSize:9}} labelStyle={{color:"#888"}}/>
                  <Area type="monotone" dataKey="tier_mass"     stroke={TIERS.mass.color}     fill={TIERS.mass.color}     fillOpacity={0.12} strokeWidth={2} name="Mass"     dot={false}/>
                  <Area type="monotone" dataKey="tier_prestige" stroke={TIERS.prestige.color} fill={TIERS.prestige.color} fillOpacity={0.12} strokeWidth={2} name="Prestige" dot={false}/>
                  <Area type="monotone" dataKey="tier_luxury"   stroke={TIERS.luxury.color}   fill={TIERS.luxury.color}   fillOpacity={0.12} strokeWidth={2} name="Luxury"   dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Funnel chart */}
          {activeChart==="funnel" && (
            <div style={{marginBottom:20}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#999",letterSpacing:".1em",marginBottom:10}}>AWARENESS → CONSIDERATION → SHARE (TOP 5 BRANDS)</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {top5.map(b => {
                  const aware  = currentStats[`aware_${b.id}`] || 0;
                  const consid = currentStats[`consid_${b.id}`] || 0;
                  const share  = currentStats[b.id] || 0;
                  const maxVal = Math.max(aware, 1);
                  const avail  = getEffectiveAvailability(b.id, tick, availabilityEvents);
                  return (
                    <div key={b.id}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:brandMods[b.id]?"#C07A4A":"#333"}}>
                          {b.name}
                          {avail < AVAIL_GATE && <span style={{marginLeft:6,fontSize:8,color:"#C0392B",fontFamily:"'DM Mono',monospace"}}>STOCKED OUT</span>}
                          {avail >= AVAIL_GATE && avail < 0.8 && <span style={{marginLeft:6,fontSize:8,color:"#B07A20",fontFamily:"'DM Mono',monospace"}}>LIMITED AVAIL</span>}
                        </span>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#888"}}>
                          {aware}% → {consid}% → {share}%
                        </span>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        {[{label:"Aware",val:aware,color:"#444"},{label:"Consider",val:consid,color:b.color},{label:"Share",val:share,color:b.color}].map(row=>(
                          <div key={row.label} style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:50,fontFamily:"'DM Mono',monospace",fontSize:8,color:"#999",textAlign:"right"}}>{row.label}</div>
                            <div style={{flex:1,height:4,background:"#EAE8E2",borderRadius:2,overflow:"hidden"}}>
                              <div className="bbar" style={{height:"100%",width:`${(row.val/maxVal)*100}%`,background:avail<AVAIL_GATE?"#333":row.color,borderRadius:2,opacity:row.label==="Aware"?0.4:1}}/>
                            </div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#888",width:30,textAlign:"right"}}>{row.val}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:16}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#999",letterSpacing:".1em",marginBottom:8}}>AVG CONSIDERATION SET SIZE OVER TIME</div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={history} margin={{top:2,right:8,bottom:2,left:-22}}>
                    <XAxis dataKey="tick" tick={{fill:"#AAA",fontSize:8,fontFamily:"DM Mono"}} tickLine={false} axisLine={{stroke:"#DDD"}}/>
                    <YAxis tick={{fill:"#AAA",fontSize:8,fontFamily:"DM Mono"}} tickLine={false} axisLine={false} domain={[0,"auto"]}/>
                    <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #D8D5CE",borderRadius:4,fontFamily:"DM Mono",fontSize:9}} labelStyle={{color:"#888"}} formatter={v=>[`${v} brands`]}/>
                    <Line type="monotone" dataKey="avgConsidSetSize" stroke="#2980B9" dot={false} strokeWidth={2} name="Avg Consideration Set"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── PARAMETERS TAB ─────────────────────────────────────────────── */}
          {activeChart==="params" && (
            <div style={{marginBottom:20}} className="fade">

              {/* Active events summary */}
              {(activePriceEvents.length > 0 || activeAvailEvents.length > 0 || pendingPriceEvents.length > 0 || pendingAvailEvents.length > 0) && (
                <div style={{marginBottom:16,padding:"10px 12px",background:"#FFFDF7",border:"1px solid #E8DFC0",borderRadius:4}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#B07A20",letterSpacing:".12em",marginBottom:8}}>SCHEDULED EVENTS</div>
                  {activePriceEvents.map((e,i) => {
                    const brand = BRANDS.find(b=>b.id===e.brandId);
                    return (
                      <span key={i} className="evt-badge" style={{background:"#FDF6E3",border:"1px solid #D4A017",color:"#8A6500"}}>
                        ⚡ {brand?.name} price ×{e.modifier.toFixed(2)} → tick {e.endTick}{e.label?` (${e.label})`:""}
                      </span>
                    );
                  })}
                  {activeAvailEvents.map((e,i) => {
                    const brand = BRANDS.find(b=>b.id===e.brandId);
                    return (
                      <span key={i} className="evt-badge" style={{background:"#FDF0EE",border:"1px solid #C0392B",color:"#922B21"}}>
                        ⚠ {brand?.name} avail {(e.availability*100).toFixed(0)}% → tick {e.endTick}{e.label?` (${e.label})`:""}
                      </span>
                    );
                  })}
                  {pendingPriceEvents.map((e,i) => {
                    const brand = BRANDS.find(b=>b.id===e.brandId);
                    return (
                      <span key={i} className="evt-badge" style={{background:"#F5F5F5",border:"1px solid #CCC",color:"#888"}}>
                        ○ {brand?.name} price ×{e.modifier.toFixed(2)} tick {e.startTick}–{e.endTick}
                      </span>
                    );
                  })}
                  {pendingAvailEvents.map((e,i) => {
                    const brand = BRANDS.find(b=>b.id===e.brandId);
                    return (
                      <span key={i} className="evt-badge" style={{background:"#F5F5F5",border:"1px solid #CCC",color:"#888"}}>
                        ○ {brand?.name} avail {(e.availability*100).toFixed(0)}% tick {e.startTick}–{e.endTick}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Parameter table */}
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#888",letterSpacing:".12em",marginBottom:8}}>
                BRAND PARAMETERS — BASELINE vs CURRENT (tick {tick})
                <span style={{marginLeft:12,color:"#B07A20"}}>■ changed</span>
                <span style={{marginLeft:8,color:"#C0392B"}}>■ availability issue</span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table className="ptable" style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:"left",width:110}}>Brand</th>
                      <th>Price $</th>
                      <th>Equity</th>
                      <th>Innov</th>
                      <th>Dist</th>
                      <th>Sat</th>
                      <th>Avail</th>
                      <th>bassP</th>
                      <th>bassQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paramRows.map(({ brand: b, hasMod, params }) => {
                      const [price, equity, innov, dist, sat, avail, bassP, bassQ] = params;
                      const isStockedOut = avail.current < AVAIL_GATE;
                      return (
                        <tr key={b.id} style={{background:hasMod?"#FFFBF5":"transparent"}}>
                          <td style={{color:hasMod?"#C07A4A":"#555",fontFamily:"'DM Sans',sans-serif",fontSize:10}}>
                            <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:b.color,marginRight:5,verticalAlign:"middle"}}/>
                            {b.name}
                          </td>
                          {[price, equity, innov, dist, sat, avail, bassP, bassQ].map((p, i) => {
                            const changed    = p.changed;
                            const isAvailCol = i === 5;
                            const showDelta  = changed && p.base !== p.current;
                            const delta      = p.isPrice
                              ? `$${(p.current - p.base).toFixed(2)}`
                              : showDelta ? (p.current - p.base > 0 ? "+" : "") + (p.current - p.base).toFixed(3) : "";
                            return (
                              <td key={i} style={{textAlign:"center"}}>
                                <div style={{color: isAvailCol && isStockedOut ? "#C0392B" : changed ? "#B07A20" : "#444"}}>
                                  {p.isPrice ? `$${p.current.toFixed(2)}` : p.current.toFixed(3)}
                                  {isAvailCol && isStockedOut && <span style={{fontSize:7,marginLeft:3}}>OUT</span>}
                                </div>
                                {showDelta && (
                                  <div style={{fontSize:7,color:p.current<p.base?"#C0392B":"#27AE60",marginTop:1}}>
                                    {p.current<p.base?"▼":"▲"}{p.isPrice ? `$${Math.abs(p.current-p.base).toFixed(2)}` : Math.abs(p.current-p.base).toFixed(3)}
                                  </div>
                                )}
                                {!changed && (
                                  <div style={{fontSize:7,color:"#BBB",marginTop:1}}>
                                    {p.isPrice ? `$${p.base.toFixed(2)}` : p.base.toFixed(3)}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:8,fontFamily:"'DM Mono',monospace",fontSize:7,color:"#BBB"}}>
                Top row = current value · Bottom row (gray) = baseline · ▲▼ = delta from baseline
              </div>
            </div>
          )}

          {/* Tier meters */}
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#999",letterSpacing:".12em",marginBottom:10}}>ACTIVE BUYERS BY TIER</div>
            <div style={{display:"flex",gap:10}}>
              {Object.entries(TIERS).map(([tid, tcfg]) => {
                const active = agents.filter(a=>a.status==="active"&&BRANDS.find(b=>b.id===a.brand)?.tier===tid).length;
                const latent = agents.filter(a=>a.status==="latent"&&a.tier===tid).length;
                const pct    = Math.round(active/Math.max(1,active+latent)*100);
                const hasMod = !!categoryMods[tid];
                return (
                  <div key={tid} style={{flex:1,padding:"10px",background:"#FFFFFF",border:`1px solid ${hasMod?tcfg.color:"#E0DDD6"}`,borderRadius:4,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:hasMod?tcfg.color:"#999",letterSpacing:".1em",marginBottom:5}}>{tcfg.label.toUpperCase()}{hasMod?" ⚡":""}</div>
                    <div style={{fontSize:18,fontWeight:400,color:tcfg.color,marginBottom:2}}>{active}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#888",marginBottom:5}}>{latent} latent</div>
                    <div style={{height:2,background:"#EAE8E2",borderRadius:1}}>
                      <div style={{height:"100%",width:`${pct}%`,background:tcfg.color,borderRadius:1,transition:"width .6s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Brand funnel snapshot */}
          <div style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#999",letterSpacing:".12em"}}>BRAND FUNNEL SNAPSHOT</div>
              <div style={{display:"flex",gap:12,fontFamily:"'DM Mono',monospace",fontSize:8,color:"#999"}}>
                <span style={{opacity:0.5}}>■ Aware</span><span>■ Consider</span><span style={{opacity:0.7}}>■ Share</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {sortedBrands.map((b,i)=>{
                const aware  = currentStats[`aware_${b.id}`] || 0;
                const consid = currentStats[`consid_${b.id}`] || 0;
                const share  = currentStats[b.id] || 0;
                const maxA   = currentStats[`aware_${sortedBrands[0].id}`] || 1;
                const hasmod = !!brandMods[b.id];
                const avail  = getEffectiveAvailability(b.id, tick, availabilityEvents);
                const hasEvent = priceEvents.some(e=>e.brandId===b.id&&tick>=e.startTick&&tick<=e.endTick) || avail<1;
                return (
                  <div key={b.id} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#BBB",width:12,textAlign:"right"}}>{i+1}</div>
                    <div style={{width:100,fontFamily:"'DM Sans',sans-serif",fontSize:10,color:hasmod?"#C07A4A":hasEvent?"#B07A20":"#444"}}>
                      {b.name}
                      {avail<AVAIL_GATE&&<span style={{fontSize:7,color:"#C0392B",marginLeft:3}}>⚠</span>}
                      {(hasmod||hasEvent)&&avail>=AVAIL_GATE&&<span style={{fontSize:7,marginLeft:3}}>⚡</span>}
                    </div>
                    <div style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
                      {[{v:aware,o:0.25},{v:consid,o:0.7},{v:share,o:1}].map((row,ri)=>(
                        <div key={ri} style={{height:3,background:"#EAE8E2",borderRadius:1,overflow:"hidden"}}>
                          <div className="bbar" style={{height:"100%",width:`${(row.v/maxA)*100}%`,background:avail<AVAIL_GATE?"#CCC":b.color,borderRadius:1,opacity:row.o}}/>
                        </div>
                      ))}
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#888",width:52,textAlign:"right"}}>{consid}%→{share}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategic insight */}
          {history.length > 3 && (
            <div>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#999",letterSpacing:".12em"}}>STRATEGIC ANALYSIS</div>
                <button onClick={async()=>{
                  setInsightLoading(true);
                  const t = await getStrategicInsight(
                    history.map(h=>({ share: Object.fromEntries(BRANDS.map(b=>[b.id,h[b.id]])), considerationP: Object.fromEntries(BRANDS.map(b=>[b.id,h[`consid_${b.id}`]])), activeTotal: h.activeTotal, avgConsidSetSize: h.avgConsidSetSize, tierActive: Object.fromEntries(["mass","prestige","luxury"].map(t=>[t,h[`tier_${t}`]])) })),
                    activeScenario
                  );
                  setInsight(t); setInsightLoading(false);
                }} disabled={insightLoading} style={{padding:"3px 10px",background:"transparent",border:"1px solid #D8D5CE",borderRadius:3,color:insightLoading?"#CCC":"#888",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:".1em"}}>
                  {insightLoading?<span className="pulse">ANALYZING…</span>:"GENERATE INSIGHT →"}
                </button>
              </div>
              {insight && (
                <div className="fade" style={{padding:"12px 16px",background:"#EFF6FB",border:"1px solid #BDD9EE",borderLeft:"3px solid #2980B9",borderRadius:4}}>
                  <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#1A3A4A",lineHeight:1.7,fontStyle:"italic"}}>{insight}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Scenario Lab */}
        <div style={{padding:"24px 22px",background:"#FFFFFF",borderLeft:"1px solid #E0DDD6",overflowY:"auto"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#999",letterSpacing:".15em",marginBottom:14}}>SCENARIO LAB</div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",lineHeight:1.6,marginBottom:14}}>
            Claude adjusts brand params, category rates, <em>price events</em>, and <em>availability events</em>. Price changes are time-limited; stockouts gate consideration sets.
          </p>

          <textarea value={scenarioQuery} onChange={e=>setScenarioQuery(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleScenario();}}}
            placeholder="e.g. Olay runs a 4-week 25% price promotion targeting mass tier value seekers…"
            rows={4}
            style={{width:"100%",padding:"11px",background:"#F7F6F3",border:"1px solid #D8D5CE",borderRadius:4,color:"#1A1A1A",fontFamily:"'DM Sans',sans-serif",fontSize:11,lineHeight:1.6,marginBottom:10}}
          />
          <button onClick={handleScenario} disabled={scenarioLoading||!scenarioQuery.trim()} style={{width:"100%",padding:"10px",background:scenarioLoading||!scenarioQuery.trim()?"#EAE8E2":"#C07A4A",color:scenarioLoading||!scenarioQuery.trim()?"#AAA":"#FFFFFF",border:"none",borderRadius:3,fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".1em",fontWeight:500,marginBottom:18}}>
            {scenarioLoading?<span className="pulse">INTERPRETING…</span>:"APPLY SCENARIO →"}
          </button>

          <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#BBB",letterSpacing:".12em",marginBottom:8}}>EXAMPLE SCENARIOS</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:20}}>
            {PRESETS.map((p,i)=><button key={i} className="chip" onClick={()=>setScenarioQuery(p)}>{p}</button>)}
          </div>

          {/* Category modifiers */}
          {Object.keys(categoryMods).length > 0 && (
            <div className="fade" style={{marginBottom:16,padding:"10px 12px",background:"#F0FAF4",border:"1px solid #A8D5B5",borderLeft:"3px solid #27AE60",borderRadius:4}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#1E7A40",letterSpacing:".12em",marginBottom:6}}>CATEGORY MODIFIERS</div>
              {Object.entries(categoryMods).map(([tier, mod])=>(
                <div key={tier} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#555",textTransform:"capitalize"}}>{tier}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#1E7A40"}}>
                    {mod.entryRate!=null&&`entry ${(mod.entryRate*100).toFixed(1)}%`}
                    {mod.entryRate!=null&&mod.exitRate!=null&&" · "}
                    {mod.exitRate!=null&&`exit ${(mod.exitRate*100).toFixed(1)}%`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Model architecture legend */}
          <div style={{marginBottom:16,padding:"10px 12px",background:"#F7F6F3",border:"1px solid #E0DDD6",borderRadius:4}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#BBB",letterSpacing:".12em",marginBottom:8}}>MODEL ARCHITECTURE</div>
            {[
              {layer:"L1",label:"Category Participation",desc:"Dynamic m — tier entry/exit rates",color:"#27AE60"},
              {layer:"L2",label:"Bass Awareness Diffusion",desc:"p (advertising) + q (WOM) → salience",color:"#C07A4A"},
              {layer:"L3",label:"Consideration Filtering",desc:"Salience threshold + availability gate",color:"#2980B9"},
              {layer:"L4",label:"Brand Choice (Softmax)",desc:"Utility over consideration set + price events",color:"#8E44AD"},
            ].map(l=>(
              <div key={l.layer} style={{display:"flex",gap:8,marginBottom:5,alignItems:"flex-start"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:l.color,width:16,flexShrink:0,marginTop:1}}>{l.layer}</div>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#444"}}>{l.label}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#888"}}>{l.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Segments */}
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#BBB",letterSpacing:".12em",marginBottom:8}}>SEGMENTS · DECAY · THRESHOLD</div>
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:18}}>
            {SEGMENTS.map(s=>{
              const count = agents.filter(a=>a.segment===s.id&&a.status==="active").length;
              return (
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#555",flex:1}}>{s.label}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#BBB",marginRight:8}}>{(s.salienceDecay*10).toFixed(0)}% · {Math.round(s.considerationThreshold*100)}%</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#888",width:28,textAlign:"right"}}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Brand key */}
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:"#BBB",letterSpacing:".12em",marginBottom:8}}>BRAND KEY</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px"}}>
            {BRANDS.map(b=>{
              const avail    = getEffectiveAvailability(b.id, tick, availabilityEvents);
              const hasPrice = priceEvents.some(e=>e.brandId===b.id&&tick>=e.startTick&&tick<=e.endTick);
              return (
                <div key={b.id} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:b.color,flexShrink:0}}/>
                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:brandMods[b.id]?"#C07A4A":hasPrice?"#B07A20":avail<AVAIL_GATE?"#C0392B":"#555"}}>
                    {b.name}
                    {avail<AVAIL_GATE&&" ⚠"}
                    {hasPrice&&avail>=AVAIL_GATE&&" ⚡"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
