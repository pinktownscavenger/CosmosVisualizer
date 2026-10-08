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
      <HistoryList queries={['g.V().limit(1)', 'g.V().limit(2)']} disabled={false} onRun={() => {}} onLoad={() => {}} onClear={() => {}} />
    );
    expect(html.indexOf('g.V().limit(2)')).toBeLessThan(html.indexOf('g.V().limit(1)'));
  });

  it('shows an empty state', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <HistoryList queries={[]} disabled={false} onRun={() => {}} onLoad={() => {}} onClear={() => {}} />
    );
    expect(html).toContain('No queries yet');
    expect(html).not.toContain('Clear history');
  });

  it('runs, loads, and clears entries', () => {
    const onRun = vi.fn();
    const onLoad = vi.fn();
    const onClear = vi.fn();
    const root = mount(<HistoryList queries={['g.V()']} disabled={false} onRun={onRun} onLoad={onLoad} onClear={onClear} />);

    Simulate.click(root.querySelector('[aria-label="Run query 1"]'));
    Simulate.click(root.querySelector('[aria-label="Load query 1"]'));
    Simulate.click([...root.querySelectorAll('button')].find(button => button.textContent === 'Clear history'));

    expect(onRun).toHaveBeenCalledWith('g.V()');
    expect(onLoad).toHaveBeenCalledWith('g.V()');
    expect(onClear).toHaveBeenCalled();
  });

  it('disables Run but keeps Load while graph requests are unavailable', () => {
    const root = mount(<HistoryList queries={['g.V()']} disabled={true} onRun={() => {}} onLoad={() => {}} onClear={() => {}} />);
    expect(root.querySelector('[aria-label="Run query 1"]').disabled).toBe(true);
    expect(root.querySelector('[aria-label="Load query 1"]').disabled).toBe(false);
  });
});
