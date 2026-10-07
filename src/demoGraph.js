import demoGraphData from './demoGraphData.json';
import { extractEdgesAndNodes } from './logics/utils';

// The startup graph is the same dataset fixture mode serves, shaped like a /query
// response so node ids, labels, and properties match what a real query returns.
const toPropertyLists = (properties) => Object.fromEntries(
  Object.entries(properties).map(([key, value]) => [key, [value]])
);

const edges = demoGraphData.edges.map(edge => ({
  ...edge,
  properties: toPropertyLists(edge.properties)
}));

const queryResponse = demoGraphData.vertices.map(vertex => ({
  id: vertex.id,
  label: vertex.label,
  type: 'vertex',
  properties: toPropertyLists(vertex.properties),
  edges: edges.filter(edge => edge.from === vertex.id || edge.to === vertex.id),
  partition: { name: 'type', value: vertex.properties.type }
}));

const graph = extractEdgesAndNodes(queryResponse, []);

export const demoNodes = graph.nodes;
export const demoEdges = [...new Map(graph.edges.map(edge => [edge.id, edge])).values()];
