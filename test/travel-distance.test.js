import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTravelDistanceSummary,
  haversineDistance,
  milesForDecade,
  milesForYear,
} from '../src/utils/travelDistance.js';

const home = { latitude: 0, longitude: 0 };

test('a standalone memory is estimated as a home round trip', () => {
  const oneWay = haversineDistance(home, { latitude: 0, longitude: 1 });
  const summary = buildTravelDistanceSummary([
    { id: 1, location_name: 'One stop', latitude: 0, longitude: 1, start_date: '2024-06-01' },
  ], home);

  assert.ok(oneWay);
  assert.ok(Math.abs(summary.totalMiles - oneWay * 2) < 0.000001);
  assert.equal(summary.routes[0].kind, 'memory');
  assert.equal(summary.mappedMemoryCount, 1);
  assert.equal(summary.unmappedMemoryCount, 0);
});

test('a journey connects ordered stops and returns home once', () => {
  const separate = buildTravelDistanceSummary([
    { id: 1, latitude: 0, longitude: 1, start_date: '2024-06-01' },
    { id: 2, latitude: 0, longitude: 2, start_date: '2024-06-02' },
  ], home);
  const journey = buildTravelDistanceSummary([
    { id: 1, journey_id: 9, journey_order: 1, latitude: 0, longitude: 1, start_date: '2024-06-01' },
    { id: 2, journey_id: 9, journey_order: 2, latitude: 0, longitude: 2, start_date: '2024-06-02' },
  ], home);

  assert.equal(separate.routes.length, 2);
  assert.equal(journey.routes.length, 1);
  assert.ok(journey.totalMiles < separate.totalMiles);
  assert.equal(journey.routes[0].mappedMemoryCount, 2);
});

test('missing coordinates are excluded without hiding the coverage gap', () => {
  const summary = buildTravelDistanceSummary([
    { id: 1, latitude: 0, longitude: 1, start_date: '2024-06-01' },
    { id: 2, location_name: 'Not mapped', start_date: '2024-06-02' },
  ], home);

  assert.equal(summary.mappedMemoryCount, 1);
  assert.equal(summary.unmappedMemoryCount, 1);
  assert.equal(summary.totalMemoryCount, 2);
});

test('period totals follow the route start date', () => {
  const summary = buildTravelDistanceSummary([
    { id: 1, latitude: 0, longitude: 1, start_date: '2024-06-01' },
    { id: 2, latitude: 0, longitude: 2, start_date: '2025-06-01' },
  ], home);

  assert.equal(Math.round(milesForYear(summary.routes, 2024)), Math.round(summary.routes[0].miles));
  assert.equal(Math.round(milesForDecade(summary.routes, 2020)), Math.round(summary.totalMiles));
});

test('no home base produces no invented mileage', () => {
  const summary = buildTravelDistanceSummary([
    { id: 1, latitude: 0, longitude: 1, start_date: '2024-06-01' },
  ]);

  assert.equal(summary.totalMiles, 0);
  assert.equal(summary.homeBaseConfigured, false);
  assert.equal(summary.mappedMemoryCount, 1);
});
