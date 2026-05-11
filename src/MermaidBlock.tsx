import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';

function normalizeMermaidSource(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/i, '');
  return s.trim();
}

type MermaidBlockProps = {
  chart: string;
  theme: 'light' | 'dark';
  className?: string;
};

export function MermaidBlock({ chart, theme, className = '' }: MermaidBlockProps) {
  const cleaned = useMemo(() => normalizeMermaidSource(chart), [chart]);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!cleaned) {
      setSvg('');
      setError('');
      return;
    }

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDark ? 'dark' : 'default',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    });

    let cancelled = false;
    const sid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? `mmd-${crypto.randomUUID()}`
        : `mmd-${Math.random().toString(36).slice(2, 12)}-${Date.now()}`;

    mermaid
      .render(sid, cleaned)
      .then(({ svg: out }) => {
        if (!cancelled) {
          setError('');
          setSvg(out);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSvg('');
          setError(e instanceof Error ? e.message : String(e));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cleaned, isDark]);

  if (!cleaned) return null;

  if (error) {
    return (
      <div
        className={`rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 ${className}`}
      >
        <div className="font-semibold">Diagram parse error</div>
        <p className="mt-1 opacity-90">{error}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={`flex min-h-[100px] items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50/80 text-xs text-slate-500 dark:border-white/10 dark:bg-black/20 ${className}`}
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className={`playbook-mermaid overflow-x-auto rounded-lg border border-slate-200/80 bg-white/95 p-2 sm:p-3 dark:border-white/10 dark:bg-[#0f1219]/95 ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
