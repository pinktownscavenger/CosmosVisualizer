import React from 'react';
import { Popover } from '@material-ui/core';

export const HistoryList = ({ queries, onLoad, onClear }) => {
  if (queries.length === 0) {
    return <p className="history-menu__empty">No queries yet</p>;
  }

  const newestFirst = queries.map((query, index) => ({ query, index })).reverse();
  return (
    <div className="history-menu">
      <ul className="history-menu__list">
        {newestFirst.map(({ query, index }) => (
          <li key={`${index}-${query}`}>
            <button
              type="button"
              className="history-menu__entry"
              title={query}
              aria-label={`Load query into editor: ${query}`}
              onClick={() => onLoad(query)}
            >
              <code className="history-menu__query">{query}</code>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="history-menu__clear" onClick={onClear}>Clear history</button>
    </div>
  );
};

export class HistoryMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = { anchor: null };
  }

  close() {
    this.setState({ anchor: null });
  }

  render() {
    const { queries, onLoad, onClear } = this.props;
    return (
      <>
        <button
          type="button"
          className="top-bar__control top-bar__ghost"
          aria-haspopup="true"
          aria-expanded={Boolean(this.state.anchor)}
          onClick={event => this.setState({ anchor: event.currentTarget })}
        >
          History ▾
        </button>
        <Popover
          open={Boolean(this.state.anchor)}
          anchorEl={this.state.anchor}
          onClose={() => this.close()}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{ className: 'top-bar__popover' }}
        >
          <HistoryList
            queries={queries}
            onLoad={(query) => { this.close(); onLoad(query); }}
            onClear={onClear}
          />
        </Popover>
      </>
    );
  }
}
