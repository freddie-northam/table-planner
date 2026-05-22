import { state, saveState } from './state.js';

function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffle(renderFn) {
  const { guests, tables } = state;
  const tc = tables.length;

  const pinned = {};
  for (let i = 0; i < tc; i++) pinned[i] = [];
  const unpinned = [];

  for (const guest of guests) {
    if (guest.pinnedToTable !== null && guest.pinnedToTable < tc) {
      pinned[guest.pinnedToTable].push(guest.id);
    } else {
      if (guest.pinnedToTable !== null && guest.pinnedToTable >= tc) guest.pinnedToTable = null;
      unpinned.push(guest);
    }
  }

  const males = fisherYates(unpinned.filter(g => g.gender === 'M'));
  const females = fisherYates(unpinned.filter(g => g.gender === 'F'));

  const capacity = tables.map((t, i) => t.seats - pinned[i].length);
  const totalCap = capacity.reduce((a, b) => a + b, 0);

  const tableMales = Array(tc).fill(0);
  const tableFemales = Array(tc).fill(0);

  let mLeft = males.length;
  for (let i = 0; i < tc; i++) {
    if (totalCap === 0) break;
    const share = Math.round((capacity[i] / totalCap) * males.length);
    tableMales[i] = Math.min(share, capacity[i], mLeft);
    mLeft -= tableMales[i];
  }
  for (let i = 0; i < tc && mLeft > 0; i++) {
    const add = Math.min(capacity[i] - tableMales[i], mLeft);
    tableMales[i] += add;
    mLeft -= add;
  }

  let fLeft = females.length;
  for (let i = 0; i < tc; i++) {
    tableFemales[i] = Math.min(capacity[i] - tableMales[i], fLeft);
    fLeft -= tableFemales[i];
  }

  let mIdx = 0, fIdx = 0;
  const assignments = {};
  for (let i = 0; i < tc; i++) {
    const tM = males.slice(mIdx, mIdx + tableMales[i]);
    const tF = females.slice(fIdx, fIdx + tableFemales[i]);
    mIdx += tableMales[i];
    fIdx += tableFemales[i];

    const interleaved = [];
    let mi = 0, fi = 0;
    let pickMale = tM.length >= tF.length;
    while (mi < tM.length || fi < tF.length) {
      if (pickMale && mi < tM.length) interleaved.push(tM[mi++].id);
      else if (fi < tF.length) interleaved.push(tF[fi++].id);
      else if (mi < tM.length) interleaved.push(tM[mi++].id);
      pickMale = !pickMale;
    }

    assignments[i] = [...pinned[i], ...interleaved];
  }

  state.assignments = assignments;
  saveState();
  renderFn(true);
}
