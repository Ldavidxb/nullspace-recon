import { useCallback, useEffect, useState } from 'react';
import { initEngine, verify } from './lib/engine';
import type { EngineInfo } from './lib/engine';
import { referenceRun } from './lib/run';
import type { Run } from './lib/run';
import { Landing } from './pages/Landing';
import { ModalitySelector } from './pages/ModalitySelector';
import { VerificationDashboard } from './pages/VerificationDashboard';
import { ManifestViewer } from './pages/ManifestViewer';

type Page = 'landing' | 'select' | 'dashboard' | 'manifest';

const routes: Record<string, Page> = {
  '': 'landing',
  '#/': 'landing',
  '#/verify': 'select',
  '#/demo': 'select',
  '#/dashboard': 'dashboard',
  '#/manifest': 'manifest',
};
const hashFor: Record<Page, string> = { landing: '#/', select: '#/verify', dashboard: '#/dashboard', manifest: '#/manifest' };

const readPage = (): Page => routes[window.location.hash] ?? 'landing';

export default function App() {
  const [engine, setEngine] = useState<EngineInfo | null>(null);
  const [page, setPage] = useState<Page>(readPage);
  const [run, setRun] = useState<Run | null>(null);
  const [scenarioId, setScenarioId] = useState('baseline');
  // `#/demo` deep link (used in outreach emails) starts the full-resolution MRI run immediately.
  const [autoStart] = useState(() => window.location.hash === '#/demo');

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
        setRun(referenceRun('parallel-beam', res));
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

  const needsRun = (page === 'dashboard' || page === 'manifest') && !run;
  const scenario = run?.scenarios.find(s => s.id === scenarioId) ?? run?.scenarios[0];

  return (
    <div className="min-h-screen" key={page}>
      {page === 'landing' && <Landing onStart={() => go('select')} />}
      {(page === 'select' || needsRun) && (
        <ModalitySelector
          engine={engine}
          autoStart={autoStart && !run}
          onEngineChange={setEngine}
          onBack={() => go('landing')}
          onComplete={newRun => {
            setRun(newRun);
            setScenarioId('baseline');
            go('dashboard');
          }}
        />
      )}
      {page === 'dashboard' && run && scenario && (
        <VerificationDashboard
          run={run}
          scenario={scenario}
          onScenario={setScenarioId}
          onBack={() => go('select')}
          onViewManifest={() => go('manifest')}
        />
      )}
      {page === 'manifest' && scenario && (
        <ManifestViewer manifestJson={scenario.result.manifest_json} onBack={() => go('dashboard')} />
      )}
    </div>
  );
}
