import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { buildArchitecturePrompt, fetchArchitectureCompletionText } from './architectureCompletion';
import { MermaidBlock } from './MermaidBlock';

type TechLayer = 'Frontend' | 'API' | 'Data' | 'Auth' | 'Infra';
type ViewMode = 'Signal Path' | 'Blueprint' | 'Briefing';
type DiagramType =
  | 'Tech Stack'
  | 'Flowchart'
  | 'DFD'
  | 'Use Case'
  | 'System Architecture'
  | 'SDLC'
  | 'Workflow';

/** Order of tabs in the main canvas diagram strip */
const CANVAS_DIAGRAM_TYPES: DiagramType[] = [
  'Tech Stack',
  'Flowchart',
  'DFD',
  'Use Case',
  'System Architecture',
  'SDLC',
  'Workflow',
];

interface TechNode {
  id: string;
  name: string;
  category: TechLayer;
  color: string;
  note: string;
}

interface NodePos {
  x: number;
  y: number;
}

interface GeneratedDiagrams {
  flowchart: string;
  dfd: string;
  useCase: string;
  systemArchitecture: string;
}

interface DiagramVisualNode {
  id: string;
  label: string;
  kind: string;
}

interface DiagramVisualEdge {
  from: string;
  to: string;
  label: string;
}

interface DiagramVisual {
  nodes: DiagramVisualNode[];
  edges: DiagramVisualEdge[];
}

interface GeneratedVisuals {
  flowchart: DiagramVisual;
  dfd: DiagramVisual;
  useCase: DiagramVisual;
  systemArchitecture: DiagramVisual;
}

interface DiagramProcessNarratives {
  flowchart?: string;
  dfd?: string;
  useCase?: string;
  systemArchitecture?: string;
}

interface ArchitectureNarrative {
  headline: string;
  summary: string;
  byLayer: Partial<Record<TechLayer, string>>;
  diagramOverview?: string;
  diagramProcesses?: DiagramProcessNarratives;
}

/** AI-generated SDLC recommendation */
interface SdlcPlan {
  method: string;
  rationale: string;
  cadenceAndCeremonies: string;
  whenToRevisit: string;
  /** Mermaid flowchart source rendered in the playbook */
  diagram: string;
}

/** Git, CI/CD, collaboration, releases */
interface WorkflowPlan {
  gitBranching: string;
  ciCd: string;
  collaboration: string;
  releaseAndRollback: string;
  /** Mermaid flowchart source rendered in the playbook */
  diagram: string;
}

interface RequirementsPlan {
  scopeAndMvp: string;
  nonFunctional: string;
  dependenciesAndIntegrations: string;
}

interface QualityPlan {
  testingStrategy: string;
  environmentsAndData: string;
  definitionOfDone: string;
}

interface SecurityPlan {
  authnAuthz: string;
  dataAndSecrets: string;
  supplyChainAndCompliance: string;
}

interface PlatformPlan {
  observability: string;
  apiContractsAndDocs: string;
  costAndCapacity: string;
}

interface DevPlaybook {
  sdlc: SdlcPlan;
  workflow: WorkflowPlan;
  requirements: RequirementsPlan;
  quality: QualityPlan;
  security: SecurityPlan;
  platform: PlatformPlan;
}

type PlaybookTabId = keyof DevPlaybook;

interface AiGeneratePayload {
  stack: string[];
  explanation?: string;
  narrative?: Partial<ArchitectureNarrative> & {
    byLayer?: Partial<Record<TechLayer, string>>;
    diagramProcesses?: Partial<DiagramProcessNarratives>;
  };
  diagrams?: GeneratedDiagrams;
  visuals?: GeneratedVisuals;
  sdlc?: Record<string, unknown>;
  workflow?: Record<string, unknown>;
  requirements?: Record<string, unknown>;
  quality?: Record<string, unknown>;
  security?: Record<string, unknown>;
  platform?: Record<string, unknown>;
}

const DEFAULT_STACK = ['React', 'TypeScript', 'Tailwind CSS', 'Supabase', 'Vercel'];

const LAYER_COLORS: Record<TechLayer, string> = {
  Frontend: '#22d3ee',
  API: '#818cf8',
  Data: '#34d399',
  Auth: '#fbbf24',
  Infra: '#a855f7',
};

const TECH_LIBRARY: Record<string, Omit<TechNode, 'id'>> = {
  React: { name: 'React', category: 'Frontend', color: '#61dafb', note: 'UI library' },
  'Next.js': { name: 'Next.js', category: 'Frontend', color: '#ffffff', note: 'React framework' },
  Vue: { name: 'Vue', category: 'Frontend', color: '#42d392', note: 'Reactive UI' },
  Angular: { name: 'Angular', category: 'Frontend', color: '#dd0031', note: 'Enterprise SPA' },
  Svelte: { name: 'Svelte', category: 'Frontend', color: '#ff3e00', note: 'Compiler UI' },
  Nuxt: { name: 'Nuxt', category: 'Frontend', color: '#00dc82', note: 'Vue framework' },
  Remix: { name: 'Remix', category: 'Frontend', color: '#8b5cf6', note: 'React framework' },
  Astro: { name: 'Astro', category: 'Frontend', color: '#ff5d01', note: 'Content sites' },
  Vite: { name: 'Vite', category: 'Frontend', color: '#646cff', note: 'Build tool' },
  TypeScript: { name: 'TypeScript', category: 'Frontend', color: '#3178c6', note: 'Type safety' },
  'Tailwind CSS': { name: 'Tailwind CSS', category: 'Frontend', color: '#38bdf8', note: 'Utility CSS' },
  Node: { name: 'Node', category: 'API', color: '#83cd29', note: 'JS runtime' },
  Express: { name: 'Express', category: 'API', color: '#ffffff', note: 'HTTP server' },
  tRPC: { name: 'tRPC', category: 'API', color: '#3b82f6', note: 'Type-safe API' },
  NestJS: { name: 'NestJS', category: 'API', color: '#e0234e', note: 'Node framework' },
  Fastify: { name: 'Fastify', category: 'API', color: '#ffffff', note: 'Fast HTTP' },
  GraphQL: { name: 'GraphQL', category: 'API', color: '#e10098', note: 'Query API' },
  Apollo: { name: 'Apollo', category: 'API', color: '#311c87', note: 'GraphQL stack' },
  Django: { name: 'Django', category: 'API', color: '#092e20', note: 'Python web' },
  Flask: { name: 'Flask', category: 'API', color: '#ffffff', note: 'Python micro' },
  Laravel: { name: 'Laravel', category: 'API', color: '#ff2d20', note: 'PHP framework' },
  Go: { name: 'Go', category: 'API', color: '#00add8', note: 'Go backend' },
  Kotlin: { name: 'Kotlin', category: 'API', color: '#7f52ff', note: 'JVM backend' },
  Supabase: { name: 'Supabase', category: 'Data', color: '#3ecf8e', note: 'BaaS platform' },
  PostgreSQL: { name: 'PostgreSQL', category: 'Data', color: '#336791', note: 'SQL database' },
  Prisma: { name: 'Prisma', category: 'Data', color: '#8b5cf6', note: 'ORM' },
  Firebase: { name: 'Firebase', category: 'Data', color: '#ffca28', note: 'Google BaaS' },
  MongoDB: { name: 'MongoDB', category: 'Data', color: '#47a248', note: 'Document DB' },
  Redis: { name: 'Redis', category: 'Data', color: '#dc382d', note: 'Cache/KV' },
  MySQL: { name: 'MySQL', category: 'Data', color: '#4479a1', note: 'SQL database' },
  Elasticsearch: { name: 'Elasticsearch', category: 'Data', color: '#005571', note: 'Search engine' },
  Clerk: { name: 'Clerk', category: 'Auth', color: '#a78bfa', note: 'Auth service' },
  Auth0: { name: 'Auth0', category: 'Auth', color: '#eb5424', note: 'Identity' },
  Cognito: { name: 'Cognito', category: 'Auth', color: '#ff9900', note: 'AWS auth' },
  Okta: { name: 'Okta', category: 'Auth', color: '#007dc1', note: 'Enterprise ID' },
  Vercel: { name: 'Vercel', category: 'Infra', color: '#ffffff', note: 'Edge deploy' },
  Netlify: { name: 'Netlify', category: 'Infra', color: '#14b8a6', note: 'JAMstack' },
  Docker: { name: 'Docker', category: 'Infra', color: '#2496ed', note: 'Containers' },
  Kubernetes: { name: 'Kubernetes', category: 'Infra', color: '#326ce5', note: 'Orchestration' },
  AWS: { name: 'AWS', category: 'Infra', color: '#ff9900', note: 'Cloud platform' },
  GCP: { name: 'GCP', category: 'Infra', color: '#4285f4', note: 'Google Cloud' },
  Azure: { name: 'Azure', category: 'Infra', color: '#0078d4', note: 'MS Cloud' },
  Cloudflare: { name: 'Cloudflare', category: 'Infra', color: '#f38020', note: 'Edge CDN' },
  Terraform: { name: 'Terraform', category: 'Infra', color: '#844fba', note: 'IaC' },
  GitHub: { name: 'GitHub', category: 'Infra', color: '#ffffff', note: 'Git + CI' },
  Sentry: { name: 'Sentry', category: 'Infra', color: '#362d59', note: 'Errors & perf' },
  Stripe: { name: 'Stripe', category: 'API', color: '#635bff', note: 'Payments API' },
  Zod: { name: 'Zod', category: 'Frontend', color: '#3068b7', note: 'Schema validation' },
  'TanStack Query': { name: 'TanStack Query', category: 'Frontend', color: '#ff4154', note: 'Server state' },
  'NextAuth.js': { name: 'NextAuth.js', category: 'Auth', color: '#1a73e8', note: 'Auth for Next.js' },
};

const TECH_ICON_SLUGS: Record<string, string> = {
  React: 'react', 'Next.js': 'nextdotjs', Vue: 'vuedotjs', Angular: 'angular',
  Svelte: 'svelte', Nuxt: 'nuxtdotjs', Remix: 'remix', Astro: 'astro', Vite: 'vite',
  TypeScript: 'typescript', 'Tailwind CSS': 'tailwindcss', Node: 'nodedotjs',
  Express: 'express', tRPC: 'trpc', NestJS: 'nestjs', Fastify: 'fastify',
  GraphQL: 'graphql', Apollo: 'apollographql', Django: 'django', Flask: 'flask',
  Laravel: 'laravel', Go: 'go', Kotlin: 'kotlin', Supabase: 'supabase',
  PostgreSQL: 'postgresql', Prisma: 'prisma', Firebase: 'firebase', MongoDB: 'mongodb',
  Redis: 'redis', MySQL: 'mysql', Elasticsearch: 'elasticsearch', Clerk: 'clerk',
  Auth0: 'auth0', Cognito: 'amazoncognito', Okta: 'okta', Vercel: 'vercel',
  Netlify: 'netlify', Docker: 'docker', Kubernetes: 'kubernetes',
  AWS: 'amazonwebservices', GCP: 'googlecloud', Azure: 'microsoftazure',
  Cloudflare: 'cloudflare', Terraform: 'terraform', GitHub: 'github',
  Sentry: 'sentry', Stripe: 'stripe', Zod: 'zod', 'TanStack Query': 'reactquery',
  'NextAuth.js': 'shield',
};

const CATEGORY_ORDER: TechLayer[] = ['Frontend', 'API', 'Data', 'Auth', 'Infra'];

/** Order of per-diagram process copy in Architecture Narrative (matches generated diagram tabs). */
const DIAGRAM_NARRATIVE_ORDER: { key: keyof DiagramProcessNarratives; label: string }[] = [
  { key: 'flowchart', label: 'Flowchart' },
  { key: 'dfd', label: 'DFD' },
  { key: 'useCase', label: 'Use Case' },
  { key: 'systemArchitecture', label: 'System Architecture' },
];

