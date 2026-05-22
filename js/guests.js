import { state, saveState } from './state.js';

export function addGuest(name, gender, renderFn) {
  state.guests.push({ id: crypto.randomUUID(), name: name.trim(), gender, pinnedToTable: null });
  saveState();
  renderFn();
}

export function deleteGuest(id, renderFn) {
  state.guests = state.guests.filter(g => g.id !== id);
  for (const t in state.assignments) {
    state.assignments[t] = state.assignments[t].filter(gid => gid !== id);
  }
  saveState();
  renderFn();
}

export function togglePin(guestId, tableIndex, renderFn) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;
  guest.pinnedToTable = guest.pinnedToTable === tableIndex ? null : tableIndex;
  saveState();
  renderFn();
}

export function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
