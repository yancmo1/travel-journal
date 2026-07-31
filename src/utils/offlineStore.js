const DB_NAME = 'where-weve-been-offline-v1';
const DB_VERSION = 2;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable')); return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots');
      if (!db.objectStoreNames.contains('mutations')) {
        const store = db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains('uploads')) db.createObjectStore('uploads', { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open offline storage'));
  });
}

async function transaction(storeName, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Offline storage request failed'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error || new Error('Offline storage transaction failed'));
  });
}

export async function getSnapshot(userId) {
  try { return await transaction('snapshots', 'readonly', store => store.get(String(userId))); }
  catch { return null; }
}

export async function saveSnapshot(userId, snapshot) {
  try { await transaction('snapshots', 'readwrite', store => store.put(snapshot, String(userId))); }
  catch (error) { console.warn('Offline snapshot could not be saved:', error); }
}

export async function enqueueMutation(mutation) {
  return transaction('mutations', 'readwrite', store => store.add({ ...mutation, createdAt: Date.now() }));
}

export async function getMutations(userId) {
  try {
    return (await transaction('mutations', 'readonly', store => store.index('userId').getAll(String(userId)))) || [];
  } catch { return []; }
}

export async function removeMutation(id) {
  return transaction('mutations', 'readwrite', store => store.delete(id));
}

export async function enqueueUpload(upload) {
  return transaction('uploads', 'readwrite', store => store.add({ ...upload, createdAt: Date.now() }));
}

export async function getUploads(userId) {
  try {
    return (await transaction('uploads', 'readonly', store => store.getAll()))
      .filter(item => String(item.userId) === String(userId));
  } catch { return []; }
}

export async function removeUpload(id) {
  return transaction('uploads', 'readwrite', store => store.delete(id));
}

export async function removeMutationsForEntity(userId, entity, entityId) {
  const mutations = await getMutations(userId);
  await Promise.all(mutations
    .filter(item => item.entity === entity && String(item.entityId) === String(entityId))
    .map(item => removeMutation(item.id)));
}

export async function clearOfflineData(userId) {
  try {
    const mutations = await getMutations(userId);
    await Promise.all(mutations.map(item => removeMutation(item.id)));
    const uploads = await getUploads(userId);
    await Promise.all(uploads.map(item => removeUpload(item.id)));
    await transaction('snapshots', 'readwrite', store => {
      store.delete(String(userId));
      return store.delete('last-user');
    });
  } catch (error) { console.warn('Offline data could not be cleared:', error); }
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* Storage persistence is an enhancement. */ }
  return false;
}
