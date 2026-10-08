import React from 'react';
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';
import { act, Simulate } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InspectorCard, { Inspector } from './InspectorCard';
import { ACTIONS } from '../../constants';
import { seedDemoGraph } from '../../logics/graphOperations';
import { reducer as graphReducer } from '../../reducers/graphReducer';
import { reducer as optionReducer } from '../../reducers/optionReducer';
import { reducer as gremlinReducer } from '../../reducers/gremlinReducer';
import { reducer as connectionReducer } from '../../reducers/connectionReducer';

const projectNode = {
  id: 'project-cosmos',
  label: 'CosmosVisualizer',
  type: 'project',
  properties: { name: ['CosmosVisualizer'], status: ['Frontend revamp'], type: ['project'] },
  partition: { name: 'type', value: 'project' }
};
const companyNode = {
  id: 'company-engine',
  label: 'Analytical Engines',
  type: 'company',
  properties: { name: ['Analytical Engines'] },
  partition: { name: 'type', value: 'company' }
};
const buildsEdge = {
  id: 'edge-builds',
  from: 'project-cosmos',
  to: 'company-engine',
  type: 'builds',
  properties: { since: ['2026-09-29'] }
};

const baseProps = {
  selectedNode: projectNode,
  selectedEdge: {},
  nodes: [projectNode, companyNode],
  edges: [buildsEdge],
  partitionKey: 'type',
  viewMode: 'table',
  collapsed: false,
  disabled: false,
  onClose: () => {},
  onToggleCollapsed: () => {},
  onViewModeChanged: () => {},
  onTraverse: () => {},
  onCenter: () => {},
  onSelectNode: () => {},
  copyText: () => Promise.resolve()
};

const renderStatic = (props) => ReactDOMServer.renderToStaticMarkup(<Inspector {...baseProps} {...props} />);

let container = null;
const mount = (element) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    ReactDOM.render(element, container);
  });
  return container;
};

afterEach(() => {
  if (container) {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    container = null;
  }
  document.body.innerHTML = '';
});

describe('inspector card content', () => {
  it('renders nothing without a selection', () => {
    expect(renderStatic({ selectedNode: {}, selectedEdge: {} })).toBe('');
  });

  it('shows the node header, partition chip, id, and actions', () => {
    const html = renderStatic();

    expect(html).toContain('CosmosVisualizer');
    expect(html).toContain('>project<');
    expect(html).toContain('partition · type = project');
    expect(html).toContain('project-cosmos');
    expect(html).toContain('Traverse out');
    expect(html).toContain('Traverse in');
    expect(html).toContain('Center');
  });

  it('unwraps Cosmos property arrays and omits the partition-key property', () => {
    const html = renderStatic();

    expect(html).toContain('Frontend revamp');
    expect(html).not.toContain('[');
    expect(html).not.toContain('>type<');
  });

  it('says when the partition value was not returned', () => {
    const html = renderStatic({ selectedNode: { ...projectNode, partition: { name: 'type', value: null } } });

    expect(html).toContain('partition · type not returned');
  });

  it('omits the partition chip when no partition key is configured', () => {
    const html = renderStatic({ partitionKey: null, selectedNode: { ...projectNode, partition: undefined } });

    expect(html).not.toContain('partition ·');
  });

  it('shows an empty property state', () => {
    expect(renderStatic({ selectedNode: { ...projectNode, properties: {} } })).toContain('No properties');
  });

  it('shows the edge label and its endpoint node labels', () => {
    const html = renderStatic({ selectedNode: {}, selectedEdge: buildsEdge });

    expect(html).toContain('builds');
    expect(html).toContain('>edge<');
    expect(html).toContain('CosmosVisualizer');
    expect(html).toContain('Analytical Engines');
    expect(html).toContain('2026-09-29');
    expect(html).not.toContain('Traverse out');
  });

  it('hides properties and the id row when collapsed', () => {
    const html = renderStatic({ collapsed: true });

    expect(html).toContain('aria-label="Expand inspector"');
    expect(html).not.toContain('Frontend revamp');
    expect(html).not.toContain('project-cosmos');
    expect(html).toContain('Traverse out');
  });

  it('shows the raw selection as JSON in json mode', () => {
    const html = renderStatic({ viewMode: 'json' });

    expect(html).toContain('<pre');
    expect(html).toContain('&quot;id&quot;: &quot;project-cosmos&quot;');
    expect(html).toMatch(/aria-label="Show JSON"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*aria-label="Show JSON"/);
  });

  it('disables traversal while graph requests are unavailable', () => {
    const html = renderStatic({ disabled: true });

    expect(html.match(/disabled=""/g).length).toBeGreaterThanOrEqual(2);
  });
});

