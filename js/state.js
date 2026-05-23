export const STORAGE_KEY = 'tablePlanner';
export const DEFAULT_SEATS = 8;
export const DEFAULT_MEAL_OPTIONS = ['Beef', 'Fish', 'Vegetarian', 'Child'];
export const RSVP_STATES = ['pending', 'confirmed', 'declined'];

export const TABLE_SHAPE_OPTIONS = [
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'one-side', label: '1-Side' },
  { id: 'two-sides', label: '2-Sides' },
  { id: 'three-sides-u', label: '3-Sides (U)' },
  { id: 'three-sides-c', label: '3-Sides (C)' },
  { id: 'four-sides', label: '4-Sides' },
  { id: 'row', label: 'Row of Seats' }
];

const TABLE_SHAPE_IDS = new Set(TABLE_SHAPE_OPTIONS.map(shape => shape.id));

export function createTable(overrides = {}) {
  return {
    seats: clampNumber(overrides.seats, 1, 60, DEFAULT_SEATS),
    shape: TABLE_SHAPE_IDS.has(overrides.shape) ? overrides.shape : 'round',
    name: typeof overrides.name === 'string' ? overrides.name : ''
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeGuest(guest) {
  return {
    id: typeof guest.id === 'string' ? guest.id : crypto.randomUUID(),
    name: typeof guest.name === 'string' ? guest.name : '',
    gender: guest.gender === 'F' ? 'F' : 'M',
    pinnedToTable: Number.isInteger(guest.pinnedToTable) ? guest.pinnedToTable : null,
    pinnedSeat: Number.isInteger(guest.pinnedSeat) ? guest.pinnedSeat : null,
    vip: Boolean(guest.vip),
    rsvp: RSVP_STATES.includes(guest.rsvp) ? guest.rsvp : 'pending',
    meal: typeof guest.meal === 'string' && guest.meal ? guest.meal : null
  };
}

function normalizeGuestSort(sort) {
  const allowedKeys = new Set(['name', 'table', 'vip', 'rsvp', 'meal']);
  return {
    key: allowedKeys.has(sort?.key) ? sort.key : 'name',
    direction: sort?.direction === 'desc' ? 'desc' : 'asc'
  };
}

function normalizeAssignments(assignments, tables) {
  const next = {};
  if (!assignments || typeof assignments !== 'object') return next;

  tables.forEach((table, tableIndex) => {
    const row = Array.isArray(assignments[tableIndex]) ? assignments[tableIndex] : [];
    next[tableIndex] = Array.from({ length: table.seats }, (_, seatIndex) => row[seatIndex] || null);
  });
  return next;
}

function normalizeState(input) {
  const tableShape = TABLE_SHAPE_IDS.has(input.tableShape) ? input.tableShape : 'round';
  let tables = Array.isArray(input.tables) && input.tables.length
    ? input.tables.map(table => createTable({ ...table, shape: table.shape || tableShape }))
    : null;

  if (!tables && input.tableCount) {
    tables = Array.from({ length: clampNumber(input.tableCount, 1, 50, 2) }, () =>
      createTable({ seats: input.seatsPerTable || DEFAULT_SEATS, shape: tableShape })
    );
  }

  if (!tables) {
    tables = [createTable(), createTable()];
  }

  const mealOptions = Array.isArray(input.mealOptions) && input.mealOptions.length
    ? [...new Set(input.mealOptions.filter(option => typeof option === 'string' && option.trim()).map(option => option.trim()))]
    : [...DEFAULT_MEAL_OPTIONS];

  return {
    guests: Array.isArray(input.guests) ? input.guests.map(normalizeGuest).filter(guest => guest.name) : [],
    tables,
    assignments: normalizeAssignments(input.assignments, tables),
    mealOptions,
    activeTab: ['floor', 'guests', 'setup'].includes(input.activeTab) ? input.activeTab : 'floor',
    guestSearch: typeof input.guestSearch === 'string' ? input.guestSearch : '',
    guestFilter: ['all', ...RSVP_STATES, 'vip'].includes(input.guestFilter) ? input.guestFilter : 'all',
    guestSort: normalizeGuestSort(input.guestSort),
    selectedSeat: null,
    selectedTableIndex: Number.isInteger(input.selectedTableIndex) ? input.selectedTableIndex : 0
  };
}

export const state = normalizeState({});

export function saveState() {
  const persisted = {
    guests: state.guests,
    tables: state.tables,
    assignments: state.assignments,
    mealOptions: state.mealOptions,
    activeTab: state.activeTab,
    guestSearch: state.guestSearch,
    guestFilter: state.guestFilter,
    guestSort: state.guestSort,
    selectedTableIndex: state.selectedTableIndex
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    Object.assign(state, normalizeState(parsed || {}));
  } catch (e) {
    // Corrupt data starts from the default state.
  }
}

export function resetState() {
  Object.assign(state, normalizeState({}));
  localStorage.removeItem(STORAGE_KEY);
}
