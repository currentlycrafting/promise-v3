import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  // Serve from project root so HTML files at root level work
  root: path.resolve(__dirname, '..'),

  // Static assets (model files) served from frontend/public
  publicDir: path.resolve(__dirname, 'public'),

  // Serve WASM files as static assets
  assetsInclude: ['**/*.wasm'],

  server: {
    port: 5173,
    headers: {
      // Required for RunAnywhere SharedArrayBuffer (multi-threaded WASM)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      // Cache heavy model + WASM assets
      '*.wasm': { 'Content-Type': 'application/wasm', 'Cache-Control': 'public, max-age=31536000' },
      '*.gguf': { 'Cache-Control': 'public, max-age=31536000' },
    },
    proxy: {
      // Forward all /api calls to FastAPI
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  resolve: {
    alias: {
      // Allow bare imports to resolve from frontend/node_modules
      '@runanywhere/web': path.resolve(__dirname, 'node_modules/@runanywhere/web'),
      '@runanywhere/web-llamacpp': path.resolve(__dirname, 'node_modules/@runanywhere/web-llamacpp'),
    },
  },
})
