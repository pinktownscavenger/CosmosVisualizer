import { escapeGremlinString } from './utils';

// Matches the first traversal step: g.V() or g.V('<id>') / g.V("<id>"), allowing escaped quotes.
const FIRST_STEP = /^(\s*)(g\.V\((?:\s*'(?:\\.|[^'\\])*'\s*|\s*"(?:\\.|[^"\\])*"\s*)?\))/;

const normalizePartitionKey = (partitionKey) => (
  typeof partitionKey === 'string' ? partitionKey.trim().replace(/^\//, '') || null : null
);

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Inserts a partition filter after the first step so Cosmos can route to one partition.
export const scopeQueryToPartition = (query, partitionKey, value) => {
  const key = normalizePartitionKey(partitionKey);
  const match = typeof query === 'string' ? query.match(FIRST_STEP) : null;
  if (!key || !match) {
    return null;
  }

  const head = match[1] + match[2];
  const rest = query.slice(head.length);
  const alreadyScoped = new RegExp(`^\\.has\\(\\s*['"]${escapeForRegExp(key)}['"]`).test(rest);
  if (alreadyScoped) {
    return null;
  }

  // Numbers and booleans must stay unquoted or Cosmos compares them as strings and matches nothing.
  if (typeof value === 'number' || typeof value === 'boolean') {
    const prefix = `${head}.has('${escapeGremlinString(key)}', ${String(value)}`;
    return { query: `${prefix})${rest}`, cursor: prefix.length };
  }
  const prefix = `${head}.has('${escapeGremlinString(key)}', '${escapeGremlinString(value || '')}`;
  return { query: `${prefix}')${rest}`, cursor: prefix.length };
};
