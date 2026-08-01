import { defineConfig } from 'vite'
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

function sitesStaticWorker() {
  return {
    name: 'sites-static-worker',
    apply: 'build',
    closeBundle() {
      const distDir = resolve(process.cwd(), 'dist')
      const serverDir = resolve(distDir, 'server')
      const clientDir = resolve(distDir, 'client')
      mkdirSync(serverDir, { recursive: true })
      copyFileSync(
        resolve(process.cwd(), 'worker/sites-static.js'),
        resolve(serverDir, 'index.js'),
      )
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
  return defineConfig({
    plugins: [react(), sitesStaticWorker()],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
  })
}
