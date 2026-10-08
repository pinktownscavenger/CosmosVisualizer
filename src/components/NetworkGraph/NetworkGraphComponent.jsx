import React from 'react';
import {connect} from 'react-redux';
import vis from 'vis-network';
import { IconButton, Tooltip } from '@material-ui/core';
import CenterFocusStrongIcon from '@material-ui/icons/CenterFocusStrong';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import PauseCircleFilledIcon from '@material-ui/icons/PauseCircleFilled';
import PlayCircleFilledIcon from '@material-ui/icons/PlayCircleFilled';
import RestoreIcon from '@material-ui/icons/Restore';
import ZoomInIcon from '@material-ui/icons/ZoomIn';
import ZoomOutIcon from '@material-ui/icons/ZoomOut';
import CloseIcon from '@material-ui/icons/Close';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import { ACTIONS } from '../../constants';
import { applyGraphControl } from '../../logics/graphControls';
import InspectorCard from '../Inspector/InspectorCard';
import { GraphLegend } from './GraphLegend';
import { changeColorMode } from '../../logics/graphOperations';

export const GraphHint = ({ visible, onDismiss }) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="graph-hint">
      <span>Click a node or edge to inspect it, then traverse from the selected node.</span>
      <Tooltip title="Dismiss hint">
        <IconButton aria-label="Dismiss graph hint" size="small" onClick={onDismiss}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </div>
  );
};

export const CanvasEmptyState = ({ connectionStatus, loading, onConnect }) => {
  if (loading) {
    return null;
  }
  if (connectionStatus !== 'connected') {
    return (
      <div className="canvas-empty">
        <p className="canvas-empty__title">Connect to Cosmos DB</p>
        <p className="canvas-empty__hint">Choose a Gremlin account, database and container to explore.</p>
        <button type="button" className="canvas-empty__action" onClick={onConnect}>Connect</button>
      </div>
    );
  }
  return (
    <div className="canvas-empty">
      <p className="canvas-empty__title">Run a query to load your graph</p>
      <p className="canvas-empty__hint">Nothing runs until you ask, so no RUs are spent on startup.</p>
    </div>
  );
};

export const clearGraph = (dispatch) => {
  dispatch({ type: ACTIONS.CLEAR_GRAPH });
  dispatch({ type: ACTIONS.CLEAR_OPERATION_DIAGNOSTICS });
  dispatch({
    type: ACTIONS.SET_QUERY_STATUS,
    payload: { status: 'idle', message: 'Graph cleared. Query history is still available for reruns.' }
  });
};

const GRAPH_FONT = '12px "JetBrains Mono"';

// Re-setting each label marks it dirty so vis-network measures it again; needsRefresh() alone
// only resizes the shape around the cached label width.
const remeasureNodes = (network) => {
  const dataSet = network && network.body && network.body.data && network.body.data.nodes;
  if (!dataSet) {
    return;
  }
  const labels = dataSet.get().map(({ id, label }) => ({ id, label }));
  if (labels.length > 0) {
    dataSet.update(labels);
  }
  if (typeof network.redraw === 'function') {
    network.redraw();
  }
};

// vis-network measures a label once, when its node is added. A node added before JetBrains Mono
// arrives keeps fallback-font metrics (the Production box drew its text off-centre), so request
// the font explicitly and re-measure whenever font loading finishes.
export const watchFontsForNetwork = (network, fontSet) => {
  const fonts = fontSet === undefined && typeof document !== 'undefined' ? document.fonts : fontSet;
  const onLoadingDone = () => remeasureNodes(network);
  if (fonts && typeof fonts.addEventListener === 'function') {
    fonts.addEventListener('loadingdone', onLoadingDone);
  }
  const request = fonts && typeof fonts.load === 'function' ? fonts.load(GRAPH_FONT) : Promise.resolve();
  const ready = Promise.resolve(request).catch(() => {}).then(onLoadingDone);
  return {
    ready,
    stop: () => {
      if (fonts && typeof fonts.removeEventListener === 'function') {
        fonts.removeEventListener('loadingdone', onLoadingDone);
      }
    }
  };
};

