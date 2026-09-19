import React from 'react';
import { connect } from 'react-redux';
import {
  ExpansionPanel,
  ExpansionPanelSummary,
  Typography,
  ExpansionPanelDetails,
  List,
  ListItem,
  ListItemText,
  TextField,
  Fab,
  IconButton,
  Button,
  ButtonGroup,
  Grid,
  Table,
  TableBody,
  TableRow,
  TableCell,
  FormControlLabel,
  Switch,
  Divider,
  Tooltip
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import RefreshIcon from '@material-ui/icons/Refresh';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import CloseIcon from '@material-ui/icons/Close';
import { JsonToTable } from 'react-json-to-table';
import { ACTIONS } from '../../constants';
import { executeQuery } from '../../api/gremlinApi';
import { onFetchQuery} from '../../logics/actionHelper';
import { getQueryFailureFeedback, getQueryResultStatus } from '../../logics/queryFeedback';
import { stringifyObjectValues} from '../../logics/utils';
import { getSelectedResultPayload } from '../../logics/selectedResult';

export const QueryHistoryList = ({ queries, onRunQuery, onLoadQuery, onClearHistory }) => {
  if (queries.length === 0) {
    return <p className="details__empty">No queries have been executed yet.</p>;
  }

  return (
    <div className="query-history">
      <List dense={true} className="details__list query-history__list">
        {queries.map((value, index) => (
          <ListItem key={`${value}-${index}`} className="query-history__item">
            <ListItemText
              primary={value}
              primaryTypographyProps={{ component: 'code' }}
            />
            <div className="query-history__actions">
              <Button size="small" onClick={() => onRunQuery(value)} aria-label={`Run query ${index + 1}`}>
                Run
              </Button>
              <Button size="small" onClick={() => onLoadQuery(value)} aria-label={`Load query ${index + 1}`}>
                Load
              </Button>
            </div>
          </ListItem>
        ))}
      </List>
      <Button
        variant="text"
        size="small"
        color="secondary"
        onClick={onClearHistory}
        className="query-history__clear"
      >
        Clear History
      </Button>
    </div>
  );
};

export const SelectedResultPanel = ({
  selectedResult,
  selectedResultViewMode,
  onViewModeChanged,
  onTraverse,
  onCloseMobileInspector
}) => {
  const hasSelected = selectedResult !== null;
  const selectedHeader = hasSelected ? selectedResult.kind[0].toUpperCase() + selectedResult.kind.slice(1) : null;
  const selectedProperties = hasSelected ? stringifyObjectValues(selectedResult.properties) : {};
  const panelClassName = hasSelected ? 'selected-panel selected-panel--mobile-sheet' : 'selected-panel';

  return (
    <section className={panelClassName}>
      <div className="selected-panel__header">
        <div>
          <h2 className="selected-panel__title">{hasSelected ? `Selected ${selectedHeader}` : 'Selected Result'}</h2>
          {!hasSelected && <p className="selected-panel__hint">Choose a node or edge to inspect its details.</p>}
          {hasSelected &&
          <span className="selected-panel__badge">{String(selectedResult.type)}</span>
          }
        </div>
        {hasSelected &&
        <Tooltip title="Close selected result">
          <IconButton
            aria-label="Close selected result"
            size="small"
            onClick={onCloseMobileInspector}
            className="selected-panel__close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        }
        <ButtonGroup className="selected-panel__view-toggle" size="small" aria-label="Selected result view mode">
          <Button
            variant={selectedResultViewMode === 'table' ? 'contained' : 'outlined'}
            color="primary"
            onClick={() => onViewModeChanged('table')}
            aria-pressed={selectedResultViewMode === 'table'}
            disabled={!hasSelected}
          >
            Table
          </Button>
          <Button
            variant={selectedResultViewMode === 'json' ? 'contained' : 'outlined'}
            color="primary"
            onClick={() => onViewModeChanged('json')}
            aria-pressed={selectedResultViewMode === 'json'}
            disabled={!hasSelected}
          >
            JSON
          </Button>
        </ButtonGroup>
      </div>
      {hasSelected && selectedResult.kind === 'node' &&
      <Grid item xs={12} sm={12} md={12} className="selected-panel__actions">
        <Grid container spacing={2}>
          <Grid item xs={6} sm={6} md={6}>
            <Fab variant="extended" size="small" onClick={() => onTraverse(selectedResult.id, 'out')}>
              Traverse Out Edges
              <ArrowForwardIcon/>
            </Fab>
          </Grid>
          <Grid item xs={6} sm={6} md={6}>
            <Fab variant="extended" size="small" onClick={() => onTraverse(selectedResult.id, 'in')}>
              Traverse In Edges
              <ArrowBackIcon/>
            </Fab>
          </Grid>
        </Grid>
      </Grid>
      }
      {!hasSelected &&
      <p className="selected-panel__empty">No graph result is selected yet.</p>
      }
      {hasSelected &&
      <Grid item xs={12} sm={12} md={12}>
        {selectedResultViewMode === 'table' &&
        <Grid container className="selected-panel__table">
          <Table aria-label="Selected result table">
            <TableBody>
              <TableRow key={'type'}>
                <TableCell scope="row">Type</TableCell>
                <TableCell align="left">{String(selectedResult.type)}</TableCell>
              </TableRow>
              <TableRow key={'id'}>
                <TableCell scope="row">ID</TableCell>
                <TableCell align="left">{String(selectedResult.id)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <JsonToTable json={selectedProperties}/>
        </Grid>
        }
        {selectedResultViewMode === 'json' &&
        <pre className="selected-panel__json">{JSON.stringify(selectedResult, null, 2)}</pre>
        }
      </Grid>
      }
    </section>
  );
};

export class Details extends React.Component {

  onAddNodeLabel() {
    this.props.dispatch({ type: ACTIONS.ADD_NODE_LABEL });
  }

  onEditNodeLabel(index, nodeLabel) {
    this.props.dispatch({ type: ACTIONS.EDIT_NODE_LABEL, payload: { id: index, nodeLabel } });
  }

  onRemoveNodeLabel(index) {
    this.props.dispatch({ type: ACTIONS.REMOVE_NODE_LABEL, payload: index });
  }

  onEditNodeLimit(limit) {
    this.props.dispatch({ type: ACTIONS.SET_NODE_LIMIT, payload: limit });
  }

  onRefresh() {
    this.props.dispatch({ type: ACTIONS.REFRESH_NODE_LABELS, payload: this.props.nodeLabels });
  }

  onTraverse(nodeId, direction) {
    const query = `g.V('${nodeId}').${direction}()`;
    executeQuery({ query, nodeLimit: this.props.nodeLimit }).then((response) => {
      onFetchQuery(response, query, this.props.nodeLabels, this.props.dispatch);
    }).catch((error) => {
      this.props.dispatch({ type: ACTIONS.SET_ERROR, payload: COMMON_GREMLIN_ERROR });
    });
  }

  onTogglePhysics(enabled){
    this.props.dispatch({ type: ACTIONS.SET_IS_PHYSICS_ENABLED, payload: enabled });
    if (this.props.network) {
      const physics = enabled ? this.props.networkOptions.physics : false;
      const edges = {
        smooth: {
          type: 'continuous'
        }
      };
      this.props.network.setOptions( { physics, edges } );
      if (!enabled) {
        this.props.network.stopSimulation();
      }
    }
  }

  onSelectedResultViewModeChanged(selectedResultViewMode) {
    this.props.dispatch({ type: ACTIONS.SET_SELECTED_RESULT_VIEW_MODE, payload: selectedResultViewMode });
  }

  onLoadQuery(query) {
    this.props.dispatch({ type: ACTIONS.SET_QUERY, payload: query });
    this.props.dispatch({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'idle', message: 'History query loaded. Execute it to refresh the Cosmos graph.' }
    });
  }

  onRunQuery(query) {
    this.props.dispatch({ type: ACTIONS.SET_QUERY, payload: query });
    this.props.dispatch({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'running', message: 'Executing Gremlin traversal...' }
    });
    return executeQuery({ query, nodeLimit: this.props.nodeLimit }).then((response) => {
      const summary = onFetchQuery(response, query, this.props.nodeLabels, this.props.dispatch);
      this.props.dispatch({
        type: ACTIONS.SET_QUERY_STATUS,
        payload: getQueryResultStatus(summary)
      });
    }).catch((error) => {
      const feedback = getQueryFailureFeedback(error);
      this.props.dispatch({ type: ACTIONS.SET_ERROR, payload: `${feedback.title}. ${feedback.message}` });
    });
  }

  onClearHistory() {
    this.props.dispatch({ type: ACTIONS.CLEAR_QUERY_HISTORY });
  }

  onCloseMobileInspector() {
    this.props.dispatch({ type: ACTIONS.SET_SELECTED_NODE, payload: null });
    this.props.dispatch({ type: ACTIONS.SET_SELECTED_EDGE, payload: null });
  }

  generateNodeLabelList(nodeLabels) {
    return nodeLabels.map((nodeLabel, index) => (
        <ListItem key={index}>
          <div className="details__label-row">
            <TextField id={`node-type-${index}`} label="Node Type" InputLabelProps={{ shrink: true }} value={nodeLabel.type} onChange={event => {
              const type = event.target.value;
              const field = nodeLabel.field;
              this.onEditNodeLabel(index, { type, field })
            }}
            />
            <TextField id={`label-field-${index}`} label="Label Field" InputLabelProps={{ shrink: true }} value={nodeLabel.field} onChange={event => {
              const field = event.target.value;
              const type = nodeLabel.type;
              this.onEditNodeLabel(index, { type, field })
            }}/>
            <IconButton aria-label={`Remove node label ${index + 1}`} size="small" onClick={() => this.onRemoveNodeLabel(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </div>
        </ListItem>
    ));
  }

  render(){
    const selectedResult = getSelectedResultPayload(this.props.selectedNode, this.props.selectedEdge);

    return (
      <div className={'details'}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={12} md={12}>
            <ExpansionPanel className="details__section">
              <ExpansionPanelSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="query-history-content"
                id="query-history-header"
              >
                <Typography className="details__heading">Query History</Typography>
              </ExpansionPanelSummary>
              <ExpansionPanelDetails>
                <QueryHistoryList
                  queries={this.props.queryHistory}
                  onRunQuery={this.onRunQuery.bind(this)}
                  onLoadQuery={this.onLoadQuery.bind(this)}
                  onClearHistory={this.onClearHistory.bind(this)}
                />
              </ExpansionPanelDetails>
            </ExpansionPanel>
            <ExpansionPanel className="details__section" defaultExpanded>
              <ExpansionPanelSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="settings-content"
                id="settings-header"
              >
                <Typography className="details__heading">Settings</Typography>
              </ExpansionPanelSummary>
              <ExpansionPanelDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={12} md={12}>
                    <Tooltip title="Automatically stabilize the graph" aria-label="Physics setting">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={this.props.isPhysicsEnabled}
                          onChange={() => { this.onTogglePhysics(!this.props.isPhysicsEnabled); }}
                          value="physics"
                          color="primary"
                        />
                      }
                      label="Enable Physics"
                    />
                    </Tooltip>
                    <Divider />
                  </Grid>
                  <Grid item xs={12} sm={12} md={12}>
                    <Tooltip title="Number of maximum nodes returned from the query. Empty or 0 has no restriction." aria-label="Node limit setting">
                      <TextField label="Node Limit" type="Number" value={this.props.nodeLimit} onChange={event => {
                        const limit = event.target.value;
                        this.onEditNodeLimit(limit)
                      }} />
                    </Tooltip>

                  </Grid>
                  <Grid item xs={12} sm={12} md={12}>
                    <Divider />
                  </Grid>
                  <Grid item xs={12} sm={12} md={12}>
                    <Typography className="details__heading">Node Labels</Typography>
                    <p className="details__subheading">Choose which property is shown for each node type.</p>
                  </Grid>
                  <Grid item xs={12} sm={12} md={12}>
                    <List dense={true} className="details__list">
                      {this.generateNodeLabelList(this.props.nodeLabels)}
                    </List>
                  </Grid>
                  <Grid item xs={12} sm={12} md={12} className="details__actions">
                    <Fab variant="extended" color="primary" size="small" onClick={this.onRefresh.bind(this)}>
                      <RefreshIcon />
                      Refresh
                    </Fab>
                    <Fab variant="extended" size="small" onClick={this.onAddNodeLabel.bind(this)}>
                      <AddIcon />
                      Add Node Label
                    </Fab>
                  </Grid>
                </Grid>
              </ExpansionPanelDetails>
            </ExpansionPanel>
          </Grid>
          <Grid item xs={12} sm={12} md={12}>
            <SelectedResultPanel
              selectedResult={selectedResult}
              selectedResultViewMode={this.props.selectedResultViewMode}
              onViewModeChanged={this.onSelectedResultViewModeChanged.bind(this)}
              onTraverse={this.onTraverse.bind(this)}
              onCloseMobileInspector={this.onCloseMobileInspector.bind(this)}
            />
          </Grid>
        </Grid>
      </div>
    );
  }
}

export const DetailsComponent = connect((state)=>{
  return {
    network: state.graph.network,
    selectedNode: state.graph.selectedNode,
    selectedEdge: state.graph.selectedEdge,
    queryHistory: state.options.queryHistory,
    nodeLabels: state.options.nodeLabels,
    nodeLimit: state.options.nodeLimit,
    isPhysicsEnabled: state.options.isPhysicsEnabled,
    selectedResultViewMode: state.options.selectedResultViewMode,
    networkOptions: state.options.networkOptions
  };
})(Details);
