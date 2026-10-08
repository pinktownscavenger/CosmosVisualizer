import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphLegend } from './GraphLegend';
import { mount, unmountAll } from '../TopBar/testUtils';

afterEach(unmountAll);

const nodes = [
  { id: 'a', type: 'person' }, { id: 'b', type: 'person' }, { id: 'c', type: 'company' },
  { id: 'd', type: 'project' }, { id: 'e', type: 'tag' }, { id: 'f', type: 'dataset' }
];
const modeAssignments = { person: 0, company: 1, project: 2, tag: 'other', dataset: 'other' };
const baseProps = {
  nodes,
  edgeCount: 5,
  colorMode: 'type',
  modeAssignments,
  collapsed: false,
  onModeChange: () => {},
  onToggleCollapsed: () => {}
};

describe('graph legend', () => {
  it('shows the mode toggle with the active mode pressed', () => {
    const html = ReactDOMServer.renderToStaticMarkup(<GraphLegend {...baseProps} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Type<|>Type</);
    expect(html).toContain('aria-pressed="false"');
  });

  it('switches mode from the toggle', () => {
    const onModeChange = vi.fn();
    const root = mount(<GraphLegend {...baseProps} onModeChange={onModeChange} />);

    Simulate.click([...root.querySelectorAll('button')].find(button => button.textContent === 'Partition'));

    expect(onModeChange).toHaveBeenCalledWith('partition');
  });

  it('lists swatches, labels and counts in slot order with Other last', () => {
    const root = mount(<GraphLegend {...baseProps} />);
    const rows = [...root.querySelectorAll('.graph-legend__row')];

    expect(rows.map(row => row.textContent)).toEqual(['person2', 'company1', 'project1', 'Other (2 keys)2']);
    expect(rows[0].querySelector('.graph-legend__swatch').style.background).toBe('rgb(57, 135, 229)');
    expect(rows[3].getAttribute('title')).toBe('tag, dataset');
  });

  it('shows the counts line', () => {
    expect(ReactDOMServer.renderToStaticMarkup(<GraphLegend {...baseProps} />)).toContain('6 nodes · 5 edges');
    expect(ReactDOMServer.renderToStaticMarkup(<GraphLegend {...baseProps} nodes={[nodes[0]]} edgeCount={1} />)).toContain('1 node · 1 edge');
  });

  it('collapses to the counts line', () => {
    const onToggleCollapsed = vi.fn();
    const root = mount(<GraphLegend {...baseProps} collapsed={true} onToggleCollapsed={onToggleCollapsed} />);

    expect(root.querySelectorAll('.graph-legend__row')).toHaveLength(0);
    expect(root.textContent).not.toContain('Partition');
    Simulate.click(root.querySelector('[aria-label="Expand legend"]'));
    expect(onToggleCollapsed).toHaveBeenCalled();
  });

  it('shows no rows for an empty graph', () => {
    const root = mount(<GraphLegend {...baseProps} nodes={[]} edgeCount={0} />);
    expect(root.querySelectorAll('.graph-legend__row')).toHaveLength(0);
    expect(root.textContent).toContain('0 nodes · 0 edges');
  });

  it('locks the mode toggle while a graph operation is running', () => {
    const onModeChange = vi.fn();
    const root = mount(<GraphLegend {...baseProps} modeLocked={true} onModeChange={onModeChange} />);
    const partition = [...root.querySelectorAll('button')].find(button => button.textContent === 'Partition');

    expect(partition.disabled).toBe(true);
    Simulate.click(partition);
    expect(onModeChange).not.toHaveBeenCalled();
  });
});
