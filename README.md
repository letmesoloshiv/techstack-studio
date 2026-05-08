# Tech Stack Studio

Personal architecture studio: visualize a tech stack on a canvas, export PNG, and generate stacks, narratives, and diagrams (flowchart, DFD, use case, system architecture) with **Google Gemini** or **Groq** (Llama).

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `VITE_AI_PROVIDER=groq` or omit / use another value for Gemini  
- `VITE_GROQ_API_KEY` and/or `VITE_GEMINI_API_KEY` (see comments in `.env.example`)

Never commit `.env`; it is listed in `.gitignore`.

## Scripts

| Command   | Description        |
|-----------|--------------------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Stack

React, TypeScript, Vite, Tailwind CSS, html-to-image.
