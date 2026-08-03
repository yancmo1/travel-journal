const DEFAULTS = {
  timeThresholdHours: 24,
  distanceThresholdKm: 10,
  minPhotosPerCluster: 1,
  maxTripDays: 30,
};

function distanceKm(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const radians = value => Number(value) * Math.PI / 180;
  const dLat = radians(secondLatitude - firstLatitude);
  const dLon = radians(secondLongitude - firstLongitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(firstLatitude)) * Math.cos(radians(secondLatitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasCoordinates(photo) {
  return photo?.metadata?.dateTaken
    && Number.isFinite(Number(photo.metadata.latitude))
    && Number.isFinite(Number(photo.metadata.longitude));
}

function createCluster(photo) {
  const latitude = Number(photo.metadata.latitude);
  const longitude = Number(photo.metadata.longitude);
  return {
    photos: [photo],
    startDate: photo.metadata.dateTaken,
    endDate: photo.metadata.dateTaken,
    coordinates: {
      minLat: latitude,
      maxLat: latitude,
      minLon: longitude,
      maxLon: longitude,
      centerLat: latitude,
      centerLon: longitude,
    },
  };
}

function belongsInCluster(photo, cluster, options) {
  const photoDate = new Date(photo.metadata.dateTaken);
  const clusterEndDate = new Date(cluster.endDate);
  const hoursDiff = (photoDate - clusterEndDate) / (1000 * 60 * 60);
  if (!Number.isFinite(hoursDiff) || hoursDiff > options.timeThresholdHours) return false;

  const close = distanceKm(
    photo.metadata.latitude,
    photo.metadata.longitude,
    cluster.coordinates.centerLat,
    cluster.coordinates.centerLon,
  ) <= options.distanceThresholdKm;
  if (!close) return false;

  const daysDiff = (photoDate - new Date(cluster.startDate)) / (1000 * 60 * 60 * 24);
  return Number.isFinite(daysDiff) && daysDiff <= options.maxTripDays;
}

function addToCluster(photo, cluster) {
  cluster.photos.push(photo);
  cluster.endDate = photo.metadata.dateTaken;
  const latitude = Number(photo.metadata.latitude);
  const longitude = Number(photo.metadata.longitude);
  cluster.coordinates.minLat = Math.min(cluster.coordinates.minLat, latitude);
  cluster.coordinates.maxLat = Math.max(cluster.coordinates.maxLat, latitude);
  cluster.coordinates.minLon = Math.min(cluster.coordinates.minLon, longitude);
  cluster.coordinates.maxLon = Math.max(cluster.coordinates.maxLon, longitude);
  cluster.coordinates.centerLat = (cluster.coordinates.minLat + cluster.coordinates.maxLat) / 2;
  cluster.coordinates.centerLon = (cluster.coordinates.minLon + cluster.coordinates.maxLon) / 2;
}

function dateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function confidence(cluster) {
  let score = 50 + Math.min(cluster.photos.length * 5, 30);
  const days = (new Date(cluster.endDate) - new Date(cluster.startDate)) / (1000 * 60 * 60 * 24);
  score += Math.min(Math.max(days, 0) * 2, 10);
  const accuracies = cluster.photos.map(photo => Number(photo.metadata.gpsAccuracy)).filter(Number.isFinite);
  if (accuracies.length && accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length < 50) score += 10;
  return Math.min(Math.round(score), 100);
}

function suggestedType(days, location) {
  const country = String(location?.countryCode || location?.address?.country_code || location?.country || '').toUpperCase();
  if (country && !['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(country)) return 'Flight';
  if (days <= 1) return 'Day Trip';
  if (days >= 5) return 'Flight';
  return 'Road Trip';
}

function notesFor(cluster, location) {
  const days = Math.ceil((new Date(cluster.endDate) - new Date(cluster.startDate)) / (1000 * 60 * 60 * 24)) + 1;
  const notes = [];
  if (cluster.photos.length > 1) notes.push(`${cluster.photos.length} photos from this trip`);
  if (days > 1) notes.push(`${days}-day trip`);
  const devices = new Set(cluster.photos.map(photo => photo.metadata.model).filter(Boolean));
  if (devices.size === 1) notes.push(`Photos from ${[...devices][0]}`);
  return notes.join('. ');
}

async function buildSuggestion(cluster, resolveLocation) {
  let location = null;
  try {
    location = await resolveLocation(cluster.coordinates.centerLat, cluster.coordinates.centerLon);
  } catch {
    location = null;
  }
  const days = Math.ceil((new Date(cluster.endDate) - new Date(cluster.startDate)) / (1000 * 60 * 60 * 24)) + 1;
  const locationName = location?.display_name
    || location?.displayName
    || location?.city
    || location?.locationName
    || 'Photo location';
  return {
    suggestedLocation: locationName,
    locationDetails: location,
    latitude: cluster.coordinates.centerLat,
    longitude: cluster.coordinates.centerLon,
    startDate: dateOnly(cluster.startDate),
    endDate: days > 1 ? dateOnly(cluster.endDate) : null,
    photoCount: cluster.photos.length,
    photos: cluster.photos,
    confidence: confidence(cluster),
    suggestedTripType: suggestedType(days, location),
    notes: notesFor(cluster, location),
  };
}

export async function clusterPhotosIntoTrips(photos, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const validPhotos = photos.filter(hasCoordinates).sort((first, second) => (
    new Date(first.metadata.dateTaken) - new Date(second.metadata.dateTaken)
  ));
  if (!validPhotos.length) return [];

  const clusters = [];
  let current = null;
  for (const photo of validPhotos) {
    if (!current) current = createCluster(photo);
    else if (belongsInCluster(photo, current, settings)) addToCluster(photo, current);
    else {
      if (current.photos.length >= settings.minPhotosPerCluster) clusters.push(current);
      current = createCluster(photo);
    }
  }
  if (current?.photos.length >= settings.minPhotosPerCluster) clusters.push(current);

  const resolveLocation = settings.resolveLocation || (async () => null);
  return Promise.all(clusters.map(cluster => buildSuggestion(cluster, resolveLocation)));
}

export function smartCluster(photos, sensitivity = 'normal', options = {}) {
  const settings = {
    strict: { timeThresholdHours: 12, distanceThresholdKm: 5, minPhotosPerCluster: 2 },
    normal: { timeThresholdHours: 24, distanceThresholdKm: 10, minPhotosPerCluster: 1 },
    loose: { timeThresholdHours: 48, distanceThresholdKm: 25, minPhotosPerCluster: 1 },
  }[sensitivity] || {};
  return clusterPhotosIntoTrips(photos, { ...settings, ...options });
}
