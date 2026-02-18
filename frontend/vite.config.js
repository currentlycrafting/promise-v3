import { defineConfig } from 'vite'

export default defineConfig({
  // Serve WASM files as static assets
  assetsInclude: ['**/*.wasm'],

  server: {
    port: 5173,
    headers: {
      // Required for RunAnywhere SharedArrayBuffer (multi-threaded WASM)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      // Forward all /api calls to FastAPI
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
