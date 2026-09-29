const selectRandomField = (obj) => {
  let firstKey;
  for (firstKey in obj) break;
  return firstKey;
};

const keyBy = (list, key) => list.reduce((result, item) => {
  result[item[key]] = item;
  return result;
}, {});

const mapValues = (obj, mapper) => Object.keys(obj).reduce((result, key) => {
  result[key] = mapper(obj[key], key);
  return result;
}, {});

const isString = (value) => typeof value === 'string' || value instanceof String;

const differenceBy = (newList, oldList, getKey) => {
  const oldKeys = new Set(oldList.map(getKey));
  return newList.filter((item) => !oldKeys.has(getKey(item)));
};

const uniqueBy = (list, getKey) => {
  const seenKeys = new Set();
  return list.filter((item) => {
    const key = getKey(item);
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    return true;
  });
};

export const getDiffNodes = (newList, oldList) => {
  return differenceBy(newList, oldList, (node) => node.id);
};

export const getDiffEdges = (newList, oldList) => {
  const getEdgeKey = (edge) => edge.id || `${edge.from},${edge.type},${edge.to}`;
  return differenceBy(uniqueBy(newList, getEdgeKey), oldList, getEdgeKey);
};

export const extractEdgesAndNodes = (nodeList, nodeLabels=[]) => {
  let edges = [];
  const nodes = [];

  const nextNodeLabels = [...nodeLabels];
  const nodeLabelMap = mapValues(keyBy(nodeLabels, 'type'), (nodeLabel) => nodeLabel.field);

  nodeList.forEach((node) => {
    const type = node.label;
    if (!nodeLabelMap[type]) {
      const field = selectRandomField(node.properties);
      const nodeLabel = { type, field };
      nextNodeLabels.push(nodeLabel);
      nodeLabelMap[type] = field;
    }
    const labelField = nodeLabelMap[type];
    const label = labelField in node.properties ? node.properties[labelField] : type;
    nodes.push({
      id: node.id,
      label: String(label),
      group: node.label,
      properties: node.properties,
      partition: node.partition,
      type
    });

    edges = edges.concat((node.edges || []).map(edge => ({ ...edge, type: edge.label, arrows: { to: { enabled: true, scaleFactor: 0.5 } } })));
  });

  return { edges, nodes, nodeLabels: nextNodeLabels }
};

export const findNodeById = (nodeList, id) => {
  return nodeList.find(node => node.id === id);
};

export const stringifyObjectValues = (obj) => {
  return mapValues(obj, (value) => isString(value) ? value : JSON.stringify(value));
};
