export const STORAGE_KEY = 'tablePlanner';
export const DEFAULT_SEATS = 8;

export const state = {
  guests: [],
  tables: [{ seats: DEFAULT_SEATS }, { seats: DEFAULT_SEATS }],
  tableShape: 'round',
  assignments: {}
};

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const p = JSON.parse(saved);
      if (p && Array.isArray(p.guests)) {
        if (p.tableCount && !p.tables) {
          p.tables = Array.from({ length: p.tableCount }, () => ({ seats: p.seatsPerTable || DEFAULT_SEATS }));
        }
        Object.assign(state, p);
      }
    }
  } catch (e) {
    // Corrupt data — start fresh
  }
}

export function resetState() {
  state.guests = [];
  state.tables = [{ seats: DEFAULT_SEATS }, { seats: DEFAULT_SEATS }];
  state.tableShape = 'round';
  state.assignments = {};
  localStorage.removeItem(STORAGE_KEY);
}
