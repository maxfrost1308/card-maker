import { defineConfig } from 'vite';

export default defineConfig({
  // No special config needed for a plain static site.
  // index.html at root is the entry point for both `vite` (dev) and `vite build` (dist/).
  //
  // Dev server: npm start        → http://localhost:5173 with HMR
  // Production: npm run build    → dist/ (minified, optimised)
  // Preview:    npm run preview  → serves dist/ locally

  build: {
    outDir: 'dist',
    // PapaParse is vendored via <script> tag — exclude from module graph
    rollupOptions: {
      external: [], // nothing to externalize; PapaParse loads as a global
    },
  },

  server: {
    // Allow serving card-type files from card-types/ directory
    fs: { allow: ['.'] },
  },
});
