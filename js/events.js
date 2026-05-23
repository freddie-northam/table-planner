import { DEFAULT_SEATS, TABLE_SHAPE_OPTIONS, createTable, state, saveState, resetState } from './state.js';
import { shuffle } from './shuffle.js';
import {
  addGuest,
  cycleGuestRsvp,
  deleteGuest,
  setGuestMeal,
  swapSeats,
  toggleGuestVip,
  togglePin
} from './guests.js';
import { SVG } from './icons.js';
import { render } from './render.js';

let selectedGender = 'M';
const SHAPE_IDS = new Set(TABLE_SHAPE_OPTIONS.map(shape => shape.id));

function updateGenderIcon() {
  const btn = document.getElementById('genderToggle');
  btn.innerHTML = selectedGender === 'M' ? SVG.male : SVG.female;
  btn.classList.toggle('female', selectedGender === 'F');
}

function setActiveTab(tab) {
  state.activeTab = tab;
  state.selectedSeat = null;
  saveState();
  render();
}

function parseIndex(value) {
  const index = Number.parseInt(value, 10);
  return Number.isInteger(index) ? index : null;
}

function wireTabs() {
  document.getElementById('tabBar').addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]');
    if (!tab) return;
    setActiveTab(tab.dataset.tab);
  });
}

function wireGuests() {
  document.getElementById('genderToggle').addEventListener('click', () => {
    selectedGender = selectedGender === 'M' ? 'F' : 'M';
    updateGenderIcon();
  });

  document.getElementById('addForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('nameInput');
    addGuest(input.value, selectedGender, render);
    input.value = '';
    input.focus();
  });

  document.getElementById('guestSearch').addEventListener('input', event => {
    state.guestSearch = event.target.value;
    saveState();
    render();
  });

  document.getElementById('guestFilterBar').addEventListener('click', event => {
    const filter = event.target.closest('[data-guest-filter]');
    if (!filter) return;
    state.guestFilter = filter.dataset.guestFilter;
    saveState();
    render();
  });

  document.getElementById('guestTable').addEventListener('click', event => {
    const sort = event.target.closest('[data-sort]');
    if (sort) {
      const key = sort.dataset.sort;
      state.guestSort = {
        key,
        direction: state.guestSort.key === key && state.guestSort.direction === 'asc' ? 'desc' : 'asc'
      };
      saveState();
      render();
      return;
    }

    const vip = event.target.closest('[data-vip]');
    if (vip) {
      toggleGuestVip(vip.dataset.vip, render);
      return;
    }

    const rsvp = event.target.closest('[data-rsvp]');
    if (rsvp) {
      cycleGuestRsvp(rsvp.dataset.rsvp, render);
      return;
    }

    const pin = event.target.closest('[data-pin-current]');
    if (pin && !pin.disabled) {
      togglePin(pin.dataset.pinCurrent, null, null, render);
      return;
    }

    const del = event.target.closest('[data-delete]');
    if (del) {
      deleteGuest(del.dataset.delete, render);
    }
  });

  document.getElementById('guestTable').addEventListener('change', event => {
    const meal = event.target.closest('[data-meal]');
    if (meal) setGuestMeal(meal.dataset.meal, meal.value, render);
  });
}

function wireFloor() {
  document.getElementById('shuffleBtn').addEventListener('click', () => shuffle(render));

  document.getElementById('tablesGrid').addEventListener('click', event => {
    const pin = event.target.closest('[data-pin-seat]');
    if (pin) {
      event.stopPropagation();
      togglePin(
        pin.dataset.pinSeat,
        parseIndex(pin.dataset.table),
        parseIndex(pin.dataset.seat),
        render
      );
      return;
    }

    const seat = event.target.closest('.seat[data-table][data-seat]');
    if (!seat) {
      const tableCard = event.target.closest('[data-table-card]');
      if (!tableCard) return;
      const tableIndex = parseIndex(tableCard.dataset.tableCard);
      if (!Number.isInteger(tableIndex)) return;
      state.selectedTableIndex = tableIndex;
      saveState();
      render();
      return;
    }

    const tableIndex = parseIndex(seat.dataset.table);
    const seatIndex = parseIndex(seat.dataset.seat);
    const guestId = seat.dataset.guest;
    if (!Number.isInteger(tableIndex) || !Number.isInteger(seatIndex)) return;

    if (!state.selectedSeat) {
      if (!guestId) return;
      state.selectedSeat = { tableIndex, seatIndex };
      state.selectedTableIndex = tableIndex;
      render();
      return;
    }

    swapSeats(state.selectedSeat, { tableIndex, seatIndex }, render);
  });
}

