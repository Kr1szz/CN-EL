
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensure relative paths for assets for GitHub Pages
  server: {
    // Proxy no longer needed as we are using local simulation
  }
})
