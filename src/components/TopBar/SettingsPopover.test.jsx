import React from 'react';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from './SettingsPopover';
import { mount, unmountAll } from './testUtils';

afterEach(unmountAll);

const makeProps = () => ({
  nodeLimit: 100,
  isPhysicsEnabled: true,
  nodeLabels: [{ type: 'person', field: 'name' }],
  onNodeLimitChange: vi.fn(),
  onTogglePhysics: vi.fn(),
  onAddLabel: vi.fn(),
  onEditLabel: vi.fn(),
  onRemoveLabel: vi.fn(),
  onApplyLabels: vi.fn()
});

describe('settings panel', () => {
  it('routes every control through its handler', () => {
    const props = makeProps();
    const root = mount(<SettingsPanel {...props} />);

    Simulate.change(root.querySelector('#settings-node-limit'), { target: { value: '25' } });
    Simulate.change(root.querySelector('[aria-label="Physics"]'), { target: { checked: false } });
    Simulate.change(root.querySelector('#node-type-0'), { target: { value: 'company' } });
    Simulate.change(root.querySelector('#label-field-0'), { target: { value: 'title' } });
    Simulate.click(root.querySelector('[aria-label="Remove node label 1"]'));
    Simulate.click([...root.querySelectorAll('button')].find(button => button.textContent.includes('Add')));
    Simulate.click([...root.querySelectorAll('button')].find(button => button.textContent.includes('Apply')));

    expect(props.onNodeLimitChange).toHaveBeenCalledWith('25');
    expect(props.onTogglePhysics).toHaveBeenCalledWith(false);
    expect(props.onEditLabel).toHaveBeenCalledWith(0, { type: 'company', field: 'name' });
    expect(props.onEditLabel).toHaveBeenCalledWith(0, { type: 'person', field: 'title' });
    expect(props.onRemoveLabel).toHaveBeenCalledWith(0);
    expect(props.onAddLabel).toHaveBeenCalled();
    expect(props.onApplyLabels).toHaveBeenCalled();
  });

  it('no longer offers a Refresh action', () => {
    const root = mount(<SettingsPanel {...makeProps()} />);
    expect(root.textContent).not.toContain('Refresh');
  });
});
