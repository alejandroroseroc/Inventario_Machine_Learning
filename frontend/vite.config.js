import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',            // <- necesario para que exista document/window
    globals: true,                    // expect, describe, it...
    setupFiles: ['./src/test/setup.js'],
    css: true,                        // por si importas CSS en componentes
    coverage: { reporter: ['text', 'lcov'] } // opcional
  },
})
