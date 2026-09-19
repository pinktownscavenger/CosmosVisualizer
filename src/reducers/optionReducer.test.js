import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../constants';
import { reducer } from './optionReducer';

describe('option reducer', () => {
  it('tracks and clears query history', () => {
    const withFirstQuery = reducer(undefined, {
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: 'g.V()'
    });
    const withSecondQuery = reducer(withFirstQuery, {
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: "g.V('person-1').out()"
    });

    expect(withSecondQuery.queryHistory).toEqual(['g.V()', "g.V('person-1').out()"]);
    expect(reducer(withSecondQuery, { type: ACTIONS.CLEAR_QUERY_HISTORY }).queryHistory).toEqual([]);
  });

  it('edits node labels by index', () => {
    const state = reducer(undefined, {
      type: ACTIONS.SET_NODE_LABELS,
      payload: [{ type: 'person', field: 'name' }]
    });

    expect(reducer(state, {
      type: ACTIONS.EDIT_NODE_LABEL,
      payload: { id: 0, nodeLabel: { type: 'person', field: 'aliases' } }
    }).nodeLabels).toEqual([{ type: 'person', field: 'aliases' }]);
  });

  it('stores node limit values', () => {
    expect(reducer(undefined, {
      type: ACTIONS.SET_NODE_LIMIT,
      payload: '25'
    }).nodeLimit).toBe('25');
  });

  it('defaults the selected result view mode to table', () => {
    expect(reducer(undefined, { type: 'UNKNOWN' }).selectedResultViewMode).toBe('table');
  });

  it('stores selected result view mode values', () => {
    const jsonState = reducer(undefined, {
      type: ACTIONS.SET_SELECTED_RESULT_VIEW_MODE,
      payload: 'json'
    });

    expect(jsonState.selectedResultViewMode).toBe('json');
    expect(reducer(jsonState, {
      type: ACTIONS.SET_SELECTED_RESULT_VIEW_MODE,
      payload: 'table'
    }).selectedResultViewMode).toBe('table');
  });

  it('ignores invalid selected result view mode values', () => {
    const jsonState = reducer(undefined, {
      type: ACTIONS.SET_SELECTED_RESULT_VIEW_MODE,
      payload: 'json'
    });

    expect(reducer(jsonState, {
      type: ACTIONS.SET_SELECTED_RESULT_VIEW_MODE,
      payload: 'card'
    })).toBe(jsonState);
  });

  it('keeps existing defaults for optional payload actions', () => {
    expect(reducer(undefined, {
      type: ACTIONS.SET_IS_PHYSICS_ENABLED
    }).isPhysicsEnabled).toBe(true);
    expect(reducer(undefined, {
      type: ACTIONS.SET_IS_PHYSICS_ENABLED,
      payload: null
    }).isPhysicsEnabled).toBe(null);
    expect(reducer(undefined, {
      type: ACTIONS.SET_NODE_LABELS
    }).nodeLabels).toEqual([]);
  });

  it('gives tag-shaped nodes enough label padding for the Production demo node', () => {
    const tagGroup = reducer(undefined, { type: 'UNKNOWN' }).networkOptions.groups.tag;

    expect(tagGroup.shape).toBe('box');
    expect(tagGroup.margin.left).toBeGreaterThanOrEqual(14);
    expect(tagGroup.margin.right).toBeGreaterThanOrEqual(14);
  });
});
