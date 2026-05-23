import { TABLE_SHAPE_OPTIONS, state } from './state.js';
import { escapeHtml } from './guests.js';
import { SVG } from './icons.js';

export const SEAT_SIZE = 78;
export const SEAT_GAP = 16;

const SEAT_R = SEAT_SIZE / 2;
const RECT_TABLE_MIN_W = 150;
const RECT_TABLE_MIN_H = 72;

export const TABLE_SHAPES = TABLE_SHAPE_OPTIONS;

function splitCounts(total, sideWeights) {
  const weightTotal = sideWeights.reduce((sum, side) => sum + side.weight, 0);
  const counts = sideWeights.map(side => ({
    side: side.side,
    count: Math.floor((total * side.weight) / weightTotal),
    remainder: (total * side.weight) / weightTotal
  }));

  let assigned = counts.reduce((sum, item) => sum + item.count, 0);
  counts
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(item => {
      if (assigned < total) {
        item.count++;
        assigned++;
      }
    });

  if (total >= sideWeights.length) {
    counts.forEach(item => {
      if (item.count === 0) {
        const donor = counts.find(candidate => candidate.count > 1);
        if (donor) {
          donor.count--;
          item.count++;
        }
      }
    });
  }

  return sideWeights.map(weightedSide => ({
    side: weightedSide.side,
    count: counts.find(item => item.side === weightedSide.side)?.count || 0
  }));
}

function sidePosition(side, index, count, geometry) {
  const { tableLeft, tableTop, tableW, tableH, width, height } = geometry;

  if (side === 'top' || side === 'bottom') {
    const x = tableLeft + (tableW / (count + 1)) * (index + 1);
    return { x, y: side === 'top' ? SEAT_R : height - SEAT_R };
  }

  const y = tableTop + (tableH / (count + 1)) * (index + 1);
  return { x: side === 'left' ? SEAT_R : width - SEAT_R, y };
}

function rectangularLayout(seats, shape, sideWeights, tableClass) {
  const counts = splitCounts(seats, sideWeights);
  const horizontalSeats = Math.max(
    counts.find(item => item.side === 'top')?.count || 0,
    counts.find(item => item.side === 'bottom')?.count || 0,
    1
  );
  const verticalSeats = Math.max(
    counts.find(item => item.side === 'left')?.count || 0,
    counts.find(item => item.side === 'right')?.count || 0,
    1
  );
  const tableW = Math.max(RECT_TABLE_MIN_W, horizontalSeats * (SEAT_SIZE + SEAT_GAP));
  const tableH = shape === 'square'
    ? Math.max(tableW, RECT_TABLE_MIN_W)
    : Math.max(RECT_TABLE_MIN_H, verticalSeats * (SEAT_SIZE * 0.68 + SEAT_GAP));
  const margin = SEAT_R + SEAT_GAP;
  const geometry = {
    width: tableW + margin * 2,
    height: tableH + margin * 2,
    tableLeft: margin,
    tableTop: margin,
    tableW,
    tableH
  };
  const positions = [];

  counts.forEach(({ side, count }) => {
    for (let i = 0; i < count; i++) {
      positions.push(sidePosition(side, i, count, geometry));
    }
  });

  return {
    w: geometry.width,
    h: geometry.height,
    seats: positions.slice(0, seats),
    table: {
      className: tableClass,
      style: `left:${geometry.tableLeft}px;top:${geometry.tableTop}px;width:${tableW}px;height:${tableH}px;`
    },
    label: {
      x: geometry.tableLeft + tableW / 2,
      y: geometry.tableTop + tableH / 2
    }
  };
}

