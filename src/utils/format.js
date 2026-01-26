export function formatDateDisplay(dateStr) {
  if (!dateStr) return ''
  // expect YYYY-MM-DD or ISO; try to parse
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

export function formatDateForSave(value) {
  // value from input[type=date] is already YYYY-MM-DD; if empty return ''
  return value || ''
}
