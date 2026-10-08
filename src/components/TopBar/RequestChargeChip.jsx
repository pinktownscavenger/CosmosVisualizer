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

export const RequestChargeChip = ({ diagnostics }) => {
  const { total, detail } = getRequestChargeParts(diagnostics);
  return (
    <div className="top-bar__control top-bar__ru" role="status" aria-label="Latest operation request charge" title={detail}>
      <span className="top-bar__ru-total">{total}</span>
      <span className="top-bar__secondary">{detail}</span>
    </div>
  );
};
