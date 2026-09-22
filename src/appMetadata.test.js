import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('app metadata', () => {
  it('uses CosmosVisualizer in browser and install metadata', () => {
    const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/manifest.json'), 'utf8'));

    expect(packageJson.name).toBe('cosmos-visualizer');
    expect(packageJson.description).toBe('Explore Azure Cosmos DB Gremlin graphs locally');
    expect(indexHtml).toContain('<title>CosmosVisualizer</title>');
    expect(indexHtml).toContain('/cosmos-visualizer.png');
    expect(manifest.short_name).toBe('CosmosVisualizer');
    expect(manifest.name).toBe('CosmosVisualizer');
    expect(manifest.icons[0].src).toBe('cosmos-visualizer.png');
  });
});
