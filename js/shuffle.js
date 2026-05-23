import { state, saveState } from './state.js';

function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emptySeatIndexes(row) {
  return row.reduce((indexes, guestId, seatIndex) => {
    if (!guestId) indexes.push(seatIndex);
    return indexes;
  }, []);
}

function placePinnedGuests(assignments) {
  const unpinned = [];

  for (const guest of state.guests) {
    const tableIndex = guest.pinnedToTable;
    const seatIndex = guest.pinnedSeat;
    const canPlace = Number.isInteger(tableIndex) &&
      Number.isInteger(seatIndex) &&
      assignments[tableIndex] &&
      seatIndex >= 0 &&
      seatIndex < assignments[tableIndex].length &&
      !assignments[tableIndex][seatIndex];

    if (canPlace) {
      assignments[tableIndex][seatIndex] = guest.id;
    } else {
      if (guest.pinnedToTable !== null || guest.pinnedSeat !== null) {
        guest.pinnedToTable = null;
        guest.pinnedSeat = null;
      }
      unpinned.push(guest);
    }
  }

  return unpinned;
}

function allocateByGender(unpinned, capacity) {
  const males = fisherYates(unpinned.filter(g => g.gender === 'M'));
  const females = fisherYates(unpinned.filter(g => g.gender === 'F'));
  const totalCap = capacity.reduce((a, b) => a + b, 0);
  const tableMales = Array(capacity.length).fill(0);
  const tableFemales = Array(capacity.length).fill(0);

  let mLeft = males.length;
  for (let i = 0; i < capacity.length; i++) {
    if (totalCap === 0) break;
    const share = Math.round((capacity[i] / totalCap) * males.length);
    tableMales[i] = Math.min(share, capacity[i], mLeft);
    mLeft -= tableMales[i];
  }

  for (let i = 0; i < capacity.length && mLeft > 0; i++) {
    const add = Math.min(capacity[i] - tableMales[i], mLeft);
    tableMales[i] += add;
    mLeft -= add;
  }

  let fLeft = females.length;
  for (let i = 0; i < capacity.length; i++) {
    tableFemales[i] = Math.min(capacity[i] - tableMales[i], fLeft);
    fLeft -= tableFemales[i];
  }

  return { males, females, tableMales, tableFemales };
}

export function shuffle(renderFn) {
  const { tables } = state;
  const assignments = {};

  tables.forEach((table, tableIndex) => {
    assignments[tableIndex] = Array.from({ length: table.seats }, () => null);
  });

  const unpinned = placePinnedGuests(assignments);
  const capacity = tables.map((_, tableIndex) => emptySeatIndexes(assignments[tableIndex]).length);
  const { males, females, tableMales, tableFemales } = allocateByGender(unpinned, capacity);

  let mIdx = 0;
  let fIdx = 0;

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    const tM = males.slice(mIdx, mIdx + tableMales[tableIndex]);
    const tF = females.slice(fIdx, fIdx + tableFemales[tableIndex]);
    mIdx += tableMales[tableIndex];
    fIdx += tableFemales[tableIndex];

    const interleaved = [];
    let mi = 0;
    let fi = 0;
    let pickMale = tM.length >= tF.length;
    while (mi < tM.length || fi < tF.length) {
      if (pickMale && mi < tM.length) interleaved.push(tM[mi++].id);
      else if (fi < tF.length) interleaved.push(tF[fi++].id);
      else if (mi < tM.length) interleaved.push(tM[mi++].id);
      pickMale = !pickMale;
    }

    const openSeats = emptySeatIndexes(assignments[tableIndex]);
    interleaved.forEach((guestId, index) => {
      const seatIndex = openSeats[index];
      if (Number.isInteger(seatIndex)) assignments[tableIndex][seatIndex] = guestId;
    });
  }

  state.assignments = assignments;
  state.selectedSeat = null;
  saveState();
  renderFn(true);
}
