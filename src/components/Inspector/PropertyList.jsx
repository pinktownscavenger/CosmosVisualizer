import React from 'react';

const PropertyValue = ({ formatted }) => {
  if (formatted.kind === 'chips') {
    return (
      <span className="property-list__value property-list__chips">
        {formatted.value.map((item, index) => <span key={`${item}-${index}`} className="property-list__chip">{item}</span>)}
      </span>
    );
  }
  const className = formatted.kind === 'json'
    ? 'property-list__value property-list__value--json'
    : 'property-list__value';
  return <span className={className}>{formatted.value}</span>;
};

export const PropertyList = ({ rows }) => {
  if (rows.length === 0) {
    return <p className="property-list__empty">No properties</p>;
  }

  return (
    <dl className="property-list">
      {rows.map(([key, formatted]) => (
        <React.Fragment key={key}>
          <dt className="property-list__key">{key}</dt>
          <dd className="property-list__cell"><PropertyValue formatted={formatted} /></dd>
        </React.Fragment>
      ))}
    </dl>
  );
};
