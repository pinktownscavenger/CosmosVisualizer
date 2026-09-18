import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('app metadata', () => {
  it('uses Cosmos Graph Visualizer in browser and install metadata', () => {
    const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/manifest.json'), 'utf8'));

    expect(indexHtml).toContain('<title>Cosmos Graph Visualizer</title>');
    expect(manifest.short_name).toBe('Cosmos Graph');
    expect(manifest.name).toBe('Cosmos Graph Visualizer');
  });
});
