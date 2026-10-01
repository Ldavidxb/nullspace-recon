import type { MriAnalysis } from './sense.ts';
import type { MriRequest } from './worker.ts';

export function runMriAnalysis(req: MriRequest, onProgress: (stage: string, fraction: number) => void): Promise<MriAnalysis> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'progress') onProgress(msg.stage, msg.fraction);
      else {
        worker.terminate();
        if (msg.type === 'result') resolve(msg.analysis as MriAnalysis);
        else reject(new Error(msg.message));
      }
    };
    worker.onerror = e => { worker.terminate(); reject(new Error(e.message || 'Analysis worker failed')); };
    worker.postMessage(req);
  });
}
