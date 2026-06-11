import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// vite-plugin-singlefile sets the rollup options it needs internally
// (inlineDynamicImports, etc.); we only need to point `base` at relative paths
// so the bundle works when opened via file:// after build.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
  },
});
