import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Servido em overclock.sh/game — base relativa pra funcionar em subpath e standalone.
export default defineConfig({
  plugins: [react()],
  base: './',
})
