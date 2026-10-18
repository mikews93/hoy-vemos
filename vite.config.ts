import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// base './' para que el build funcione en cualquier ruta (hosting estático o vista previa).
// En Vercel (VERCEL=1) los datos van por el proxy /api, que guarda las claves de TMDB y OMDb en el servidor.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  return {
    base: './',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_PROXY': JSON.stringify(env.VITE_API_PROXY ?? (env.VERCEL ? '1' : '')),
      // En Vercel las claves nunca entran al JavaScript, aunque un .env local se cuele en el despliegue
      ...(env.VERCEL ? { 'import.meta.env.VITE_TMDB_TOKEN': '""', 'import.meta.env.VITE_OMDB_KEY': '""' } : {}),
    },
  }
})
