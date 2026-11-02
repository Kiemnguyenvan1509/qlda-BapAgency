import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { expressApp } from './backend/app';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'fullstack-mvc-express-middleware',
      configureServer(server) {
        // Gắn trực tiếp Express MVC Backend (/api/*) vào Vite Dev Server
        server.middlewares.use(expressApp);
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
    open: true,
  },
});