const CARD_CLEARANCE = 24;

// Only nodes actually hidden by the card (plus a small margin) are moved, and they go to the canvas centre.
export const keepNodeClearOfInspector = (network, nodeId, cardRect) => {
  if (!network || !cardRect) {
    return;
  }
  const position = network.getPositions([nodeId])[nodeId];
  if (!position) {
    return;
  }
  const { x, y } = network.canvasToDOM(position);
  const covered = x >= cardRect.left - CARD_CLEARANCE && x <= cardRect.right + CARD_CLEARANCE
    && y >= cardRect.top - CARD_CLEARANCE && y <= cardRect.bottom + CARD_CLEARANCE;
  if (covered) {
    network.moveTo({ position, animation: true });
  }
};

// Layout box of the card inside the canvas; offset* ignores the card's enter animation transform.
const inspectorCardRect = (workspace) => {
  const card = workspace && workspace.querySelector('.inspector-card');
  if (!card) {
    return null;
  }
  return {
    left: card.offsetLeft,
    top: card.offsetTop,
    right: card.offsetLeft + card.offsetWidth,
    bottom: card.offsetTop + card.offsetHeight
  };
};

// vis-network has no event for clicking empty canvas, so clear the selection on a bare click.
export const handleCanvasClick = (params, dispatch) => {
  const hasNodes = params.nodes && params.nodes.length > 0;
  const hasEdges = params.edges && params.edges.length > 0;
  if (!hasNodes && !hasEdges) {
    dispatch({ type: ACTIONS.SET_SELECTED_NODE, payload: null });
  }
};

export class NetworkGraph extends React.Component{
  constructor(props) {
    super(props);
    this.networkRef = React.createRef();
    this.state = {
      isHintDismissed: false,
      hasSelectedOnce: false
    };
  }

  componentDidMount() {
    const data = {
      nodes: this.props.nodeHolder,
      edges: this.props.edgeHolder
    };
    const network = new vis.Network(this.networkRef.current, data, this.props.networkOptions);
    this.network = network;
    this.fontWatcher = watchFontsForNetwork(network);

    network.on('stabilized', () => {
      network.stopSimulation();
    });

    network.on('selectNode', (params) => {
      const nodeId = params.nodes && params.nodes.length > 0 ? params.nodes[0] : null;
      this.props.dispatch({ type: ACTIONS.SET_SELECTED_NODE, payload: nodeId });
      this.markSelected();
      if (nodeId !== null) {
        keepNodeClearOfInspector(network, nodeId, inspectorCardRect(this.networkRef.current && this.networkRef.current.parentNode));
      }
    });

    network.on("selectEdge", (params) => {
      const edgeId = params.edges && params.edges.length === 1 ? params.edges[0] : null;
      const isNodeSelected = params.nodes && params.nodes.length > 0;
      if (!isNodeSelected && edgeId !== null) {
        this.props.dispatch({ type: ACTIONS.SET_SELECTED_EDGE, payload: edgeId });
        this.markSelected();
      }
    });

    network.on('click', (params) => handleCanvasClick(params, this.props.dispatch));

    this.props.dispatch({ type: ACTIONS.SET_NETWORK, payload: network });
  }

  componentWillUnmount() {
    if (this.fontWatcher) {
      this.fontWatcher.stop();
    }
    if (this.network) {
      this.network.destroy();
    }
  }

  markSelected() {
    if (!this.state.hasSelectedOnce) {
      this.setState({ hasSelectedOnce: true });
    }
  }

  isHintVisible() {
    return !this.state.isHintDismissed && !this.state.hasSelectedOnce;
  }

  onControl(command) {
    const network = this.props.network || this.network;
    if (command === 'physics') {
      const enabled = !this.props.isPhysicsEnabled;
      this.props.dispatch({ type: ACTIONS.SET_IS_PHYSICS_ENABLED, payload: enabled });
      applyGraphControl(network, command, {
        enabled,
        networkOptions: this.props.networkOptions
      });
      return;
    }

    applyGraphControl(network, command, {
      selectedNode: this.props.selectedNode,
      selectedEdge: this.props.selectedEdge,
      networkOptions: this.props.networkOptions
    });
  }

