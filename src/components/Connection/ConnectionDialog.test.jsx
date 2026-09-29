import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionDialog } from './ConnectionDialog';

const baseProps = {
  open: true,
  connection: {
    mode: 'cosmos',
    endpointHost: 'account.gremlin.cosmos.azure.com',
    database: 'db',
    container: 'graph',
    partitionKey: 'type'
  },
  switching: false,
  error: null,
  probeDiagnostics: null,
  onClose: vi.fn(),
  onSubmit: vi.fn()
};

const installSynchronousState = (dialog) => {
  dialog.setState = (update) => {
    const patch = typeof update === 'function' ? update(dialog.state, dialog.props) : update;
    dialog.state = { ...dialog.state, ...patch };
  };
  return dialog;
};

const collectElements = (node, matches = []) => {
  if (!React.isValidElement(node)) {
    return matches;
  }
  matches.push(node);
  React.Children.forEach(node.props.children, child => collectElements(child, matches));
  return matches;
};

describe('connection dialog', () => {
  it('renders every connection field, protects the key, and prefills only sanitized values', () => {
    const dialog = new ConnectionDialog(baseProps);
    const elements = collectElements(dialog.render());
    const fields = elements.filter(element => element.props && element.props.name);

    expect(fields.map(field => field.props.name)).toEqual([
      'endpoint',
      'primaryKey',
      'database',
      'container',
      'partitionKey'
    ]);
    expect(fields.find(field => field.props.name === 'primaryKey').props.type).toBe('password');
    expect(dialog.state).toMatchObject({
      endpoint: 'wss://account.gremlin.cosmos.azure.com:443/',
      primaryKey: '',
      database: 'db',
      container: 'graph',
      partitionKey: 'type'
    });
  });

  it('clears the primary key on dismissal while retaining non-secret corrections', () => {
    const onClose = vi.fn();
    const dialog = installSynchronousState(new ConnectionDialog({ ...baseProps, onClose }));
    dialog.state = { ...dialog.state, endpoint: 'wss://corrected.example.com:443/', primaryKey: 'secret' };

    dialog.handleClose();

    expect(dialog.state.primaryKey).toBe('');
    expect(dialog.state.endpoint).toBe('wss://corrected.example.com:443/');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ['successful', vi.fn().mockResolvedValue({})],
    ['failed', vi.fn().mockRejectedValue(new Error('probe failed'))]
  ])('submits credentials once and clears the key after a %s probe', async (_label, onSubmit) => {
    const dialog = installSynchronousState(new ConnectionDialog({ ...baseProps, onSubmit }));
    dialog.state = { ...dialog.state, primaryKey: 'one-shot-secret' };

    await dialog.handleSubmit({ preventDefault: vi.fn() });

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      primaryKey: 'one-shot-secret',
      database: 'db',
      container: 'graph',
      partitionKey: 'type'
    }));
    expect(dialog.state.primaryKey).toBe('');
  });

  it('describes successful and charged failed probes without exposing credentials', () => {
    const success = new ConnectionDialog({
      ...baseProps,
      probeDiagnostics: { requestCharge: { total: 2.345 } }
    });
    const failure = new ConnectionDialog({
      ...baseProps,
      error: 'Connection probe failed',
      probeDiagnostics: { requestCharge: { total: 1.2 } }
    });

    expect(success.getProbeMessage()).toBe('Connection verified - 2.35 RUs');
    expect(failure.getProbeMessage()).toBe('Connection failed after 1.20 RUs');
  });
});