function roundLayout(seats) {
  const circumference = seats * (SEAT_SIZE + SEAT_GAP);
  const radius = Math.max(94, circumference / (2 * Math.PI));
  const tableR = Math.max(54, radius * 0.5);
  const size = (radius + SEAT_R + SEAT_GAP) * 2;
  const cx = size / 2;
  const cy = size / 2;

  return {
    w: size,
    h: size,
    seats: Array.from({ length: seats }, (_, i) => {
      const angle = (2 * Math.PI * i / seats) - Math.PI / 2;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle)
      };
    }),
    table: {
      className: 'round',
      style: `left:${cx - tableR}px;top:${cy - tableR}px;width:${tableR * 2}px;height:${tableR * 2}px;`
    },
    label: { x: cx, y: cy }
  };
}

function rowLayout(seats) {
  const width = Math.max(RECT_TABLE_MIN_W, seats * (SEAT_SIZE + SEAT_GAP) - SEAT_GAP);
  const height = SEAT_SIZE + 52;
  return {
    w: width,
    h: height,
    seats: Array.from({ length: seats }, (_, i) => ({
      x: SEAT_R + i * (SEAT_SIZE + SEAT_GAP),
      y: SEAT_R
    })),
    table: null,
    label: { x: width / 2, y: height - 18 }
  };
}

export function getSeatLayout(seats, shape) {
  switch (shape) {
    case 'round':
      return roundLayout(seats);
    case 'square':
      return rectangularLayout(seats, shape, [
        { side: 'top', weight: 1 },
        { side: 'right', weight: 1 },
        { side: 'bottom', weight: 1 },
        { side: 'left', weight: 1 }
      ], 'square');
    case 'one-side':
      return rectangularLayout(seats, shape, [{ side: 'top', weight: 1 }], 'long one-side');
    case 'two-sides':
      return rectangularLayout(seats, shape, [
        { side: 'top', weight: 1 },
        { side: 'bottom', weight: 1 }
      ], 'long two-sides');
    case 'three-sides-u':
      return rectangularLayout(seats, shape, [
        { side: 'top', weight: 2 },
        { side: 'left', weight: 1 },
        { side: 'bottom', weight: 2 }
      ], 'long three-sides-u');
    case 'three-sides-c':
      return rectangularLayout(seats, shape, [
        { side: 'top', weight: 2 },
        { side: 'right', weight: 1 },
        { side: 'bottom', weight: 2 }
      ], 'long three-sides-c');
    case 'four-sides':
      return rectangularLayout(seats, shape, [
        { side: 'top', weight: 2 },
        { side: 'right', weight: 1 },
        { side: 'bottom', weight: 2 },
        { side: 'left', weight: 1 }
      ], 'long four-sides');
    case 'row':
      return rowLayout(seats);
    default:
      return roundLayout(seats);
  }
}

export function getTableBaseDims(seats, shape) {
  const layout = getSeatLayout(seats, shape);
  return { w: layout.w, h: layout.h };
}

export function getShapeIcon(shapeId) {
  const layout = getSeatLayout(8, shapeId);
  const scale = 42 / Math.max(layout.w, layout.h);
  const table = layout.table
    ? `<rect class="shape-icon-table ${layout.table.className}" x="${layout.table.style.match(/left:([^p]+)px/)?.[1] || 0}" y="${layout.table.style.match(/top:([^p]+)px/)?.[1] || 0}" width="${layout.table.style.match(/width:([^p]+)px/)?.[1] || 0}" height="${layout.table.style.match(/height:([^p]+)px/)?.[1] || 0}" rx="7"/>`
    : '<path class="shape-icon-table row" d="M5 35H79"/>';

  const seats = layout.seats.map(seat => `<circle class="shape-icon-seat" cx="${seat.x}" cy="${seat.y}" r="10"/>`).join('');
  return `<svg class="shape-thumb" viewBox="0 0 ${layout.w} ${layout.h}" style="--thumb-scale:${scale};" aria-hidden="true">${table}${seats}</svg>`;
}

function truncateName(name) {
  return name.length > 16 ? `${name.slice(0, 15)}...` : name;
}

