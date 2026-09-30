import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3100,
    fs: {
      allow: ['..'],
    },
  },
  optimizeDeps: {
    exclude: ['nullspace-recon-wasm'],
  },
})
