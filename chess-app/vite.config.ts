import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  define: {
    'process.env.VITE_GQL_URL': JSON.stringify(process.env.VITE_GQL_URL),
    'process.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL),
  },
  plugins: [
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    nitro()
  ],
})

export default config
