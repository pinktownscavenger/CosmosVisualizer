import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryList } from './HistoryMenu';
import { mount, unmountAll } from './testUtils';

afterEach(unmountAll);

describe('history list', () => {
  it('lists the newest query first', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <HistoryList queries={['g.V().limit(1)', 'g.V().limit(2)']} onLoad={() => {}} onClear={() => {}} />
    );
    expect(html.indexOf('g.V().limit(2)')).toBeLessThan(html.indexOf('g.V().limit(1)'));
  });

  it('shows an empty state', () => {
    const html = ReactDOMServer.renderToStaticMarkup(<HistoryList queries={[]} onLoad={() => {}} onClear={() => {}} />);
    expect(html).toContain('No queries yet');
    expect(html).not.toContain('Clear history');
  });

  it('loads a query by clicking it, with no separate Run or Load buttons', () => {
    const onLoad = vi.fn();
    const root = mount(<HistoryList queries={['g.V()', "g.V('a').out()"]} onLoad={onLoad} onClear={() => {}} />);
    const rows = [...root.querySelectorAll('.history-menu__entry')];

    expect(rows.map(row => row.tagName)).toEqual(['BUTTON', 'BUTTON']);
    expect(root.textContent).not.toMatch(/\bRun\b|\bLoad\b/);
    Simulate.click(rows[0]);
    expect(onLoad).toHaveBeenCalledWith("g.V('a').out()");
  });

  it('labels each entry for assistive tech and clears history', () => {
    const onClear = vi.fn();
    const root = mount(<HistoryList queries={['g.V()']} onLoad={() => {}} onClear={onClear} />);

    expect(root.querySelector('.history-menu__entry').getAttribute('aria-label')).toBe('Load query into editor: g.V()');
    Simulate.click([...root.querySelectorAll('button')].find(button => button.textContent === 'Clear history'));
    expect(onClear).toHaveBeenCalled();
  });
});
