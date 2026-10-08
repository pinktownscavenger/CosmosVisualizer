import { describe, expect, it, vi } from 'vitest';
import { applyGraphControl, getFitScale, getSelectedGraphItemId, getVisibleCenterOffset } from './graphControls';

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

  it('offsets the view centre by half the covered strip', () => {
    expect(getVisibleCenterOffset(384)).toEqual({ x: -192, y: 0 });
    expect(getVisibleCenterOffset(0)).toEqual({ x: 0, y: 0 });
  });

  it('shrinks the fit scale to the uncovered width', () => {
    expect(getFitScale(1, 1400, 384)).toBeCloseTo(1016 / 1400);
    expect(getFitScale(2, 1400, 0)).toBe(2);
  });

  it('fits into the visible region when the inspector covers the right side', () => {
    const network = {
      ...makeNetwork(),
      getScale: vi.fn(() => 1),
      getViewPosition: vi.fn(() => ({ x: 10, y: 20 })),
      body: { container: { clientWidth: 1400 } }
    };

    applyGraphControl(network, 'fit', { insetRight: 384 });

    expect(network.fit).toHaveBeenCalledWith({ animation: false });
    expect(network.moveTo).toHaveBeenCalledWith({
      position: { x: 10, y: 20 },
      scale: expect.closeTo(1016 / 1400),
      offset: { x: -192, y: 0 },
      animation: true
    });
  });

  it('centres the selection in the visible region when the inspector is open', () => {
    const network = makeNetwork();

    applyGraphControl(network, 'center-selection', { selectedNode: { id: 'person-1' }, insetRight: 384 });

    expect(network.focus).toHaveBeenCalledWith('person-1', {
      animation: true,
      scale: 1.1,
      offset: { x: -192, y: 0 }
    });
  });

  it('restores dynamic curves when physics resumes or the layout resets', () => {
    const network = makeNetwork();
    const physics = { solver: 'forceAtlas2Based' };

    applyGraphControl(network, 'physics', { enabled: true, networkOptions: { physics } });
    applyGraphControl(network, 'reset-layout', { networkOptions: { physics } });

    expect(network.setOptions).toHaveBeenNthCalledWith(1, { physics, edges: { smooth: { type: 'dynamic' } } });
    expect(network.setOptions).toHaveBeenNthCalledWith(2, { physics, edges: { smooth: { type: 'dynamic' } } });
  });
});
