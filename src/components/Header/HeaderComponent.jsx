import React from 'react';
import { connect } from 'react-redux';
import { Button, TextField }  from '@material-ui/core';
import {
  ACTIONS,
  EMPTY_GREMLIN_QUERY_ERROR,
  QUERY_RUNNING_MESSAGE,
  TOO_LONG_GREMLIN_QUERY_ERROR
} from '../../constants';
import { executeQuery } from '../../api/gremlinApi';
import { onFetchQuery } from '../../logics/actionHelper';
import {
  getQueryFailureFeedback,
  getQueryResultStatus,
  isQueryTooLong
} from '../../logics/queryFeedback';

const DEMO_QUERY = 'g.V().limit(25)';

export class Header extends React.Component {
  clearGraph() {
    this.props.dispatch({ type: ACTIONS.CLEAR_GRAPH });
    this.props.dispatch({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'idle', message: 'Graph cleared. Query history is still available for reruns.' }
    });
  }

  sendQuery() {
    const query = this.props.query.trim();
    if (!query) {
      this.props.dispatch({ type: ACTIONS.SET_ERROR, payload: EMPTY_GREMLIN_QUERY_ERROR });
      return;
    }
    if (isQueryTooLong(query)) {
      this.props.dispatch({ type: ACTIONS.SET_ERROR, payload: TOO_LONG_GREMLIN_QUERY_ERROR });
      return;
    }

    this.props.dispatch({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'running', message: QUERY_RUNNING_MESSAGE }
    });
    executeQuery({ query, nodeLimit: this.props.nodeLimit }).then((response) => {
      const summary = onFetchQuery(response, query, this.props.nodeLabels, this.props.dispatch);
      const resultStatus = getQueryResultStatus(summary);
      this.props.dispatch({
        type: ACTIONS.SET_QUERY_STATUS,
        payload: resultStatus
      });
    }).catch((error) => {
      console.error('Error sending query:', error);
      const feedback = getQueryFailureFeedback(error);
      this.props.dispatch({ type: ACTIONS.SET_ERROR, payload: `${feedback.title}. ${feedback.message}` });
    });
  }

  onQueryChanged(query) {
    this.props.dispatch({ type: ACTIONS.SET_QUERY, payload: query });
  }

  onSubmit(event) {
    event.preventDefault();
    this.sendQuery();
  }

  useDemoQuery() {
    this.onQueryChanged(DEMO_QUERY);
    this.props.dispatch({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'idle', message: 'Demo traversal loaded. Execute it to refresh the graph.' }
    });
  }

  render(){
    const isExecuting = this.props.queryStatus === 'running';
    return (
      <div className={'header'}>
        <div className="header__topline">
          <div>
            <h1 className="header__title">Cosmos Graph Visualizer</h1>
            <p className="header__subtitle">Cosmos graph exploration console</p>
          </div>
          <div className="header__meta" aria-label="Graph summary">
            <span className="metric-pill">
              <span className="metric-pill__value">{this.props.nodes.length}</span>
              <span className="metric-pill__label">Nodes</span>
            </span>
            <span className="metric-pill">
              <span className="metric-pill__value">{this.props.edges.length}</span>
              <span className="metric-pill__label">Edges</span>
            </span>
          </div>
        </div>

        <form noValidate autoComplete="off" className="query-form" onSubmit={this.onSubmit.bind(this)}>
          <TextField
            value={this.props.query}
            onChange={(event => this.onQueryChanged(event.target.value))}
            id="gremlin-query"
            label="Gremlin query"
            className="query-field"
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={isExecuting}
            className="query-button query-button--execute"
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={this.clearGraph.bind(this)}
            className="query-button query-button--clear"
          >
            Clear Graph
          </Button>
        </form>

        <div className={`query-status query-status--${this.props.queryStatus}`} role="status">
          <span>{this.props.queryStatusMessage}</span>
          <Button
            variant="text"
            size="small"
            onClick={this.useDemoQuery.bind(this)}
            className="query-status__demo"
          >
            Use demo query
          </Button>
        </div>

        {this.props.error && <div className="error-banner" role="alert">{this.props.error}</div>}
      </div>

    );
  }
}

export const HeaderComponent = connect((state)=>{
  return {
    query: state.gremlin.query,
    error: state.gremlin.error,
    queryStatus: state.gremlin.queryStatus,
    queryStatusMessage: state.gremlin.queryStatusMessage,
    nodes: state.graph.nodes,
    edges: state.graph.edges,
    nodeLabels: state.options.nodeLabels,
    nodeLimit: state.options.nodeLimit
  };
})(Header);
