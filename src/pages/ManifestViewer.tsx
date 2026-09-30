interface Props {
  manifestJson: string;
  onBack: () => void;
}

export function ManifestViewer({ manifestJson, onBack }: Props) {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(manifestJson);
  } catch {
    parsed = { raw: manifestJson };
  }
  const formatted = JSON.stringify(parsed, null, 2);

  const download = () => {
    const blob = new Blob([formatted], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verification-manifest.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = () => {
    navigator.clipboard.writeText(formatted);
  };

  return (
    <div className="mesh-grid min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-6">

        <nav className="flex items-center justify-between mb-8 animate-fade-in">
          <button onClick={onBack} className="text-slate-500 hover:text-white transition-colors flex items-center gap-2 text-sm group">
            <span className="text-lg group-hover:-translate-x-0.5 transition-transform">&#8592;</span>
            Back to dashboard
          </button>
          <div className="flex items-center gap-2">
            <button onClick={copy}
              className="text-slate-400 hover:text-white transition-all text-sm border border-slate-700/50 bg-slate-900/50 rounded-lg px-4 py-2 hover:bg-slate-800/60 hover:border-slate-600/50">
              Copy
            </button>
            <button onClick={download}
              className="text-cyan-400 hover:text-cyan-300 transition-all text-sm border border-cyan-500/20 bg-cyan-500/5 rounded-lg px-4 py-2 hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5">
              Download JSON &#8595;
            </button>
          </div>
        </nav>

        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">Verification Manifest</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              SHA-256
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Cryptographic binding of measurements, operator, reconstruction, and verification results.
            Ready for ML-DSA-65 post-quantum signing.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-in-d1">
          <ManifestField label="Version" value={parsed.version as string} />
          <ManifestField label="Operator" value={(parsed.operator as string)?.slice(0, 50)} />
          <ManifestField label="Noise Model" value={parsed.noise_model as string} />
        </div>

        <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-xl overflow-hidden animate-fade-in-d2">
          <div className="px-5 py-3 border-b border-slate-800/60 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-400 font-mono tracking-wide">verification-manifest.json</span>
            <span className="text-xs text-slate-600 ml-auto font-mono">{formatted.split('\n').length} lines</span>
          </div>
          <pre className="p-5 text-sm text-slate-300 font-mono overflow-x-auto leading-relaxed max-h-[65vh] overflow-y-auto">
            {formatted.split('\n').map((line, i) => (
              <div key={i} className="flex hover:bg-slate-800/30 -mx-5 px-5 rounded">
                <span className="w-10 text-right text-slate-700 select-none mr-5 shrink-0 tabular-nums">{i + 1}</span>
                <span>{highlightJson(line)}</span>
              </div>
            ))}
          </pre>
        </div>

        <footer className="mt-10 pt-6 border-t border-slate-800/40 animate-fade-in-d3">
          <p className="text-xs text-slate-600">
            nullspace-recon v0.2.0 &middot; Rust + WebAssembly &middot; Client-side only
          </p>
        </footer>
      </div>
    </div>
  );
}

function ManifestField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-xl px-4 py-3.5">
      <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">{label}</div>
      <div className="text-sm text-cyan-400 font-mono truncate">{value ?? 'N/A'}</div>
    </div>
  );
}

function highlightJson(line: string): React.ReactNode {
  return line.replace(/"([^"]+)":/g, '<KEY>$1</KEY>:').split(/(<KEY>.*?<\/KEY>)/).map((part, i) => {
    const match = part.match(/<KEY>(.*?)<\/KEY>/);
    if (match) return <span key={i} className="text-cyan-400">&quot;{match[1]}&quot;</span>;
    if (part.match(/"[^"]*"/)) return <span key={i} className="text-emerald-400">{part}</span>;
    if (part.match(/\b\d+\.?\d*\b/)) return <span key={i} className="text-amber-300">{part}</span>;
    return <span key={i}>{part}</span>;
  });
}
