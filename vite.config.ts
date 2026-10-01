import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

// `vite build --mode demo` produces dist-demo/index.html: a single self-contained file
// (worker inlined, no HDF5 reader) for sharing the demo as one link or attachment.
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
    plugins: [react(), tailwindcss(), ...(demo ? [viteSingleFile()] : [])],
    define: demo ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1') } : {},
    resolve: demo
      ? { alias: [{ find: /^(.*)\/mri\/client\.ts$/, replacement: fileURLToPath(new URL('./src/lib/mri/client.inline.ts', import.meta.url)) }] }
      : {},
    worker: { format: 'es' as const, rollupOptions: demo ? { output: { inlineDynamicImports: true } } : {} },
    build: demo ? { outDir: 'dist-demo' } : {},
    server: {
      port: 3100,
      fs: {
        allow: ['..'],
      },
    },
    optimizeDeps: {
      exclude: ['nullspace-recon-wasm', 'h5wasm'],
    },
  }
})
