import { defineConfig } from 'vite'

// Load ESM-only plugin with dynamic import so it works in environments
// where config may be loaded via CommonJS/require.
export default async () => {
  const { default: react } = await import('@vitejs/plugin-react')
  return defineConfig({
    plugins: [react()],
  })
}
