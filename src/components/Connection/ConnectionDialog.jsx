import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField
} from '@material-ui/core';

const stateFromConnection = (connection) => ({
  endpoint: connection && connection.mode === 'cosmos' && connection.endpointHost
    ? `wss://${connection.endpointHost}:443/`
    : '',
  primaryKey: '',
  database: connection && connection.mode === 'cosmos' ? connection.database || '' : '',
  container: connection && connection.mode === 'cosmos' ? connection.container || '' : '',
  partitionKey: connection ? connection.partitionKey || '' : ''
});

export class ConnectionDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = stateFromConnection(props.connection);
  }

  componentDidUpdate(previousProps) {
    if (!previousProps.open && this.props.open) {
      this.setState(stateFromConnection(this.props.connection));
    }
  }

  handleChange(field, event) {
    this.setState({ [field]: event.target.value });
  }

  handleClose() {
    this.setState({ primaryKey: '' });
    this.props.onClose();
  }

  async handleSubmit(event) {
    event.preventDefault();
    const config = {
      endpoint: this.state.endpoint.trim(),
      primaryKey: this.state.primaryKey,
      database: this.state.database.trim(),
      container: this.state.container.trim(),
      partitionKey: this.state.partitionKey.trim()
    };

    try {
      await this.props.onSubmit(config);
    } catch (_) {
      // The connection reducer owns the safe, user-facing failure state.
    } finally {
      this.setState({ primaryKey: '' });
    }
  }

  getProbeMessage() {
    const charge = this.props.probeDiagnostics
      && this.props.probeDiagnostics.requestCharge
      && this.props.probeDiagnostics.requestCharge.total;
    if (!Number.isFinite(charge)) {
      return null;
    }
    return this.props.error
      ? `Connection failed after ${charge.toFixed(2)} RUs`
      : `Connection verified - ${charge.toFixed(2)} RUs`;
  }

  render() {
    const probeMessage = this.getProbeMessage();
    const fieldProps = {
      fullWidth: true,
      required: true,
      variant: 'outlined',
      disabled: this.props.switching,
      InputLabelProps: { shrink: true }
    };

    return (
      <Dialog
        className="connection-dialog"
        open={this.props.open}
        onClose={this.props.switching ? undefined : this.handleClose.bind(this)}
        aria-labelledby="connection-dialog-title"
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={this.handleSubmit.bind(this)} autoComplete="off">
          <DialogTitle id="connection-dialog-title">Switch Cosmos connection</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Credentials stay in this browser form only long enough to verify the connection.
              They are not saved by CosmosVisualizer.
            </DialogContentText>
            <div className="connection-dialog__fields">
              <TextField
                {...fieldProps}
                autoFocus
                id="connection-endpoint"
                name="endpoint"
                label="Gremlin endpoint"
                type="url"
                value={this.state.endpoint}
                onChange={this.handleChange.bind(this, 'endpoint')}
                placeholder="wss://account.gremlin.cosmos.azure.com:443/"
              />
              <TextField
                {...fieldProps}
                id="connection-primary-key"
                name="primaryKey"
                label="Primary key"
                type="password"
                autoComplete="new-password"
                value={this.state.primaryKey}
                onChange={this.handleChange.bind(this, 'primaryKey')}
              />
              <TextField
                {...fieldProps}
                id="connection-database"
                name="database"
                label="Database"
                value={this.state.database}
                onChange={this.handleChange.bind(this, 'database')}
              />
              <TextField
                {...fieldProps}
                id="connection-container"
                name="container"
                label="Container"
                value={this.state.container}
                onChange={this.handleChange.bind(this, 'container')}
              />
              <TextField
                {...fieldProps}
                id="connection-partition-key"
                name="partitionKey"
                label="Partition-key property"
                value={this.state.partitionKey}
                onChange={this.handleChange.bind(this, 'partitionKey')}
                helperText="Enter the vertex property name, for example type."
              />
            </div>
            {probeMessage && (
              <div className={this.props.error ? 'connection-dialog__probe connection-dialog__probe--error' : 'connection-dialog__probe'} role="status">
                {probeMessage}
              </div>
            )}
            {this.props.error && <div className="connection-dialog__error" role="alert">{this.props.error}</div>}
          </DialogContent>
          <DialogActions>
            <Button onClick={this.handleClose.bind(this)} disabled={this.props.switching}>
              Close
            </Button>
            <Button type="submit" color="primary" variant="contained" disabled={this.props.switching}>
              {this.props.switching ? 'Verifying...' : 'Verify and switch'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    );
  }
}
