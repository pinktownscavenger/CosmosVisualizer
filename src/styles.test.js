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
  it('fills the viewport with the top bar and canvas without page scroll', () => {
    expect(declarationsFor('.app-shell')).toContain('height: 100vh');
    expect(declarationsFor('.app-shell')).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(declarationsFor('.app-shell')).toContain('overflow: hidden');
    expect(declarationsFor('.graph-workspace')).toContain('overflow: hidden');
    expect(declarationsFor('.mynetwork')).toContain('position: absolute');
    expect(declarationsFor('.mynetwork')).toContain('inset: 0');
  });

  it('keeps every top-bar control on one 44px row', () => {
    expect(declarationsFor('.top-bar')).toContain('align-items: start');
    expect(declarationsFor('.top-bar__control')).toContain('height: 44px');
    expect(declarationsFor('.message-line')).toContain('height: 18px');
    expect(declarationsFor('.message-line')).toContain('grid-column: 2;');
  });

  it('gives the RU chip a fixed width so the bar never shifts as values change', () => {
    expect(declarationsFor('.top-bar__ru')).toContain('width: 330px');
    expect(declarationsFor('.top-bar__ru .top-bar__secondary')).toContain('max-width: 100%');
  });

  it('uses a strong border token for the query editor', () => {
    expect(declarationsFor(':root')).toContain('--color-border-strong: #64748b');
    expect(declarationsFor('.query-editor')).toContain('border: 1px solid var(--color-border-strong)');
  });

  it('themes scrollbars for the dark workbench surfaces', () => {
    expect(stylesheet).toContain('scrollbar-color:');
    expect(stylesheet).toContain('::-webkit-scrollbar-thumb');
  });

  it('keeps the graph hint dismiss target large enough for pointer use', () => {
    expect(declarationsFor('.graph-hint .MuiIconButton-root')).toContain('width: 36px');
    expect(declarationsFor('.graph-hint .MuiIconButton-root')).toContain('height: 36px');
  });

  it('drops the removed header and sidebar styles', () => {
    for (const selector of ['.header', '.metric-pill', '.query-status', '.query-advisories', '.operation-diagnostics', '.details', '.selected-panel', '.workspace-panel', '.graph-frame']) {
      expect(stylesheet).not.toContain(`${selector} {`);
    }
    expect(stylesheet).toContain('.connection-dialog__fields');
  });
});
