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

  it('prevents the right inspector from exposing horizontal overflow', () => {
    expect(declarationsFor('.details')).toContain('overflow-x: hidden');
  });

  it('themes scrollbars for the dark workbench surfaces', () => {
    expect(stylesheet).toContain('scrollbar-color:');
    expect(stylesheet).toContain('::-webkit-scrollbar-thumb');
  });

  it('keeps compact action targets large enough for touch and pointer use', () => {
    expect(declarationsFor('.query-status__demo.MuiButton-root')).toContain('min-height: 36px');
    expect(declarationsFor('.graph-hint .MuiIconButton-root')).toContain('width: 36px');
    expect(declarationsFor('.graph-hint .MuiIconButton-root')).toContain('height: 36px');
  });

  it('defines a mobile selected-result sheet treatment', () => {
    expect(stylesheet).toContain('.selected-panel--mobile-sheet');
    expect(stylesheet).toContain('position: fixed');
    expect(stylesheet).toContain('max-height: 58vh');
  });
});
