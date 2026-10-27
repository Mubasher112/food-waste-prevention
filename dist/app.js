import { CATEGORIES, LOCATIONS, UNITS, uid, todayISO, freshness, useSoon, normalizeItem, exportPayload } from './model.js';

const STORE_KEY = 'freshloop.v1';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const defaultState = () => ({ profile: null, items: [], shopping: [], activity: [] });
let state = load();
let toastTimer;

function load() {
  try { return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
  catch { return defaultState(); }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); render(); }
function esc(value = '') { const d = document.createElement('div'); d.textContent = String(value); return d.innerHTML; }
function displayDate(value) { return value ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(value + 'T12:00:00')) : 'No date'; }
function announce(message) { const el = $('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200); }
function log(action, item) { state.activity.unshift({ id: uid('activity'), action, item: item.name, at: new Date().toISOString() }); state.activity = state.activity.slice(0, 100); }

function seedItems() {
  const today = new Date();
  const plus = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return todayISO(d); };
  return [
    normalizeItem({ name: 'Fresh spinach', category: 'Fruit & vegetables', quantity: 1, unit: 'packs', location: 'Fridge', date: plus(1), dateType: 'use-by', dateSource: 'entered' }),
    normalizeItem({ name: 'Plain yoghurt', brand: 'Local dairy', category: 'Dairy & eggs', quantity: 500, unit: 'g', location: 'Fridge', date: plus(3), dateType: 'best-before', dateSource: 'entered' }),
    normalizeItem({ name: 'Cooked daal', category: 'Other', quantity: 2, unit: 'packs', location: 'Fridge', date: plus(2), dateType: 'other', dateSource: 'estimated', notes: 'Leftovers from dinner' }),
    normalizeItem({ name: 'Basmati rice', category: 'Grains & bakery', quantity: 1.5, unit: 'kg', location: 'Pantry', date: '', dateSource: 'entered' })
  ];
}

function initialize() {
  CATEGORIES.forEach((v) => $('[name=category]').add(new Option(v, v)));
  LOCATIONS.forEach((v) => { $('[name=location]').add(new Option(v, v)); $('#locationFilter').add(new Option(v, v)); });
  UNITS.forEach((v) => $('[name=unit]').add(new Option(v, v)));
  $('#todayDate').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase();
  bindEvents();
  if (state.profile) showApp(); else $('#onboarding').hidden = false;
  updateOnline();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

function showApp() { $('#onboarding').hidden = true; $('#app').hidden = false; render(); }
function bindEvents() {
  $('#onboardingForm').addEventListener('submit', (event) => {
    event.preventDefault(); const fd = new FormData(event.currentTarget);
    state.profile = { household: fd.get('household').trim(), currency: fd.get('currency'), language: fd.get('language'), createdAt: new Date().toISOString() };
    state.items = seedItems(); save(); showApp(); announce('Welcome to FreshLoop. Sample items are ready to explore.');
  });
  $$('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  $$('[data-view-target]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.viewTarget)));
  $$('.add-food').forEach((button) => button.addEventListener('click', () => openItemDialog()));
  $('#mobileAdd').addEventListener('click', () => openItemDialog());
  $('#itemForm').addEventListener('submit', saveItem);
  $('#inventorySearch').addEventListener('input', renderInventory);
  $('#locationFilter').addEventListener('change', renderInventory);
  $('#statusFilter').addEventListener('change', renderInventory);
  $('#shoppingForm').addEventListener('submit', addShopping);
  $('#saveSettings').addEventListener('click', saveSettings);
  $('#exportData').addEventListener('click', exportData);
  $('#deleteData').addEventListener('click', deleteData);
  window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);
  document.addEventListener('click', (event) => { if (!event.target.closest('.status-menu')) $$('.more-menu').forEach((m) => m.hidden = true); });
}

