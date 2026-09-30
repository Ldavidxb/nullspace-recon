import { useState, useEffect } from 'react';
import { initWasm, verify_parallel_beam } from './wasm';
import { ModalitySelector } from './pages/ModalitySelector';
import { VerificationDashboard } from './pages/VerificationDashboard';
import { ManifestViewer } from './pages/ManifestViewer';
import type { VerificationResult } from './wasm';

type Page = 'select' | 'dashboard' | 'manifest';

export default function App() {
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>('select');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [modality, setModality] = useState('');

  useEffect(() => {
    initWasm().then(() => {
      setReady(true);
      if (window.location.hash === '#autorun') {
        const res = verify_parallel_beam(32, 45, 0.02, 'tv', 0.1) as VerificationResult;
        setResult(res);
        setModality('Parallel-Beam CT');
        setPage('dashboard');
      }
    });
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Loading verification engine...</p>
          <p className="text-slate-500 text-sm mt-2">Compiling physics-bounded math to your browser</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {page === 'select' && (
        <ModalitySelector
          onSelect={(mod, res) => {
            setModality(mod);
            setResult(res);
            setPage('dashboard');
          }}
        />
      )}
      {page === 'dashboard' && result && (
        <VerificationDashboard
          result={result}
          modality={modality}
          onBack={() => setPage('select')}
          onViewManifest={() => setPage('manifest')}
        />
      )}
      {page === 'manifest' && result && (
        <ManifestViewer
          manifestJson={result.manifest_json}
          onBack={() => setPage('dashboard')}
        />
      )}
    </div>
  );
}
