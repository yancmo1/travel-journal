import test from 'node:test';
import assert from 'node:assert/strict';
import { smartCluster } from '../src/utils/photoClustering.js';

function photo(fileIndex, dateTaken, latitude, longitude) {
  return {
    filename: `photo-${fileIndex}.jpg`,
    fileIndex,
    metadata: { dateTaken, latitude, longitude, hasGPS: true },
  };
}

test('photo clustering groups nearby photos by time and location', async () => {
  const result = await smartCluster([
    photo(0, '2024-06-01T10:00:00Z', 35.0, -97.0),
    photo(1, '2024-06-01T18:00:00Z', 35.01, -97.01),
    photo(2, '2024-06-04T10:00:00Z', 40.0, -74.0),
  ], 'normal', { resolveLocation: async () => ({ display_name: 'Test Place', address: { country_code: 'us' } }) });

  assert.equal(result.length, 2);
  assert.equal(result[0].photoCount, 2);
  assert.deepEqual(result[0].photos.map(item => item.fileIndex), [0, 1]);
  assert.equal(result[0].suggestedLocation, 'Test Place');
  assert.equal(result[1].photos[0].fileIndex, 2);
});

test('strict clustering can reject a single-photo cluster', async () => {
  const result = await smartCluster([
    photo(0, '2024-06-01T10:00:00Z', 35.0, -97.0),
    photo(1, '2024-06-04T10:00:00Z', 40.0, -74.0),
  ], 'strict', { resolveLocation: async () => null });

  assert.deepEqual(result, []);
});