describe('inspector card interactions', () => {
  it('selects an edge endpoint when its link is clicked', () => {
    const onSelectNode = vi.fn();
    const root = mount(<Inspector {...baseProps} selectedNode={{}} selectedEdge={buildsEdge} onSelectNode={onSelectNode} />);

    Simulate.click(root.querySelector('[data-endpoint="to"]'));

    expect(onSelectNode).toHaveBeenCalledWith('company-engine');
  });

  it('traverses and toggles from the header controls', () => {
    const onTraverse = vi.fn();
    const onToggleCollapsed = vi.fn();
    const onViewModeChanged = vi.fn();
    const onClose = vi.fn();
    const root = mount(
      <Inspector
        {...baseProps}
        onTraverse={onTraverse}
        onToggleCollapsed={onToggleCollapsed}
        onViewModeChanged={onViewModeChanged}
        onClose={onClose}
      />
    );

    Simulate.click(root.querySelector('[aria-label="Traverse in edges"]'));
    Simulate.click(root.querySelector('[aria-label="Collapse inspector"]'));
    Simulate.click(root.querySelector('[aria-label="Show JSON"]'));
    Simulate.click(root.querySelector('[aria-label="Close inspector"]'));

    expect(onTraverse).toHaveBeenCalledWith('project-cosmos', 'in');
    expect(onToggleCollapsed).toHaveBeenCalled();
    expect(onViewModeChanged).toHaveBeenCalledWith('json');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape from the page', () => {
    const onClose = vi.fn();
    mount(<Inspector {...baseProps} onClose={onClose} />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(['textarea', 'input'])('ignores Escape typed into a %s', (tag) => {
    const onClose = vi.fn();
    mount(<Inspector {...baseProps} onClose={onClose} />);
    const field = document.createElement(tag);
    document.body.appendChild(field);

    act(() => {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores Escape while a dialog has focus', () => {
    const onClose = vi.fn();
    mount(<Inspector {...baseProps} onClose={onClose} />);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);

    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirms a successful id copy', async () => {
    const copyText = vi.fn(() => Promise.resolve());
    const root = mount(<Inspector {...baseProps} copyText={copyText} />);

    await act(async () => {
      Simulate.click(root.querySelector('[aria-label="Copy id"]'));
    });

    expect(copyText).toHaveBeenCalledWith('project-cosmos');
    expect(root.textContent).toContain('Copied');
  });

  it('reports a failed id copy', async () => {
    const root = mount(<Inspector {...baseProps} copyText={() => Promise.reject(new Error('denied'))} />);

    await act(async () => {
      Simulate.click(root.querySelector('[aria-label="Copy id"]'));
    });

    expect(root.textContent).toContain('Copy failed');
  });

  it('does not carry a pending copy result over to the next selection', async () => {
    let resolveCopy;
    const copyText = () => new Promise((resolve) => { resolveCopy = resolve; });
    const root = mount(<Inspector {...baseProps} copyText={copyText} />);
    await act(async () => {
      Simulate.click(root.querySelector('[aria-label="Copy id"]'));
    });
    expect(typeof resolveCopy).toBe('function');

    act(() => {
      ReactDOM.render(<Inspector {...baseProps} copyText={copyText} selectedNode={companyNode} />, container);
    });
    await act(async () => {
      resolveCopy();
    });

    expect(root.textContent).not.toContain('Copied');
  });

  it('clears the copy confirmation after two seconds', async () => {
    vi.useFakeTimers();
    try {
      const root = mount(<Inspector {...baseProps} copyText={() => Promise.resolve()} />);
      await act(async () => {
        Simulate.click(root.querySelector('[aria-label="Copy id"]'));
      });
      expect(root.textContent).toContain('Copied');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(root.textContent).not.toContain('Copied');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('inspector card motion', () => {
  it('keeps the last selection on screen while the card animates out, then unmounts', () => {
    vi.useFakeTimers();
    try {
      const root = mount(<Inspector {...baseProps} />);
      act(() => {
        ReactDOM.render(<Inspector {...baseProps} selectedNode={{}} />, container);
      });

      expect(root.querySelector('.inspector-card')).not.toBeNull();
      expect(root.textContent).toContain('CosmosVisualizer');

      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(root.querySelector('.inspector-card')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('animates the body when collapsing', () => {
    const root = mount(<Inspector {...baseProps} />);
    expect(root.querySelector('.inspector-card .MuiCollapse-container')).not.toBeNull();
  });
});

describe('connected inspector card', () => {
  const makeStore = () => createStore(combineReducers({
    graph: graphReducer,
    options: optionReducer,
    gremlin: gremlinReducer,
    connection: connectionReducer
  }));

  it('hides once the graph is cleared under the selection', () => {
    const store = makeStore();
    seedDemoGraph({ colorMode: 'type', colorAssignments: { type: {}, partition: {} }, dispatch: store.dispatch });
    const nodeId = store.getState().graph.nodes[0].id;
    act(() => {
      store.dispatch({ type: ACTIONS.SET_SELECTED_NODE, payload: nodeId });
    });
    const root = mount(<Provider store={store}><InspectorCard /></Provider>);
    expect(root.querySelector('.inspector-card')).not.toBeNull();

    vi.useFakeTimers();
    try {
      act(() => {
        store.dispatch({ type: ACTIONS.CLEAR_GRAPH });
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(root.querySelector('.inspector-card')).toBeNull();
  });
});
