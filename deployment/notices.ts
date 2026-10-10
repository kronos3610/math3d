import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Keep redistributed library/font notices alongside the static deployment. */
export function thirdPartyNotices(moduleIds: readonly string[], projectRoot: string): string {
    const directories = new Set<string>();
    for (const moduleId of moduleIds) {
        const id = moduleId.replaceAll('\\', '/').replace(/^\0+/, '').split('?')[0];
        const marker = '/node_modules/'; const start = id.lastIndexOf(marker);
        if (start < 0) continue;
        const name = id.slice(start + marker.length).match(/^(?:@[^/]+\/)?[^/]+/)?.[0];
        if (name) directories.add(id.slice(0, start + marker.length) + name);
    }
    // CSS font assets need not appear in a JavaScript chunk's module list.
    for (const name of ['@fontsource-variable/inter', '@fontsource-variable/jetbrains-mono']) {
        directories.add(resolve(projectRoot, 'node_modules', name));
    }
    const notices: string[] = ['Third-party notices for the Math3D production build.\nThese notices apply to the respective libraries and fonts.'];
    for (const directory of [...directories].sort()) {
        const packageFile = join(directory, 'package.json');
        if (!existsSync(packageFile)) continue;
        const metadata: { name?: unknown; version?: unknown; license?: unknown } = JSON.parse(readFileSync(packageFile, 'utf8'));
        const files = readdirSync(directory).filter(name => /^(?:licen[cs]e|notice|ofl)(?:\.[\w.-]+)?$/i.test(name) && statSync(join(directory, name)).isFile());
        const texts = files.filter(name => !name.endsWith('.json')).map(name => `${name}\n${readFileSync(join(directory, name), 'utf8')}`);
        notices.push(`\n${'='.repeat(72)}\n${String(metadata.name)} ${String(metadata.version)}\nLicense: ${String(metadata.license ?? 'See notice below')}\n${texts.join('\n\n')}`);
    }
    return `${notices.join('\n\n')}\n`;
}
