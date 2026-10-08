// Validated all-pairs on the #0b1120 canvas (dataviz validator, dark mode): only three hues
// stay distinguishable when any node can sit beside any other, so later keys fold into Other.
export const PALETTE = {
  slots: [
    { background: '#3987e5', border: '#86b6ef' },
    { background: '#d95926', border: '#f0a07e' },
    { background: '#199e70', border: '#7fd1b2' }
  ],
  other: { background: '#94a3b8', border: '#cbd5e1' },
  notReturned: { background: '#0b1120', border: '#94a3b8' },
  highlightBorder: '#f8fafc'
};

export const NOT_RETURNED = '__not_returned__';
const OTHER = 'other';

export const getColorKey = (node, mode) => {
  if (mode === 'partition') {
    const partition = node.partition;
    return partition && partition.value != null ? String(partition.value) : NOT_RETURNED;
  }
  return String(node.type);
};

export const assignSlots = (modeAssignments, keys) => {
  const next = { ...modeAssignments };
  keys.forEach((key) => {
    if (key === NOT_RETURNED || key in next) {
      return;
    }
    const used = Object.values(next).filter(slot => slot !== OTHER).length;
    next[key] = used < PALETTE.slots.length ? used : OTHER;
  });
  return next;
};

const paletteEntry = (slot) => {
  if (slot === NOT_RETURNED) {
    return PALETTE.notReturned;
  }
  return typeof slot === 'number' ? PALETTE.slots[slot] : PALETTE.other;
};

// Always returns shapeProperties so a mode switch also clears dashed borders.
export const getNodeStyle = (slot) => {
  const { background, border } = paletteEntry(slot);
  const active = { background, border: PALETTE.highlightBorder };
  return {
    color: { background, border, highlight: active, hover: active },
    shapeProperties: { borderDashes: slot === NOT_RETURNED ? [4, 3] : false }
  };
};

const slotFor = (key, modeAssignments) => (key === NOT_RETURNED ? NOT_RETURNED : modeAssignments[key]);

export const styleNodes = (nodes, mode, colorAssignments) => {
  const keys = nodes.map(node => getColorKey(node, mode));
  const modeAssignments = assignSlots(colorAssignments[mode] || {}, keys);
  return {
    nodes: nodes.map((node, index) => ({ ...node, ...getNodeStyle(slotFor(keys[index], modeAssignments)) })),
    colorAssignments: { ...colorAssignments, [mode]: modeAssignments }
  };
};

const slotOrder = (slot) => {
  if (typeof slot === 'number') {
    return slot;
  }
  return slot === OTHER ? PALETTE.slots.length : PALETTE.slots.length + 1;
};

export const getLegendRows = (nodes, mode, modeAssignments) => {
  const counts = new Map();
  nodes.forEach((node) => {
    const key = getColorKey(node, mode);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const rows = [];
  const otherKeys = [];
  let otherCount = 0;
  counts.forEach((count, key) => {
    const slot = key === NOT_RETURNED ? NOT_RETURNED : (key in modeAssignments ? modeAssignments[key] : OTHER);
    if (slot === OTHER) {
      otherKeys.push(key);
      otherCount += count;
    } else if (slot === NOT_RETURNED) {
      rows.push({ key, label: 'partition not returned', slot, count });
    } else {
      rows.push({ key, label: key, slot, count });
    }
  });
  if (otherKeys.length > 0) {
    rows.push({ key: OTHER, label: `Other (${otherKeys.length} ${otherKeys.length === 1 ? 'key' : 'keys'})`, slot: OTHER, count: otherCount, keys: otherKeys });
  }
  return rows.sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
};
