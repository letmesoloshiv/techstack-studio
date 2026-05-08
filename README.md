# Nebula

**Nebula** is a browser-based **architecture and tech-stack studio**. You lay out technologies and generated diagrams on a draggable canvas, export artwork for docs or slides, and optionally **describe a product idea in plain language** so AI proposes a full stack, narrative, and diagram data.

## What it does

### Studio canvas

- **Tech stack workspace** — Add technologies from a built-in library (grouped by Frontend, API, Data, Auth, Infra). Cards sit on a grid; you can **drag** them and **connect** them with labeled edges.
- **Multiple diagram views** — Switch tabs for **Flowchart**, **DFD**, **Use case**, and **System architecture**. Each uses its own **node-and-edge graph** (and raw **Mermaid** output) when you generate with AI.
- **Use case actors** — In the use-case view, human actors are shown as a **stick-figure** style when the model marks them as actors.
- **View styles** — **Signal path** (animated edges), **Blueprint** (document-style), **Briefing** (minimal).
- **Export** — Download the whole studio panel as a **PNG** for presentations or READMEs.

### AI: “Idea → architecture”

Paste a short **product / web app idea**. Nebula calls **Groq** (Llama) or **Google Gemini** and returns:

- A recommended **stack** (frontend, APIs, data, auth, infra).
- An **architecture narrative**: headline, summary, per-layer notes, and how the diagrams relate.
- **Mermaid** sources for flowchart, DFD, use case, and system-architecture diagrams.
- **Interactive `visuals`** (nodes/edges) for the canvas tabs.

Configure keys in `.env` (see below). Free-tier limits depend on the provider; you can switch models or providers when quotas are hit.

### Landing page

The home screen introduces Nebula and lets you open the studio with a demo stack or your own session.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- **Groq** — `VITE_AI_PROVIDER=groq` and `VITE_GROQ_API_KEY` ([console.groq.com](https://console.groq.com))  
- **Gemini** — `VITE_GEMINI_API_KEY` ([Google AI Studio](https://aistudio.google.com/apikey))  
- Optional: `VITE_GEMINI_MODEL`, `VITE_GROQ_MODEL`

`.env` is gitignored. Never commit real keys.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck + production bundle |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

## Stack

React, TypeScript, Vite, Tailwind CSS, **html-to-image** (PNG export).

## Name

The product name is **Nebula**. The repository folder may still be named `techstack-studio` on disk; that does not change the app name in the UI.
