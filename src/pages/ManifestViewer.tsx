import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge, NavButton, PageFooter, ShieldIcon } from '../components/ui';

interface Props {
  manifestJson: string;
  onBack: () => void;
}

export function ManifestViewer({ manifestJson, onBack }: Props) {
  const [copied, setCopied] = useState(false);

  const { parsed, formatted } = useMemo(() => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(manifestJson);
    } catch {
      parsed = { raw: manifestJson };
    }
    return { parsed, formatted: JSON.stringify(parsed, null, 2) };
  }, [manifestJson]);
  const lines = formatted.split('\n');

  const download = () => {
    const blob = new Blob([formatted + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verification-manifest.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
    } catch {
      // Clipboard API is unavailable outside secure contexts; fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = formatted;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const signature = parsed.signature as { algorithm?: string } | undefined;
  const digest = parsed.manifest_sha256 as string | undefined;

  return (
    <div className="mesh-grid min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <nav className="flex items-center justify-between gap-3 animate-fade-in">
          <NavButton onClick={onBack}>
            <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            <span className="hidden sm:inline">Back to dashboard</span>
            <span className="sm:hidden">Back</span>
          </NavButton>
          <div className="flex items-center gap-2">
            <NavButton onClick={copy} variant="outline" ariaLabel="Copy manifest JSON">
              {copied ? <span className="text-emerald-300">Copied ✓</span> : 'Copy'}
            </NavButton>
            <NavButton onClick={download} variant="accent">
              Download JSON <span aria-hidden>↓</span>
            </NavButton>
          </div>
        </nav>

        <header className="mt-8 mb-6 animate-fade-in-d1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-[-0.025em]">Verification Manifest</h1>
            <Badge>SHA-256</Badge>
          </div>
          <p className="mt-3 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Cryptographic binding of measurements, operator, reconstruction, and verification results.
            Ready for ML-DSA-65 post-quantum signing.
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-d2">
          <Field label="Version" value={parsed.version as string} />
          <Field label="Operator" value={parsed.operator as string} />
          <Field label="Noise Model" value={parsed.noise_model as string} />
        </section>

        {digest && (
          <section className="mt-3 glass rounded-2xl px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 animate-fade-in-d2">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-[0.14em] shrink-0">
              <ShieldIcon className="w-4 h-4" /> Manifest digest
            </div>
            <code className="text-[12px] font-mono text-slate-200 break-all">{digest}</code>
            <span className="sm:ml-auto shrink-0 text-[11px] font-mono text-slate-400 border border-slate-700/50 rounded-md px-2 py-0.5">
              {signature?.algorithm ?? 'ML-DSA-65'} · awaiting key
            </span>
          </section>
        )}

        <section className="mt-4 glass rounded-2xl overflow-hidden animate-fade-in-d3">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-700/40 flex items-center gap-3 bg-slate-950/30">
            <span className="flex gap-1.5" aria-hidden>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            </span>
            <span className="text-xs text-slate-300 font-mono">verification-manifest.json</span>
            <span className="text-xs text-slate-500 ml-auto font-mono">{lines.length} lines · {new Blob([formatted]).size} B</span>
          </div>
          <pre className="code-scroll py-4 text-[12.5px] sm:text-[13px] font-mono overflow-auto leading-[1.7] max-h-[62vh] text-slate-300">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-slate-800/30 pr-5">
                <span className="w-12 shrink-0 text-right pr-4 text-slate-600 select-none tabular-nums">{i + 1}</span>
                <span className="whitespace-pre">{highlightJson(line)}</span>
              </div>
            ))}
          </pre>
        </section>

        <PageFooter left="nullspace-recon v0.2.0 · Rust + WebAssembly · Client-side only" right="Your data never leaves this machine" />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3.5 min-w-0">
      <div className="text-[11px] text-slate-400 uppercase tracking-[0.14em] font-medium">{label}</div>
      <div className="mt-1.5 text-sm text-cyan-300 font-mono truncate" title={value}>{value ?? 'N/A'}</div>
    </div>
  );
}

// Tokenises one line of pretty-printed JSON: keys cyan, strings green, numbers amber, literals violet.
const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

function highlightJson(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(<span key={last} className="text-slate-500">{line.slice(last, idx)}</span>);
    if (m[1] && m[2]) {
      out.push(<span key={idx} className="text-cyan-300">{m[1]}</span>, <span key={idx + 'c'} className="text-slate-500">{m[2]}</span>);
    } else if (m[1]) {
      out.push(<span key={idx} className="text-emerald-300">{m[1]}</span>);
    } else if (m[3]) {
      out.push(<span key={idx} className="text-amber-300">{m[3]}</span>);
    } else {
      out.push(<span key={idx} className="text-violet-300">{m[4]}</span>);
    }
    last = idx + m[0].length;
  }
  if (last < line.length) out.push(<span key={last} className="text-slate-500">{line.slice(last)}</span>);
  return out;
}