function switchView(view) {
  $$('.view').forEach((el) => { el.hidden = el.id !== `${view}View`; });
  $$('.nav-item[data-view]').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  if (view === 'settings') { $('#householdName').value = state.profile.household; $('#currencySetting').value = state.profile.currency; }
  $('#main').focus(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  if (!state.profile) return;
  const available = state.items.filter((i) => i.status === 'available');
  const consumed = state.items.filter((i) => i.status === 'consumed');
  const soon = useSoon(state.items);
  $('#navInventoryCount').textContent = available.length;
  $('#navShoppingCount').textContent = state.shopping.filter((i) => !i.done).length;
  $('#consumedStat').textContent = consumed.length;
  $('#savedStat').textContent = consumed.length ? 'Recorded as fully used' : 'A thoughtful start';
  if (soon.length) { const first = soon[0]; $('#heroTitle').textContent = `Use ${first.name.toLowerCase()} next`; $('#heroMeta').textContent = `${displayDate(first.date)} · ${first.dateSource === 'estimated' ? 'Estimated date' : 'User-entered date'} · ${first.location}`; }
  else { $('#heroTitle').textContent = 'Your kitchen is clear'; $('#heroMeta').textContent = 'No available items are within three days of their date.'; }
  $('#useSoonList').innerHTML = soon.length ? soon.slice(0, 3).map(foodCard).join('') : '<div class="empty-card"><h3>Nothing needs urgent attention</h3><p>Add a date to an inventory item and it will appear here when the time is near.</p></div>';
  const locations = LOCATIONS.map((location) => ({ label: location, count: available.filter((i) => i.location === location).length }));
  $('#kitchenStats').innerHTML = locations.map((x) => `<div class="kitchen-stat"><strong>${x.count}</strong><small>${x.label}</small></div>`).join('');
  renderInventory(); renderShopping();
}

function foodCard(item) {
  const f = freshness(item); const qty = item.quantity == null ? 'Quantity unknown' : `${item.quantity} ${esc(item.unit)}`;
  return `<article class="food-card"><span class="food-icon">${categoryIcon(item.category)}</span><div><h3>${esc(item.name)}</h3><p>${qty} · ${esc(item.location)}<br>${item.dateSource === 'estimated' ? 'Estimated date' : 'User-entered date'} · ${esc(item.dateType.replace('-', ' '))}</p></div><span class="date-chip ${f.key}">${esc(f.label)}</span></article>`;
}
function categoryIcon(category) { return ({ 'Fruit & vegetables': '◒', 'Dairy & eggs': '◯', 'Meat & fish': '◇', 'Grains & bakery': '≋', 'Drinks': '◡' })[category] || '✦'; }

function renderInventory() {
  const query = ($('#inventorySearch')?.value || '').trim().toLowerCase(); const location = $('#locationFilter')?.value || ''; const status = $('#statusFilter')?.value ?? 'available';
  const items = state.items.filter((i) => (!query || [i.name, i.brand, i.category].some((v) => v.toLowerCase().includes(query))) && (!location || i.location === location) && (!status || i.status === status)).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  $('#inventoryList').innerHTML = items.length ? items.map((item) => { const f = freshness(item); return `<article class="inventory-row" data-id="${item.id}"><div class="row-main"><span class="food-icon">${categoryIcon(item.category)}</span><div><h3>${esc(item.name)}</h3><small>${item.quantity == null ? 'Unknown quantity' : `${item.quantity} ${esc(item.unit)}`}${item.brand ? ` · ${esc(item.brand)}` : ''}</small></div></div><small class="category-cell">${esc(item.category)}</small><small class="location-cell">${esc(item.location)}</small><div class="date-cell"><strong>${displayDate(item.date)}</strong><br><small>${item.date ? `${item.dateSource === 'estimated' ? 'Estimated' : 'User-entered'} · ${esc(item.dateType.replace('-', ' '))}` : 'Date unknown'}</small></div><div class="row-actions"><button class="icon-btn" data-edit="${item.id}" aria-label="Edit ${esc(item.name)}">✎</button><div class="status-menu"><button class="icon-btn" data-menu="${item.id}" aria-label="More actions for ${esc(item.name)}">•••</button><div class="more-menu" hidden><button data-status="consumed">Mark consumed</button><button data-status="discarded">Mark discarded</button><button data-status="available">Restore as available</button><button data-delete="${item.id}">Remove item</button></div></div></div></article>`; }).join('') : '<div class="empty-card"><h3>No items found</h3><p>Try another filter or add something to your kitchen.</p></div>';
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => openItemDialog(state.items.find((i) => i.id === b.dataset.edit))));
  $$('[data-menu]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const m = b.nextElementSibling; $$('.more-menu').forEach((x) => { if (x !== m) x.hidden = true; }); m.hidden = !m.hidden; }));
  $$('[data-status]').forEach((b) => b.addEventListener('click', () => setItemStatus(b.closest('.inventory-row').dataset.id, b.dataset.status)));
  $$('[data-delete]').forEach((b) => b.addEventListener('click', () => removeItem(b.dataset.delete)));
}

