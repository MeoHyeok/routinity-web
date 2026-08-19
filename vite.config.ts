import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base matches the GitHub Pages project-site path (https://<user>.github.io/routinity-web/)
export default defineConfig({
  base: '/routinity-web/',
  plugins: [react(), tailwindcss()],
})