const PLAYBOOK_TABS: { id: PlaybookTabId; label: string; shortLabel?: string; hint: string }[] = [
  { id: 'sdlc', label: 'SDLC', hint: 'Methodology narrative — open the SDLC tab on the canvas for the diagram.' },
  { id: 'workflow', label: 'Workflow', shortLabel: 'Flow', hint: 'Shipping narrative — open the Workflow canvas tab for the diagram.' },
  { id: 'requirements', label: 'Requirements', shortLabel: 'Reqs', hint: 'Scope, NFRs, integrations and contracts.' },
  { id: 'quality', label: 'Quality', hint: 'Testing strategy, environments, definition of done.' },
  { id: 'security', label: 'Security', hint: 'Auth, data, secrets, supply chain, compliance.' },
  { id: 'platform', label: 'Platform', hint: 'Observability, API docs, cost and capacity.' },
];

function strField(obj: Record<string, unknown> | undefined, key: string): string {
  const v = obj?.[key];
  return typeof v === 'string' ? v.trim() : '';
}

function parseDevPlaybook(parsed: AiGeneratePayload): DevPlaybook | null {
  const s = parsed.sdlc;
  const w = parsed.workflow;
  const r = parsed.requirements;
  const q = parsed.quality;
  const sec = parsed.security;
  const p = parsed.platform;

  const sdlc: SdlcPlan = {
    method: strField(s, 'method'),
    rationale: strField(s, 'rationale'),
    cadenceAndCeremonies: strField(s, 'cadenceAndCeremonies'),
    whenToRevisit: strField(s, 'whenToRevisit'),
    diagram: strField(s, 'diagram'),
  };
  const workflow: WorkflowPlan = {
    gitBranching: strField(w, 'gitBranching'),
    ciCd: strField(w, 'ciCd'),
    collaboration: strField(w, 'collaboration'),
    releaseAndRollback: strField(w, 'releaseAndRollback'),
    diagram: strField(w, 'diagram'),
  };
  const requirements: RequirementsPlan = {
    scopeAndMvp: strField(r, 'scopeAndMvp'),
    nonFunctional: strField(r, 'nonFunctional'),
    dependenciesAndIntegrations: strField(r, 'dependenciesAndIntegrations'),
  };
  const quality: QualityPlan = {
    testingStrategy: strField(q, 'testingStrategy'),
    environmentsAndData: strField(q, 'environmentsAndData'),
    definitionOfDone: strField(q, 'definitionOfDone'),
  };
  const security: SecurityPlan = {
    authnAuthz: strField(sec, 'authnAuthz'),
    dataAndSecrets: strField(sec, 'dataAndSecrets'),
    supplyChainAndCompliance: strField(sec, 'supplyChainAndCompliance'),
  };
  const platform: PlatformPlan = {
    observability: strField(p, 'observability'),
    apiContractsAndDocs: strField(p, 'apiContractsAndDocs'),
    costAndCapacity: strField(p, 'costAndCapacity'),
  };

  const blocks = [sdlc, workflow, requirements, quality, security, platform];
  const anyContent = blocks.some((block) =>
    Object.values(block).some((v) => v.length > 0)
  );
  if (!anyContent) return null;
  return { sdlc, workflow, requirements, quality, security, platform };
}

const TECH_ALIASES: Record<string, string> = {
  nextjs: 'Next.js',
  'next js': 'Next.js',
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mongo: 'MongoDB',
  vuejs: 'Vue',
  reactjs: 'React',
  typescript: 'TypeScript',
  trpc: 'tRPC',
  kubernetes: 'Kubernetes',
  k8s: 'Kubernetes',
  vercel: 'Vercel',
  supabase: 'Supabase',
  auth0: 'Auth0',
  clerk: 'Clerk',
  stripe: 'Stripe',
  zod: 'Zod',
  sentry: 'Sentry',
  prisma: 'Prisma',
  redis: 'Redis',
  mysql: 'MySQL',
  firebase: 'Firebase',
  mongodb: 'MongoDB',
  nodejs: 'Node',
  'node.js': 'Node',
  expressjs: 'Express',
  nestjs: 'NestJS',
  aws: 'AWS',
  gcp: 'GCP',
  'google cloud': 'GCP',
  azure: 'Azure',
  github: 'GitHub',
  docker: 'Docker',
  terraform: 'Terraform',
  graphql: 'GraphQL',
  fastify: 'Fastify',
  django: 'Django',
  flask: 'Flask',
  laravel: 'Laravel',
  go: 'Go',
  kotlin: 'Kotlin',
  elasticsearch: 'Elasticsearch',
  cloudflare: 'Cloudflare',
  netlify: 'Netlify',
  apollo: 'Apollo',
  'tanstack query': 'TanStack Query',
  reactquery: 'TanStack Query',
  nextauth: 'NextAuth.js',
  'nextauth.js': 'NextAuth.js',
};

function normalizeTechName(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (TECH_LIBRARY[t]) return t;
  const lower = t.toLowerCase().replace(/\s+/g, ' ').trim();
  const compact = lower.replace(/\./g, '');
  const aliased = TECH_ALIASES[lower] ?? TECH_ALIASES[compact];
  if (aliased && TECH_LIBRARY[aliased]) return aliased;
  for (const key of Object.keys(TECH_LIBRARY)) {
    if (key.toLowerCase() === lower) return key;
  }
  return t;
}

function mapStackFromAi(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = normalizeTechName(raw);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= 16) break;
  }
  return out;
}

function firstSentences(text: string, count: number): string {
  const parts = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, count).join(' ');
}

/** Stable SVG id for edge gradients (avoid invalid id characters). */
function svgEdgeGradientId(diagramSlug: string, edgeIndex: number, fromId: string, toId: string): string {
  return `e-${diagramSlug}-${edgeIndex}-${fromId}-${toId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** Perceived brightness 0–255 (sRGB, integer weights). */
function brandBrightness(hex: string): number | null {
  let h = hex.trim().toLowerCase();
  if (!h.startsWith('#')) return null;
  h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (!Number.isFinite(r + g + b)) return null;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function isVeryLightBrandHex(hex: string): boolean {
  const br = brandBrightness(hex);
  return br != null && br > 200;
}

/** On light canvas, very light hexes read as invisible on edges — nudge toward a readable slate. */
function edgeStrokeColor(hex: string, lightCanvas: boolean): string {
  if (!lightCanvas) return hex;
  let h = hex.trim();
  if (!h.startsWith('#')) return hex;
  h = h.slice(1).toLowerCase();
  if (h === 'fff' || h === 'ffffff') return '#64748b';
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (!Number.isFinite(r + g + b)) return hex;
    if (r > 235 && g > 235 && b > 235) return '#64748b';
  }
  return hex;
}

/** Node titles/tags on light cards: pure white / very light brand colors need a dark ink color. */
function nodeTextColor(hex: string, isDark: boolean): string {
  if (isDark) return hex;
  return isVeryLightBrandHex(hex) ? '#0f172a' : hex;
}

function nodeTagChipStyle(hex: string, isDark: boolean): { backgroundColor: string; color: string } {
  const color = nodeTextColor(hex, isDark);
  if (isDark) return { backgroundColor: `${hex}20`, color };
  if (color === '#0f172a' && isVeryLightBrandHex(hex)) {
    return { backgroundColor: 'rgba(15, 23, 42, 0.1)', color };
  }
  return { backgroundColor: `${hex}28`, color };
}

const VIEW_OPTIONS: { id: ViewMode; title: string; hint: string }[] = [
  { id: 'Signal Path', title: 'Signal path', hint: 'Animated edges — trace requests and data as they move.' },
  { id: 'Blueprint', title: 'Blueprint', hint: 'Bold grid and solid lines for specs and handoffs.' },
  { id: 'Briefing', title: 'Briefing', hint: 'Muted, lightweight diagram for slides and demos.' },
];

const THEME_STORAGE_KEY = 'nebula-theme';

function readStoredTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY);
    if (s === 'light' || s === 'dark') return s;
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function ThemeToggle({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-amber-200 dark:shadow-none dark:hover:bg-white/15"
    >
      {dark ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}

function TechIcon({ name, className, theme }: { name: string; className?: string; theme: 'light' | 'dark' }) {
  const slug = TECH_ICON_SLUGS[name] || name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const [error, setError] = useState(false);
  const iconHex = theme === 'dark' ? 'ffffff' : '1e293b';

  if (error) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded bg-slate-200 text-[8px] font-bold text-slate-600 dark:bg-white/10 dark:text-white/60`}
      >
        {name[0]}
      </div>
    );
  }

  return (
    <img
      src={`https://cdn.simpleicons.org/${slug}/${iconHex}`}
      alt={name}
      className={className}
      onError={() => setError(true)}
    />
  );
}

