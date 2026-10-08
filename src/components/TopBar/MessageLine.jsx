import React from 'react';

export const MessageLine = ({ line, onAction }) => (
  <div className={`message-line message-line--${line.tone}`} role="status" title={line.tooltip || line.text}>
    <span className="message-line__text">{line.tone === 'advisory' ? `⚠ ${line.text}` : line.text}</span>
    {line.action && (
      <button type="button" className="message-line__action" onClick={() => onAction(line.action)}>
        {line.actionLabel}
      </button>
    )}
  </div>
);
