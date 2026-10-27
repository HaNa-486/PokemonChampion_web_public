import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [react(), {
    name: 'demo-license-and-dev-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        // React's development preamble is inline; production keeps strict scripts.
        return context.server ? html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';") : html;
      },
    },
    generateBundle() {
      const source = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses/Apache-2.0.txt']
        .map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n\n');
      this.emitFile({ type: 'asset', fileName: 'project-notices.txt', source });
    },
  }],
  base: './',
  build: { sourcemap: false, license: { fileName: 'dependency-licenses.md' } },
});
