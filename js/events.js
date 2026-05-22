import { state, saveState, resetState, DEFAULT_SEATS } from './state.js';
import { shuffle } from './shuffle.js';
import { addGuest, deleteGuest, togglePin } from './guests.js';
import { SVG } from './icons.js';
import { render, renderGuestList } from './render.js';

let selectedGender = 'M';

function updateGenderIcon() {
  const btn = document.getElementById('genderToggle');
  btn.innerHTML = selectedGender === 'M' ? SVG.male : SVG.female;
  const ic = btn.querySelector('.icon');
  if (ic) { ic.style.width = '18px'; ic.style.height = '18px'; }
}

export function initEvents() {
  document.getElementById('genderToggle').addEventListener('click', () => {
    selectedGender = selectedGender === 'M' ? 'F' : 'M';
    updateGenderIcon();
  });

  document.getElementById('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = document.getElementById('nameInput');
    const name = inp.value.trim();
    if (!name) return;
    addGuest(name, selectedGender, render);
    inp.value = '';
    inp.focus();
  });

  // Delegated delete clicks (virtual scroll means buttons are re-created)
  document.getElementById('guestList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete]');
    if (btn) deleteGuest(btn.dataset.delete, render);
  });

  // Delegated pin clicks on table seats
  document.getElementById('tablesGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.seat-pin-btn');
    if (btn) togglePin(btn.dataset.guest, parseInt(btn.dataset.table, 10), render);
  });

  document.getElementById('shuffleBtn').addEventListener('click', () => shuffle(render));

  document.getElementById('guestListScroll').addEventListener('scroll', renderGuestList);

  document.getElementById('tableCount').addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    if (val >= 1 && val <= 50) {
      while (state.tables.length < val) state.tables.push({ seats: DEFAULT_SEATS });
      while (state.tables.length > val) state.tables.pop();
      saveState();
      if (Object.keys(state.assignments).length > 0 && state.guests.length > 0) shuffle(render);
      else render();
    }
  });

  document.getElementById('tableSizes').addEventListener('change', (e) => {
    if (e.target.classList.contains('table-seat-input')) {
      const idx = parseInt(e.target.dataset.tidx, 10);
      const val = parseInt(e.target.value, 10);
      if (val >= 1 && val <= 30 && state.tables[idx]) {
        state.tables[idx].seats = val;
        saveState();
        if (Object.keys(state.assignments).length > 0 && state.guests.length > 0) shuffle(render);
        else render();
      }
    }
  });

  document.querySelectorAll('.shape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tableShape = btn.dataset.shape;
      saveState();
      render();
    });
  });

  document.getElementById('clearAll').addEventListener('click', () => {
    if (confirm('Clear all guests and assignments?')) {
      resetState();
      render();
    }
  });

  window.addEventListener('resize', () => render());
}
