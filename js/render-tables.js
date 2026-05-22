import { state } from './state.js';
import { escapeHtml } from './guests.js';
import { SVG } from './icons.js';

export const SEAT_W = 90;
export const SEAT_H = 56;
export const SEAT_GAP = 10;

function seatHtml(guest, tableIndex, isPinned) {
  if (!guest) return '<span class="seat-name">Empty</span>';
  return `<span class="seat-name">${escapeHtml(guest.name)}</span><button class="seat-pin-btn" data-guest="${guest.id}" data-table="${tableIndex}" title="${isPinned ? 'Unpin' : 'Pin'}">${SVG.pin}</button>`;
}

function seatDiv(g, ti, x, y) {
  const pinned = g && g.pinnedToTable === ti;
  const cls = g ? `occupied ${g.gender} ${pinned ? 'pinned' : ''}` : 'empty-seat';
  return `<div class="seat ${cls}" style="left:${x}px;top:${y}px;">${seatHtml(g, ti, pinned)}</div>`;
}

// For rectangular tables: 2 end seats (head + foot), rest split top/bottom
function rectLayout(seats) {
  const hasEnds = seats >= 6;
  const endSeats = hasEnds ? 2 : 0;
  const sideSeats = seats - endSeats;
  const topC = Math.ceil(sideSeats / 2);
  const botC = Math.floor(sideSeats / 2);
  return { hasEnds, topC, botC };
}

export function getTableBaseDims(seats, shape) {
  if (shape === 'round') {
    const slotSize = SEAT_W + SEAT_GAP;
    const circumference = seats * slotSize;
    const radius = Math.max(60, circumference / (2 * Math.PI));
    const sz = (radius + SEAT_H / 2 + 10) * 2;
    return { w: sz, h: sz };
  } else {
    const { hasEnds, topC } = rectLayout(seats);
    const slotW = SEAT_W + SEAT_GAP;
    const sideMargin = hasEnds ? SEAT_W + SEAT_GAP * 2 : SEAT_GAP * 2;
    const totalW = topC * slotW + sideMargin;
    const totalH = SEAT_H + 16 + SEAT_H * 1.2 + 16 + SEAT_H;
    return { w: totalW, h: totalH };
  }
}

export function renderRoundTable(ti, seats, guestIds) {
  const slotSize = SEAT_W + SEAT_GAP;
  const circumference = seats * slotSize;
  const radius = Math.max(60, circumference / (2 * Math.PI));
  const tableR = radius * 0.55;
  const sz = (radius + SEAT_H / 2 + 10) * 2;
  const cx = sz / 2, cy = sz / 2;

  let h = `<div class="table-visual" style="width:${sz}px;height:${sz}px;">`;
  h += `<div class="table-shape round" style="width:${tableR * 2}px;height:${tableR * 2}px;"></div>`;

  for (let i = 0; i < seats; i++) {
    const a = (2 * Math.PI * i / seats) - Math.PI / 2;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    const gid = guestIds[i];
    const g = gid ? state.guests.find(g2 => g2.id === gid) : null;
    h += seatDiv(g, ti, x, y);
  }
  return h + '</div>';
}

export function renderRectTable(ti, seats, guestIds) {
  const { hasEnds, topC, botC } = rectLayout(seats);
  const slotW = SEAT_W + SEAT_GAP;
  const maxSideC = Math.max(topC, botC);

  // Dimensions
  const sideMargin = hasEnds ? SEAT_W / 2 + SEAT_GAP * 2 : SEAT_GAP;
  const seatsRowW = maxSideC * slotW;
  const totalW = seatsRowW + sideMargin * 2;
  const tH = Math.round(SEAT_H * 1.2); // table height — prominent
  const seatAreaTop = SEAT_H / 2;       // top row center Y
  const tableTop = SEAT_H + 16;         // table starts after top seats + gap
  const tableBot = tableTop + tH;
  const seatAreaBot = tableBot + 16 + SEAT_H / 2; // bottom row center Y
  const totalH = seatAreaBot + SEAT_H / 2;

  // Table shape — spans from seat row edge to edge
  const tW = seatsRowW + SEAT_GAP;

  let h = `<div class="table-visual" style="width:${totalW}px;height:${totalH}px;">`;
  h += `<div class="table-shape rectangle" style="width:${tW}px;height:${tH}px;top:${tableTop + tH / 2}px;"></div>`;

  let gIdx = 0;

  // Top row — centered in the seats area
  const topRowW = topC * slotW;
  const topOffset = (totalW - topRowW) / 2;
  for (let i = 0; i < topC; i++) {
    const x = topOffset + slotW * i + slotW / 2;
    const g = guestIds[gIdx] ? state.guests.find(g2 => g2.id === guestIds[gIdx]) : null;
    h += seatDiv(g, ti, x, seatAreaTop);
    gIdx++;
  }

  // Head of table (left end)
  if (hasEnds) {
    const endY = tableTop + tH / 2;
    const g = guestIds[gIdx] ? state.guests.find(g2 => g2.id === guestIds[gIdx]) : null;
    h += seatDiv(g, ti, SEAT_W / 2, endY);
    gIdx++;
  }

  // Bottom row — centered
  const botRowW = botC * slotW;
  const botOffset = (totalW - botRowW) / 2;
  for (let i = 0; i < botC; i++) {
    const x = botOffset + slotW * i + slotW / 2;
    const g = guestIds[gIdx] ? state.guests.find(g2 => g2.id === guestIds[gIdx]) : null;
    h += seatDiv(g, ti, x, seatAreaBot);
    gIdx++;
  }

  // Foot of table (right end)
  if (hasEnds) {
    const endY = tableTop + tH / 2;
    const g = guestIds[gIdx] ? state.guests.find(g2 => g2.id === guestIds[gIdx]) : null;
    h += seatDiv(g, ti, totalW - SEAT_W / 2, endY);
    gIdx++;
  }

  return h + '</div>';
}
