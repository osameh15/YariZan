import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  resolve: { alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  plugins: [vue({ template: { transformAssetUrls: false } })],
  test: { environment: 'happy-dom', include: ['tests/unit/**/*.test.ts'] },
});
