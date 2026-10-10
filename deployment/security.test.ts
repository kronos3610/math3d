import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { productionCsp, developmentCsp, securityHeaders } from './security';

interface HostingConfig {
    headers: { source: string; headers: { key: string; value: string }[] }[];
    rewrites: { source: string; destination: string }[];
}
test('provider headers stay aligned with the built application policy', () => {
    const config: HostingConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    expect(Object.fromEntries(config.headers[0].headers.map(header => [header.key, header.value]))).toEqual(securityHeaders);
    expect(productionCsp).not.toMatch(/https:|unsafe-eval|unsafe-inline.*script-src/);
    expect(productionCsp.split('; ').find(rule => rule.startsWith('script-src'))).toBe("script-src 'self'");
    expect(developmentCsp).toContain("connect-src 'self' ws: wss:");
    expect(productionCsp).not.toContain('ws:');
});
test('SPA rewrites preserve missing asset errors and cover deep lesson addresses', () => {
    const config: HostingConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const source = new RegExp(`^${config.rewrites[0].source}$`);
    expect(source.test('/ml/decision-trees')).toBe(true);
    expect(source.test('/unknown/deep/address')).toBe(true);
    expect(source.test('/assets/deleted-chunk.js')).toBe(false);
    expect(source.test('/favicon.svg')).toBe(false);
    expect(config.rewrites[0].destination).toBe('/index.html');
    const htmlCache = new RegExp(`^${config.headers[1].source}$`);
    expect(htmlCache.test('/ml/decision-trees')).toBe(true);
    expect(htmlCache.test('/assets/hashed.js')).toBe(false);
});
