import { RSVP_STATES, TABLE_SHAPE_OPTIONS, state } from './state.js';
import { escapeHtml, findAssignedSeat } from './guests.js';
import { SVG } from './icons.js';
import { getShapeIcon, getTableBaseDims, renderTable } from './render-tables.js';

function tableDisplayName(table, tableIndex) {
  return table.name.trim() || `Table ${tableIndex + 1}`;
}

function assignmentLabel(guestId) {
  const seat = findAssignedSeat(guestId);
  if (!seat) return 'Unassigned';
  return tableDisplayName(state.tables[seat.tableIndex], seat.tableIndex);
}

function compareValue(guest, key) {
  if (key === 'table') return assignmentLabel(guest.id);
  if (key === 'vip') return guest.vip ? 1 : 0;
  return guest[key] || '';
}

export function getPlanMetrics() {
  const totalSeats = state.tables.reduce((sum, table) => sum + table.seats, 0);
  const assignedGuestIds = new Set();

  state.tables.forEach((table, tableIndex) => {
    const row = Array.isArray(state.assignments[tableIndex]) ? state.assignments[tableIndex] : [];
    row.slice(0, table.seats).forEach(guestId => {
      if (guestId) assignedGuestIds.add(guestId);
    });
  });

  return {
    tableCount: state.tables.length,
    totalSeats,
    guestCount: state.guests.length,
    seatedGuests: assignedGuestIds.size,
    unseatedGuests: Math.max(0, state.guests.length - assignedGuestIds.size),
    mealSelections: state.guests.filter(guest => guest.meal).length,
    confirmed: state.guests.filter(guest => guest.rsvp === 'confirmed').length,
    pending: state.guests.filter(guest => guest.rsvp === 'pending').length,
    declined: state.guests.filter(guest => guest.rsvp === 'declined').length,
    vip: state.guests.filter(guest => guest.vip).length
  };
}

export function getGuestFilterCounts() {
  return {
    all: state.guests.length,
    confirmed: state.guests.filter(guest => guest.rsvp === 'confirmed').length,
    pending: state.guests.filter(guest => guest.rsvp === 'pending').length,
    declined: state.guests.filter(guest => guest.rsvp === 'declined').length,
    vip: state.guests.filter(guest => guest.vip).length
  };
}

export function getVisibleGuests() {
  const search = state.guestSearch.trim().toLowerCase();
  const filter = state.guestFilter || 'all';
  const filteredBySearch = search
    ? state.guests.filter(guest => guest.name.toLowerCase().includes(search))
    : [...state.guests];
  const filtered = filteredBySearch.filter(guest => {
    if (filter === 'all') return true;
    if (filter === 'vip') return guest.vip;
    return guest.rsvp === filter;
  });
  const direction = state.guestSort.direction === 'desc' ? -1 : 1;

  return filtered.sort((a, b) => {
    const av = compareValue(a, state.guestSort.key);
    const bv = compareValue(b, state.guestSort.key);
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * direction;
  });
}

function sortIndicator(key) {
  if (state.guestSort.key !== key) return '';
  return state.guestSort.direction === 'asc' ? ' ^' : ' v';
}