function openItemDialog(item = null) {
  const form = $('#itemForm'); form.reset(); $('#itemDialogTitle').textContent = item ? 'Edit food' : 'Add food'; form.elements.id.value = item?.id || '';
  if (item) Object.entries(item).forEach(([key, value]) => { const field = form.elements[key]; if (field && key !== 'dateSource') field.value = value ?? ''; });
  if (item?.dateSource) form.querySelector(`[name=dateSource][value=${item.dateSource}]`).checked = true;
  $('#itemDialog').showModal(); setTimeout(() => form.elements.name.focus(), 0);
}
function saveItem(event) {
  event.preventDefault(); const submitter = event.submitter; if (submitter?.value === 'cancel') { $('#itemDialog').close(); return; }
  if (!event.currentTarget.reportValidity()) return;
  const data = Object.fromEntries(new FormData(event.currentTarget)); const existing = state.items.find((i) => i.id === data.id);
  try { const item = normalizeItem(data, existing); if (existing) state.items[state.items.indexOf(existing)] = item; else state.items.push(item); log(existing ? 'updated' : 'added', item); save(); $('#itemDialog').close(); announce(existing ? 'Item updated.' : 'Food added to your kitchen.'); }
  catch (error) { announce(error.message); }
}
function setItemStatus(id, status) { const item = state.items.find((i) => i.id === id); if (!item) return; item.status = status; item.updatedAt = new Date().toISOString(); log(`marked ${status}`, item); save(); announce(`${item.name} marked ${status}.`); }
function removeItem(id) { const item = state.items.find((i) => i.id === id); if (!item || !confirm(`Remove “${item.name}”? This cannot be undone.`)) return; state.items = state.items.filter((i) => i.id !== id); log('removed', item); save(); announce('Item removed.'); }

function addShopping(event) { event.preventDefault(); const fd = new FormData(event.currentTarget); const name = fd.get('name').trim(); if (state.shopping.some((i) => !i.done && i.name.toLowerCase() === name.toLowerCase()) && !confirm(`${name} is already on the list. Add another?`)) return; state.shopping.push({ id: uid('shop'), name, quantity: fd.get('quantity').trim(), done: false, createdAt: new Date().toISOString() }); event.currentTarget.reset(); save(); announce('Added to shopping list.'); }
function renderShopping() {
  const sorted = [...state.shopping].sort((a, b) => Number(a.done) - Number(b.done));
  $('#shoppingList').innerHTML = sorted.length ? sorted.map((item) => { const home = state.items.some((i) => i.status === 'available' && i.name.toLowerCase().includes(item.name.toLowerCase())); return `<article class="shopping-item ${item.done ? 'done' : ''}" data-shop-id="${item.id}"><input type="checkbox" ${item.done ? 'checked' : ''} aria-label="Mark ${esc(item.name)} ${item.done ? 'not purchased' : 'purchased'}"><div><strong class="item-name">${esc(item.name)}</strong>${item.quantity ? `<br><small>${esc(item.quantity)}</small>` : ''}</div>${home ? '<span class="home-note">May be at home</span>' : '<span></span>'}<button class="icon-btn" aria-label="Remove ${esc(item.name)}">×</button></article>`; }).join('') : '<div class="empty-card"><h3>Your list is beautifully empty</h3><p>Add only what you need. FreshLoop will flag possible matches already at home.</p></div>';
  $$('.shopping-item input').forEach((box) => box.addEventListener('change', () => { const item = state.shopping.find((i) => i.id === box.closest('.shopping-item').dataset.shopId); item.done = box.checked; save(); }));
  $$('.shopping-item button').forEach((button) => button.addEventListener('click', () => { state.shopping = state.shopping.filter((i) => i.id !== button.closest('.shopping-item').dataset.shopId); save(); announce('List item removed.'); }));
}
function saveSettings() { state.profile.household = $('#householdName').value.trim() || 'My household'; state.profile.currency = $('#currencySetting').value; save(); announce('Settings saved.'); }
function exportData() { const blob = new Blob([JSON.stringify(exportPayload(state), null, 2)], { type: 'application/json' }); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `freshloop-export-${todayISO()}.json` }); a.click(); URL.revokeObjectURL(a.href); announce('Data export downloaded.'); }
function deleteData() { if (!confirm('Delete all FreshLoop data stored in this browser? This cannot be undone. Export first if you need a copy.')) return; localStorage.removeItem(STORE_KEY); location.reload(); }
function updateOnline() { $('#offlineBanner').hidden = navigator.onLine; document.body.classList.toggle('is-offline', !navigator.onLine); }

initialize();