/** UML-style stick figure for use case actors */
function ActorStickFigure({ className, stroke }: { className?: string; stroke: string }) {
  return (
    <svg viewBox="0 0 40 56" className={className} aria-hidden fill="none">
      <circle cx="20" cy="9" r="6" stroke={stroke} strokeWidth="2" />
      <path d="M20 15v14M12 22h16M14 44l6-15 6 15M16 35l-6 12M24 35l6 12" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function isBoundaryKind(kindRaw: string): boolean {
  const k = kindRaw.toLowerCase();
  return (
    k.includes('system boundary') ||
    k.includes('boundary') ||
    k === 'subsystem' ||
    k.includes('package')
  );
}

function isUseCaseActorNode(
  diagramType: DiagramType,
  node: { isTech: boolean; subtitle: string; tag: string; title: string }
): boolean {
  if (diagramType !== 'Use Case' || node.isTech) return false;
  const kind = `${node.subtitle} ${node.tag}`.toLowerCase();
  if (isBoundaryKind(kind)) return false;
  const title = node.title.toLowerCase();
  if (/\bactor|human|participant|persona\b/.test(kind)) return true;
  if (/^actor$|^user$|^users$|end[\s-]*user|^customer|visitor|shopper|member|client|admin|driver|patient|guest/.test(title)) return true;
  if (/\b(user|customer|actor|person|member)\b/.test(title)) return true;
  if (/actor|user\s*\(/i.test(node.title)) return true;
  return kind.includes('actor') || kind.includes('enduser');
}

/** Classic UML layout: primary actor left, secondary right, use cases stacked inside boundary column */
function getUseCaseUmlLayoutPos(
  id: string,
  nodes: { id: string; title: string; subtitle: string; tag: string; isTech: boolean }[]
): NodePos {
  const actors: string[] = [];
  const useCases: string[] = [];
  for (const n of nodes) {
    if (isUseCaseActorNode('Use Case', n)) actors.push(n.id);
    else useCases.push(n.id);
  }
  const ai = actors.indexOf(id);
  if (ai >= 0) {
    const nActors = actors.length;
    const onRight = nActors > 1 && ai % 2 === 1;
    const x = nActors === 1 ? 5 : onRight ? 80 : 5;
    const y =
      nActors <= 2
        ? 20 + ai * 32
        : 12 + (ai * 68) / Math.max(nActors - 1, 1);
    return { x, y };
  }
  const ui = useCases.indexOf(id);
  if (ui >= 0) {
    const n = useCases.length;
    const y = n <= 1 ? 38 : 12 + (ui * 66) / Math.max(n - 1, 1);
    return { x: 35, y };
  }
  return { x: 40, y: 42 };
}

/** Use case ellipses (inside system boundary), not actors or tech nodes */
function isUseCaseOvalNode(
  diagramType: DiagramType,
  node: { isTech: boolean; subtitle: string; tag: string; title: string }
): boolean {
  if (diagramType !== 'Use Case' || node.isTech) return false;
  return !isUseCaseActorNode(diagramType, node);
}

function makeNodes(stack: string[]): TechNode[] {
  return stack
    .filter(Boolean)
    .map((name, i) => {
      const tech = TECH_LIBRARY[name] || { name, category: 'Frontend' as TechLayer, color: '#9ca3af', note: 'Custom' };
      return { ...tech, id: `${name}-${i}` };
    })
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Demo dataset — used by the "Try Demo" tour so the studio is fully filled  */
/*  without calling any AI provider.                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const DEMO_PROJECT_NAME = 'TaskPilot';

const DEMO_STACK: string[] = [
  'React',
  'TypeScript',
  'Tailwind CSS',
  'Node',
  'tRPC',
  'PostgreSQL',
  'Prisma',
  'Clerk',
  'Vercel',
  'Sentry',
];

const DEMO_SYSTEM_IDEA =
  'A task tracker for small teams. Members create work, get AI suggestions on next steps, and sync deadlines with calendars. Needs SSO, audit logs, low-latency sync, and SOC2-friendly logging.';

const DEMO_AI_RESULT =
  'TaskPilot — a tRPC + Postgres SaaS with Clerk SSO, optimistic React UI, and Sentry-backed observability on Vercel.';

const DEMO_NARRATIVE: ArchitectureNarrative = {
  headline: 'TaskPilot — collaborative AI task manager',
  summary:
    'Small teams plan work in a real-time React UI backed by a typed tRPC layer on Node. Postgres via Prisma stores tasks, projects, and audit events; Clerk owns identity and SSO. Vercel hosts edge-deployed pages and serverless API routes; Sentry captures errors and slow traces in production.',
  byLayer: {
    Frontend:
      'React + TypeScript + Tailwind for fast iteration on the UI. Query patterns over tRPC give optimistic updates while staying type-safe end to end.',
    API:
      'A tRPC layer over Node handlers groups procedures by domain (projects, tasks, AI). Auth context is injected from Clerk-issued JWTs; each procedure validates with Zod schemas.',
    Data:
      'Postgres on a managed provider, accessed through Prisma. Schema covers Users, Workspaces, Projects, Tasks, Comments, AuditEvents. Soft-deletes and per-row workspace IDs enable multi-tenant isolation.',
    Auth:
      'Clerk handles signup, social SSO, and session refresh. Workspace roles (owner/admin/member/viewer) are enforced on the API in tRPC middleware.',
    Infra:
      'Vercel deploys both the SPA and serverless tRPC routes globally. Sentry tracks errors and performance across both halves. GitHub Actions runs CI gates on PRs.',
  },
  diagramOverview:
    'Tabs trace the same product from different lenses: Flowchart shows the create-task journey, DFD highlights where data moves, Use Case captures the core actor flows, and System Architecture shows the deployment topology.',
  diagramProcesses: {
    flowchart:
      'A user creates a task → React form posts via tRPC → Node validates with Zod → Prisma writes to Postgres → audit event emitted → optimistic UI confirms.',
    dfd:
      'Members push task input into the API process, which reads/writes the Tasks store and emits AuditEvents to the audit store; the AI suggestions service reads task context and returns enrichment.',
    useCase:
      'Primary actor "Member" performs Create Task, Comment, Mark Done, and Request AI Suggestion inside the TaskPilot system boundary; "Admin" additionally performs Manage Workspace.',
    systemArchitecture:
      'Clients connect to Vercel Edge → tRPC routes (Node) → Postgres (Prisma) and Clerk for auth → Sentry sinks errors and traces.',
  },
};

const DEMO_DIAGRAMS: GeneratedDiagrams = {
  flowchart: `flowchart TD
  A[User opens TaskPilot] --> B[Create new task]
  B --> C{Valid input?}
  C -- Yes --> D[tRPC mutation]
  D --> E[Prisma → Postgres]
  E --> F[Emit AuditEvent]
  F --> G[Optimistic UI update]
  C -- No --> H[Inline validation message]`,
  dfd: `flowchart LR
  M((Member)) -->|task input| P[API process]
  P -->|read/write| TS[(Tasks store)]
  P -->|append| AE[(Audit events)]
  AI[/AI Suggestions svc/] -->|enrich| P
  P -->|response| M`,
  useCase: `flowchart LR
  M((Member)) --- UC1((Create Task))
  M --- UC2((Mark Done))
  M --- UC3((Request AI Suggestion))
  A((Admin)) --- UC4((Manage Workspace))
  A --- UC1
  subgraph TaskPilot
    UC1
    UC2
    UC3
    UC4
  end`,
  systemArchitecture: `flowchart TB
  subgraph Edge[Vercel Edge]
    UI[React SPA]
  end
  subgraph API[Vercel Serverless]
    T[tRPC routes]
  end
  subgraph Data[Managed Postgres]
    DB[(Postgres + Prisma)]
  end
  Clerk[(Clerk Identity)]
  Sentry[(Sentry)]
  UI --> T
  T --> DB
  T --> Clerk
  UI --> Sentry
  T --> Sentry`,
};

const DEMO_VISUALS: GeneratedVisuals = {
  flowchart: {
    nodes: [
      { id: 'open', label: 'Open TaskPilot', kind: 'process' },
      { id: 'create', label: 'Create task', kind: 'process' },
      { id: 'rpc', label: 'tRPC mutation', kind: 'api' },
      { id: 'db', label: 'Postgres write', kind: 'data store' },
      { id: 'audit', label: 'Audit event', kind: 'data store' },
      { id: 'ui', label: 'Optimistic UI', kind: 'process' },
    ],
    edges: [
      { from: 'open', to: 'create', label: 'opens form' },
      { from: 'create', to: 'rpc', label: 'submit' },
      { from: 'rpc', to: 'db', label: 'persist' },
      { from: 'db', to: 'audit', label: 'emit' },
      { from: 'audit', to: 'ui', label: 'confirm' },
    ],
  },
  dfd: {
    nodes: [
      { id: 'mem', label: 'Member', kind: 'external actor' },
      { id: 'api', label: 'API process', kind: 'process' },
      { id: 'ts', label: 'Tasks store', kind: 'data store' },
      { id: 'ae', label: 'Audit events', kind: 'data store' },
      { id: 'ai', label: 'AI suggestions', kind: 'external service' },
    ],
    edges: [
      { from: 'mem', to: 'api', label: 'task input' },
      { from: 'api', to: 'ts', label: 'read/write' },
      { from: 'api', to: 'ae', label: 'append' },
      { from: 'ai', to: 'api', label: 'enrich' },
      { from: 'api', to: 'mem', label: 'response' },
    ],
  },
  useCase: {
    nodes: [
      { id: 'mem', label: 'Member', kind: 'actor' },
      { id: 'adm', label: 'Admin', kind: 'actor' },
      { id: 'sys', label: 'TaskPilot', kind: 'system boundary' },
      { id: 'uc1', label: 'Create Task', kind: 'use case' },
      { id: 'uc2', label: 'Mark Done', kind: 'use case' },
      { id: 'uc3', label: 'Request AI Suggestion', kind: 'use case' },
      { id: 'uc4', label: 'Manage Workspace', kind: 'use case' },
    ],
    edges: [
      { from: 'mem', to: 'uc1', label: 'creates' },
      { from: 'mem', to: 'uc2', label: 'completes' },
      { from: 'mem', to: 'uc3', label: 'requests' },
      { from: 'adm', to: 'uc1', label: 'creates' },
      { from: 'adm', to: 'uc4', label: 'manages' },
    ],
  },
  systemArchitecture: {
    nodes: [
      { id: 'spa', label: 'React SPA', kind: 'frontend' },
      { id: 'api', label: 'tRPC routes', kind: 'api' },
      { id: 'db', label: 'Postgres', kind: 'data store' },
      { id: 'clerk', label: 'Clerk Identity', kind: 'external service' },
      { id: 'sentry', label: 'Sentry', kind: 'external service' },
    ],
    edges: [
      { from: 'spa', to: 'api', label: 'tRPC' },
      { from: 'api', to: 'db', label: 'Prisma' },
      { from: 'api', to: 'clerk', label: 'verify JWT' },
      { from: 'spa', to: 'sentry', label: 'errors' },
      { from: 'api', to: 'sentry', label: 'traces' },
    ],
  },
};

const DEMO_PLAYBOOK: DevPlaybook = {
  sdlc: {
    method: 'Lean Scrum (2-week sprints)',
    rationale:
      'Small team iterating on UX with regular customer feedback. Sprints keep planning lightweight while shipping on a predictable cadence.',
    cadenceAndCeremonies:
      'Planning Monday week 1, mid-sprint review Friday week 1, demo + retro Friday week 2. Daily 10-minute async standup in Slack.',
    whenToRevisit:
      'Move toward Kanban if work becomes interrupt-driven (incidents, support) or scale Scrum-of-Scrums when the team passes ~10 engineers.',
    diagram: `flowchart LR
  Plan[Sprint planning] --> Build[Build]
  Build --> Review[Mid-sprint review]
  Review --> Build
  Build --> Demo[Demo + retro]
  Demo --> Plan`,
  },
  workflow: {
    gitBranching:
      'Trunk-based with short-lived feature branches; merge to main behind feature flags. Squash-merge with conventional commit titles.',
    ciCd:
      'GitHub Actions: lint + typecheck + unit + e2e on every PR. Preview deploys on Vercel for each PR; main auto-deploys to production.',
    collaboration:
      'PRs require one review and green CI. ADRs in /docs/adr for architectural changes. Linear for ticketing, linked from PR body.',
    releaseAndRollback:
      'Vercel instant rollback on regressions. Feature flags toggle risky changes. Postmortems within 48 hours.',
    diagram: `flowchart LR
  Dev[Developer] --> PR[Open PR]
  PR --> CI[GitHub Actions CI]
  CI --> Preview[Vercel preview]
  Preview --> Review[Code review]
  Review --> Main[Merge to main]
  Main --> Prod[Vercel production]
  Prod --> Sentry[Sentry observability]`,
  },
  requirements: {
    scopeAndMvp:
      'MVP: workspaces, tasks, comments, AI suggestions, SSO. Out of scope for v1: Gantt charts, custom workflows, native mobile apps.',
    nonFunctional:
      'P95 task save < 250 ms; 99.9% monthly availability; SOC2-friendly audit logs; encryption at rest and in transit.',
    dependenciesAndIntegrations:
      'Clerk for auth, OpenAI-compatible API for suggestions, Google/Microsoft calendar sync, Slack notifications.',
  },
  quality: {
    testingStrategy:
      'Unit tests on tRPC procedures with Vitest; component tests via React Testing Library; Playwright for the create-task and SSO journeys.',
    environmentsAndData:
      'Dev / preview / prod environments. Preview branches use a sanitized seed DB. PII is never copied to lower environments.',
    definitionOfDone:
      'Code reviewed, tests added, telemetry emitted, ADR written if architectural, docs updated, feature flag plan agreed.',
  },
  security: {
    authnAuthz:
      'Clerk for identity; tRPC middleware enforces workspace-scoped roles. JWTs verified on every request with short TTL and refresh tokens.',
    dataAndSecrets:
      'Secrets in Vercel + GitHub OIDC; Postgres TLS-only; row-level workspace isolation; audit log export to S3 with lifecycle policies.',
    supplyChainAndCompliance:
      'Renovate + Dependabot for updates; SBOM generated on release; SOC2 controls tracked in a dedicated compliance tool.',
  },
  platform: {
    observability:
      'Sentry for errors and performance; structured logs to Vercel + a log aggregator; SLO dashboard reviewed weekly.',
    apiContractsAndDocs:
      'tRPC schemas are the source of truth; generated TS types shared with the SPA; OpenAPI mirror published for partner integrations.',
    costAndCapacity:
      'Vercel Pro tier; Postgres 4 vCPU plan with read replica past 80% utilization; AI cost capped per workspace via quota.',
  },
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Animated landing preview — a tiny "studio" mock that cycles through       */
/*  diagram types so the hero communicates what the app actually does.        */
/* ────────────────────────────────────────────────────────────────────────── */

interface PreviewNode {
  id: string;
  label: string;
  x: number; // %
  y: number; // %
  color: string;
}

interface PreviewEdge {
  from: string;
  to: string;
}

interface PreviewScene {
  tab: 'Tech Stack' | 'Flowchart' | 'DFD' | 'SDLC';
  caption: string;
  nodes: PreviewNode[];
  edges: PreviewEdge[];
}

const PREVIEW_SCENES: PreviewScene[] = [
  {
    tab: 'Tech Stack',
    caption: 'Color-coded by layer — Frontend, API, Data, Auth, Infra.',
    nodes: [
      { id: 'react', label: 'React', x: 10, y: 30, color: '#22d3ee' },
      { id: 'trpc', label: 'tRPC', x: 32, y: 62, color: '#818cf8' },
      { id: 'pg', label: 'Postgres', x: 56, y: 30, color: '#34d399' },
      { id: 'clerk', label: 'Clerk', x: 78, y: 62, color: '#fbbf24' },
      { id: 'vercel', label: 'Vercel', x: 78, y: 14, color: '#a855f7' },
    ],
    edges: [
      { from: 'react', to: 'trpc' },
      { from: 'trpc', to: 'pg' },
      { from: 'trpc', to: 'clerk' },
      { from: 'react', to: 'vercel' },
    ],
  },
  {
    tab: 'Flowchart',
    caption: 'Trace a user journey from input to confirmation.',
    nodes: [
      { id: 'open', label: 'Open', x: 6, y: 46, color: '#22d3ee' },
      { id: 'create', label: 'Create task', x: 30, y: 22, color: '#818cf8' },
      { id: 'save', label: 'Save', x: 54, y: 46, color: '#34d399' },
      { id: 'audit', label: 'Audit', x: 54, y: 78, color: '#a855f7' },
      { id: 'done', label: 'Done', x: 80, y: 46, color: '#fbbf24' },
    ],
    edges: [
      { from: 'open', to: 'create' },
      { from: 'create', to: 'save' },
      { from: 'save', to: 'audit' },
      { from: 'save', to: 'done' },
    ],
  },
  {
    tab: 'DFD',
    caption: 'Where data flows between actors, processes, and stores.',
    nodes: [
      { id: 'user', label: 'Member', x: 6, y: 46, color: '#fbbf24' },
      { id: 'api', label: 'API', x: 36, y: 46, color: '#818cf8' },
      { id: 'tasks', label: 'Tasks DB', x: 70, y: 22, color: '#34d399' },
      { id: 'audit', label: 'Audit DB', x: 70, y: 70, color: '#34d399' },
      { id: 'ai', label: 'AI svc', x: 36, y: 14, color: '#22d3ee' },
    ],
    edges: [
      { from: 'user', to: 'api' },
      { from: 'api', to: 'tasks' },
      { from: 'api', to: 'audit' },
      { from: 'ai', to: 'api' },
    ],
  },
  {
    tab: 'SDLC',
    caption: 'Lifecycle, workflow, and engineering playbook included.',
    nodes: [
      { id: 'plan', label: 'Plan', x: 8, y: 46, color: '#a855f7' },
      { id: 'build', label: 'Build', x: 30, y: 18, color: '#818cf8' },
      { id: 'review', label: 'Review', x: 56, y: 46, color: '#22d3ee' },
      { id: 'demo', label: 'Demo', x: 30, y: 76, color: '#34d399' },
      { id: 'ship', label: 'Ship', x: 80, y: 46, color: '#fbbf24' },
    ],
    edges: [
      { from: 'plan', to: 'build' },
      { from: 'build', to: 'review' },
      { from: 'review', to: 'demo' },
      { from: 'demo', to: 'ship' },
      { from: 'ship', to: 'plan' },
    ],
  },
];

function LandingPreview({ theme }: { theme: 'light' | 'dark' }) {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setScene((s) => (s + 1) % PREVIEW_SCENES.length);
    }, 3400);
    return () => window.clearInterval(id);
  }, [paused]);

  const s = PREVIEW_SCENES[scene];
  const nodeById = useMemo(() => Object.fromEntries(s.nodes.map((n) => [n.id, n])), [s]);

  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-xl" />
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/40 sm:p-5"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* window chrome */}
        <div className="mb-3 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-400/60" />
          <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
          <div className="h-3 w-3 rounded-full bg-green-400/60" />
          <div className="ml-auto text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-500">
            Nebula Studio
          </div>
        </div>

        {/* tab strip */}
        <div className="mb-3 flex gap-1 overflow-hidden rounded-lg bg-slate-100/80 p-1 dark:bg-white/5">
          {PREVIEW_SCENES.map((sc, i) => (
            <div
              key={sc.tab}
              className={`flex-1 rounded-md px-2 py-1 text-center text-[10px] font-medium transition sm:text-xs ${
                i === scene
                  ? 'bg-indigo-500/15 text-indigo-800 dark:bg-indigo-500/25 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {sc.tab}
            </div>
          ))}
        </div>

        {/* canvas */}
        <div
          key={scene}
          className="scene-enter relative aspect-[5/3] w-full overflow-hidden rounded-lg border border-slate-200/70 bg-slate-50/70 dark:border-white/5 dark:bg-black/40"
        >
          {/* grid */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" aria-hidden>
            <defs>
              <pattern id="preview-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.12)'}
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#preview-grid)" />
          </svg>

          {/* edges */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {s.edges.map((e, idx) => {
              const a = nodeById[e.from];
              const b = nodeById[e.to];
              if (!a || !b) return null;
              const ax = a.x + 6;
              const ay = a.y + 5;
              const bx = b.x + 6;
              const by = b.y + 5;
              const len = Math.hypot(bx - ax, by - ay) * 2;
              return (
                <line
                  key={`${scene}-${idx}`}
                  x1={ax}
                  y1={ay}
                  x2={bx}
                  y2={by}
                  stroke={isDark ? 'rgba(165,180,252,0.85)' : 'rgba(99,102,241,0.85)'}
                  strokeWidth={0.5}
                  className="edge-draw"
                  style={{ ['--edge-len' as string]: String(len) }}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* nodes */}
          {s.nodes.map((n, i) => (
            <div
              key={`${scene}-${n.id}`}
              className="scene-enter absolute rounded-md border px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur-sm sm:text-xs"
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                animationDelay: `${100 + i * 70}ms`,
                borderColor: isDark ? `${n.color}66` : `${n.color}aa`,
                background: isDark
                  ? `linear-gradient(135deg, ${n.color}22, rgba(0,0,0,0.55))`
                  : `linear-gradient(135deg, ${n.color}33, rgba(255,255,255,0.92))`,
                color: isDark ? '#e2e8f0' : '#0f172a',
                boxShadow: isDark ? `0 0 16px -8px ${n.color}` : `0 6px 16px -8px ${n.color}aa`,
              }}
            >
              {n.label}
            </div>
          ))}
        </div>

        {/* caption */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1">
            {PREVIEW_SCENES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === scene ? 'w-6 bg-indigo-500 dark:bg-indigo-400' : 'w-1.5 bg-slate-300 dark:bg-white/15'
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400 sm:text-xs">{s.caption}</p>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tour overlay — used by the Try Demo button                                */
/* ────────────────────────────────────────────────────────────────────────── */

type TourAnchorKey = 'ai' | 'tabs' | 'narrative' | 'playbook' | 'export';

interface TourStep {
  anchor: TourAnchorKey;
  title: string;
  body: string;
  durationMs: number;
}

const TOUR_STEPS: TourStep[] = [
  {
    anchor: 'ai',
    title: 'Idea → architecture',
    body:
      'Describe a product here in plain English. One run fills the canvas, narrative, diagrams, and engineering playbook — no setup.',
    durationMs: 7000,
  },
  {
    anchor: 'tabs',
    title: 'Diagram tabs cycle through the same product',
    body:
      'Tech Stack, Flowchart, DFD, Use Case, System Architecture, plus Mermaid SDLC and Workflow. Drag any node to recompose the layout.',
    durationMs: 13000,
  },
  {
    anchor: 'narrative',
    title: 'Layer-by-layer narrative',
    body:
      'A summary plus rationale for Frontend, API, Data, Auth, and Infra — and a one-paragraph caption per diagram tab.',
    durationMs: 7000,
  },
  {
    anchor: 'playbook',
    title: 'Engineering playbook',
    body:
      'SDLC method, workflow, requirements, quality, security, and platform notes — generated from the same brief.',
    durationMs: 11000,
  },
  {
    anchor: 'export',
    title: 'Export PNG',
    body: 'Any diagram tab can be exported as a high-resolution PNG for docs, decks, or PRs.',
    durationMs: 6000,
  },
];

interface TourOverlayProps {
  step: TourStep;
  rect: DOMRect | null;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

function TourOverlay({ step, rect, index, total, onPrev, onNext, onClose }: TourOverlayProps) {
  if (!rect) return null;
  const padding = 8;
  const ringStyle: React.CSSProperties = {
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  const tipWidth = 320;
  const margin = 16;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

  let tipLeft = rect.left + rect.width / 2 - tipWidth / 2;
  tipLeft = Math.max(margin, Math.min(vw - tipWidth - margin, tipLeft));

  const spaceBelow = vh - (rect.bottom + padding) - margin;
  const placeBelow = spaceBelow > 180 || rect.top < 200;
  const tipTop = placeBelow ? rect.bottom + padding + 12 : Math.max(margin, rect.top - padding - 12 - 220);

  const isLast = index === total - 1;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[60] bg-slate-900/35 transition-colors dark:bg-black/55"
        aria-hidden
      />
      <div
        className="tour-ring pointer-events-none fixed z-[61] rounded-2xl ring-2 ring-indigo-400/80"
        style={ringStyle}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="fixed z-[62] w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-indigo-300/60 bg-white p-4 shadow-2xl dark:border-indigo-400/30 dark:bg-[#0f1320]"
        style={{ left: tipLeft, top: tipTop, width: Math.min(tipWidth, vw - margin * 2) }}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            Demo · Step {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
            aria-label="Close demo"
          >
            ✕
          </button>
        </div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{step.title}</h3>
        <p className="mb-3 text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={index === 0}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [showStudio, setShowStudio] = useState(false);
  const [projectName, setProjectName] = useState('My Project');
  const [stack, setStack] = useState<string[]>(DEFAULT_STACK);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('Signal Path');
  const [diagramType, setDiagramType] = useState<DiagramType>('Tech Stack');
  const [stakeholderMode, setStakeholderMode] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePos>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [systemIdea, setSystemIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [architectureNarrative, setArchitectureNarrative] = useState<ArchitectureNarrative | null>(null);
  const [aiError, setAiError] = useState('');
  const [generatedDiagrams, setGeneratedDiagrams] = useState<GeneratedDiagrams | null>(null);
  const [generatedVisuals, setGeneratedVisuals] = useState<GeneratedVisuals | null>(null);
  const [diagramTab, setDiagramTab] = useState<'Flowchart' | 'DFD' | 'Use Case' | 'System Architecture'>('Flowchart');
  const [devPlaybook, setDevPlaybook] = useState<DevPlaybook | null>(null);
  const [playbookTab, setPlaybookTab] = useState<PlaybookTabId>('sdlc');
  const [theme, setTheme] = useState<'light' | 'dark'>(readStoredTheme);

  const [tourStep, setTourStep] = useState<number>(-1);
  const [tourRect, setTourRect] = useState<DOMRect | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const nodeElRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tourAiRef = useRef<HTMLDivElement>(null);
  const tourTabsRef = useRef<HTMLDivElement>(null);
  const tourNarrativeRef = useRef<HTMLDivElement>(null);
  const tourPlaybookRef = useRef<HTMLDivElement>(null);
  const tourExportRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const isDark = theme === 'dark';
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const tourActive = tourStep >= 0 && tourStep < TOUR_STEPS.length;
  const currentTourStep = tourActive ? TOUR_STEPS[tourStep] : null;

  const tourAnchorRefs = useMemo<Record<TourAnchorKey, React.RefObject<HTMLElement | null>>>(
    () => ({
      ai: tourAiRef,
      tabs: tourTabsRef,
      narrative: tourNarrativeRef,
      playbook: tourPlaybookRef,
      export: tourExportRef,
    }),
    []
  );

  // Track the current tour anchor's bounding rect via rAF while the tour is active.
  useEffect(() => {
    if (!currentTourStep) {
      setTourRect(null);
      return;
    }
    const ref = tourAnchorRefs[currentTourStep.anchor];
    const el = ref.current;
    if (!el) {
      setTourRect(null);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    let rafId = 0;
    const tick = () => {
      const node = ref.current;
      if (node) setTourRect(node.getBoundingClientRect());
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [currentTourStep, tourAnchorRefs]);

  // Auto-advance the tour and run per-step side effects (cycling diagram + playbook tabs).
  useEffect(() => {
    if (!currentTourStep) return;
    const cleanups: Array<() => void> = [];

    if (currentTourStep.anchor === 'tabs') {
      let i = 0;
      setDiagramType(CANVAS_DIAGRAM_TYPES[0]);
      const id = window.setInterval(() => {
        i = (i + 1) % CANVAS_DIAGRAM_TYPES.length;
        setDiagramType(CANVAS_DIAGRAM_TYPES[i]);
      }, 1700);
      cleanups.push(() => window.clearInterval(id));
    } else if (currentTourStep.anchor === 'playbook') {
      const order: PlaybookTabId[] = PLAYBOOK_TABS.map((t) => t.id);
      let i = 0;
      setPlaybookTab(order[0]);
      const id = window.setInterval(() => {
        i = (i + 1) % order.length;
        setPlaybookTab(order[i]);
      }, 1500);
      cleanups.push(() => window.clearInterval(id));
    } else if (currentTourStep.anchor === 'narrative') {
      setDiagramType('Tech Stack');
    }

    const advanceId = window.setTimeout(() => {
      setTourStep((s) => (s < TOUR_STEPS.length - 1 ? s + 1 : -1));
    }, currentTourStep.durationMs);
    cleanups.push(() => window.clearTimeout(advanceId));

    return () => cleanups.forEach((fn) => fn());
  }, [currentTourStep]);

  // Allow Esc to exit the tour.
  useEffect(() => {
    if (!tourActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTourStep(-1);
      if (e.key === 'ArrowRight')
        setTourStep((s) => (s < TOUR_STEPS.length - 1 ? s + 1 : -1));
      if (e.key === 'ArrowLeft') setTourStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourActive]);

  const loadDemo = () => {
    setProjectName(DEMO_PROJECT_NAME);
    setStack(DEMO_STACK);
    setSystemIdea(DEMO_SYSTEM_IDEA);
    setAiResult(DEMO_AI_RESULT);
    setAiError('');
    setArchitectureNarrative(DEMO_NARRATIVE);
    setGeneratedDiagrams(DEMO_DIAGRAMS);
    setGeneratedVisuals(DEMO_VISUALS);
    setDevPlaybook(DEMO_PLAYBOOK);
    setDiagramType('Tech Stack');
    setDiagramTab('Flowchart');
    setPlaybookTab('sdlc');
    setNodePositions({});
    setStakeholderMode(false);
    setShowStudio(true);
    window.setTimeout(() => setTourStep(0), 320);
  };

  const nodes = useMemo(() => makeNodes(stack), [stack]);
  
  const suggestions = useMemo(() => {
    const q = query.toLowerCase();
    return Object.keys(TECH_LIBRARY).filter(t => 
      !stack.includes(t) && t.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [query, stack]);

  const grouped = useMemo(() => 
    CATEGORY_ORDER.map(cat => ({
      category: cat,
      items: nodes.filter(n => n.category === cat)
    })).filter(g => g.items.length > 0)
  , [nodes]);

  const diagramKey = useMemo(() => {
    if (diagramType === 'Flowchart') return 'flowchart';
    if (diagramType === 'DFD') return 'dfd';
    if (diagramType === 'Use Case') return 'useCase';
    if (diagramType === 'System Architecture') return 'systemArchitecture';
    return null;
  }, [diagramType]);

  const isPlaybookMermaidCanvas = diagramType === 'SDLC' || diagramType === 'Workflow';

  const playbookCanvasChart = useMemo(() => {
    if (!devPlaybook) return '';
    if (diagramType === 'SDLC') return devPlaybook.sdlc.diagram.trim();
    if (diagramType === 'Workflow') return devPlaybook.workflow.diagram.trim();
    return '';
  }, [diagramType, devPlaybook]);

  const visualNodeColor = (kind: string): string => {
    const key = kind.toLowerCase();
    if (key.includes('actor') || key.includes('user')) return '#fbbf24';
    if (key.includes('use case') || key.includes('usecase')) return '#a5b4fc';
    if (key.includes('process') || key.includes('service') || key.includes('api')) return '#818cf8';
    if (key.includes('data') || key.includes('db') || key.includes('store')) return '#34d399';
    if (key.includes('external') || key.includes('third')) return '#22d3ee';
    return '#a78bfa';
  };

  const canvasVisual = useMemo<DiagramVisual>(() => {
    if (!diagramKey || !generatedVisuals) return { nodes: [], edges: [] };
    return generatedVisuals[diagramKey] ?? { nodes: [], edges: [] };
  }, [diagramKey, generatedVisuals]);

  const canvasNodes = useMemo(() => {
    if (diagramType === 'SDLC' || diagramType === 'Workflow') {
      return [];
    }
    if (diagramType === 'Tech Stack') {
      return nodes.map((node) => ({
        id: node.id,
        title: node.name,
        subtitle: node.note,
        tag: node.category,
        color: node.color,
        isTech: true,
      }));
    }
    if (!generatedVisuals || canvasVisual.nodes.length === 0) {
      return [];
    }
    const rawNodes =
      diagramType === 'Use Case'
        ? canvasVisual.nodes.filter((node) => !isBoundaryKind(node.kind))
        : canvasVisual.nodes;
    return rawNodes.map((node) => {
      const color = visualNodeColor(node.kind);
      return {
        id: `${diagramType}-${node.id}`,
        title: node.label,
        subtitle: node.kind,
        tag: node.kind,
        color,
        isTech: false,
      };
    });
  }, [diagramType, nodes, canvasVisual, generatedVisuals]);

  const systemBoundaryLabel = useMemo(() => {
    if (diagramType !== 'Use Case') return '';
    const b = generatedVisuals?.useCase?.nodes.find((n) => isBoundaryKind(n.kind));
    if (b?.label?.trim()) return b.label.trim();
    const h = architectureNarrative?.headline?.trim();
    if (h) return h;
    const p = projectName.trim();
    return p || 'System';
  }, [diagramType, generatedVisuals, architectureNarrative?.headline, projectName]);

  const canvasEdges = useMemo(() => {
    if (diagramType === 'SDLC' || diagramType === 'Workflow') {
      return [];
    }
    if (diagramType === 'Tech Stack') {
      return nodes.slice(0, -1).map((node, i) => ({
        from: node.id,
        to: nodes[i + 1].id,
        label: stakeholderMode ? 'connects' : `${node.category} → ${nodes[i + 1].category}`,
      }));
    }
    if (!generatedVisuals || canvasVisual.edges.length === 0) {
      return [];
    }
    const boundaryIds =
      diagramType === 'Use Case'
        ? new Set(
            canvasVisual.nodes.filter((n) => isBoundaryKind(n.kind)).map((n) => n.id)
          )
        : new Set<string>();
    const seen = new Set<string>();
    return canvasVisual.edges
      .filter((edge) => {
        if (boundaryIds.size > 0 && (boundaryIds.has(edge.from) || boundaryIds.has(edge.to))) {
          return false;
        }
        const k = `${edge.from}\0${edge.to}\0${edge.label ?? ''}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((edge) => ({
        from: `${diagramType}-${edge.from}`,
        to: `${diagramType}-${edge.to}`,
        label: edge.label || 'flow',
      }));
  }, [diagramType, canvasVisual, generatedVisuals, nodes, stakeholderMode]);

  const canvasView = useMemo(() => {
    if (isDark) {
      switch (viewMode) {
        case 'Blueprint':
          return { gridClass: 'opacity-[0.32]', dash: undefined as string | undefined, strokeOpacity: 0.72, flowAnimation: false };
        case 'Briefing':
          return { gridClass: 'opacity-[0.11]', dash: '0.35 0.55', strokeOpacity: 0.36, flowAnimation: false };
        default:
          return { gridClass: 'opacity-20', dash: '1 0.5', strokeOpacity: 0.5, flowAnimation: true };
      }
    }
    switch (viewMode) {
      case 'Blueprint':
        return { gridClass: 'opacity-[0.52]', dash: undefined as string | undefined, strokeOpacity: 0.94, flowAnimation: false };
      case 'Briefing':
        return { gridClass: 'opacity-[0.3]', dash: '0.35 0.55', strokeOpacity: 0.72, flowAnimation: false };
      default:
        return { gridClass: 'opacity-[0.45]', dash: '1 0.5', strokeOpacity: 0.9, flowAnimation: true };
    }
  }, [viewMode, isDark]);

  const NODE_WIDTH_PCT = 14;
  const NODE_HEIGHT_PCT = 14;
  const GRID_STEP = 2;
  const dragOffsetRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 160,
    h: 100,
  });

  const getNodePos = (id: string, index: number, total: number): NodePos => {
    if (nodePositions[id]) return nodePositions[id];
    if (diagramType === 'Use Case' && canvasNodes.length > 0) {
      return getUseCaseUmlLayoutPos(id, canvasNodes);
    }
    const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      x: 4 + (col / Math.max(cols - 1, 1)) * 78,
      y: 4 + (row / Math.max(Math.ceil(total / cols) - 1, 1)) * 80,
    };
  };

  useEffect(() => {
    setNodePositions(prev => {
      const next: Record<string, NodePos> = {};
      canvasNodes.forEach((n, i) => { next[n.id] = prev[n.id] || getNodePos(n.id, i, canvasNodes.length); });
      return next;
    });
  }, [canvasNodes]);

  const updateDraggedPosition = (clientX: number, clientY: number) => {
    if (!draggingId || !graphRef.current) return;
    const rect = graphRef.current.getBoundingClientRect();
    const live = nodeElRefs.current[draggingId]?.getBoundingClientRect();
    const cardW = live?.width ?? dragOffsetRef.current.w;
    const cardH = live?.height ?? dragOffsetRef.current.h;
    const cardWPct = (cardW / rect.width) * 100;
    const cardHPct = (cardH / rect.height) * 100;
    const maxX = Math.max(0, 100 - cardWPct);
    const maxY = Math.max(0, 100 - cardHPct);

    const targetLeftPx = clientX - rect.left - dragOffsetRef.current.x;
    const targetTopPx = clientY - rect.top - dragOffsetRef.current.y;
    let x = (targetLeftPx / rect.width) * 100;
    let y = (targetTopPx / rect.height) * 100;

    if (snapToGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    x = Math.max(0, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));

    if (snapToGrid) {
      const snapMaxX = Math.floor(maxX / GRID_STEP) * GRID_STEP;
      const snapMaxY = Math.floor(maxY / GRID_STEP) * GRID_STEP;
      if (x >= snapMaxX) x = maxX;
      if (y >= snapMaxY) y = maxY;
    }

    setNodePositions((p) => ({
      ...p,
      [draggingId]: { x, y },
    }));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    updateDraggedPosition(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (!draggingId) return;

    const handleWindowPointerMove = (event: PointerEvent) => {
      updateDraggedPosition(event.clientX, event.clientY);
    };
    const handleWindowPointerUp = () => {
      setDraggingId(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [draggingId, snapToGrid]);

  const addTech = (name: string) => {
    if (name && !stack.includes(name)) {
      setStack([...stack, name]);
      setQuery('');
    }
  };

  const removeTech = (name: string) => setStack(stack.filter(t => t !== name));

  const exportPng = async () => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    try {
      const url = await toPng(canvasRef.current, {
        pixelRatio: 2,
        backgroundColor: isDark ? '#0a0b10' : '#f8fafc',
      });
      const a = document.createElement('a');
      a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-diagram.png`;
      a.href = url;
      a.click();
    } finally {
      setIsExporting(false);
    }
  };

  const generateStack = async () => {
    if (!systemIdea.trim()) return;

    const providerRaw = (import.meta.env.VITE_AI_PROVIDER as string | undefined)?.trim().toLowerCase();
    const useGroq = providerRaw === 'groq';
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
    const geminiModel =
      (import.meta.env.VITE_GEMINI_MODEL as string | undefined)?.trim() || 'gemini-2.0-flash';
    const groqModel = (import.meta.env.VITE_GROQ_MODEL as string | undefined)?.trim();

    if (useGroq) {
      if (!groqKey?.trim()) {
        setAiError('Add VITE_GROQ_API_KEY to .env (free: https://console.groq.com) or remove VITE_AI_PROVIDER=groq to use Gemini.');
        return;
      }
    } else if (!geminiKey?.trim()) {
      setAiError('Add VITE_GEMINI_API_KEY to .env, or set VITE_AI_PROVIDER=groq with VITE_GROQ_API_KEY for Groq’s free tier.');
      return;
    }
    
    setIsGenerating(true);
    setAiError('');
    setAiResult('');
    setArchitectureNarrative(null);
    setDevPlaybook(null);
    
    const parseGeminiText = (raw: string) => {
      const t = raw.trim();
      try {
        return JSON.parse(t) as AiGeneratePayload;
      } catch {
        const m = t.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('Could not parse JSON from model');
        return JSON.parse(m[0]) as AiGeneratePayload;
      }
    };

    const ensureVisual = (v: unknown): DiagramVisual =>
      v && typeof v === 'object' && Array.isArray((v as DiagramVisual).nodes) && Array.isArray((v as DiagramVisual).edges)
        ? (v as DiagramVisual)
        : { nodes: [], edges: [] };

    try {
      const knownTechHint = Object.keys(TECH_LIBRARY).slice(0, 40).join(', ');
      const prompt = buildArchitecturePrompt(knownTechHint, systemIdea);

      const text = await fetchArchitectureCompletionText({
        backend: useGroq ? 'groq' : 'gemini',
        prompt,
        geminiKey,
        geminiModel,
        groqKey,
        groqModel,
      });

      const parsed = parseGeminiText(text);
      const mapped = mapStackFromAi(Array.isArray(parsed.stack) ? parsed.stack : []);
      if (mapped.length >= 2) setStack(mapped);

      const narRaw = parsed.narrative;
      const nar =
        narRaw && typeof narRaw === 'object' && !Array.isArray(narRaw)
          ? (narRaw as AiGeneratePayload['narrative'])
          : undefined;

      if (nar) {
        const dp = nar.diagramProcesses;
        const diagramProcesses =
          dp && typeof dp === 'object' && !Array.isArray(dp)
            ? {
                flowchart: typeof dp.flowchart === 'string' ? dp.flowchart : undefined,
                dfd: typeof dp.dfd === 'string' ? dp.dfd : undefined,
                useCase: typeof dp.useCase === 'string' ? dp.useCase : undefined,
                systemArchitecture:
                  typeof dp.systemArchitecture === 'string' ? dp.systemArchitecture : undefined,
              }
            : undefined;
        setArchitectureNarrative({
          headline: typeof nar.headline === 'string' ? nar.headline : 'Suggested architecture',
          summary: typeof nar.summary === 'string' ? nar.summary : '',
          byLayer: {
            Frontend: typeof nar.byLayer?.Frontend === 'string' ? nar.byLayer.Frontend : undefined,
            API: typeof nar.byLayer?.API === 'string' ? nar.byLayer.API : undefined,
            Data: typeof nar.byLayer?.Data === 'string' ? nar.byLayer.Data : undefined,
            Auth: typeof nar.byLayer?.Auth === 'string' ? nar.byLayer.Auth : undefined,
            Infra: typeof nar.byLayer?.Infra === 'string' ? nar.byLayer.Infra : undefined,
          },
          diagramOverview: typeof nar.diagramOverview === 'string' ? nar.diagramOverview : undefined,
          diagramProcesses,
        });
      }

      const explain = typeof parsed.explanation === 'string' && parsed.explanation.trim() ? parsed.explanation.trim() : '';
      const sum = typeof nar?.summary === 'string' ? nar.summary : '';
      setAiResult(
        explain || (sum ? `${sum.slice(0, 280)}${sum.length > 280 ? '…' : ''}` : 'Architecture generated — see narrative and diagram tabs.')
      );

      if (parsed.diagrams && typeof parsed.diagrams === 'object') {
        setGeneratedDiagrams({
          flowchart: String(parsed.diagrams.flowchart || ''),
          dfd: String(parsed.diagrams.dfd || ''),
          useCase: String(parsed.diagrams.useCase || ''),
          systemArchitecture: String(parsed.diagrams.systemArchitecture || ''),
        });
      }

      if (parsed.visuals && typeof parsed.visuals === 'object') {
        setGeneratedVisuals({
          flowchart: ensureVisual(parsed.visuals.flowchart),
          dfd: ensureVisual(parsed.visuals.dfd),
          useCase: ensureVisual(parsed.visuals.useCase),
          systemArchitecture: ensureVisual(parsed.visuals.systemArchitecture),
        });
      }

      const playbook = parseDevPlaybook(parsed);
      setDevPlaybook(playbook);
      if (playbook) setPlaybookTab('sdlc');

      setDiagramType('Tech Stack');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Landing Page
  if (!showStudio) {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0a0b10] dark:text-white">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-indigo-500/15 blur-[120px] dark:bg-indigo-600/20" />
          <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/15 blur-[120px] dark:bg-purple-600/20" />
          <div className="absolute top-[30%] right-[20%] h-[400px] w-[400px] rounded-full bg-cyan-400/10 blur-[100px] dark:bg-cyan-500/10" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-8 sm:px-6 sm:py-12">
          {/* Header */}
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-xl font-bold">Nebula</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-sm text-slate-600 dark:text-slate-400 sm:block sm:text-right">
                Idea → stack, diagrams &amp; engineering playbook
              </div>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </header>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 sm:hidden">
            Idea → stack, diagrams &amp; engineering playbook
          </p>

          {/* Hero */}
          <main className="flex-1 flex items-center py-6 sm:py-10 lg:py-0">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center w-full">
              <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50 px-3 py-1 text-xs text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 sm:mb-6 sm:text-sm">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-indigo-500 dark:bg-indigo-400" />
                  Idea → architecture in one run
                </div>
                <h1 className="mb-5 text-3xl font-bold leading-[1.12] text-slate-900 sm:mb-6 sm:text-4xl sm:leading-tight md:text-5xl lg:text-6xl dark:text-white">
                  Describe the product.
                  <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
                    {' '}
                    Get the stack and diagrams.
                  </span>
                </h1>
                <p className="mb-6 max-w-lg text-base text-slate-600 sm:mb-8 sm:text-lg dark:text-slate-400">
                  Describe what you are building once. Nebula uses AI to propose a stack, write a layer-by-layer narrative, fill
                  diagram tabs (flowchart, DFD, use case, system—plus Mermaid SDLC and workflow), and draft playbook notes from
                  requirements through platform. Refine the interactive canvas, then export a PNG for specs or presentations.
                </p>
                <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
                  {DEFAULT_STACK.map(t => (
                    <span
                      key={t}
                      className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-slate-200/90 bg-white/80 px-2.5 py-1 text-xs shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none sm:px-3 sm:py-1.5 sm:text-sm"
                    >
                      <TechIcon name={t} theme={theme} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t}</span>
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setShowStudio(true)}
                    className="w-full touch-manipulation rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-center font-semibold text-white hover:opacity-90 transition sm:w-auto"
                  >
                    Launch Studio
                  </button>
                  <button
                    type="button"
                    onClick={loadDemo}
                    className="group w-full touch-manipulation rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/5 sm:w-auto"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
                      </span>
                      Try Demo (guided tour)
                    </span>
                  </button>
                </div>
              </div>

              <div className="hidden lg:block lg:col-start-2 lg:row-start-1 min-w-0">
                <LandingPreview theme={theme} />
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-4 backdrop-blur-md dark:border-white/10 dark:bg-black/30 sm:p-5 lg:hidden lg:col-span-2">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700">Included</div>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {[
                    'Idea → architecture AI',
                    'Stack + diagram canvas tabs',
                    'Engineering playbook',
                    'Export PNG',
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="shrink-0 text-indigo-600 dark:text-indigo-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </main>

          <footer className="border-t border-slate-200/80 pt-8 text-center text-xs text-slate-600 dark:border-white/5 dark:text-slate-500 sm:text-sm">
            Nebula · architecture sketches from a brief, ready to share
          </footer>
        </div>
      </div>
    );
  }

  // Studio
  return (
    <div className="min-h-dvh bg-slate-50 pb-2 text-slate-900 dark:bg-[#0a0b10] dark:text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[5%] top-[-10%] h-[400px] w-[400px] rounded-full bg-indigo-400/10 blur-[100px] dark:bg-indigo-600/15" />
        <div className="absolute bottom-[10%] right-[5%] h-[350px] w-[350px] rounded-full bg-purple-400/10 blur-[100px] dark:bg-purple-600/15" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-3 pt-3 sm:px-4 sm:pt-4 lg:p-6">
        {/* Header */}
        <header className="mb-5 flex flex-col gap-4 border-b border-slate-200/90 pb-4 dark:border-white/5 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setShowStudio(false)}
              aria-label="Back to home"
              className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center hover:opacity-80 transition touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Nebula</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500">Studio</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 sm:text-xs dark:text-slate-500">
                Project name
              </div>
              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="min-w-0 w-full max-w-[min(100%,24rem)] border-none bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-500 sm:text-lg"
              />
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
            <span className="rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs text-slate-700 dark:border-transparent dark:bg-white/5 dark:text-slate-300 sm:text-sm">
              {nodes.length} modules
            </span>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button
              ref={tourExportRef}
              type="button"
              onClick={exportPng}
              disabled={isExporting}
              className="min-w-[8rem] flex-1 touch-manipulation rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:flex-none"
            >
              {isExporting ? 'Exporting...' : 'Export PNG'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* Main Canvas */}
          <div
            ref={canvasRef}
            className="col-span-12 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-black/30 lg:col-span-9"
          >
            {/* Diagram Tabs */}
            <div
              ref={tourTabsRef}
              className="-mx-px flex touch-pan-x gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200/80 bg-slate-100/80 p-2 scrollbar-thin dark:border-white/5 dark:bg-black/20"
            >
              {CANVAS_DIAGRAM_TYPES.map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setDiagramType(type)}
                  className={`shrink-0 touch-manipulation whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                    diagramType === type
                      ? 'bg-indigo-500/15 text-indigo-800 dark:bg-indigo-500/20 dark:text-white'
                      : 'text-slate-800 hover:bg-slate-200/90 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  {type === 'System Architecture' ? <span className="sm:hidden">Sys arch</span> : null}
                  {type === 'System Architecture' ? <span className="hidden sm:inline">{type}</span> : null}
                  {type !== 'System Architecture' ? type : null}
                </button>
              ))}
            </div>

            {/* Canvas */}
            <div
              ref={graphRef}
              className={`relative min-h-[260px] h-[min(720px,max(260px,calc(100svh-15.5rem)))] sm:h-[min(620px,max(340px,calc(100svh-14rem)))] lg:h-[720px] ${
                isPlaybookMermaidCanvas ? 'touch-auto select-text' : 'touch-none select-none'
              }`}
              onPointerMove={onPointerMove}
              onPointerUp={() => setDraggingId(null)}
            >
              {isPlaybookMermaidCanvas ? (
                <div className="absolute inset-0 z-[5] overflow-auto overscroll-contain p-3 sm:p-5">
                  {!devPlaybook ? (
                    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-700 dark:text-slate-500">
                      <span>Run Idea → architecture first — SDLC and Workflow diagrams come from that response.</span>
                    </div>
                  ) : !playbookCanvasChart ? (
                    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-700 dark:text-slate-500">
                      <span>
                        No Mermaid source for this view yet. Regenerate — the model should return{' '}
                        <code className="rounded bg-slate-200/90 px-1 text-xs dark:bg-white/10">
                          {diagramType === 'SDLC' ? 'sdlc.diagram' : 'workflow.diagram'}
                        </code>
                        .
                      </span>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-5xl space-y-3">
                      {diagramType === 'SDLC' && devPlaybook.sdlc.method ? (
                        <div className="inline-flex items-center gap-2 rounded-lg border border-violet-200/80 bg-violet-50/90 px-3 py-1.5 dark:border-violet-500/25 dark:bg-violet-500/10">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300/90">
                            SDLC
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {devPlaybook.sdlc.method}
                          </span>
                        </div>
                      ) : null}
                      {diagramType === 'Workflow' ? (
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          Engineering workflow
                        </div>
                      ) : null}
                      <MermaidBlock chart={playbookCanvasChart} theme={theme} />
                    </div>
                  )}
                </div>
              ) : (
                <>
              {/* Grid */}
              <svg className={`absolute inset-0 w-full h-full pointer-events-none ${canvasView.gridClass}`}>
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.2)'}
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {diagramType === 'Use Case' && canvasNodes.length > 0 ? (
                <div
                  className="pointer-events-none absolute z-[1] rounded-lg border-2 border-dashed border-slate-500/55 bg-slate-200/55 dark:border-white/25 dark:bg-[#0f1420]/40"
                  style={{ left: '23%', top: '7%', width: '50%', height: '80%' }}
                  aria-hidden
                >
                  <div className="absolute left-1/2 top-0 z-[2] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-[#0a0b10] dark:text-slate-400">
                    {systemBoundaryLabel}
                  </div>
                </div>
              ) : null}

              {/* Connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <filter id="edge-label-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow
                      dx="0"
                      dy="0"
                      stdDeviation={isDark ? 0.35 : 0.55}
                      floodColor={isDark ? '#0a0b10' : '#64748b'}
                      floodOpacity={isDark ? 0.95 : 0.45}
                    />
                  </filter>
                </defs>
                {canvasEdges.map((edge, edgeIndex) => {
                  const fromIndex = canvasNodes.findIndex((node) => node.id === edge.from);
                  const toIndex = canvasNodes.findIndex((node) => node.id === edge.to);
                  if (fromIndex < 0 || toIndex < 0) return null;
                  const rawPos1 = getNodePos(edge.from, fromIndex, canvasNodes.length);
                  const rawPos2 = getNodePos(edge.to, toIndex, canvasNodes.length);
                  const pos1 = { x: rawPos1.x + NODE_WIDTH_PCT / 2, y: rawPos1.y + NODE_HEIGHT_PCT / 2 };
                  const pos2 = { x: rawPos2.x + NODE_WIDTH_PCT / 2, y: rawPos2.y + NODE_HEIGHT_PCT / 2 };
                  const fromNode = canvasNodes[fromIndex]!;
                  const toNode = canvasNodes[toIndex]!;
                  const colorFrom = edgeStrokeColor(fromNode.color, !isDark);
                  const colorTo = edgeStrokeColor(toNode.color, !isDark);
                  const diagramSlug = diagramType.replace(/\s+/g, '');
                  const gradId = svgEdgeGradientId(diagramSlug, edgeIndex, edge.from, edge.to);
                  const midX = (pos1.x + pos2.x) / 2;
                  const midY = (pos1.y + pos2.y) / 2;
                  const spiralR = 2.4 + (edgeIndex % 6) * 0.65;
                  const spiralA = ((edgeIndex * 53) % 360) * (Math.PI / 180);
                  const lx = midX + Math.cos(spiralA) * spiralR;
                  const ly = midY + Math.sin(spiralA) * spiralR;
                  const labelText = stakeholderMode ? 'connects' : edge.label;
                  const shortLabel =
                    labelText.length > 22 ? `${labelText.slice(0, 20)}…` : labelText;
                  const dashPattern = canvasView.dash;
                  const staggerDashOffset = dashPattern ? (edgeIndex * 0.35) % 2.5 : undefined;
                  return (
                    <g key={`edge-${edgeIndex}-${edge.from}-${edge.to}`}>
                      <defs>
                        <linearGradient
                          id={gradId}
                          gradientUnits="userSpaceOnUse"
                          x1={pos1.x}
                          y1={pos1.y}
                          x2={pos2.x}
                          y2={pos2.y}
                        >
                          <stop offset="0%" stopColor={colorFrom} stopOpacity={canvasView.strokeOpacity} />
                          <stop offset="100%" stopColor={colorTo} stopOpacity={canvasView.strokeOpacity} />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M ${pos1.x} ${pos1.y} Q ${(pos1.x + pos2.x) / 2} ${pos1.y + 8}, ${pos2.x} ${pos2.y}`}
                        fill="none"
                        stroke={`url(#${gradId})`}
                        strokeWidth={isDark ? 0.38 : 0.52}
                        strokeOpacity={1}
                        {...(dashPattern
                          ? { strokeDasharray: dashPattern, strokeDashoffset: staggerDashOffset }
                          : {})}
                        className={canvasView.flowAnimation ? 'animate-[flow_3s_linear_infinite]' : ''}
                      />
                      <text
                        x={lx}
                        y={ly}
                        fill={isDark ? 'rgba(226,232,240,0.95)' : '#0f172a'}
                        stroke={isDark ? '#0a0b10' : '#ffffff'}
                        strokeWidth={isDark ? 0.5 : 0.75}
                        paintOrder="stroke fill"
                        fontSize="1.05"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        filter="url(#edge-label-shadow)"
                      >
                        {shortLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {canvasNodes.map((node, i) => {
                const pos = getNodePos(node.id, i, canvasNodes.length);
                const actorNode = isUseCaseActorNode(diagramType, node);
                const ovalNode = isUseCaseOvalNode(diagramType, node);
                return (
                  <div
                    key={node.id}
                    ref={(el) => {
                      nodeElRefs.current[node.id] = el;
                    }}
                    onPointerDown={e => {
                      e.preventDefault();
                      const cardRect = e.currentTarget.getBoundingClientRect();
                      dragOffsetRef.current = {
                        x: e.clientX - cardRect.left,
                        y: e.clientY - cardRect.top,
                        w: cardRect.width,
                        h: cardRect.height,
                      };
                      setDraggingId(node.id);
                    }}
                    className={`absolute h-fit flex flex-col cursor-grab active:cursor-grabbing transition-shadow hover:shadow-2xl max-w-[calc(100%-0.75rem)] ${
                      ovalNode
                        ? 'z-20 items-center justify-center rounded-full border px-4 py-2.5 text-center min-w-[9rem] sm:min-w-[10rem] max-w-[min(18rem,calc(100%-1rem))] backdrop-blur-xl'
                        : actorNode
                          ? 'gap-1.5 rounded-xl border backdrop-blur-xl w-32 items-center px-2 pt-2 pb-2.5 text-center sm:w-36'
                          : 'flex flex-col gap-2 rounded-xl border backdrop-blur-xl w-36 px-2.5 pt-3 pb-2 sm:w-40 sm:px-3'
                    } ${draggingId === node.id ? 'z-30' : ovalNode ? 'z-20' : 'z-10'}`}
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      borderColor: isDark ? `${node.color}55` : `${node.color}cc`,
                      background: isDark
                        ? `linear-gradient(135deg, ${node.color}15, rgba(0,0,0,0.6))`
                        : `linear-gradient(135deg, ${node.color}22, rgba(255,255,255,0.94))`,
                      boxShadow: isDark ? `0 0 30px -10px ${node.color}` : `0 8px 24px -8px ${node.color}55`,
                      touchAction: 'none',
                    }}
                  >
                    {actorNode ? (
                      <>
                        <ActorStickFigure
                          stroke={nodeTextColor(node.color, isDark)}
                          className="w-12 h-[3.25rem] shrink-0"
                        />
                        <div
                          className="w-full px-0.5 text-sm font-semibold leading-tight"
                          style={{ color: nodeTextColor(node.color, isDark) }}
                        >
                          {node.title}
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-500">
                          Use case actor
                        </div>
                      </>
                    ) : ovalNode ? (
                      <>
                        <div
                          className="text-xs font-semibold leading-snug"
                          style={{ color: nodeTextColor(node.color, isDark) }}
                        >
                          {node.title}
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-500">Use case</div>
                      </>
                    ) : (
                      <>
                        <div className="flex shrink-0 items-center justify-between gap-2">
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase leading-none"
                            style={nodeTagChipStyle(node.color, isDark)}
                          >
                            {node.tag}
                          </span>
                          {node.isTech ? <TechIcon name={node.title} theme={theme} className="h-5 w-5 shrink-0" /> : null}
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-col gap-0.5">
                          <div
                            className="text-sm font-semibold leading-tight"
                            style={{ color: nodeTextColor(node.color, isDark) }}
                          >
                            {node.title}
                          </div>
                          <div className="text-[10px] leading-none text-slate-700 dark:text-slate-400">{node.subtitle}</div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {canvasNodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-700 dark:text-slate-500">
                  {diagramType === 'Tech Stack' && <span>Add technologies to get started</span>}
                  {diagramType !== 'Tech Stack' && !generatedVisuals && (
                    <span>Run Idea → architecture first — each tab then loads its own graph from the AI response.</span>
                  )}
                  {diagramType !== 'Tech Stack' && generatedVisuals && (
                    <>
                      <span>No interactive nodes for this diagram in the last response.</span>
                      <span className="text-xs text-slate-600 dark:text-slate-600">
                        Mermaid source may still appear below under Generated diagrams.
                      </span>
                    </>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            {/* Add Tech */}
            <div className="rounded-xl border border-slate-200/90 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-500">
                Add Technology
              </div>
              <div className="mb-3 flex gap-2">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTech(query)}
                  placeholder="Search..."
                  className="flex-1 rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500/50 dark:border-white/10 dark:bg-black/40 dark:text-slate-100"
                />
                <button
                  onClick={() => addTech(query)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
                >
                  Add
                </button>
              </div>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {suggestions.map(t => (
                  <button
                    key={t}
                    onClick={() => addTech(t)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-800 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <TechIcon name={t} theme={theme} className="h-3 w-3" />
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Stack */}
            <div className="rounded-xl border border-slate-200/90 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-500">
                Current Stack ({nodes.length})
              </div>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {nodes.map(n => (
                  <button
                    key={n.id}
                    onClick={() => removeTech(n.name)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition hover:bg-red-500/15 dark:hover:bg-red-500/20"
                    style={nodeTagChipStyle(n.color, isDark)}
                  >
                    <TechIcon name={n.name} theme={theme} className="h-3 w-3" />
                    {n.name}
                    <span className="ml-1 text-slate-400 dark:text-white/40">×</span>
                  </button>
                ))}
              </div>
            </div>

            {/* View Options */}
            <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-500">
                View Options
              </div>

              <div>
                <div className="mb-2 text-[10px] font-medium text-slate-600 dark:text-slate-500">Canvas style</div>
                <div className="flex flex-col gap-1.5">
                  {VIEW_OPTIONS.map(({ id, title, hint }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setViewMode(id)}
                      className={`rounded-lg px-2.5 py-2 text-left transition ${
                        viewMode === id
                          ? 'bg-indigo-600 text-white ring-1 ring-indigo-400/40'
                          : 'bg-slate-100 hover:bg-slate-200/90 dark:bg-white/5 dark:hover:bg-white/10'
                      }`}
                    >
                      <div
                        className={`text-xs font-semibold ${viewMode === id ? '' : 'text-slate-800 dark:text-slate-100'}`}
                      >
                        {title}
                      </div>
                      <div
                        className={`mt-0.5 text-[10px] leading-snug ${viewMode === id ? 'text-indigo-100/90' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        {hint}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/80 py-2 dark:border-white/5">
                <span className="text-xs text-slate-600 dark:text-slate-400">Snap to Grid</span>
                <button
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  className={`h-5 w-10 rounded-full transition ${snapToGrid ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-white/20'}`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${snapToGrid ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/80 py-2 dark:border-white/5">
                <span className="text-xs text-slate-600 dark:text-slate-400">Audience</span>
                <button
                  onClick={() => setStakeholderMode(!stakeholderMode)}
                  className={`rounded px-3 py-1 text-[10px] font-semibold uppercase ${
                    stakeholderMode
                      ? 'bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                      : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                  }`}
                >
                  {stakeholderMode ? 'Stakeholder' : 'Technical'}
                </button>
              </div>
            </div>

            {/* AI Generator */}
            <div
              ref={tourAiRef}
              className="rounded-xl border border-slate-200/90 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold">Idea → architecture</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-500">
                    Stack, SDLC, workflow, security, quality, diagrams & narrative
                  </div>
                  <div className="mt-1 text-[10px] text-slate-600 dark:text-slate-600">
                    AI:{' '}
                    {(import.meta.env.VITE_AI_PROVIDER as string | undefined)?.trim().toLowerCase() === 'groq'
                      ? 'Groq (Llama) — set VITE_GROQ_API_KEY'
                      : 'Gemini — set VITE_GEMINI_API_KEY (or use VITE_AI_PROVIDER=groq if Google quota is full)'}
                  </div>
                </div>
              </div>
              <textarea
                value={systemIdea}
                onChange={e => setSystemIdea(e.target.value)}
                placeholder="Describe the product: users, workflows, compliance, scale…"
                className="h-24 w-full resize-none rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500/50 dark:border-white/10 dark:bg-black/40 dark:text-slate-100"
              />
              <button
                onClick={generateStack}
                disabled={isGenerating || !systemIdea.trim()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating…
                  </>
                ) : 'Generate architecture'}
              </button>
              {aiError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{aiError}</p>}
              {aiResult && <p className="mt-2 text-xs text-green-700 dark:text-green-400">{aiResult}</p>}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="col-span-12 grid grid-cols-12 gap-4">
            {/* Stack Breakdown */}
            <div className="col-span-12 rounded-xl border border-slate-200/90 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30 lg:col-span-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-500">
                Stack Breakdown
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {CATEGORY_ORDER.map(cat => {
                  const count = grouped.find(g => g.category === cat)?.items.length ?? 0;
                  return (
                    <div key={cat} className="p-3 rounded-lg" style={{ backgroundColor: `${LAYER_COLORS[cat]}10` }}>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: LAYER_COLORS[cat] }}>{cat}</div>
                      <div className="text-2xl font-bold" style={{ color: LAYER_COLORS[cat] }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Narrative */}
            <div
              ref={tourNarrativeRef}
              className="col-span-12 rounded-xl border border-slate-200/90 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30 lg:col-span-8"
            >
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-500">
                Architecture Narrative
              </div>

              {architectureNarrative ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">
                      {architectureNarrative.headline}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {stakeholderMode ? firstSentences(architectureNarrative.summary, 2) : architectureNarrative.summary}
                    </p>
                  </div>

                  {!stakeholderMode &&
                    CATEGORY_ORDER.some((c) => architectureNarrative.byLayer?.[c]) && (
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          By layer
                        </div>
                        {CATEGORY_ORDER.map((cat) => {
                          const para = architectureNarrative.byLayer?.[cat];
                          if (!para?.trim()) return null;
                          return (
                            <div
                              key={cat}
                              className="rounded-lg border border-slate-200/60 p-3 dark:border-white/5"
                              style={{ backgroundColor: `${LAYER_COLORS[cat]}08` }}
                            >
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: LAYER_COLORS[cat] }}>
                                {cat}
                              </div>
                              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{para}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {architectureNarrative.diagramOverview && (
                    <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/80 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/5">
                      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-indigo-800 dark:text-indigo-300/90">
                        Diagrams in context
                      </div>
                      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        {stakeholderMode ? firstSentences(architectureNarrative.diagramOverview, 2) : architectureNarrative.diagramOverview}
                      </p>
                    </div>
                  )}

                  {architectureNarrative.diagramProcesses &&
                    DIAGRAM_NARRATIVE_ORDER.some(({ key }) => architectureNarrative.diagramProcesses?.[key]?.trim()) && (
                      <div className="space-y-2.5">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-500">
                          What each diagram shows
                        </div>
                        {DIAGRAM_NARRATIVE_ORDER.map(({ key, label }) => {
                          const para = architectureNarrative.diagramProcesses?.[key];
                          if (!para?.trim()) return null;
                          return (
                            <div
                              key={key}
                              className="rounded-lg border border-teal-200/80 bg-teal-50/60 p-3 dark:border-teal-500/20 dark:bg-teal-500/[0.06]"
                            >
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300/90">
                                {label}
                              </div>
                              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                                {stakeholderMode ? firstSentences(para, 2) : para}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  <div className="flex flex-wrap gap-2 border-t border-slate-200/80 pt-1 dark:border-white/5">
                    {grouped.map(g => (
                      <div key={g.category} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${LAYER_COLORS[g.category]}10` }}>
                        <span className="text-xs font-semibold" style={{ color: LAYER_COLORS[g.category] }}>{g.category}:</span>
                        <div className="flex flex-wrap gap-1">
                          {g.items.map(item => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px]"
                              style={nodeTagChipStyle(item.color, isDark)}
                            >
                              <TechIcon name={item.name} theme={theme} className="h-3 w-3" />
                              {item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {stakeholderMode
                      ? 'Generate from your product idea to see a tailored story: how users move through the app, how data and auth are protected, and how services connect.'
                      : 'Run Idea → architecture to populate this panel with a headline, layer-by-layer rationale, and how each diagram type maps to your system. Until then, this is a quick overview of your current stack composition.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {grouped.map(g => (
                      <div key={g.category} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${LAYER_COLORS[g.category]}10` }}>
                        <span className="text-xs font-semibold" style={{ color: LAYER_COLORS[g.category] }}>{g.category}:</span>
                        <div className="flex flex-wrap gap-1">
                          {g.items.map(item => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px]"
                              style={nodeTagChipStyle(item.color, isDark)}
                            >
                              <TechIcon name={item.name} theme={theme} className="h-3 w-3" />
                              {item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Engineering playbook: SDLC, workflow, and delivery tabs */}
          <div
            ref={tourPlaybookRef}
            className="col-span-12 rounded-xl border border-slate-200/90 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-500">
              Engineering playbook
            </div>
            <p className="mb-3 text-[11px] leading-snug text-slate-600 dark:text-slate-500">
              Filled by the same AI run as your architecture. SDLC and Workflow diagrams live in the main canvas tabs; this panel
              adds narrative detail.
            </p>
            <div className="-mx-px flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200/80 pb-2 scrollbar-thin touch-pan-x dark:border-white/5">
              {PLAYBOOK_TABS.map(({ id, label, shortLabel, hint }) => (
                <button
                  type="button"
                  key={id}
                  title={hint}
                  onClick={() => setPlaybookTab(id)}
                  className={`shrink-0 touch-manipulation whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
                    playbookTab === id
                      ? 'bg-violet-500/15 text-violet-900 dark:bg-violet-500/20 dark:text-white'
                      : 'text-slate-800 hover:bg-slate-200/90 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">{shortLabel ?? label}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 min-h-[6rem] text-sm">
              {!devPlaybook ? (
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-500">
                  Run <span className="font-semibold text-slate-800 dark:text-slate-300">Idea → architecture</span> to populate SDLC
                  method, engineering workflow, requirements, quality, security, and platform guidance tailored to your product.
                </p>
              ) : (
                (() => {
                  const t = (s: string) => (stakeholderMode && s ? firstSentences(s, 3) : s);
                  const Para = ({ label, body }: { label: string; body: string }) =>
                    body ? (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-violet-800 dark:text-violet-300/90">
                          {label}
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{t(body)}</p>
                      </div>
                    ) : null;

                  if (playbookTab === 'sdlc') {
                    const m = devPlaybook.sdlc.method;
                    return (
                      <div className="space-y-3">
                        <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-500">
                          Open the <span className="font-semibold text-slate-800 dark:text-slate-300">SDLC</span> tab above the
                          canvas to view the lifecycle Mermaid diagram full size.
                        </p>
                        {m ? (
                          <div className="inline-flex items-center gap-2 rounded-lg border border-violet-200/80 bg-violet-50/90 px-3 py-1.5 dark:border-violet-500/25 dark:bg-violet-500/10">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300/90">
                              Recommended SDLC
                            </span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">{m}</span>
                          </div>
                        ) : null}
                        <Para label="Why this method" body={devPlaybook.sdlc.rationale} />
                        <Para label="Cadence & ceremonies" body={devPlaybook.sdlc.cadenceAndCeremonies} />
                        <Para label="When to revisit" body={devPlaybook.sdlc.whenToRevisit} />
                      </div>
                    );
                  }
                  if (playbookTab === 'workflow') {
                    return (
                      <div className="space-y-3">
                        <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-500">
                          Open the <span className="font-semibold text-slate-800 dark:text-slate-300">Workflow</span> tab above the
                          canvas for the delivery pipeline diagram.
                        </p>
                        <Para label="Git & branching" body={devPlaybook.workflow.gitBranching} />
                        <Para label="CI / CD" body={devPlaybook.workflow.ciCd} />
                        <Para label="Collaboration" body={devPlaybook.workflow.collaboration} />
                        <Para label="Release & rollback" body={devPlaybook.workflow.releaseAndRollback} />
                      </div>
                    );
                  }
                  if (playbookTab === 'requirements') {
                    return (
                      <div className="space-y-3">
                        <Para label="Scope & MVP" body={devPlaybook.requirements.scopeAndMvp} />
                        <Para label="Non-functional requirements" body={devPlaybook.requirements.nonFunctional} />
                        <Para label="Dependencies & integrations" body={devPlaybook.requirements.dependenciesAndIntegrations} />
                      </div>
                    );
                  }
                  if (playbookTab === 'quality') {
                    return (
                      <div className="space-y-3">
                        <Para label="Testing strategy" body={devPlaybook.quality.testingStrategy} />
                        <Para label="Environments & data" body={devPlaybook.quality.environmentsAndData} />
                        <Para label="Definition of done" body={devPlaybook.quality.definitionOfDone} />
                      </div>
                    );
                  }
                  if (playbookTab === 'security') {
                    return (
                      <div className="space-y-3">
                        <Para label="Authentication & authorization" body={devPlaybook.security.authnAuthz} />
                        <Para label="Data & secrets" body={devPlaybook.security.dataAndSecrets} />
                        <Para label="Supply chain & compliance" body={devPlaybook.security.supplyChainAndCompliance} />
                      </div>
                    );
                  }
                  if (playbookTab === 'platform') {
                    return (
                      <div className="space-y-3">
                        <Para label="Observability" body={devPlaybook.platform.observability} />
                        <Para label="API contracts & docs" body={devPlaybook.platform.apiContractsAndDocs} />
                        <Para label="Cost & capacity" body={devPlaybook.platform.costAndCapacity} />
                      </div>
                    );
                  }
                  return null;
                })()
              )}
            </div>
          </div>

          {/* Generated Diagrams */}
          {generatedDiagrams && (
            <div className="col-span-12 rounded-xl border border-slate-200/90 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-500">
                Generated Diagrams
              </div>
              <div className="-mx-px flex gap-2 mb-3 overflow-x-auto overflow-y-hidden scrollbar-thin touch-pan-x pb-0.5">
                {(['Flowchart', 'DFD', 'Use Case', 'System Architecture'] as const).map(tab => (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => setDiagramTab(tab)}
                    className={`shrink-0 touch-manipulation whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      diagramTab === tab
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <pre className="max-h-40 overflow-auto rounded-lg border border-slate-300/90 bg-slate-100 p-3 font-mono text-[11px] text-slate-900 dark:border-transparent dark:bg-black/40 dark:text-slate-300 sm:max-h-48 sm:p-4 sm:text-xs">
                {diagramTab === 'Flowchart' && generatedDiagrams.flowchart}
                {diagramTab === 'DFD' && generatedDiagrams.dfd}
                {diagramTab === 'Use Case' && generatedDiagrams.useCase}
                {diagramTab === 'System Architecture' && generatedDiagrams.systemArchitecture}
              </pre>
            </div>
          )}
        </div>
      </div>

      {tourActive && currentTourStep ? (
        <TourOverlay
          step={currentTourStep}
          rect={tourRect}
          index={tourStep}
          total={TOUR_STEPS.length}
          onPrev={() => setTourStep((s) => Math.max(0, s - 1))}
          onNext={() =>
            setTourStep((s) => (s < TOUR_STEPS.length - 1 ? s + 1 : -1))
          }
          onClose={() => setTourStep(-1)}
        />
      ) : null}
    </div>
  );
}
