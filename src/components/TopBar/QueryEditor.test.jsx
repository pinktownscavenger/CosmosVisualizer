import React from 'react';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryEditor } from './QueryEditor';
import { mount, unmountAll } from './testUtils';

afterEach(unmountAll);

const renderEditor = (props) => {
  const handlers = { onChange: vi.fn(), onSubmit: vi.fn(), onHistoryStep: vi.fn(() => null) };
  const root = mount(<QueryEditor value="" disabled={false} {...handlers} {...props} />);
  return { textarea: root.querySelector('textarea'), ...handlers, ...props };
};

describe('query editor', () => {
  it('shows the placeholder query', () => {
    const { textarea } = renderEditor();
    expect(textarea.getAttribute('placeholder')).toBe("g.V().has('type', 'project').limit(25)");
  });

  it.each([['metaKey'], ['ctrlKey']])('submits on Enter with %s', (modifier) => {
    const { textarea, onSubmit } = renderEditor({ value: 'g.V()' });
    Simulate.keyDown(textarea, { key: 'Enter', [modifier]: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit on plain Enter', () => {
    const { textarea, onSubmit } = renderEditor({ value: 'g.V()' });
    Simulate.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit from the keyboard while disabled', () => {
    const { textarea, onSubmit } = renderEditor({ value: 'g.V()', disabled: true });
    Simulate.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('steps history on ArrowUp when the caret is on the first line', () => {
    const { textarea, onHistoryStep } = renderEditor({ value: '' });
    textarea.setSelectionRange(0, 0);
    Simulate.keyDown(textarea, { key: 'ArrowUp' });
    expect(onHistoryStep).toHaveBeenCalledWith('up');
  });

  it('leaves ArrowUp to the textarea when the caret is below the first line', () => {
    const { textarea, onHistoryStep } = renderEditor({ value: 'g.V()\n.out()' });
    textarea.setSelectionRange(8, 8);
    Simulate.keyDown(textarea, { key: 'ArrowUp' });
    expect(onHistoryStep).not.toHaveBeenCalled();
  });

  it('steps history on ArrowDown only from the last line', () => {
    const { textarea, onHistoryStep } = renderEditor({ value: 'g.V()\n.out()' });
    textarea.setSelectionRange(2, 2);
    Simulate.keyDown(textarea, { key: 'ArrowDown' });
    expect(onHistoryStep).not.toHaveBeenCalled();
    textarea.setSelectionRange(9, 9);
    Simulate.keyDown(textarea, { key: 'ArrowDown' });
    expect(onHistoryStep).toHaveBeenCalledWith('down');
  });

  it('grows with the line count up to six rows', () => {
    expect(renderEditor({ value: 'g.V()' }).textarea.getAttribute('rows')).toBe('1');
    expect(renderEditor({ value: 'a\nb\nc' }).textarea.getAttribute('rows')).toBe('3');
    expect(renderEditor({ value: 'a\nb\nc\nd\ne\nf\ng\nh' }).textarea.getAttribute('rows')).toBe('6');
  });
});
