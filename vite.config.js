import { defineConfig } from 'vite'
import { cpSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'

function sitesStaticWorker() {
  return {
    name: 'sites-static-worker',
    apply: 'build',
    closeBundle() {
      const distDir = resolve(process.cwd(), 'dist')
      const serverDir = resolve(distDir, 'server')
      const clientDir = resolve(distDir, 'client')
      mkdirSync(serverDir, { recursive: true })
      buildSync({
        entryPoints: [resolve(process.cwd(), 'worker/sites-static.js')],
        outfile: resolve(serverDir, 'index.js'),
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        minify: true,
      })
      mkdirSync(clientDir, { recursive: true })
      for (const entry of readdirSync(distDir)) {
        if (entry === 'client' || entry === 'server') continue
        cpSync(resolve(distDir, entry), resolve(clientDir, entry), { recursive: true })
      }
    },
  }
}

// Load ESM-only plugin with dynamic import so it works in environments
// where config may be loaded via CommonJS/require.
export default async () => {
  const { default: react } = await import('@vitejs/plugin-react')
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
  const devApiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:3080'
  return defineConfig({
    plugins: [react(), sitesStaticWorker()],
    server: {
      // Keep the Vite preview on 5173 usable with the local API container on 3080.
      // This is development-only; production continues to serve /api from the host.
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: false,
        },
        '/photos': {
          target: devApiTarget,
          changeOrigin: false,
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
  })
}