function wireSetup() {
  document.getElementById('addTableBtn').addEventListener('click', () => {
    state.tables.push(createTable({ seats: DEFAULT_SEATS }));
    saveState();
    render();
  });

  document.getElementById('setupTables').addEventListener('click', event => {
    const shape = event.target.closest('[data-table-shape]');
    if (shape) {
      const tableIndex = parseIndex(shape.dataset.tableShape);
      if (state.tables[tableIndex] && SHAPE_IDS.has(shape.dataset.shape)) {
        state.tables[tableIndex].shape = shape.dataset.shape;
        saveState();
        render();
      }
      return;
    }

    const remove = event.target.closest('[data-remove-table]');
    if (remove && !remove.disabled) {
      const tableIndex = parseIndex(remove.dataset.removeTable);
      if (state.tables.length > 1 && state.tables[tableIndex]) {
        state.tables.splice(tableIndex, 1);
        for (const guest of state.guests) {
          if (guest.pinnedToTable === tableIndex || guest.pinnedToTable >= state.tables.length) {
            guest.pinnedToTable = null;
            guest.pinnedSeat = null;
          } else if (guest.pinnedToTable > tableIndex) {
            guest.pinnedToTable--;
          }
        }
        state.assignments = {};
        state.selectedSeat = null;
        saveState();
        render();
      }
    }
  });

  document.getElementById('setupTables').addEventListener('change', event => {
    const seats = event.target.closest('[data-table-seats]');
    if (seats) {
      const tableIndex = parseIndex(seats.dataset.tableSeats);
      const value = Number.parseInt(seats.value, 10);
      if (state.tables[tableIndex] && value >= 1 && value <= 60) {
        state.tables[tableIndex].seats = value;
        const row = state.assignments[tableIndex] || [];
        state.assignments[tableIndex] = row.slice(0, value);
        state.guests.forEach(guest => {
          if (guest.pinnedToTable === tableIndex && guest.pinnedSeat >= value) {
            guest.pinnedToTable = null;
            guest.pinnedSeat = null;
          }
        });
        saveState();
        render();
      }
    }
  });

  document.getElementById('setupTables').addEventListener('input', event => {
    const name = event.target.closest('[data-table-name]');
    if (name) {
      const tableIndex = parseIndex(name.dataset.tableName);
      if (state.tables[tableIndex]) {
        state.tables[tableIndex].name = name.value;
        saveState();
      }
    }
  });
}

function wireMeals() {
  document.getElementById('mealOptionForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('mealOptionInput');
    const option = input.value.trim();
    if (option && !state.mealOptions.some(existing => existing.toLowerCase() === option.toLowerCase())) {
      state.mealOptions.push(option);
      saveState();
      render();
    }
    input.value = '';
    input.focus();
  });

  document.getElementById('mealOptionsList').addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-meal]');
    if (!remove) return;
    const option = remove.dataset.removeMeal;
    state.mealOptions = state.mealOptions.filter(item => item !== option);
    state.guests.forEach(guest => {
      if (guest.meal === option) guest.meal = null;
    });
    saveState();
    render();
  });
}

export function initEvents() {
  updateGenderIcon();
  wireTabs();
  wireGuests();
  wireFloor();
  wireSetup();
  wireMeals();

  document.getElementById('clearAll').addEventListener('click', () => {
    if (confirm('Clear all guests and assignments?')) {
      resetState();
      render();
    }
  });

  window.addEventListener('resize', () => render());
}
