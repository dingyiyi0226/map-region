import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

const httpsConfig = fs.existsSync('./localhost-key.pem') && fs.existsSync('./localhost.pem')
  ? { key: fs.readFileSync('./localhost-key.pem'), cert: fs.readFileSync('./localhost.pem') }
  : undefined

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/map-region/',
  server: {
    https: httpsConfig,
  },
})
