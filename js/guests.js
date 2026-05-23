import { RSVP_STATES, state, saveState } from './state.js';

export function addGuest(name, gender, renderFn) {
  const cleanName = name.trim();
  if (!cleanName) return;

  state.guests.push({
    id: crypto.randomUUID(),
    name: cleanName,
    gender,
    pinnedToTable: null,
    pinnedSeat: null,
    vip: false,
    rsvp: 'pending',
    meal: null
  });
  saveState();
  renderFn();
}

export function deleteGuest(id, renderFn) {
  state.guests = state.guests.filter(g => g.id !== id);
  for (const tableIndex in state.assignments) {
    state.assignments[tableIndex] = state.assignments[tableIndex].map(gid => gid === id ? null : gid);
  }
  if (state.selectedSeat && state.assignments[state.selectedSeat.tableIndex]?.[state.selectedSeat.seatIndex] === id) {
    state.selectedSeat = null;
  }
  saveState();
  renderFn();
}

export function findAssignedSeat(guestId) {
  for (let tableIndex = 0; tableIndex < state.tables.length; tableIndex++) {
    const seats = state.assignments[tableIndex] || [];
    const seatIndex = seats.indexOf(guestId);
    if (seatIndex !== -1) return { tableIndex, seatIndex };
  }
  return null;
}

function ensureAssignmentRow(tableIndex) {
  const table = state.tables[tableIndex];
  if (!table) return null;

  const row = Array.isArray(state.assignments[tableIndex]) ? [...state.assignments[tableIndex]] : [];
  while (row.length < table.seats) row.push(null);
  state.assignments[tableIndex] = row.slice(0, table.seats);
  return state.assignments[tableIndex];
}

function movePinWithGuest(guestId, tableIndex, seatIndex) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest || guest.pinnedToTable === null) return;
  guest.pinnedToTable = tableIndex;
  guest.pinnedSeat = seatIndex;
}

export function togglePin(guestId, tableIndex, seatIndex, renderFn) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;

  const fallbackSeat = findAssignedSeat(guestId);
  const nextTable = Number.isInteger(tableIndex) ? tableIndex : fallbackSeat?.tableIndex;
  const nextSeat = Number.isInteger(seatIndex) ? seatIndex : fallbackSeat?.seatIndex;
  if (!Number.isInteger(nextTable) || !Number.isInteger(nextSeat)) return;

  const alreadyPinned = guest.pinnedToTable === nextTable && guest.pinnedSeat === nextSeat;
  guest.pinnedToTable = alreadyPinned ? null : nextTable;
  guest.pinnedSeat = alreadyPinned ? null : nextSeat;
  saveState();
  renderFn();
}

export function toggleGuestVip(guestId, renderFn) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;
  guest.vip = !guest.vip;
  saveState();
  renderFn();
}

export function cycleGuestRsvp(guestId, renderFn) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;
  const nextIndex = (RSVP_STATES.indexOf(guest.rsvp) + 1) % RSVP_STATES.length;
  guest.rsvp = RSVP_STATES[nextIndex];
  saveState();
  renderFn();
}

export function setGuestMeal(guestId, meal, renderFn) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;
  guest.meal = meal || null;
  saveState();
  renderFn();
}

export function swapAssignedGuests(firstGuestId, secondGuestId) {
  const first = findAssignedSeat(firstGuestId);
  const second = findAssignedSeat(secondGuestId);
  if (!first || !second) return false;
  return swapSeats(first, second);
}

export function swapSeats(first, second, renderFn) {
  if (!first || !second) return false;
  if (first.tableIndex === second.tableIndex && first.seatIndex === second.seatIndex) return false;

  const firstRow = ensureAssignmentRow(first.tableIndex);
  const secondRow = first.tableIndex === second.tableIndex
    ? firstRow
    : ensureAssignmentRow(second.tableIndex);
  if (!firstRow || !secondRow) return false;

  const firstGuest = firstRow[first.seatIndex] || null;
  const secondGuest = secondRow[second.seatIndex] || null;
  firstRow[first.seatIndex] = secondGuest;
  secondRow[second.seatIndex] = firstGuest;

  if (firstGuest) movePinWithGuest(firstGuest, second.tableIndex, second.seatIndex);
  if (secondGuest) movePinWithGuest(secondGuest, first.tableIndex, first.seatIndex);

  state.selectedSeat = null;
  saveState();
  if (renderFn) renderFn();
  return true;
}

export function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
