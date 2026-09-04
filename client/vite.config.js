import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'


// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    // Der einzige verbleibende Chunk über der Default-Grenze (500kB) ist die ~3,3MB große
    // Übungsdatenbank (default-exercises.json, via defaultExercisesLoader.js) - die ist
    // bewusst per dynamic import() aus dem Haupt-Bundle ausgelagert (siehe main.js,
    // warmupExercisesArea) und wird erst geladen, wenn der Übungen-Bereich tatsächlich
    // gebraucht wird bzw. kurz nach App-Start im Hintergrund vorgeladen (requestIdleCallback).
    // Sie blockiert damit nicht mehr den initialen App-Start - die Standard-Warnung würde hier
    // trotzdem weiter anschlagen, weil sie pro Chunk und nicht "nur im kritischen Pfad" prüft.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue-router')) return 'router';
            if (id.includes('pinia')) return 'pinia';
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('chart.js')) return 'charts';
            if (id.includes('dayjs')) return 'date';
            if (id.includes('lodash')) return 'lodash';
            // default vendor chunk
            return 'vendor';
          }
          return undefined;
        }
      }
    },
    terserOptions: {
      compress: {
        // drop_console: true,
        // drop_debugger: true
      }
    }
  }
})
