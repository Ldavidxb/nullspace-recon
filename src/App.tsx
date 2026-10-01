import { useCallback, useEffect, useState } from 'react';
import { MODALITIES, initEngine, verify } from './lib/engine';
import type { EngineInfo, ModalityId, VerificationResult } from './lib/engine';
import { Landing } from './pages/Landing';
import { ModalitySelector } from './pages/ModalitySelector';
import { VerificationDashboard } from './pages/VerificationDashboard';
import { ManifestViewer } from './pages/ManifestViewer';

type Page = 'landing' | 'select' | 'dashboard' | 'manifest';

const routes: Record<string, Page> = {
  '': 'landing',
  '#/': 'landing',
  '#/verify': 'select',
  '#/dashboard': 'dashboard',
  '#/manifest': 'manifest',
};
const hashFor: Record<Page, string> = { landing: '#/', select: '#/verify', dashboard: '#/dashboard', manifest: '#/manifest' };

const readPage = (): Page => routes[window.location.hash] ?? 'landing';

export default function App() {
  const [engine, setEngine] = useState<EngineInfo | null>(null);
  const [page, setPage] = useState<Page>(readPage);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [modalityId, setModalityId] = useState<ModalityId>('parallel-beam');

  const go = useCallback((p: Page) => {
    if (window.location.hash !== hashFor[p]) window.location.hash = hashFor[p];
    setPage(p);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onHash = () => {
      setPage(readPage());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    initEngine().then(async info => {
      setEngine(info);
      // Deep links to results (e.g. a refreshed dashboard, or #autorun) recompute the default run.
      if (window.location.hash === '#autorun' || ['dashboard', 'manifest'].includes(readPage())) {
        const res = await verify('parallel-beam', 'tv', 0.1);
        setResult(res);
        if (window.location.hash === '#autorun') go('dashboard');
      }
    });
  }, [go]);

  if (!engine) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          </div>
          <p className="text-slate-200 text-base font-medium">Loading verification engine…</p>
          <p className="text-slate-500 text-sm mt-1.5">Compiling physics-bounded math to your browser</p>
        </div>
      </div>
    );
  }

  const modality = MODALITIES.find(m => m.id === modalityId)!;
  const needsResult = (page === 'dashboard' || page === 'manifest') && !result;

  return (
    <div className="min-h-screen" key={page}>
      {page === 'landing' && <Landing onStart={() => go('select')} />}
      {(page === 'select' || needsResult) && (
        <ModalitySelector
          engine={engine}
          onEngineChange={setEngine}
          onBack={() => go('landing')}
          onComplete={(id, res) => {
            setModalityId(id);
            setResult(res);
            go('dashboard');
          }}
        />
      )}
      {page === 'dashboard' && result && (
        <VerificationDashboard
          result={result}
          modality={modality}
          onBack={() => go('select')}
          onViewManifest={() => go('manifest')}
        />
      )}
      {page === 'manifest' && result && (
        <ManifestViewer manifestJson={result.manifest_json} onBack={() => go('dashboard')} />
      )}
    </div>
  );
}
