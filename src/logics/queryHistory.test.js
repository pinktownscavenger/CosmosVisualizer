import { describe, expect, it } from 'vitest';
import { stepHistory } from './queryHistory';

const history = ['q1', 'q2', 'q3'];

describe('history cycling', () => {
  it('starts at the newest entry from an empty editor', () => {
    expect(stepHistory({ history, cursor: null, draft: '', editorValue: '' }, 'up')).toEqual({ cursor: 2, value: 'q3' });
  });

  it('moves to older entries and stops at the oldest', () => {
    expect(stepHistory({ history, cursor: 2, draft: '', editorValue: 'q3' }, 'up')).toEqual({ cursor: 1, value: 'q2' });
    expect(stepHistory({ history, cursor: 0, draft: '', editorValue: 'q1' }, 'up')).toEqual({ cursor: 0, value: 'q1' });
  });

  it('moves down and restores the draft past the newest entry', () => {
    expect(stepHistory({ history, cursor: 0, draft: '', editorValue: 'q1' }, 'down')).toEqual({ cursor: 1, value: 'q2' });
    expect(stepHistory({ history, cursor: 2, draft: 'typed', editorValue: 'q3' }, 'down')).toEqual({ cursor: null, value: 'typed' });
  });

  it('does nothing when pressing down without cycling', () => {
    expect(stepHistory({ history, cursor: null, draft: '', editorValue: '' }, 'down')).toBeNull();
  });

  it('stops cycling once the recalled entry is edited', () => {
    expect(stepHistory({ history, cursor: 1, draft: '', editorValue: 'q2 edited' }, 'up')).toBeNull();
  });

  it('does not start cycling over typed text', () => {
    expect(stepHistory({ history, cursor: null, draft: '', editorValue: 'something' }, 'up')).toBeNull();
  });

  it('does nothing with empty history or a stale cursor', () => {
    expect(stepHistory({ history: [], cursor: null, draft: '', editorValue: '' }, 'up')).toBeNull();
    expect(stepHistory({ history: ['q1'], cursor: 2, draft: '', editorValue: 'q3' }, 'up')).toBeNull();
  });
});
