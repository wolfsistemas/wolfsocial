import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Base path must match the GitHub Pages repository name (wolfsistemas/wolfsocial).
export default defineConfig({
  base: '/wolfsocial/',
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['.monkeycode-ai.live'],
  },
  build: {
    outDir: 'dist',
  },
})
