import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Servido em overclock.sh/game — base absoluta no build (assets funcionam com ou sem
// barra final na URL); '/' no dev local.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/game/' : '/',
  server: {
    // dev: WS do multiplayer roda no server local (npm run server)
    proxy: { '/ws': { target: 'ws://localhost:8790', ws: true } },
  },
}))
