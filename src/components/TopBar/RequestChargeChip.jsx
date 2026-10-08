import React from 'react';

const operationDirection = (operation) => {
  if (operation === 'traverse-in') {
    return 'inbound';
  }
  if (operation === 'traverse-out') {
    return 'outbound';
  }
  return null;
};

const formatCharge = (charge) => charge.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const getRequestChargeParts = (diagnostics) => {
  if (!diagnostics) {
    return { total: '— RU', detail: 'no operation yet' };
  }
  const requestCharge = diagnostics.requestCharge;
  if (!requestCharge || !Number.isFinite(requestCharge.total)) {
    return { total: '— RU', detail: 'charge unavailable' };
  }

  const requests = Array.isArray(requestCharge.requests) ? requestCharge.requests : [];
  const breakdown = requests
    .filter(request => request && Number.isFinite(request.charge))
    .map(request => `${request.kind} ${formatCharge(request.charge)}`)
    .join(' + ');
  const detail = [operationDirection(diagnostics.operation), breakdown].filter(Boolean).join(' · ') || 'total only';
  return { total: `${formatCharge(requestCharge.total)} RU`, detail };
};

export const getSessionParts = (session) => {
  if (!session || session.operations === 0) {
    return { total: 'Σ — RU', detail: '0 ops' };
  }
  const operations = `${session.operations} ${session.operations === 1 ? 'op' : 'ops'}`;
  const unpriced = session.unpricedOperations > 0 ? ` · ${session.unpricedOperations} unpriced` : '';
  return { total: `Σ ${formatCharge(session.total)} RU`, detail: `${operations}${unpriced}` };
};

const SESSION_HINT = 'Session total since this connection. Click to reset.';

export const RequestChargeChip = ({ diagnostics, session, onResetSession }) => {
  const last = getRequestChargeParts(diagnostics);
  const sessionParts = getSessionParts(session);
  return (
    <div className="top-bar__control top-bar__ru">
      <div className="top-bar__ru-half" role="status" aria-label="Latest operation request charge" title={last.detail}>
        <span className="top-bar__ru-total">{last.total}</span>
        <span className="top-bar__secondary">{last.detail}</span>
      </div>
      <button
        type="button"
        className="top-bar__ru-half top-bar__ru-session"
        aria-label={`${SESSION_HINT} ${sessionParts.total}, ${sessionParts.detail}`}
        title={SESSION_HINT}
        onClick={onResetSession}
      >
        <span className="top-bar__ru-total">{sessionParts.total}</span>
        <span className="top-bar__secondary">{sessionParts.detail}</span>
      </button>
    </div>
  );
};
