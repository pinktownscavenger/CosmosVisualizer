const isEmptySelection = (selection) => {
  if (selection == null) {
    return true;
  }
  return Object.keys(selection).length === 0;
};

export const getSelectedResultPayload = (selectedNode, selectedEdge) => {
  const selection = !isEmptySelection(selectedNode) ? selectedNode : selectedEdge;
  const kind = !isEmptySelection(selectedNode) ? 'node' : 'edge';

  if (isEmptySelection(selection)) {
    return null;
  }

  const payload = {
    kind,
    type: selection.type,
    id: selection.id,
    properties: selection.properties || {}
  };

  if (kind === 'node') {
    payload.partition = selection.partition;
  }

  return payload;
};
