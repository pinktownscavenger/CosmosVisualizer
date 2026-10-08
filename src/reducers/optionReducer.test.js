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
    expect(tagGroup.margin.left).toBeGreaterThanOrEqual(20);
    expect(tagGroup.margin.right).toBeGreaterThanOrEqual(20);
    expect(tagGroup.labelHighlightBold).toBe(false);
  });

  it('starts with the inspector expanded and no history cursor', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.inspectorCollapsed).toBe(false);
    expect(state.historyCursor).toBeNull();
  });

  it('stores the inspector collapsed state and the history cursor', () => {
    const collapsed = reducer(undefined, { type: ACTIONS.SET_INSPECTOR_COLLAPSED, payload: true });
    expect(collapsed.inspectorCollapsed).toBe(true);
    expect(reducer(collapsed, { type: ACTIONS.SET_HISTORY_CURSOR, payload: 2 }).historyCursor).toBe(2);
  });

  it('resets the history cursor when history changes', () => {
    const cycling = reducer(undefined, { type: ACTIONS.SET_HISTORY_CURSOR, payload: 0 });
    expect(reducer(cycling, { type: ACTIONS.ADD_QUERY_HISTORY, payload: 'g.V()' }).historyCursor).toBeNull();
    expect(reducer(cycling, { type: ACTIONS.CLEAR_QUERY_HISTORY }).historyCursor).toBeNull();
  });


  it('keeps edge labels legible with background pills and dynamic curves', () => {
    const { edges } = reducer(undefined, { type: 'UNKNOWN' }).networkOptions;

    expect(edges.font.background).toBe('rgba(11, 17, 32, 0.92)');
    expect(edges.font.strokeWidth).toBe(0);
    expect(edges.smooth).toEqual({ type: 'dynamic' });
  });

  it('defaults to type colouring with empty assignments and an open legend', () => {
    const state = reducer(undefined, { type: 'UNKNOWN' });
    expect(state.colorMode).toBe('type');
    expect(state.colorAssignments).toEqual({ type: {}, partition: {} });
    expect(state.legendCollapsed).toBe(false);
  });

  it('stores colour mode, assignments and legend collapse', () => {
    let state = reducer(undefined, { type: ACTIONS.SET_COLOR_MODE, payload: 'partition' });
    state = reducer(state, { type: ACTIONS.SET_COLOR_ASSIGNMENTS, payload: { type: { a: 0 }, partition: { p: 0 } } });
    state = reducer(state, { type: ACTIONS.SET_LEGEND_COLLAPSED, payload: true });

    expect(state.colorMode).toBe('partition');
    expect(state.colorAssignments).toEqual({ type: { a: 0 }, partition: { p: 0 } });
    expect(state.legendCollapsed).toBe(true);
  });

  it('ignores unknown colour modes', () => {
    expect(reducer(undefined, { type: ACTIONS.SET_COLOR_MODE, payload: 'rainbow' }).colorMode).toBe('type');
  });

  it('resets colour assignments on a successful connection switch only', () => {
    const assigned = reducer(undefined, { type: ACTIONS.SET_COLOR_ASSIGNMENTS, payload: { type: { a: 0 }, partition: {} } });
    expect(reducer(assigned, { type: ACTIONS.SWITCH_CONNECTION_SUCCESS, payload: {} }).colorAssignments).toEqual({ type: {}, partition: {} });
    expect(reducer(assigned, { type: ACTIONS.CLEAR_GRAPH }).colorAssignments).toEqual({ type: { a: 0 }, partition: {} });
  });

  it('drops the hardcoded demo colour groups but keeps the tag box shape', () => {
    const { groups } = reducer(undefined, { type: 'UNKNOWN' }).networkOptions;
    expect(Object.keys(groups)).toEqual(['tag']);
    expect(groups.tag.shape).toBe('box');
    expect(groups.tag.color).toBeUndefined();
  });
});
