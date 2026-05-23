import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {}
};

const { state } = await import('../js/state.js');
const { shuffle } = await import('../js/shuffle.js');
const guestsModule = await import('../js/guests.js');
const renderModule = await import('../js/render.js');

function resetPlannerState() {
  state.guests = [];
  state.tables = [];
  state.assignments = {};
  state.mealOptions = ['Beef', 'Fish', 'Vegetarian', 'Child'];
  state.activeTab = 'floor';
  state.guestSearch = '';
  state.guestFilter = 'all';
  state.guestSort = { key: 'name', direction: 'asc' };
}

function guest(id, fields = {}) {
  return {
    id,
    name: fields.name || id,
    gender: fields.gender || 'M',
    pinnedToTable: fields.pinnedToTable ?? null,
    pinnedSeat: fields.pinnedSeat ?? null,
    vip: fields.vip ?? false,
    rsvp: fields.rsvp || 'pending',
    meal: fields.meal ?? null
  };
}

test('shuffle keeps a pinned guest in the exact same table seat', () => {
  resetPlannerState();
  state.tables = [{ seats: 6, shape: 'round', name: '' }];
  state.guests = [
    guest('pinned', { pinnedToTable: 0, pinnedSeat: 3 }),
    guest('a', { gender: 'F' }),
    guest('b'),
    guest('c', { gender: 'F' }),
    guest('d')
  ];
  state.assignments = { 0: ['a', 'b', 'c', 'pinned', 'd', null] };

  shuffle(() => {});

  assert.equal(state.assignments[0][3], 'pinned');
  assert.equal(state.assignments[0].filter(id => id === 'pinned').length, 1);
});

test('swapAssignedGuests swaps two seated guests and moves pins with the guest', () => {
  resetPlannerState();
  state.tables = [
    { seats: 4, shape: 'round', name: 'Family' },
    { seats: 4, shape: 'square', name: 'Friends' }
  ];
  state.guests = [
    guest('pinned', { pinnedToTable: 0, pinnedSeat: 1 }),
    guest('other', { gender: 'F' })
  ];
  state.assignments = {
    0: [null, 'pinned', null, null],
    1: [null, null, 'other', null]
  };

  assert.equal(typeof guestsModule.swapAssignedGuests, 'function');

  const swapped = guestsModule.swapAssignedGuests('pinned', 'other');

  assert.equal(swapped, true);
  assert.equal(state.assignments[0][1], 'other');
  assert.equal(state.assignments[1][2], 'pinned');
  assert.equal(state.guests.find(g => g.id === 'pinned').pinnedToTable, 1);
  assert.equal(state.guests.find(g => g.id === 'pinned').pinnedSeat, 2);
});

test('swapSeats moves a selected guest directly to an empty target seat', () => {
  resetPlannerState();
  state.tables = [{ seats: 4, shape: 'round', name: 'Family' }];
  state.guests = [guest('alice', { name: 'Alice' })];
  state.assignments = { 0: ['alice', null, null, null] };

  const moved = guestsModule.swapSeats(
    { tableIndex: 0, seatIndex: 0 },
    { tableIndex: 0, seatIndex: 2 }
  );

  assert.equal(moved, true);
  assert.deepEqual(state.assignments[0], [null, null, 'alice', null]);
});

test('planner metrics treat persistent empty tables as configured capacity', () => {
  resetPlannerState();
  state.tables = [
    { seats: 8, shape: 'round', name: 'Family' },
    { seats: 10, shape: 'four-sides', name: 'Friends' }
  ];
  state.guests = [];
  state.assignments = { 0: [], 1: [] };

  assert.equal(typeof renderModule.getPlanMetrics, 'function');

  const metrics = renderModule.getPlanMetrics();

  assert.equal(metrics.tableCount, 2);
  assert.equal(metrics.totalSeats, 18);
  assert.equal(metrics.seatedGuests, 0);
  assert.equal(metrics.unseatedGuests, 0);
  assert.equal(metrics.mealSelections, 0);
});

test('visible guest filters support RSVP and VIP planning views', () => {
  resetPlannerState();
  state.tables = [{ seats: 4, shape: 'round', name: '' }];
  state.guests = [
    guest('alice', { name: 'Alice Morgan', rsvp: 'confirmed', vip: true, meal: 'Fish' }),
    guest('ben', { name: 'Ben Carter', rsvp: 'pending' }),
    guest('clara', { name: 'Clara Reed', rsvp: 'declined', vip: true })
  ];

  assert.equal(typeof renderModule.getGuestFilterCounts, 'function');
  assert.equal(typeof renderModule.getVisibleGuests, 'function');

  const counts = renderModule.getGuestFilterCounts();
  assert.deepEqual(counts, {
    all: 3,
    confirmed: 1,
    pending: 1,
    declined: 1,
    vip: 2
  });

  state.guestFilter = 'confirmed';
  assert.deepEqual(renderModule.getVisibleGuests().map(item => item.id), ['alice']);

  state.guestFilter = 'vip';
  assert.deepEqual(renderModule.getVisibleGuests().map(item => item.id), ['alice', 'clara']);
});
