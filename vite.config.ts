import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /storagesim/
export default defineConfig({
  base: '/storagesim/',
  plugins: [react()],
})
