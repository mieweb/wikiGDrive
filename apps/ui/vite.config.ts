import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

if (!process.env.GIT_SHA) {
  process.env.GIT_SHA = process.env.SOURCE_VERSION;
}
if (!process.env.BUILD_TIME) {
  process.env.BUILD_TIME = new Date().toISOString();
}
if (!process.env.VERSION) {
  process.env.VERSION = 'dev';
}

export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
    }
  },
  build: {
    sourcemap: true,
    manifest: true,
  },
  define: {
    'import.meta.env.GIT_SHA': JSON.stringify(process.env.GIT_SHA),
    'import.meta.env.BUILD_TIME': JSON.stringify(process.env.BUILD_TIME),
    'import.meta.env.VERSION': JSON.stringify(process.env.VERSION)
  }
});