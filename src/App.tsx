import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { buildArchitecturePrompt, fetchArchitectureCompletionText } from './architectureCompletion';

type TechLayer = 'Frontend' | 'API' | 'Data' | 'Auth' | 'Infra';
type ViewMode = 'Signal Path' | 'Blueprint' | 'Briefing';
type DiagramType = 'Tech Stack' | 'Flowchart' | 'DFD' | 'Use Case' | 'System Architecture';

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

interface ArchitectureNarrative {
  headline: string;
  summary: string;
  byLayer: Partial<Record<TechLayer, string>>;
  diagramOverview?: string;
}

interface AiGeneratePayload {
  stack: string[];
  explanation?: string;
  narrative?: Partial<ArchitectureNarrative> & {
    byLayer?: Partial<Record<TechLayer, string>>;
  };
  diagrams?: GeneratedDiagrams;
  visuals?: GeneratedVisuals;
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

const VIEW_OPTIONS: { id: ViewMode; title: string; hint: string }[] = [
  { id: 'Signal Path', title: 'Signal path', hint: 'Animated edges — trace requests and data as they move.' },
  { id: 'Blueprint', title: 'Blueprint', hint: 'Bold grid and solid lines for specs and handoffs.' },
  { id: 'Briefing', title: 'Briefing', hint: 'Muted, lightweight diagram for slides and demos.' },
];

function TechIcon({ name, className }: { name: string; className?: string }) {
  const slug = TECH_ICON_SLUGS[name] || name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const [error, setError] = useState(false);
  
  if (error) {
    return <div className={`${className} flex items-center justify-center rounded bg-white/10 text-[8px] font-bold text-white/60`}>{name[0]}</div>;
  }
  
  return (
    <img
      src={`https://cdn.simpleicons.org/${slug}/ffffff`}
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

function isUseCaseActorNode(
  diagramType: DiagramType,
  node: { isTech: boolean; subtitle: string; tag: string; title: string }
): boolean {
  if (diagramType !== 'Use Case' || node.isTech) return false;
  const kind = `${node.subtitle} ${node.tag}`.toLowerCase();
  const title = node.title.toLowerCase();
  if (/\bactor|human|participant|persona\b/.test(kind)) return true;
  if (/^actor$|^user$|^users$|end[\s-]*user|^customer|visitor|shopper|member|client|admin|driver|patient|guest/.test(title)) return true;
  if (/\b(user|customer|actor|person|member)\b/.test(title)) return true;
  if (/actor|user\s*\(/i.test(node.title)) return true;
  return kind.includes('actor') || kind.includes('enduser');
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

  const canvasRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const nodeElRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const visualNodeColor = (kind: string): string => {
    const key = kind.toLowerCase();
    if (key.includes('actor') || key.includes('user')) return '#fbbf24';
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
    return canvasVisual.nodes.map((node) => {
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

  const canvasEdges = useMemo(() => {
    if (diagramType === 'Tech Stack') {
      return nodes.slice(0, -1).map((node, i) => ({
        from: node.id,
        to: nodes[i + 1].id,
        label: stakeholderMode ? 'connects' : `${node.category} → ${nodes[i + 1].category}`,
        color: node.color,
      }));
    }
    if (!generatedVisuals || canvasVisual.edges.length === 0) {
      return [];
    }
    const seen = new Set<string>();
    return canvasVisual.edges
      .filter((edge) => {
        const k = `${edge.from}\0${edge.to}\0${edge.label ?? ''}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((edge) => ({
        from: `${diagramType}-${edge.from}`,
        to: `${diagramType}-${edge.to}`,
        label: edge.label || 'flow',
        color: '#8b5cf6',
      }));
  }, [diagramType, canvasVisual, generatedVisuals, nodes, stakeholderMode]);

  const canvasView = useMemo(() => {
    switch (viewMode) {
      case 'Blueprint':
        return { gridClass: 'opacity-[0.32]', dash: undefined as string | undefined, strokeOpacity: 0.72, flowAnimation: false };
      case 'Briefing':
        return { gridClass: 'opacity-[0.11]', dash: '0.35 0.55', strokeOpacity: 0.36, flowAnimation: false };
      default:
        return { gridClass: 'opacity-20', dash: '1 0.5', strokeOpacity: 0.5, flowAnimation: true };
    }
  }, [viewMode]);

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
      const url = await toPng(canvasRef.current, { pixelRatio: 2, backgroundColor: '#0a0b10' });
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
      <div className="relative min-h-screen bg-[#0a0b10] text-white overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[120px]" />
          <div className="absolute top-[30%] right-[20%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 min-h-screen flex flex-col">
          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-xl font-bold">Nebula</span>
            </div>
            <div className="text-sm text-slate-400">Tech Stack Visualizer</div>
          </header>

          {/* Hero */}
          <main className="flex-1 flex items-center">
            <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-300 mb-6">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  AI-Powered Architecture
                </div>
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight mb-6">
                  Visualize your
                  <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> tech stack</span>
                </h1>
                <p className="text-lg text-slate-400 mb-8 max-w-lg">
                  Create stunning architecture diagrams in seconds. Perfect for documentation, presentations, and team communication.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {DEFAULT_STACK.map(t => (
                    <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm">
                      <TechIcon name={t} className="w-4 h-4" />
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowStudio(true)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-semibold hover:opacity-90 transition"
                  >
                    Launch Studio
                  </button>
                  <button
                    onClick={() => { setStack(DEFAULT_STACK); setShowStudio(true); }}
                    className="px-6 py-3 rounded-xl border border-white/20 font-semibold hover:bg-white/5 transition"
                  >
                    Try Demo
                  </button>
                </div>
              </div>

              <div className="hidden lg:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur-xl" />
                  <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                    <div className="flex gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-400/60" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <div className="w-3 h-3 rounded-full bg-green-400/60" />
                    </div>
                    <div className="space-y-3">
                      {['Drag-and-drop canvas', 'AI stack suggestions', 'Multiple diagram types', 'Export to PNG'].map(f => (
                        <div key={f} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                          <span className="text-indigo-400">✓</span>
                          <span className="text-sm text-slate-300">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <footer className="text-center text-sm text-slate-500 pt-8 border-t border-white/5">
            Built for developers who present to humans
          </footer>
        </div>
      </div>
    );
  }

  // Studio
  return (
    <div className="min-h-screen bg-[#0a0b10] text-white">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[5%] w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-[100px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[350px] h-[350px] rounded-full bg-purple-600/15 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto p-4 lg:p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowStudio(false)} className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center hover:opacity-80 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </button>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Project</div>
              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="text-lg font-semibold bg-transparent border-none outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg bg-white/5 text-sm text-slate-300">{nodes.length} modules</span>
            <button
              onClick={exportPng}
              disabled={isExporting}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-sm font-medium disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export PNG'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* Main Canvas */}
          <div ref={canvasRef} className="col-span-12 lg:col-span-9 bg-black/30 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            {/* Diagram Tabs */}
            <div className="flex gap-1 p-2 border-b border-white/5 bg-black/20">
              {(['Tech Stack', 'Flowchart', 'DFD', 'Use Case', 'System Architecture'] as DiagramType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setDiagramType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    diagramType === type
                      ? 'bg-indigo-500/20 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Canvas */}
            <div
              ref={graphRef}
              className="relative h-[720px] touch-none select-none"
              onPointerMove={onPointerMove}
              onPointerUp={() => setDraggingId(null)}
            >
              {/* Grid */}
              <svg className={`absolute inset-0 w-full h-full pointer-events-none ${canvasView.gridClass}`}>
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <filter id="edge-label-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="0" stdDeviation="0.35" floodColor="#0a0b10" floodOpacity="0.95" />
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
                  const midX = (pos1.x + pos2.x) / 2;
                  const midY = (pos1.y + pos2.y) / 2;
                  const spiralR = 2.4 + (edgeIndex % 6) * 0.65;
                  const spiralA = ((edgeIndex * 53) % 360) * (Math.PI / 180);
                  const lx = midX + Math.cos(spiralA) * spiralR;
                  const ly = midY + Math.sin(spiralA) * spiralR;
                  const labelText = stakeholderMode ? 'connects' : edge.label;
                  const shortLabel =
                    labelText.length > 22 ? `${labelText.slice(0, 20)}…` : labelText;
                  return (
                    <g key={`edge-${edgeIndex}-${edge.from}-${edge.to}`}>
                      <path
                        d={`M ${pos1.x} ${pos1.y} Q ${(pos1.x + pos2.x) / 2} ${pos1.y + 8}, ${pos2.x} ${pos2.y}`}
                        fill="none"
                        stroke={edge.color}
                        strokeWidth="0.3"
                        strokeOpacity={canvasView.strokeOpacity}
                        strokeDasharray={canvasView.dash}
                        className={canvasView.flowAnimation ? 'animate-[flow_3s_linear_infinite]' : ''}
                      />
                      <text
                        x={lx}
                        y={ly}
                        fill="rgba(226,232,240,0.92)"
                        stroke="#0a0b10"
                        strokeWidth="0.5"
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
                    className={`absolute h-fit flex flex-col gap-1.5 rounded-xl border backdrop-blur-xl cursor-grab active:cursor-grabbing transition-shadow hover:shadow-2xl ${
                      actorNode ? 'w-36 items-center px-2 pt-2 pb-2.5 text-center' : 'w-40 gap-2 px-3 pt-3 pb-2'
                    } ${draggingId === node.id ? 'z-30' : 'z-10'}`}
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      borderColor: `${node.color}40`,
                      background: `linear-gradient(135deg, ${node.color}15, rgba(0,0,0,0.6))`,
                      boxShadow: `0 0 30px -10px ${node.color}`,
                      touchAction: 'none',
                    }}
                  >
                    {actorNode ? (
                      <>
                        <ActorStickFigure stroke={node.color} className="w-12 h-[3.25rem] shrink-0" />
                        <div className="text-sm font-semibold leading-tight w-full px-0.5" style={{ color: node.color }}>{node.title}</div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Use case actor</div>
                      </>
                    ) : (
                      <>
                        <div className="flex shrink-0 items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase leading-none" style={{ backgroundColor: `${node.color}20`, color: node.color }}>
                            {node.tag}
                          </span>
                          {node.isTech ? <TechIcon name={node.title} className="w-5 h-5 shrink-0" /> : null}
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-col gap-0.5">
                          <div className="text-sm font-semibold leading-tight" style={{ color: node.color }}>{node.title}</div>
                          <div className="text-[10px] leading-none text-slate-400">{node.subtitle}</div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {canvasNodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-slate-500 text-sm">
                  {diagramType === 'Tech Stack' && <span>Add technologies to get started</span>}
                  {diagramType !== 'Tech Stack' && !generatedVisuals && (
                    <span>Run Idea → architecture first — each tab then loads its own graph from the AI response.</span>
                  )}
                  {diagramType !== 'Tech Stack' && generatedVisuals && (
                    <>
                      <span>No interactive nodes for this diagram in the last response.</span>
                      <span className="text-xs text-slate-600">Mermaid source may still appear below under Generated diagrams.</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            {/* Add Tech */}
            <div className="bg-black/30 backdrop-blur-xl rounded-xl border border-white/10 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Add Technology</div>
              <div className="flex gap-2 mb-3">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTech(query)}
                  placeholder="Search..."
                  className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm outline-none focus:border-indigo-500/50"
                />
                <button onClick={() => addTech(query)} className="px-3 py-2 rounded-lg bg-indigo-600 text-sm font-medium">Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {suggestions.map(t => (
                  <button key={t} onClick={() => addTech(t)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-xs hover:bg-white/10 transition">
                    <TechIcon name={t} className="w-3 h-3" />{t}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Stack */}
            <div className="bg-black/30 backdrop-blur-xl rounded-xl border border-white/10 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Current Stack ({nodes.length})</div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {nodes.map(n => (
                  <button key={n.id} onClick={() => removeTech(n.name)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs hover:bg-red-500/20 transition" style={{ backgroundColor: `${n.color}15`, color: n.color }}>
                    <TechIcon name={n.name} className="w-3 h-3" />{n.name}<span className="text-white/40 ml-1">×</span>
                  </button>
                ))}
              </div>
            </div>

            {/* View Options */}
            <div className="bg-black/30 backdrop-blur-xl rounded-xl border border-white/10 p-4 space-y-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">View Options</div>
              
              <div>
                <div className="text-[10px] text-slate-500 mb-2">Canvas style</div>
                <div className="flex flex-col gap-1.5">
                  {VIEW_OPTIONS.map(({ id, title, hint }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setViewMode(id)}
                      className={`rounded-lg px-2.5 py-2 text-left transition ${
                        viewMode === id ? 'bg-indigo-600 ring-1 ring-indigo-400/40' : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-semibold">{title}</div>
                      <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-white/5">
                <span className="text-xs text-slate-400">Snap to Grid</span>
                <button onClick={() => setSnapToGrid(!snapToGrid)} className={`w-10 h-5 rounded-full transition ${snapToGrid ? 'bg-indigo-600' : 'bg-white/20'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${snapToGrid ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-white/5">
                <span className="text-xs text-slate-400">Audience</span>
                <button onClick={() => setStakeholderMode(!stakeholderMode)} className={`px-3 py-1 rounded text-[10px] font-semibold uppercase ${stakeholderMode ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-slate-400'}`}>
                  {stakeholderMode ? 'Stakeholder' : 'Technical'}
                </button>
              </div>
            </div>

            {/* AI Generator */}
            <div className="bg-black/30 backdrop-blur-xl rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold">Idea → architecture</div>
                  <div className="text-[10px] text-slate-500">Stack, auth, APIs, diagrams & narrative</div>
                  <div className="text-[10px] text-slate-600 mt-1">
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
                className="w-full h-24 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm outline-none resize-none focus:border-purple-500/50"
              />
              <button
                onClick={generateStack}
                disabled={isGenerating || !systemIdea.trim()}
                className="w-full mt-2 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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
              {aiError && <p className="mt-2 text-xs text-red-400">{aiError}</p>}
              {aiResult && <p className="mt-2 text-xs text-green-400">{aiResult}</p>}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="col-span-12 grid grid-cols-12 gap-4">
            {/* Stack Breakdown */}
            <div className="col-span-12 lg:col-span-4 bg-black/30 backdrop-blur-xl rounded-xl border border-white/10 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Stack Breakdown</div>
              <div className="grid grid-cols-3 gap-2">
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
            <div className="col-span-12 lg:col-span-8 bg-black/30 backdrop-blur-xl rounded-xl border border-white/10 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Architecture Narrative</div>

              {architectureNarrative ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-white leading-snug">{architectureNarrative.headline}</h3>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                      {stakeholderMode ? firstSentences(architectureNarrative.summary, 2) : architectureNarrative.summary}
                    </p>
                  </div>

                  {!stakeholderMode &&
                    CATEGORY_ORDER.some((c) => architectureNarrative.byLayer?.[c]) && (
                      <div className="space-y-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">By layer</div>
                        {CATEGORY_ORDER.map((cat) => {
                          const para = architectureNarrative.byLayer?.[cat];
                          if (!para?.trim()) return null;
                          return (
                            <div key={cat} className="rounded-lg border border-white/5 p-3" style={{ backgroundColor: `${LAYER_COLORS[cat]}08` }}>
                              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: LAYER_COLORS[cat] }}>{cat}</div>
                              <p className="text-xs text-slate-300 leading-relaxed">{para}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {architectureNarrative.diagramOverview && (
                    <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-indigo-300/90 mb-1.5">Diagrams in context</div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {stakeholderMode ? firstSentences(architectureNarrative.diagramOverview, 2) : architectureNarrative.diagramOverview}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
                    {grouped.map(g => (
                      <div key={g.category} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${LAYER_COLORS[g.category]}10` }}>
                        <span className="text-xs font-semibold" style={{ color: LAYER_COLORS[g.category] }}>{g.category}:</span>
                        <div className="flex flex-wrap gap-1">
                          {g.items.map(item => (
                            <span key={item.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                              <TechIcon name={item.name} className="w-3 h-3" />{item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-400 mb-4 leading-relaxed">
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
                            <span key={item.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                              <TechIcon name={item.name} className="w-3 h-3" />{item.name}
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

          {/* Generated Diagrams */}
          {generatedDiagrams && (
            <div className="col-span-12 bg-black/30 backdrop-blur-xl rounded-xl border border-white/10 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Generated Diagrams</div>
              <div className="flex gap-2 mb-3">
                {(['Flowchart', 'DFD', 'Use Case', 'System Architecture'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDiagramTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${diagramTab === tab ? 'bg-indigo-600' : 'bg-white/5 hover:bg-white/10'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <pre className="p-4 rounded-lg bg-black/40 text-xs text-slate-300 overflow-auto max-h-48 font-mono">
                {diagramTab === 'Flowchart' && generatedDiagrams.flowchart}
                {diagramTab === 'DFD' && generatedDiagrams.dfd}
                {diagramTab === 'Use Case' && generatedDiagrams.useCase}
                {diagramTab === 'System Architecture' && generatedDiagrams.systemArchitecture}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
