import { describe, expect, it, vi } from 'vitest';
import { applyGraphControl, getSelectedGraphItemId } from './graphControls';

const makeNetwork = () => ({
  fit: vi.fn(),
  focus: vi.fn(),
  moveTo: vi.fn(),
  stabilize: vi.fn(),
  setOptions: vi.fn(),
  stopSimulation: vi.fn(),
  getScale: vi.fn(() => 1.2)
});

describe('graph controls', () => {
  it('detects the selected graph item from node or edge state', () => {
    expect(getSelectedGraphItemId({ id: 'person-1' }, {})).toBe('person-1');
    expect(getSelectedGraphItemId({}, { id: 'edge-1' })).toBe('edge-1');
    expect(getSelectedGraphItemId({}, {})).toBeNull();
  });

  it('applies fit, zoom, center, and reset commands to the network', () => {
    const network = makeNetwork();

    applyGraphControl(network, 'fit');
    applyGraphControl(network, 'zoom-in');
    applyGraphControl(network, 'zoom-out');
    applyGraphControl(network, 'center-selection', { selectedNode: { id: 'person-1' } });
    applyGraphControl(network, 'reset-layout');

    expect(network.fit).toHaveBeenCalledWith({ animation: true });
    expect(network.moveTo).toHaveBeenCalledWith({ scale: 1.44, animation: true });
    expect(network.moveTo).toHaveBeenCalledWith({ scale: 0.96, animation: true });
    expect(network.focus).toHaveBeenCalledWith('person-1', { animation: true, scale: 1.1 });
    expect(network.stabilize).toHaveBeenCalledWith(50);
  });

  it('toggles physics options and stops simulation when disabled', () => {
    const network = makeNetwork();
    const physics = { solver: 'forceAtlas2Based' };

    applyGraphControl(network, 'physics', {
      enabled: false,
      networkOptions: { physics }
    });

    expect(network.setOptions).toHaveBeenCalledWith({
      physics: false,
      edges: { smooth: { type: 'continuous' } }
    });
    expect(network.stopSimulation).toHaveBeenCalled();
  });
});
