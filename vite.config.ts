import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'fs'

function copyPdfjsWorker(): Plugin {
  return {
    name: 'copy-pdfjs-worker',
    buildStart() {
      try {
        const src = resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
        const dest = resolve('public/pdf.worker.min.mjs')
        if (existsSync(dest) && existsSync(src) && statSync(dest).size === statSync(src).size) {
          return
        }
        mkdirSync('public', { recursive: true })
        copyFileSync(src, dest)
        console.log('pdf.worker.min.mjs copiado para public/')
      } catch (e) {
        console.warn('Nao foi possivel copiar pdf.worker:', e)
      }
    }
  }
}

function syncServiceWorker(): Plugin {
  const swSourcePath = resolve('src/sw.js')
  const swPublicPath = resolve('public/sw.js')

  return {
    name: 'sync-service-worker',
    buildStart() {
      try {
        const source = readFileSync(swSourcePath, 'utf8')
        if (existsSync(swPublicPath) && readFileSync(swPublicPath, 'utf8') === source) {
          return
        }
        mkdirSync('public', { recursive: true })
        copyFileSync(swSourcePath, swPublicPath)
      } catch (e) {
        console.warn('Nao foi possivel sincronizar src/sw.js para public/sw.js:', e)
      }
    },
    configureServer(server) {
      server.middlewares.use('/sw.js', (_req, res, next) => {
        try {
          const source = readFileSync(swSourcePath, 'utf8')
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Service-Worker-Allowed', '/')
          res.end(source)
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), copyPdfjsWorker(), syncServiceWorker()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    entries: ['index.html'],
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'lucide-react',
      '@supabase/supabase-js',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    // Permite servir atrás do proxy de preview (dev apenas; não afeta o build).
    allowedHosts: true,
    watch: {
      ignored: [
        '**/tests/**',
        '**/docs/**',
        '**/public/assets/**',
        '**/public/sw.js',
        '**/public/pdf.worker.min.mjs',
        '**/dist/**',
        '**/.playwright-cli/**',
      ],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
  }
})
