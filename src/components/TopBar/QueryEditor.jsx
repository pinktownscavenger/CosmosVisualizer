import React from 'react';

export const QUERY_PLACEHOLDER = "g.V().has('type', 'project').limit(25)";
const MAX_ROWS = 6;

const caretOnFirstLine = (textarea) => !textarea.value.slice(0, textarea.selectionStart).includes('\n');
const caretOnLastLine = (textarea) => !textarea.value.slice(textarea.selectionEnd).includes('\n');

export class QueryEditor extends React.Component {
  onKeyDown(event) {
    const textarea = event.target;
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!this.props.disabled) {
        this.props.onSubmit();
      }
      return;
    }

    const collapsed = textarea.selectionStart === textarea.selectionEnd;
    const direction = (event.key === 'ArrowUp' && collapsed && caretOnFirstLine(textarea) && 'up')
      || (event.key === 'ArrowDown' && collapsed && caretOnLastLine(textarea) && 'down');
    if (direction && this.props.onHistoryStep(direction) !== null) {
      event.preventDefault();
    }
  }

  render() {
    const rows = Math.min(MAX_ROWS, Math.max(1, this.props.value.split('\n').length));
    return (
      <textarea
        id="gremlin-query"
        ref={this.props.inputRef}
        className="query-editor"
        aria-label="Gremlin query"
        placeholder={QUERY_PLACEHOLDER}
        spellCheck={false}
        autoComplete="off"
        rows={rows}
        value={this.props.value}
        onChange={event => this.props.onChange(event.target.value)}
        onKeyDown={this.onKeyDown.bind(this)}
      />
    );
  }
}
