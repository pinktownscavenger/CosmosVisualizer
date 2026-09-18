import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('app metadata', () => {
  it('uses Cosmos Graph Visualizer in browser and install metadata', () => {
    const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/manifest.json'), 'utf8'));

    expect(packageJson.name).toBe('cosmos-graph-visualizer');
    expect(packageJson.description).toBe('Visualize Cosmos graph networks from Gremlin queries');
    expect(indexHtml).toContain('<title>Cosmos Graph Visualizer</title>');
    expect(indexHtml).toContain('/cosmos-graph-visualizer.png');
    expect(manifest.short_name).toBe('Cosmos Graph');
    expect(manifest.name).toBe('Cosmos Graph Visualizer');
    expect(manifest.icons[0].src).toBe('cosmos-graph-visualizer.png');
  });
});