  render(){
    const hasSelection = Boolean(this.props.selectedNode && this.props.selectedNode.id);
    const physicsLabel = this.props.isPhysicsEnabled ? 'Pause physics' : 'Resume physics';

    return (
      <section className="graph-workspace" aria-label="Graph canvas workspace">
        <div className="graph-toolbar" aria-label="Graph controls">
          <Tooltip title="Fit graph to view">
            <IconButton aria-label="Fit graph to view" onClick={() => this.onControl('fit')}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom in">
            <IconButton aria-label="Zoom in" onClick={() => this.onControl('zoom-in')}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom out">
            <IconButton aria-label="Zoom out" onClick={() => this.onControl('zoom-out')}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={hasSelection ? 'Center selected node' : 'Select a node to center it'}>
            <span>
              <IconButton
                aria-label="Center selected node"
                disabled={!hasSelection}
                onClick={() => this.onControl('center-selection')}
              >
                <CenterFocusStrongIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Reset layout">
            <IconButton aria-label="Reset layout" onClick={() => this.onControl('reset-layout')}>
              <RestoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={physicsLabel}>
            <IconButton aria-label={physicsLabel} onClick={() => this.onControl('physics')}>
              {this.props.isPhysicsEnabled ? <PauseCircleFilledIcon fontSize="small" /> : <PlayCircleFilledIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear graph (keeps query history)">
            <span>
              <IconButton
                aria-label="Clear graph"
                className="graph-toolbar__clear"
                disabled={this.props.queryStatus === 'running'}
                onClick={() => clearGraph(this.props.dispatch)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </div>
        <div ref={this.networkRef} className={'mynetwork'} />
        <GraphLegend
          nodes={this.props.nodes}
          edgeCount={this.props.edgeCount}
          colorMode={this.props.colorMode}
          modeAssignments={this.props.colorAssignments[this.props.colorMode]}
          collapsed={this.props.legendCollapsed}
          // A result styled for the old mode would overwrite the new mode's assignments.
          modeLocked={this.props.queryStatus === 'running'}
          onModeChange={mode => changeColorMode({
            mode,
            nodes: this.props.nodes,
            colorAssignments: this.props.colorAssignments,
            dispatch: this.props.dispatch
          })}
          onToggleCollapsed={() => this.props.dispatch({ type: ACTIONS.SET_LEGEND_COLLAPSED, payload: !this.props.legendCollapsed })}
        />
        {this.props.nodeCount === 0 && this.props.queryStatus !== 'running' && (
          <CanvasEmptyState
            connectionStatus={this.props.connectionStatus}
            loading={this.props.connectionLoading}
            onConnect={() => {
              this.props.dispatch({ type: ACTIONS.RESET_CONNECTION_FEEDBACK });
              this.props.dispatch({ type: ACTIONS.OPEN_CONNECTION_DIALOG });
            }}
          />
        )}
        <GraphHint
          visible={this.isHintVisible()}
          onDismiss={() => this.setState({ isHintDismissed: true })}
        />
        <InspectorCard />
      </section>
    );
  }
}

export const NetworkGraphComponent = connect((state)=>{
  return {
    nodeHolder: state.graph.nodeHolder,
    edgeHolder: state.graph.edgeHolder,
    network: state.graph.network,
    selectedNode: state.graph.selectedNode,
    selectedEdge: state.graph.selectedEdge,
    isPhysicsEnabled: state.options.isPhysicsEnabled,
    networkOptions: state.options.networkOptions,
    nodes: state.graph.nodes,
    nodeCount: state.graph.nodes.length,
    edgeCount: state.graph.edges.length,
    queryStatus: state.gremlin.queryStatus,
    colorMode: state.options.colorMode,
    colorAssignments: state.options.colorAssignments,
    legendCollapsed: state.options.legendCollapsed,
    connectionStatus: state.connection.status,
    connectionLoading: state.connection.loading
  };
})(NetworkGraph);
