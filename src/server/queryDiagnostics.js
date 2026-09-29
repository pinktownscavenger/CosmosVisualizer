const TOTAL_REQUEST_CHARGE = 'x-ms-total-request-charge';
const REQUEST_CHARGE = 'x-ms-request-charge';

function readAttribute(attributes, name) {
  if (attributes instanceof Map) {
    return attributes.get(name);
  }

  if (attributes && typeof attributes === 'object') {
    return attributes[name];
  }

  return undefined;
}

function normalizeCharge(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const charge = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(charge) && charge >= 0 ? charge : null;
}

function extractRequestCharge(source) {
  const attributes = source && (source.attributes || source.statusAttributes);
  const total = normalizeCharge(readAttribute(attributes, TOTAL_REQUEST_CHARGE));

  if (total !== null) {
    return total;
  }

  return normalizeCharge(readAttribute(attributes, REQUEST_CHARGE));
}

function buildOperationDiagnostics(operation, requests) {
  const chargedRequests = (requests || []).reduce((result, request) => {
    const charge = extractRequestCharge(request.source);
    if (charge !== null) {
      result.push({ kind: request.kind, charge });
    }
    return result;
  }, []);

  if (chargedRequests.length === 0) {
    return { operation };
  }

  return {
    operation,
    requestCharge: {
      total: chargedRequests.reduce((total, request) => total + request.charge, 0),
      requests: chargedRequests
    }
  };
}

module.exports = {
  buildOperationDiagnostics,
  extractRequestCharge
};
