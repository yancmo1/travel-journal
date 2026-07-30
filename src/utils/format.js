export function parseDateValue(dateStr) {
  if (!dateStr) return null;

  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  }

  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateOnly(dateStr, options) {
  const date = parseDateValue(dateStr);
  return date ? date.toLocaleDateString('en-US', options) : dateStr || '';
}

export function formatDateDisplay(dateStr) {
  const date = parseDateValue(dateStr);
  if (!date) return dateStr || '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function formatDateForSave(value) {
  // value from input[type=date] is already YYYY-MM-DD; if empty return ''
  return value || '';
}
