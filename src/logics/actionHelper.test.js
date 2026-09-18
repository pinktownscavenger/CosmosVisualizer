import { describe, expect, it, vi } from 'vitest';
import { ACTIONS } from '../constants';
import { onFetchQuery } from './actionHelper';
import { normalizedGraph } from '../__fixtures__/graphFixtures';

describe('query action helper', () => {
  it('dispatches graph updates and returns a result summary for status copy', () => {
    const dispatch = vi.fn();

    const summary = onFetchQuery(
      { data: normalizedGraph },
      'g.V()',
      [],
      dispatch
    );

    expect(summary).toEqual({ nodes: 4, edges: 9 });
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: 'g.V()'
    });
  });
});
