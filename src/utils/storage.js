const STORAGE_KEY = 'travelData_v1'

const defaultData = {
  trips: [],
  settings: {
    distanceUnit: 'miles',
    dateFormat: 'YYYY-MM-DD'
  }
}

function getData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData
    return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to read storage', e)
    return defaultData
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to write storage', e)
  }
}

function exportJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'travel-data.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function importJSON(file) {
  const text = await file.text()
  return JSON.parse(text)
}

export default { getData, saveData, exportJSON, importJSON }
