import { state } from './state.js';
import { escapeHtml } from './guests.js';
import { SVG } from './icons.js';
import { getTableBaseDims, renderRoundTable, renderRectTable } from './render-tables.js';

const ROW_H = 40;
const OVERSCAN = 5;

export function renderGuestList() {
  const { guests } = state;
  const scrollEl = document.getElementById('guestListScroll');
  const vpEl = document.getElementById('guestListViewport');
  const listEl = document.getElementById('guestList');

  if (guests.length === 0) {
    vpEl.style.height = 'auto';
    listEl.style.transform = '';
    listEl.innerHTML = '<div class="empty-state" style="padding:1.5rem 0">Add guests to get started</div>';
    return;
  }

  vpEl.style.height = guests.length * ROW_H + 'px';
  const scrollTop = scrollEl.scrollTop;
  const viewH = scrollEl.clientHeight || 300;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(guests.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);

  listEl.style.transform = `translateY(${start * ROW_H}px)`;
  listEl.innerHTML = guests.slice(start, end).map(g => `
    <div class="guest-row" style="height:${ROW_H}px;">
      <span class="name">${escapeHtml(g.name)}</span>
      <span class="gender-chip ${g.gender}">${g.gender === 'M' ? SVG.male : SVG.female}</span>
      <button class="btn-delete" data-delete="${g.id}" title="Remove">${SVG.x}</button>
    </div>
  `).join('');
}

export function renderTableSizes() {
  const el = document.getElementById('tableSizes');
  el.innerHTML = state.tables.map((t, i) => `
    <div class="table-size-row">
      <span>Table ${i + 1}</span>
      <input type="number" class="num-input table-seat-input" min="1" max="30" value="${t.seats}" data-tidx="${i}">
    </div>
  `).join('');
}

export function render(shuffled = false) {
  const { guests, tables, tableShape, assignments } = state;

  document.getElementById('tableCount').value = tables.length;
  document.getElementById('shuffleBtn').disabled = guests.length === 0;

  document.querySelectorAll('.shape-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.shape === tableShape)
  );

  // Warning
  const totalSeats = tables.reduce((s, t) => s + t.seats, 0);
  const warningEl = document.getElementById('warning');
  const warningText = document.getElementById('warningText');
  if (guests.length > totalSeats) {
    warningText.textContent = `${guests.length - totalSeats} guest(s) won't fit — ${guests.length} guests, ${totalSeats} seats.`;
    warningEl.classList.add('visible');
  } else {
    warningEl.classList.remove('visible');
  }

  renderGuestList();
  renderTableSizes();

  // Tables
  const gridEl = document.getElementById('tablesGrid');
  const zeroEl = document.getElementById('zeroState');
  const hasAssignments = Object.keys(assignments).length > 0 && guests.length > 0;

  if (!hasAssignments) {
    gridEl.innerHTML = '';
    zeroEl.style.display = '';
    return;
  }

  zeroEl.style.display = 'none';

  // Calculate scale to fill available space
  const boundary = document.querySelector('.tables-boundary');
  const availW = boundary.clientWidth - 40;
  const availH = boundary.clientHeight - 40;

  const maxSeats = Math.max(...tables.map(t => t.seats));
  const baseDims = getTableBaseDims(maxSeats, tableShape);
  const baseW = baseDims.w;
  const baseH = baseDims.h + 28; // label + gap

  // Find best column layout
  const tc = tables.length;
  let bestCols = 1, bestScale = 0;
  for (let cols = 1; cols <= tc; cols++) {
    const rows = Math.ceil(tc / cols);
    const gapX = 20 * (cols - 1);
    const gapY = 20 * (rows - 1);
    const scaleW = (availW - gapX) / (cols * baseW);
    const scaleH = (availH - gapY) / (rows * baseH);
    const s = Math.min(scaleW, scaleH);
    if (s > bestScale) { bestScale = s; bestCols = cols; }
  }
  const scale = Math.min(Math.max(0.35, bestScale), 1.5);

  // Render with explicit wrapper dimensions for correct flex layout
  const wrapW = Math.round(baseW * scale);
  const wrapH = Math.round(baseH * scale);

  let html = '';
  for (let i = 0; i < tables.length; i++) {
    const gids = assignments[i] || [];
    const padded = [...gids];
    while (padded.length < tables[i].seats) padded.push(null);

    const tHtml = tableShape === 'round'
      ? renderRoundTable(i, tables[i].seats, padded)
      : renderRectTable(i, tables[i].seats, padded);

    html += `<div class="table-visual-wrapper ${shuffled ? 'shuffled' : ''}" style="width:${wrapW}px;height:${wrapH}px;transform:scale(${scale.toFixed(3)});">
      <span class="table-label">Table ${i + 1}</span>
      ${tHtml}
    </div>`;
  }
  gridEl.innerHTML = html;
}
