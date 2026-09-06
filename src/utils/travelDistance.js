const EARTH_RADIUS_MILES = 3958.8;

function dateValue(trip) {
  return trip?.start_date ?? trip?.startDate ?? null;
}

function journeyId(trip) {
  return trip?.journey_id ?? trip?.journeyId ?? null;
}

function journeyOrder(trip) {
  const value = Number(trip?.journey_order ?? trip?.journeyOrder);
  return Number.isFinite(value) ? value : null;
}

function tripId(trip) {
  return String(trip?.id ?? '');
}

export function coordinatesFor(value) {
  const nested = value?.location?.coordinates;
  const latitude = Array.isArray(value)
    ? value[0]
    : value?.latitude ?? value?.lat ?? value?.home_latitude ?? nested?.latitude ?? nested?.lat;
  const longitude = Array.isArray(value)
    ? value[1]
    : value?.longitude ?? value?.lng ?? value?.home_longitude ?? nested?.longitude ?? nested?.lng;
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) return null;
  if (parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180) return null;
  return { latitude: parsedLatitude, longitude: parsedLongitude };
}

export function haversineDistance(from, to) {
  const first = coordinatesFor(from);
  const second = coordinatesFor(to);
  if (!first || !second) return null;
  const toRadians = value => value * Math.PI / 180;
  const deltaLatitude = toRadians(second.latitude - first.latitude);
  const deltaLongitude = toRadians(second.longitude - first.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(first.latitude))
      * Math.cos(toRadians(second.latitude))
      * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

export function routeDistanceMiles(points) {
  const coordinates = points.map(coordinatesFor).filter(Boolean);
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += haversineDistance(coordinates[index - 1], coordinates[index]) || 0;
  }
  return total;
}

function compareStops(first, second) {
  const firstOrder = journeyOrder(first);
  const secondOrder = journeyOrder(second);
  if (firstOrder != null && secondOrder != null && firstOrder !== secondOrder) return firstOrder - secondOrder;
  if (firstOrder != null && secondOrder == null) return -1;
  if (firstOrder == null && secondOrder != null) return 1;

  const firstDate = String(dateValue(first) || '');
  const secondDate = String(dateValue(second) || '');
  if (firstDate && secondDate && firstDate !== secondDate) return firstDate.localeCompare(secondDate);
  if (firstDate && !secondDate) return -1;
  if (!firstDate && secondDate) return 1;
  return tripId(first).localeCompare(tripId(second), undefined, { numeric: true });
}

function yearFromDate(value) {
  const match = String(value || '').match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function routeForStops(kind, id, stops, home) {
  const orderedStops = stops.slice().sort(compareStops);
  const mappedStops = orderedStops.filter(stop => coordinatesFor(stop));
  if (!mappedStops.length) return null;
  const points = home ? [home, ...mappedStops, home] : [];
  return {
    kind,
    id: String(id),
    stops: mappedStops,
    // Period totals assign the complete route to its first mapped stop.
    startDate: dateValue(mappedStops[0]),
    mappedMemoryCount: mappedStops.length,
    miles: home ? routeDistanceMiles(points) : 0,
  };
}

export function buildTravelDistanceSummary(trips = [], home = null) {
  // A journey is one continuous route. An ungrouped memory is its own
  // out-and-back route so unrelated memories never get joined by date.
  const rows = Array.isArray(trips) ? trips : [];
  const homeCoordinates = coordinatesFor(home);
  const journeys = new Map();
  const standalone = [];

  rows.forEach(trip => {
    const id = journeyId(trip);
    if (id == null || id === '') {
      standalone.push(trip);
      return;
    }
    if (!journeys.has(String(id))) journeys.set(String(id), []);
    journeys.get(String(id)).push(trip);
  });

  const routes = [];
  journeys.forEach((stops, id) => {
    const route = routeForStops('journey', id, stops, homeCoordinates);
    if (route) routes.push(route);
  });
  standalone.forEach(trip => {
    const route = routeForStops('memory', tripId(trip), [trip], homeCoordinates);
    if (route) routes.push(route);
  });

  const mappedMemoryCount = routes.reduce((sum, route) => sum + route.mappedMemoryCount, 0);
  return {
    routes,
    totalMiles: routes.reduce((sum, route) => sum + route.miles, 0),
    mappedMemoryCount,
    unmappedMemoryCount: Math.max(0, rows.length - mappedMemoryCount),
    totalMemoryCount: rows.length,
    homeBaseConfigured: Boolean(homeCoordinates),
  };
}

export function milesForYear(routes, year) {
  const targetYear = Number(year);
  return routes.reduce((sum, route) => yearFromDate(route.startDate) === targetYear ? sum + route.miles : sum, 0);
}

export function milesForDecade(routes, decade) {
  const targetDecade = Number(decade);
  return routes.reduce((sum, route) => {
    const year = yearFromDate(route.startDate);
    return year != null && Math.floor(year / 10) * 10 === targetDecade ? sum + route.miles : sum;
  }, 0);
}
