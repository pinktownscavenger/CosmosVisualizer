const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const formatScalar = (value) => {
  if (isPlainObject(value)) {
    return { kind: 'json', value: JSON.stringify(value) };
  }
  return { kind: 'text', value: String(value) };
};

// Cosmos returns every vertex property as an array of values.
export const formatPropertyValue = (value) => {
  if (!Array.isArray(value)) {
    return formatScalar(value);
  }
  if (value.length === 0) {
    return { kind: 'text', value: '' };
  }
  if (value.length === 1) {
    return formatScalar(value[0]);
  }
  if (value.some(isPlainObject)) {
    return { kind: 'json', value: JSON.stringify(value) };
  }
  return { kind: 'chips', value: value.map(String) };
};

export const getDisplayProperties = (properties, partitionKey) => {
  if (!properties) {
    return [];
  }
  return Object.keys(properties)
    .filter(key => key !== partitionKey)
    .map(key => [key, formatPropertyValue(properties[key])]);
};
