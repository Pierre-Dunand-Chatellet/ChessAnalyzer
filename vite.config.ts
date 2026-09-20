import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relative : l'app fonctionne dans n'importe quel sous-dossier du serveur (déploiement FTP).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
