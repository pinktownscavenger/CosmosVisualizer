const ANIMATION = true;

export const getSelectedGraphItemId = (selectedNode, selectedEdge) => {
  if (selectedNode && selectedNode.id !== undefined) {
    return selectedNode.id;
  }
  if (selectedEdge && selectedEdge.id !== undefined) {
    return selectedEdge.id;
  }
  return null;
};

export const getVisibleCenterOffset = (insetRight) => ({ x: insetRight ? -insetRight / 2 : 0, y: 0 });

export const getFitScale = (currentScale, canvasWidth, insetRight) => {
  if (!insetRight || !canvasWidth) {
    return currentScale;
  }
  return currentScale * (canvasWidth - insetRight) / canvasWidth;
};

const smoothEdges = {
  smooth: {
    type: 'continuous'
  }
};

export const applyGraphControl = (network, command, context = {}) => {
  if (!network) {
    return;
  }

  const insetRight = context.insetRight || 0;

  if (command === 'fit') {
    if (!insetRight) {
      network.fit({ animation: ANIMATION });
      return;
    }
    network.fit({ animation: false });
    const canvasWidth = network.body && network.body.container ? network.body.container.clientWidth : 0;
    network.moveTo({
      position: network.getViewPosition(),
      scale: getFitScale(network.getScale(), canvasWidth, insetRight),
      offset: getVisibleCenterOffset(insetRight),
      animation: ANIMATION
    });
    return;
  }

  if (command === 'zoom-in' || command === 'zoom-out') {
    const currentScale = typeof network.getScale === 'function' ? network.getScale() : 1;
    const multiplier = command === 'zoom-in' ? 1.2 : 0.8;
    network.moveTo({ scale: Number((currentScale * multiplier).toFixed(2)), animation: ANIMATION });
    return;
  }

  if (command === 'center-selection') {
    const selectedNodeId = context.selectedNode && context.selectedNode.id;
    if (selectedNodeId !== undefined) {
      const focusOptions = { animation: ANIMATION, scale: 1.1 };
      if (insetRight) {
        focusOptions.offset = getVisibleCenterOffset(insetRight);
      }
      network.focus(selectedNodeId, focusOptions);
      return;
    }
    network.fit({ animation: ANIMATION });
    return;
  }

  if (command === 'reset-layout') {
    if (context.networkOptions && context.networkOptions.physics) {
      network.setOptions({ physics: context.networkOptions.physics, edges: smoothEdges });
    }
    network.stabilize(50);
    return;
  }

  if (command === 'physics') {
    const physics = context.enabled ? context.networkOptions && context.networkOptions.physics : false;
    network.setOptions({ physics, edges: smoothEdges });
    if (!context.enabled) {
      network.stopSimulation();
    }
  }
};
