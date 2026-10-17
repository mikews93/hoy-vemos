import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' para que el build funcione en cualquier ruta (hosting estático o vista previa)
export default defineConfig({
  base: './',
  plugins: [react()],
})
