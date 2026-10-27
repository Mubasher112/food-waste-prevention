export const CATEGORIES = ['Fruit & vegetables', 'Dairy & eggs', 'Meat & fish', 'Grains & bakery', 'Canned & pantry', 'Snacks', 'Drinks', 'Other'];
export const LOCATIONS = ['Fridge', 'Freezer', 'Pantry'];
export const UNITS = ['pieces', 'g', 'kg', 'ml', 'L', 'packs'];

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function daysUntil(date, now = new Date()) {
  if (!date) return null;
  const start = new Date(todayISO(now) + 'T00:00:00');
  const end = new Date(date + 'T00:00:00');
  return Math.round((end - start) / 86400000);
}

export function freshness(item, now = new Date()) {
  if (!item.date) return { key: 'unknown', label: 'No date', days: null };
  const days = daysUntil(item.date, now);
  if (days < 0) return { key: 'passed', label: `${Math.abs(days)}d past date`, days };
  if (days === 0) return { key: 'today', label: 'Date is today', days };
  if (days <= 3) return { key: 'soon', label: `${days}d remaining`, days };
  return { key: 'fresh', label: `${days}d remaining`, days };
}

export function useSoon(items, now = new Date()) {
  return items
    .filter((item) => item.status === 'available' && item.date && daysUntil(item.date, now) <= 3)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeItem(input, existing = {}) {
  const quantity = input.quantity === '' || input.quantity == null ? null : Number(input.quantity);
  if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) throw new Error('Quantity must be zero or greater.');
  if (!String(input.name || '').trim()) throw new Error('Item name is required.');
  return {
    id: existing.id || uid('food'),
    name: String(input.name).trim(),
    brand: String(input.brand || '').trim(),
    category: input.category || 'Other',
    quantity,
    unit: input.unit || 'pieces',
    location: input.location || 'Fridge',
    date: input.date || '',
    dateType: input.dateType || 'best-before',
    dateSource: input.dateSource || 'entered',
    notes: String(input.notes || '').trim(),
    status: input.status || existing.status || 'available',
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function reduceQuantity(item, amount) {
  const used = Number(amount);
  if (!Number.isFinite(used) || used <= 0) throw new Error('Enter an amount greater than zero.');
  if (item.quantity == null) throw new Error('Set a quantity before recording partial use.');
  if (used > item.quantity) throw new Error('Amount used cannot exceed the available quantity.');
  const quantity = Math.round((item.quantity - used) * 1000) / 1000;
  return { ...item, quantity, status: quantity === 0 ? 'consumed' : item.status, updatedAt: new Date().toISOString() };
}

export function exportPayload(state) {
  return { format: 'freshloop-export', version: 1, exportedAt: new Date().toISOString(), data: state };
}
