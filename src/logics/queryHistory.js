// Shell-style history recall: only cycles from an empty editor or an unedited recalled entry.
export const stepHistory = ({ history, cursor, draft, editorValue }, direction) => {
  if (history.length === 0) {
    return null;
  }

  if (cursor === null) {
    if (direction !== 'up' || editorValue !== '') {
      return null;
    }
    return { cursor: history.length - 1, value: history[history.length - 1] };
  }

  if (cursor < 0 || cursor >= history.length || history[cursor] !== editorValue) {
    return null;
  }

  if (direction === 'up') {
    const next = Math.max(0, cursor - 1);
    return { cursor: next, value: history[next] };
  }
  if (cursor === history.length - 1) {
    return { cursor: null, value: draft };
  }
  return { cursor: cursor + 1, value: history[cursor + 1] };
};
