import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { attachGenerationRoutes } from './server/openaiAdapter.ts'

function generationApiPlugin(): Plugin {
  return {
    name: 'playbook-generation-api',
    configureServer(server) {
      attachGenerationRoutes(server)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), generationApiPlugin()],
  }
})
