# Skincare Market Consumer Simulation
**Material+ Intelligence Lab** — Agent-Based Model

500 synthetic consumer agents · 10 competing brands · Claude-powered scenario interpretation

---

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create skincare-abm --public --push
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework preset: **Vite** (auto-detected)
4. Click **Deploy** — don't add env vars yet

### 3. Add your Anthropic API Key
1. In Vercel: **Project Settings → Environment Variables**
2. Add: `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
3. **Redeploy** (Deployments tab → ⋯ → Redeploy)

Your app is now live at `https://your-project.vercel.app` ✓

---

## Run locally

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
```

---

## Architecture

```
/
├── api/
│   └── claude.js        # Vercel serverless function — API key lives here (server-side only)
├── src/
│   ├── main.jsx         # React entry point
│   └── App.jsx          # Simulation + UI (all API calls go to /api/claude)
├── index.html
├── vite.config.js
└── vercel.json          # Routes /api/* to serverless functions
```

**Key design decision:** The Anthropic API key never touches the browser. All Claude calls go through `/api/claude.js`, a Vercel serverless function that injects the key server-side.

---

## Simulation Model

**Agents:** 500 consumers across 6 psychographic segments
- Budget Basics · Value Seekers · Ingredient Nerds · Brand Loyalists · Prestige Seekers · Clean & Natural

**Brands:** Olay, CeraVe, Neutrogena, L'Oréal Paris, Aveeno, Clinique, Estée Lauder, SkinCeuticals, Cetaphil, Tatcha

**Choice mechanism:** Softmax utility function with segment-specific weights on price, brand equity, innovation, and distribution — plus social influence propagation across agent networks.

**Claude integration:** Natural language scenarios are translated by Claude into brand attribute modifiers, applied at runtime. Strategic insights are generated post-simulation.
