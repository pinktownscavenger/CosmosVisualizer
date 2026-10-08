import React from 'react';

export const getConnectionLabel = (status, connection) => {
  if (status !== 'connected' || !connection) {
    return 'Disconnected';
  }
  if (connection.mode === 'fixture') {
    return 'Fixture';
  }
  return `${connection.endpointHost} / ${connection.database} / ${connection.container}`;
};

export const ConnectionChip = ({ label, partitionKey, disabled, onClick }) => (
  <button
    type="button"
    className="top-bar__control top-bar__connection"
    title={`${label} · switch connection`}
    aria-label={`Connection: ${label}. Switch connection`}
    disabled={disabled}
    onClick={onClick}
  >
    <span className="top-bar__connection-label">{label} ▾</span>
    <span className="top-bar__secondary">{partitionKey ? `partition · ${partitionKey}` : 'no partition key'}</span>
  </button>
);
