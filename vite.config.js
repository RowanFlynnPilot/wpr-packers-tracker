import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages project path so iframe embeds resolve assets.
// Repo name: wpr-packers-tracker -> https://rowanflynnpilot.github.io/wpr-packers-tracker/
export default defineConfig({
  plugins: [react()],
  base: '/wpr-packers-tracker/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // Compact widgets for sidebars/articles — each its own page so embeds stay lightweight.
        mini: resolve(__dirname, 'mini.html'),
        miniStandings: resolve(__dirname, 'mini-standings.html'),
        miniDigest: resolve(__dirname, 'mini-digest.html'),
        // The hosted media kit — config-driven inventory + live previews for WPR sales.
        sponsors: resolve(__dirname, 'sponsors.html'),
      },
    },
  },
})
