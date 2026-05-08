/**
 * Fetches architecture JSON from Gemini or Groq (OpenAI-compatible).
 * Groq free tier is often easier for heavy JSON than Google AI free quotas.
 */

export type ArchitectureBackend = 'gemini' | 'groq';

export function buildArchitecturePrompt(knownTechHint: string, idea: string): string {
  return `You are a principal software architect. Design a complete, production-appropriate web application architecture for the product below.

Output requirements (strict):
1) Return ONLY JSON (no markdown, no prose outside JSON). Use response schema mentally: one root object.
2) "stack": array of 8–14 string technology names. MUST include coverage for ALL of these concerns:
   - Frontend UI (e.g. React, Next.js, Vue)
   - APIs / application backend or typed BaaS (e.g. Node, NestJS, tRPC, or Supabase edge functions as appropriate)
   - Data persistence (e.g. PostgreSQL, MongoDB, Supabase/Firebase when BaaS includes DB)
   - Authentication & authorization (e.g. Clerk, Auth0, NextAuth.js, Cognito, or framework-native auth)
   - Infrastructure & delivery (e.g. Vercel, AWS, Docker, Cloudflare)
   Prefer widely adopted tools. Prefer names from this library when they fit: ${knownTechHint} (you may include other well-known tools if needed).
3) "narrative": {
     "headline": short title for the architecture,
     "summary": 3–5 sentences explaining how the pieces work together for THIS product idea,
     "byLayer": object with optional keys "Frontend","API","Data","Auth","Infra" — each value is 1–3 sentences on choices and responsibilities for that layer,
     "diagramOverview": 2–4 sentences describing how the four diagrams below relate to the system
   }
4) "explanation": one or two punchy sentences (shown in the UI compactly).
5) "diagrams": {
     "flowchart": valid Mermaid flowchart (flowchart TD) for main user/system process,
     "dfd": valid Mermaid for a data-flow style (use flowchart LR or flowchart TD with clear processes, data stores, external entities; label flows),
     "useCase": Mermaid diagram for use cases (use caseDiagram syntax if possible, else flowchart that lists actors and use cases),
     "systemArchitecture": Mermaid diagram for components (flowchart or C4-style blocks) showing clients, services, data stores, and integrations
   }
6) "visuals": For interactive canvas graphs, for EACH key flowchart, dfd, useCase, systemArchitecture provide:
   { "nodes": [ { "id", "label", "kind" } ], "edges": [ { "from", "to", "label" } ] }
   Use 5–9 nodes per diagram. "kind" should reflect semantics (actor, process, datastore, external, service, client, api, integration).
   For useCase visuals, human actors MUST use kind "actor" (or "human actor") so the UI can render a stick-figure actor; use cases remain other kinds.
   IDs must match across edges. Each diagram must reflect THAT diagram type (DFD ≠ flowchart ≠ use case ≠ architecture).

Product idea:
${idea.trim()}`;
}

async function groqCompletion(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const baseBody = {
    model,
    messages: [{ role: 'user' as const, content: prompt }],
    temperature: 0.45,
  };

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...baseBody,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const msg = String(errJson?.error?.message || '');
    if (res.status === 400 && /response_format|json/i.test(msg)) {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(baseBody),
      });
    } else {
      let m = msg || `Groq error ${res.status}`;
      if (/rate|limit|quota|429/i.test(m)) {
        m += ' — See console.groq.com usage; free tier still has RPM limits.';
      }
      throw new Error(m);
    }
  }

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    let m = String(errJson?.error?.message || `Groq error ${res.status}`);
    if (/rate|limit|quota|429/i.test(m)) {
      m += ' — See console.groq.com usage; free tier still has RPM limits.';
    }
    throw new Error(m);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') throw new Error('Empty Groq response');
  return text;
}

async function geminiCompletion(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let msg = typeof err?.error?.message === 'string' ? err.error.message : `API error ${res.status}`;
    if (/quota|rate limit|RESOURCE_EXHAUSTED|free tier|429/i.test(msg)) {
      msg +=
        ' — Try VITE_AI_PROVIDER=groq + VITE_GROQ_API_KEY (free at console.groq.com), wait, or enable billing in Google AI Studio.';
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text.trim()) throw new Error('Empty model response');
  return text;
}

export async function fetchArchitectureCompletionText(opts: {
  backend: ArchitectureBackend;
  prompt: string;
  geminiKey?: string;
  geminiModel?: string;
  groqKey?: string;
  groqModel?: string;
}): Promise<string> {
  const { backend, prompt } = opts;
  if (backend === 'groq') {
    const key = opts.groqKey?.trim();
    if (!key) throw new Error('Missing VITE_GROQ_API_KEY');
    const model = opts.groqModel?.trim() || 'llama-3.3-70b-versatile';
    return groqCompletion(key, model, prompt);
  }

  const key = opts.geminiKey?.trim();
  if (!key) throw new Error('Missing VITE_GEMINI_API_KEY');
  const model = opts.geminiModel?.trim() || 'gemini-2.0-flash';
  return geminiCompletion(key, model, prompt);
}
