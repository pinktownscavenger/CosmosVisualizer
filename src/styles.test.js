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
    expect(declarationsFor('.graph-frame')).toContain('height: clamp(560px, calc(100vh - 250px), 900px)');
    expect(declarationsFor('.graph-workspace')).toContain('overflow: hidden');
    expect(declarationsFor('.mynetwork')).toContain('position: absolute');
    expect(declarationsFor('.mynetwork')).toContain('inset: 0');
    expect(declarationsFor('.mynetwork')).toContain('min-height: 0');
  });

  it('keeps the right inspector scrolling independently from the graph', () => {
    expect(declarationsFor('.workspace-panel')).toContain('height: clamp(560px, calc(100vh - 250px), 900px)');
    expect(declarationsFor('.workspace-panel')).toContain('overflow: hidden');
    expect(declarationsFor('.details')).toContain('overflow-x: hidden');
    expect(declarationsFor('.details')).toContain('overflow-y: auto');
  });

  it('renders details panel expansion icons on the dark surface', () => {
    expect(declarationsFor('.details__section .MuiExpansionPanelSummary-expandIcon')).toContain('color: var(--color-text)');
    expect(declarationsFor('.details__section .MuiExpansionPanelSummary-expandIcon.Mui-expanded')).toContain('color: var(--color-text)');
  });

  it('themes scrollbars for the dark workbench surfaces', () => {
    expect(stylesheet).toContain('scrollbar-color:');
    expect(stylesheet).toContain('::-webkit-scrollbar-thumb');
  });

  it('keeps compact action targets large enough for touch and pointer use', () => {
    expect(declarationsFor('.query-status__demo.MuiButton-root')).toContain('min-height: 36px');
    expect(declarationsFor('.connection-control__switch.MuiButton-root')).toContain('min-height: 36px');
    expect(declarationsFor('.graph-hint .MuiIconButton-root')).toContain('width: 36px');
    expect(declarationsFor('.graph-hint .MuiIconButton-root')).toContain('height: 36px');
  });

  it('styles compact connection, RU, advisory, and modal surfaces', () => {
    expect(stylesheet).toContain('.connection-control');
    expect(stylesheet).toContain('.operation-diagnostics');
    expect(stylesheet).toContain('.query-advisories');
    expect(stylesheet).toContain('.connection-dialog__fields');
  });

  it('defines a mobile selected-result sheet treatment', () => {
    expect(stylesheet).toContain('.selected-panel--mobile-sheet');
    expect(stylesheet).toContain('position: fixed');
    expect(stylesheet).toContain('max-height: 58vh');
  });
});