function plural(count, singular, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function renderPlanRail() {
  const rail = document.getElementById('planRail');
  if (!rail) return;

  const metrics = getPlanMetrics();
  const tablesReady = metrics.tableCount > 0 && metrics.totalSeats > 0;
  const guestsReady = metrics.guestCount > 0;
  const seatingReady = metrics.guestCount > 0 && metrics.seatedGuests === metrics.guestCount;
  const reviewReady = seatingReady && metrics.mealSelections === metrics.guestCount;
  const steps = [
    { label: 'Tables', value: `${plural(metrics.tableCount, 'table')} / ${plural(metrics.totalSeats, 'seat')}`, done: tablesReady },
    { label: 'Guests', value: plural(metrics.guestCount, 'guest'), done: guestsReady },
    { label: 'Seating', value: `${metrics.seatedGuests} / ${metrics.guestCount} seated`, done: seatingReady },
    { label: 'Review', value: `${metrics.mealSelections} meals`, done: reviewReady }
  ];

  rail.innerHTML = `
    <div class="rail-heading">
      <span class="eyebrow">Plan</span>
      <strong>${metrics.unseatedGuests ? `${metrics.unseatedGuests} unseated` : 'Ready to arrange'}</strong>
    </div>
    <div class="plan-steps">
      ${steps.map(step => `
        <div class="plan-step ${step.done ? 'done' : ''}">
          <span class="step-dot">${step.done ? SVG.check : ''}</span>
          <span>
            <strong>${step.label}</strong>
            <small>${step.value}</small>
          </span>
        </div>
      `).join('')}
    </div>
    <div class="rail-metrics">
      <span><strong>${metrics.confirmed}</strong> confirmed</span>
      <span><strong>${metrics.pending}</strong> pending</span>
      <span><strong>${metrics.vip}</strong> VIP</span>
    </div>
  `;
}

function selectedTableIndex() {
  if (Number.isInteger(state.selectedSeat?.tableIndex)) return state.selectedSeat.tableIndex;
  if (Number.isInteger(state.selectedTableIndex) && state.tables[state.selectedTableIndex]) return state.selectedTableIndex;
  return 0;
}

function renderInspector() {
  const inspector = document.getElementById('tableInspector');
  if (!inspector) return;

  const tableIndex = selectedTableIndex();
  const table = state.tables[tableIndex];
  if (!table) {
    inspector.innerHTML = '<div class="inspector-empty">No table selected.</div>';
    return;
  }

  const row = ensurePaddedAssignments(tableIndex);
  const seated = row.filter(Boolean).length;
  const selectedSeatIndex = state.selectedSeat?.tableIndex === tableIndex ? state.selectedSeat.seatIndex : null;
  const selectedGuestId = Number.isInteger(selectedSeatIndex) ? row[selectedSeatIndex] : null;
  const selectedGuest = selectedGuestId ? state.guests.find(guest => guest.id === selectedGuestId) : null;
  const tableName = tableDisplayName(table, tableIndex);
  const meals = row
    .map(guestId => state.guests.find(guest => guest.id === guestId))
    .filter(Boolean)
    .reduce((counts, guest) => {
      const key = guest.meal || 'No meal';
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

  inspector.innerHTML = `
    <div class="inspector-heading">
      <span class="eyebrow">Inspector</span>
      <h3>${escapeHtml(tableName)}</h3>
      <p>${table.shape.replaceAll('-', ' ')} table</p>
    </div>
    <dl class="inspector-stats">
      <div><dt>Seats</dt><dd>${table.seats}</dd></div>
      <div><dt>Seated</dt><dd>${seated}</dd></div>
      <div><dt>Open</dt><dd>${Math.max(0, table.seats - seated)}</dd></div>
    </dl>
    <div class="inspector-section">
      <h4>${selectedGuest ? 'Selected seat' : 'Table status'}</h4>
      ${selectedGuest ? `
        <div class="selected-guest-card">
          <strong>${escapeHtml(selectedGuest.name)}</strong>
          <span>Seat ${(selectedSeatIndex ?? 0) + 1} / ${selectedGuest.rsvp}</span>
          <span>${selectedGuest.meal || 'No meal selected'}</span>
          <em>Choose a destination seat on the floor plan.</em>
        </div>
      ` : `
        <p>${seated ? `${seated} seated at this table.` : 'Configured and waiting for guests.'}</p>
      `}
    </div>
    <div class="inspector-section">
      <h4>Meals</h4>
      ${Object.keys(meals).length ? `
        <div class="meal-summary">
          ${Object.entries(meals).map(([meal, count]) => `<span>${escapeHtml(meal)} <strong>${count}</strong></span>`).join('')}
        </div>
      ` : '<p>No meal choices at this table yet.</p>'}
    </div>
  `;
}

function renderGuestFilters() {
  const filterBar = document.getElementById('guestFilterBar');
  if (!filterBar) return;

  const counts = getGuestFilterCounts();
  const filters = [
    ['all', 'All'],
    ['confirmed', 'Confirmed'],
    ['pending', 'Pending'],
    ['declined', 'Declined'],
    ['vip', 'VIP']
  ];

  filterBar.innerHTML = filters.map(([key, label]) => `
    <button class="filter-chip ${state.guestFilter === key ? 'active' : ''}" data-guest-filter="${key}">
      ${label}
      <span>${counts[key]}</span>
    </button>
  `).join('');
}

export function renderGuestList() {
  const tbody = document.getElementById('guestTableBody');
  const count = document.getElementById('guestCount');
  const search = document.getElementById('guestSearch');
  if (!tbody) return;

  const guests = getVisibleGuests();
  renderGuestFilters();
  count.textContent = `${state.guests.length} guest${state.guests.length === 1 ? '' : 's'}`;
  if (search && search.value !== state.guestSearch) search.value = state.guestSearch;

  document.querySelectorAll('[data-sort]').forEach(button => {
    const key = button.dataset.sort;
    button.textContent = `${button.dataset.label}${sortIndicator(key)}`;
    button.classList.toggle('active', state.guestSort.key === key);
  });

  if (guests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-table-cell">${state.guests.length ? 'No guests match this view' : 'Add guests to start seating'}</td></tr>`;
    return;
  }

  tbody.innerHTML = guests.map(guest => {
    const seat = findAssignedSeat(guest.id);
    const pinned = guest.pinnedToTable !== null;
    const mealOptions = [
      '<option value="">None</option>',
      ...state.mealOptions.map(option =>
        `<option value="${escapeHtml(option)}" ${guest.meal === option ? 'selected' : ''}>${escapeHtml(option)}</option>`
      )
    ].join('');

    return `
      <tr>
        <td>
          <span class="guest-name-cell">
            <span class="gender-dot ${guest.gender}"></span>
            ${escapeHtml(guest.name)}
          </span>
        </td>
        <td><span class="table-chip">${escapeHtml(assignmentLabel(guest.id))}</span></td>
        <td>
          <button class="table-icon-btn vip-toggle ${guest.vip ? 'active' : ''}" data-vip="${guest.id}" title="Toggle VIP" aria-label="Toggle VIP for ${escapeHtml(guest.name)}">${SVG.star}</button>
        </td>
        <td>
          <button class="rsvp-pill ${guest.rsvp}" data-rsvp="${guest.id}" title="Cycle RSVP">${guest.rsvp}</button>
        </td>
        <td>
          <select class="meal-select" data-meal="${guest.id}">
            ${mealOptions}
          </select>
        </td>
        <td>
          <div class="row-actions">
            <button class="table-icon-btn ${pinned ? 'active' : ''}" data-pin-current="${guest.id}" ${seat ? '' : 'disabled'} title="${seat ? 'Pin to current seat' : 'Shuffle first to assign a seat'}" aria-label="Pin ${escapeHtml(guest.name)}">${SVG.pin}</button>
            <button class="table-icon-btn danger" data-delete="${guest.id}" title="Remove" aria-label="Remove ${escapeHtml(guest.name)}">${SVG.x}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function renderSetup() {
  const tableList = document.getElementById('setupTables');
  const mealList = document.getElementById('mealOptionsList');
  if (!tableList || !mealList) return;

  tableList.innerHTML = state.tables.map((table, tableIndex) => `
    <div class="setup-table-row">
      <div class="setup-table-main">
        <div class="setup-table-title">Table ${tableIndex + 1}</div>
        <input type="text" class="setup-name-input" data-table-name="${tableIndex}" value="${escapeHtml(table.name)}" placeholder="Optional name">
      </div>
      <div class="shape-picker" role="group" aria-label="Shape for table ${tableIndex + 1}">
        ${TABLE_SHAPE_OPTIONS.map(shape => `
          <button class="shape-btn ${table.shape === shape.id ? 'active' : ''}" data-table-shape="${tableIndex}" data-shape="${shape.id}" title="${shape.label}" aria-label="${shape.label}">
            ${getShapeIcon(shape.id)}
          </button>
        `).join('')}
      </div>
      <label class="seat-count-control">
        <span>Seats</span>
        <input type="number" class="num-input" data-table-seats="${tableIndex}" min="1" max="60" value="${table.seats}">
      </label>
      <button class="table-icon-btn danger" data-remove-table="${tableIndex}" ${state.tables.length === 1 ? 'disabled' : ''} title="Remove table" aria-label="Remove table">${SVG.x}</button>
    </div>
  `).join('');

  mealList.innerHTML = state.mealOptions.map(option => `
    <div class="meal-option-row">
      <span>${escapeHtml(option)}</span>
      <button class="table-icon-btn danger" data-remove-meal="${escapeHtml(option)}" title="Remove meal option" aria-label="Remove ${escapeHtml(option)}">${SVG.x}</button>
    </div>
  `).join('');
}

function renderTabs() {
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === state.activeTab);
  });
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === state.activeTab);
  });
}

function renderWarning() {
  const metrics = getPlanMetrics();
  const warningEl = document.getElementById('warning');
  const warningText = document.getElementById('warningText');
  const capacityText = document.getElementById('capacityText');
  if (!warningEl || !warningText) return;

  if (capacityText) {
    capacityText.textContent = `${plural(metrics.guestCount, 'guest')} / ${plural(metrics.totalSeats, 'seat')} / ${plural(metrics.tableCount, 'table')}`;
    capacityText.classList.toggle('over-capacity', metrics.guestCount > metrics.totalSeats);
  }

  if (metrics.guestCount > metrics.totalSeats) {
    warningText.textContent = `${metrics.guestCount - metrics.totalSeats} guest(s) will not fit - ${metrics.guestCount} guests, ${metrics.totalSeats} seats.`;
    warningEl.classList.add('visible');
  } else {
    warningEl.classList.remove('visible');
  }
}

function ensurePaddedAssignments(tableIndex) {
  const table = state.tables[tableIndex];
  const row = Array.isArray(state.assignments[tableIndex]) ? [...state.assignments[tableIndex]] : [];
  while (row.length < table.seats) row.push(null);
  return row.slice(0, table.seats);
}

function renderFloor(shuffled) {
  const gridEl = document.getElementById('tablesGrid');
  const zeroEl = document.getElementById('zeroState');
  const moveHint = document.getElementById('moveHint');
  const shuffleBtn = document.getElementById('shuffleBtn');
  if (!gridEl || !zeroEl) return;

  const metrics = getPlanMetrics();
  if (shuffleBtn) shuffleBtn.disabled = metrics.guestCount === 0;
  const selectedGuestId = Number.isInteger(state.selectedSeat?.tableIndex)
    ? state.assignments[state.selectedSeat.tableIndex]?.[state.selectedSeat.seatIndex]
    : null;
  const selectedGuest = selectedGuestId ? state.guests.find(guest => guest.id === selectedGuestId) : null;

  zeroEl.classList.toggle('hidden', metrics.guestCount > 0 && metrics.seatedGuests > 0);
  zeroEl.innerHTML = `
    <strong>${metrics.seatedGuests} seated / ${metrics.totalSeats} seats</strong>
    <span>${metrics.guestCount ? `${metrics.unseatedGuests} guests still unseated` : 'Configured tables are ready for guests'}</span>
  `;

  if (moveHint) {
    moveHint.classList.toggle('visible', Boolean(selectedGuest));
    moveHint.innerHTML = selectedGuest
      ? `<strong>${escapeHtml(selectedGuest.name)} selected</strong><span>Choose an open seat to move, or another guest to swap.</span>`
      : '';
  }

  const boundary = document.querySelector('.tables-boundary');
  boundary.classList.toggle('moving-seat', Boolean(selectedGuest));
  const availW = Math.max(0, boundary.clientWidth - 40);
  const availH = Math.max(0, boundary.clientHeight - 40);
  if (!availW || !availH) return;

  const dims = state.tables.map(table => getTableBaseDims(table.seats, table.shape));
  const maxW = Math.max(...dims.map(dim => dim.w), 1);
  const maxH = Math.max(...dims.map(dim => dim.h), 1);
  const tableCount = state.tables.length;
  let bestCols = 1;
  let bestScale = 0;

  for (let cols = 1; cols <= tableCount; cols++) {
    const rows = Math.ceil(tableCount / cols);
    const gapX = 24 * (cols - 1);
    const gapY = 24 * (rows - 1);
    const scaleW = (availW - gapX) / (cols * maxW);
    const scaleH = (availH - gapY) / (rows * maxH);
    const scale = Math.min(scaleW, scaleH);
    if (scale > bestScale) {
      bestScale = scale;
      bestCols = cols;
    }
  }

  const scale = Math.min(Math.max(0.35, bestScale), 1.25);
  gridEl.style.gridTemplateColumns = `repeat(${bestCols}, max-content)`;

  gridEl.innerHTML = state.tables.map((table, tableIndex) => {
    const assignment = ensurePaddedAssignments(tableIndex);
    const tableHtml = renderTable(tableIndex, table, assignment);
    const width = Math.round(dims[tableIndex].w * scale);
    const height = Math.round(dims[tableIndex].h * scale);
    return `
      <div class="table-visual-wrapper ${shuffled ? 'shuffled' : ''} ${selectedTableIndex() === tableIndex ? 'selected-table' : ''}" style="width:${width}px;height:${height}px;">
        <div class="table-scale" data-table-card="${tableIndex}" style="transform:scale(${scale.toFixed(3)});">
          ${tableHtml}
        </div>
      </div>
    `;
  }).join('');
}

export function render(shuffled = false) {
  renderTabs();
  renderWarning();
  renderGuestList();
  renderSetup();
  renderFloor(shuffled);
  renderPlanRail();
  renderInspector();
}
