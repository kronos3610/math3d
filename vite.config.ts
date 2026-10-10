import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { developmentCsp, productionCsp, securityHeaders } from './deployment/security'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), {
    name: 'deployment-policy',
    transformIndexHtml(html) {
      return html.replace('__MATH3D_CSP__', command === 'build' ? productionCsp : developmentCsp);
    },
    generateBundle() {
      const headers = ['/*', ...Object.entries(securityHeaders).map(([name,value]) => `  ${name}: ${value}`),
        ...['/', '/index.html', '/404.html', ...['linear-algebra','calculus','probability','ml'].flatMap(topic => [`/${topic}`, `/${topic}/*`])]
          .flatMap(path => [path, '  Cache-Control: public, max-age=0, must-revalidate']),
        '/assets/*', '  Cache-Control: public, max-age=31536000, immutable'].join('\n');
      this.emitFile({ type: 'asset', fileName: '_headers', source: `${headers}\n` });
    },
  }],
  preview: { headers: securityHeaders },
  // Small KaTeX fonts must remain same-origin files under font-src 'self'.
  build: { assetsInlineLimit: 0 },
}))