function seatAvatar(guest, arcId) {
  if (!guest) {
    return `
      <svg class="seat-avatar empty" viewBox="0 0 84 84" aria-hidden="true">
        <circle class="empty-seat-circle" cx="42" cy="42" r="31"/>
      </svg>
    `;
  }

  const displayName = escapeHtml(truncateName(guest.name));
  return `
    <svg class="seat-avatar person" viewBox="0 0 84 84" aria-hidden="true">
      <defs>
        <path id="${arcId}" d="M15 43 A27 27 0 0 1 69 43"/>
      </defs>
      <circle class="vip-ring" cx="42" cy="42" r="34"/>
      <circle class="person-head" cx="42" cy="31" r="12"/>
      <path class="person-shoulders" d="M22 66 C26 51 34 45 42 45 C50 45 58 51 62 66 Z"/>
      <text class="curved-name">
        <textPath href="#${arcId}" startOffset="50%" text-anchor="middle">${displayName}</textPath>
      </text>
    </svg>
  `;
}

function seatHtml(guest, tableIndex, seatIndex, isSelected, isMoveTarget) {
  const pinned = guest && guest.pinnedToTable === tableIndex && guest.pinnedSeat === seatIndex;
  const classes = [
    'seat',
    guest ? 'occupied' : 'empty-seat',
    guest?.gender || '',
    guest?.vip ? 'vip' : '',
    pinned ? 'pinned' : '',
    isSelected ? 'selected' : '',
    isMoveTarget ? 'move-target' : ''
  ].filter(Boolean).join(' ');
  const arcId = `seat-name-${tableIndex}-${seatIndex}`;
  const dataGuest = guest ? `data-guest="${guest.id}"` : '';
  const title = guest ? escapeHtml(`${guest.name}${pinned ? ' (pinned)' : ''}`) : 'Empty seat';
  const ariaLabel = guest
    ? `${escapeHtml(guest.name)} at ${tableLabel(state.tables[tableIndex], tableIndex)}, seat ${seatIndex + 1}`
    : `${tableLabel(state.tables[tableIndex], tableIndex)}, empty seat ${seatIndex + 1}`;
  const pinButton = guest
    ? `<button class="seat-pin-btn" data-pin-seat="${guest.id}" data-table="${tableIndex}" data-seat="${seatIndex}" title="${pinned ? 'Unpin this seat' : 'Pin to this exact seat'}" aria-label="${pinned ? 'Unpin' : 'Pin'} ${escapeHtml(guest.name)}">${SVG.pin}</button>`
    : '';

  return `<div class="${classes}" data-table="${tableIndex}" data-seat="${seatIndex}" ${dataGuest} title="${title}" role="button" tabindex="0" aria-label="${ariaLabel}">
    ${seatAvatar(guest, arcId)}
    ${pinButton}
  </div>`;
}

function tableLabel(table, tableIndex) {
  const name = table.name.trim();
  return escapeHtml(name || `Table ${tableIndex + 1}`);
}

export function renderTable(ti, table, guestIds) {
  const layout = getSeatLayout(table.seats, table.shape);
  let html = `<div class="table-visual ${table.shape}" style="width:${layout.w}px;height:${layout.h}px;">`;

  if (layout.table) {
    html += `<div class="table-shape ${layout.table.className}" style="${layout.table.style}"></div>`;
  }

  html += `<div class="table-center-label" style="left:${layout.label.x}px;top:${layout.label.y}px;">${tableLabel(table, ti)}</div>`;

  layout.seats.forEach((position, seatIndex) => {
    const gid = guestIds[seatIndex];
    const guest = gid ? state.guests.find(g => g.id === gid) : null;
    const selected = state.selectedSeat?.tableIndex === ti && state.selectedSeat?.seatIndex === seatIndex;
    const moveTarget = Boolean(state.selectedSeat && !selected);
    html += `<div class="seat-position" style="left:${position.x}px;top:${position.y}px;">${seatHtml(guest, ti, seatIndex, selected, moveTarget)}</div>`;
  });

  return `${html}</div>`;
}
