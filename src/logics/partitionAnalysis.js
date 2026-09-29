const FINDINGS = {
  UNSCOPED_VERTEX_SCAN: (partitionKey) => ({
    code: 'UNSCOPED_VERTEX_SCAN',
    message: `This traversal starts with g.V() without an early ${partitionKey} partition predicate and may scan multiple partitions.`
  }),
  ID_WITHOUT_PARTITION: (partitionKey) => ({
    code: 'ID_WITHOUT_PARTITION',
    message: `This vertex ID lookup does not include its ${partitionKey} partition value and may fan out across partitions.`
  }),
  INBOUND_TRAVERSAL: () => ({
    code: 'INBOUND_TRAVERSAL',
    message: 'Inbound traversals can fan out because Cosmos DB stores each edge with its source vertex.'
  }),
  BIDIRECTIONAL_TRAVERSAL: () => ({
    code: 'BIDIRECTIONAL_TRAVERSAL',
    message: 'Bidirectional traversals include inbound access and may fan out across Cosmos DB partitions.'
  })
};

function tokenize(query) {
  const strings = [];
  let code = '';

  for (let index = 0; index < query.length;) {
    const char = query[index];
    const next = query[index + 1];

    if (char === '/' && next === '/') {
      index += 2;
      while (index < query.length && query[index] !== '\n') {
        index += 1;
      }
      code += '\n';
      continue;
    }

    if (char === '/' && next === '*') {
      const end = query.indexOf('*/', index + 2);
      if (end === -1) {
        return null;
      }
      code += ' ';
      index = end + 2;
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      let value = '';
      let closed = false;
      index += 1;

      while (index < query.length) {
        const stringChar = query[index];
        if (stringChar === '\\') {
          if (index + 1 >= query.length) {
            return null;
          }
          value += query[index + 1];
          index += 2;
          continue;
        }
        if (stringChar === quote) {
          closed = true;
          index += 1;
          break;
        }
        value += stringChar;
        index += 1;
      }

      if (!closed) {
        return null;
      }

      const marker = `__STRING_${strings.length}__`;
      strings.push(value);
      code += marker;
      continue;
    }

    code += char;
    index += 1;
  }

  return { code, strings };
}

function valueForMarker(marker, strings) {
  const match = /^__STRING_(\d+)__$/.exec(marker);
  return match ? strings[Number(match[1])] : undefined;
}

function hasMatchingPartitionPredicate(code, strings, partitionKey) {
  const pattern = /\.\s*has\s*\(\s*(__STRING_\d+__)/g;
  let match;
  while ((match = pattern.exec(code)) !== null) {
    if (valueForMarker(match[1], strings) === partitionKey) {
      return true;
    }
  }
  return false;
}

function hasMatchingPartitionStrategy(code, strings, partitionKey) {
  if (!/\bPartitionStrategy\b/.test(code)) {
    return false;
  }

  const match = /\.\s*partitionKey\s*\(\s*(__STRING_\d+__)\s*\)/.exec(code);
  return Boolean(match && valueForMarker(match[1], strings) === partitionKey);
}

function isPartitionIdTuple(argumentsText) {
  return /^\s*\[\s*__STRING_\d+__\s*,\s*__STRING_\d+__\s*\]\s*$/.test(argumentsText);
}

function analyzePartitionFanOut(query, partitionKey) {
  if (
    typeof query !== 'string'
    || query.trim() === ''
    || typeof partitionKey !== 'string'
    || partitionKey.trim() === ''
  ) {
    return [];
  }

  const tokenized = tokenize(query);
  if (!tokenized) {
    return [];
  }

  const normalizedPartitionKey = partitionKey.trim().replace(/^\//, '');
  if (!normalizedPartitionKey) {
    return [];
  }

  const { code, strings } = tokenized;
  const findings = [];
  const seen = new Set();
  const add = (finding) => {
    if (!seen.has(finding.code)) {
      seen.add(finding.code);
      findings.push(finding);
    }
  };

  const start = /\bg\s*\.\s*V\s*\(([^)]*)\)/.exec(code);
  if (start) {
    const argumentsText = start[1];
    const tail = code.slice(start.index + start[0].length);
    const navigation = /\.\s*(?:outE?|inE?|bothE?)\s*\(/.exec(tail);
    const earlyTail = navigation ? tail.slice(0, navigation.index) : tail;
    const scoped = hasMatchingPartitionPredicate(earlyTail, strings, normalizedPartitionKey)
      || hasMatchingPartitionStrategy(code, strings, normalizedPartitionKey)
      || isPartitionIdTuple(argumentsText);

    if (!scoped && argumentsText.trim() === '') {
      add(FINDINGS.UNSCOPED_VERTEX_SCAN(normalizedPartitionKey));
    } else if (!scoped && /^\s*__STRING_\d+__\s*$/.test(argumentsText)) {
      add(FINDINGS.ID_WITHOUT_PARTITION(normalizedPartitionKey));
    }
  }

  if (/\.\s*in(?:E)?\s*\(/.test(code)) {
    add(FINDINGS.INBOUND_TRAVERSAL());
  }
  if (/\.\s*both(?:E)?\s*\(/.test(code)) {
    add(FINDINGS.BIDIRECTIONAL_TRAVERSAL());
  }

  return findings;
}

export {
  analyzePartitionFanOut
};
