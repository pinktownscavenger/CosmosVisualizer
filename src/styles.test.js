import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const stylesheet = fs.readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

const declarationsFor = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
};

describe('layout stylesheet contracts', () => {
  it('keeps the vis network canvas from increasing document height as it resizes', () => {
    expect(declarationsFor('.graph-workspace')).toContain('overflow: hidden');
    expect(declarationsFor('.mynetwork')).toContain('position: absolute');
    expect(declarationsFor('.mynetwork')).toContain('inset: 0');
    expect(declarationsFor('.mynetwork')).toContain('min-height: 0');
  });
});
