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
import { ACTIONS } from '../../constants';
import { applyGraphControl } from '../../logics/graphControls';

class NetworkGraph extends React.Component{
  constructor(props) {
    super(props);
    this.networkRef = React.createRef();
  }

  componentDidMount() {
    const data = {
      nodes: this.props.nodeHolder,
      edges: this.props.edgeHolder
    };
    const network = new vis.Network(this.networkRef.current, data, this.props.networkOptions);
    this.network = network;

    network.on('stabilized', () => {
      network.stopSimulation();
    });

    network.on('selectNode', (params) => {
      const nodeId = params.nodes && params.nodes.length > 0 ? params.nodes[0] : null;
      this.props.dispatch({ type: ACTIONS.SET_SELECTED_NODE, payload: nodeId });
    });

    network.on("selectEdge", (params) => {
      const edgeId = params.edges && params.edges.length === 1 ? params.edges[0] : null;
      const isNodeSelected = params.nodes && params.nodes.length > 0;
      if (!isNodeSelected && edgeId !== null) {
        this.props.dispatch({ type: ACTIONS.SET_SELECTED_EDGE, payload: edgeId });
      }
    });

    this.props.dispatch({ type: ACTIONS.SET_NETWORK, payload: network });
  }

  componentWillUnmount() {
    if (this.network) {
      this.network.destroy();
    }
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
        </div>
        <p className="graph-hint">Click a node or edge to inspect it, then traverse from the selected node.</p>
        <div ref={this.networkRef} className={'mynetwork'} />
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
    networkOptions: state.options.networkOptions
  };
})(NetworkGraph);
