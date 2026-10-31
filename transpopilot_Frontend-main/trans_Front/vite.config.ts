import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 5173,
    // Proxy ko local testing ke liye rehne de sakte hain
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        // target: 'https://transpopilot-backend.vercel.app', // dY`^ Live URL yahan bhi dal sakte hain
        changeOrigin: true,
        secure: false,
      },
    },
  },

  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2015',
    chunkSizeWarningLimit: 1000,
  },
  
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});