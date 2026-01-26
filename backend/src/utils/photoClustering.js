import { reverseGeocode, areCoordinatesClose } from './geocoding.js';

/**
 * Photo Clustering Algorithm
 * Groups photos into potential trips based on location and time proximity
 */

const DEFAULTS = {
  // Time threshold: photos within 24 hours are considered same trip
  timeThresholdHours: 24,
  
  // Distance threshold: photos within 10km are considered same location
  distanceThresholdKm: 10,
  
  // Minimum photos to suggest a trip (can be 1 for single photo trips)
  minPhotosPerCluster: 1,
  
  // Maximum days for a single trip (splits if exceeded)
  maxTripDays: 30
};

/**
 * Cluster photos into suggested trips
 * @param {Array} photos - Array of photo objects with metadata
 * @param {Object} options - Clustering options
 * @returns {Promise<Array>} Array of suggested trip objects
 */
export async function clusterPhotosIntoTrips(photos, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  
  // Filter photos with GPS and date
  const validPhotos = photos.filter(photo => 
    photo.metadata?.latitude && 
    photo.metadata?.longitude && 
    photo.metadata?.dateTaken
  );

  if (validPhotos.length === 0) {
    return [];
  }

  // Sort by date taken
  validPhotos.sort((a, b) => 
    new Date(a.metadata.dateTaken) - new Date(b.metadata.dateTaken)
  );

  // Build clusters
  const clusters = [];
  let currentCluster = null;

  for (const photo of validPhotos) {
    if (!currentCluster) {
      // Start first cluster
      currentCluster = createNewCluster(photo);
    } else {
      const shouldMerge = shouldPhotoJoinCluster(
        photo,
        currentCluster,
        opts
      );

      if (shouldMerge) {
        // Add to current cluster
        addPhotoToCluster(photo, currentCluster);
      } else {
        // Save current cluster and start new one
        clusters.push(currentCluster);
        currentCluster = createNewCluster(photo);
      }
    }
  }

  // Don't forget the last cluster
  if (currentCluster && currentCluster.photos.length >= opts.minPhotosPerCluster) {
    clusters.push(currentCluster);
  }

  // Geocode cluster locations
  const suggestedTrips = await Promise.all(
    clusters.map(cluster => buildTripSuggestion(cluster))
  );

  return suggestedTrips;
}

/**
 * Create new cluster from first photo
 */
function createNewCluster(photo) {
  return {
    photos: [photo],
    startDate: photo.metadata.dateTaken,
    endDate: photo.metadata.dateTaken,
    coordinates: {
      minLat: photo.metadata.latitude,
      maxLat: photo.metadata.latitude,
      minLon: photo.metadata.longitude,
      maxLon: photo.metadata.longitude,
      centerLat: photo.metadata.latitude,
      centerLon: photo.metadata.longitude
    }
  };
}

/**
 * Check if photo should join existing cluster
 */
function shouldPhotoJoinCluster(photo, cluster, opts) {
  const photoDate = new Date(photo.metadata.dateTaken);
  const clusterEndDate = new Date(cluster.endDate);
  
  // Check time proximity
  const hoursDiff = (photoDate - clusterEndDate) / (1000 * 60 * 60);
  if (hoursDiff > opts.timeThresholdHours) {
    return false;
  }

  // Check location proximity (to cluster center)
  const isClose = areCoordinatesClose(
    photo.metadata.latitude,
    photo.metadata.longitude,
    cluster.coordinates.centerLat,
    cluster.coordinates.centerLon,
    opts.distanceThresholdKm
  );

  if (!isClose) {
    return false;
  }

  // Check if trip would be too long
  const tripStartDate = new Date(cluster.startDate);
  const daysDiff = (photoDate - tripStartDate) / (1000 * 60 * 60 * 24);
  if (daysDiff > opts.maxTripDays) {
    return false;
  }

  return true;
}

/**
 * Add photo to existing cluster
 */
function addPhotoToCluster(photo, cluster) {
  cluster.photos.push(photo);
  cluster.endDate = photo.metadata.dateTaken;
  
  // Update bounding box
  const lat = photo.metadata.latitude;
  const lon = photo.metadata.longitude;
  
  cluster.coordinates.minLat = Math.min(cluster.coordinates.minLat, lat);
  cluster.coordinates.maxLat = Math.max(cluster.coordinates.maxLat, lat);
  cluster.coordinates.minLon = Math.min(cluster.coordinates.minLon, lon);
  cluster.coordinates.maxLon = Math.max(cluster.coordinates.maxLon, lon);
  
  // Recalculate center
  cluster.coordinates.centerLat = 
    (cluster.coordinates.minLat + cluster.coordinates.maxLat) / 2;
  cluster.coordinates.centerLon = 
    (cluster.coordinates.minLon + cluster.coordinates.maxLon) / 2;
}

/**
 * Build trip suggestion from cluster
 */
async function buildTripSuggestion(cluster) {
  // Geocode the center point
  const location = await reverseGeocode(
    cluster.coordinates.centerLat,
    cluster.coordinates.centerLon
  );

  const startDate = new Date(cluster.startDate);
  const endDate = new Date(cluster.endDate);
  const daysSpan = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  return {
    suggestedLocation: location?.displayName || 'Unknown Location',
    locationDetails: location,
    latitude: cluster.coordinates.centerLat,
    longitude: cluster.coordinates.centerLon,
    startDate: startDate.toISOString().split('T')[0],
    endDate: daysSpan > 1 ? endDate.toISOString().split('T')[0] : null,
    photoCount: cluster.photos.length,
    photos: cluster.photos,
    confidence: calculateConfidence(cluster),
    suggestedTripType: suggestTripType(daysSpan, location),
    notes: generateAutoNotes(cluster, location)
  };
}

/**
 * Calculate confidence score (0-100) for trip suggestion
 */
function calculateConfidence(cluster) {
  let score = 50; // Base confidence

  // More photos = higher confidence
  score += Math.min(cluster.photos.length * 5, 30);

  // Longer trips = higher confidence
  const days = (new Date(cluster.endDate) - new Date(cluster.startDate)) / (1000 * 60 * 60 * 24);
  score += Math.min(days * 2, 10);

  // GPS accuracy (if available)
  const avgAccuracy = cluster.photos.reduce((sum, p) => {
    return sum + (p.metadata.gpsAccuracy || 100);
  }, 0) / cluster.photos.length;
  
  if (avgAccuracy < 50) score += 10; // Good GPS accuracy

  return Math.min(Math.round(score), 100);
}

/**
 * Suggest trip type based on duration and location
 */
function suggestTripType(days, location) {
  if (!location) return 'Road Trip';

  // International = likely a flight
  if (location.countryCode && location.countryCode !== 'US') {
    return 'Flight';
  }

  // Day trip
  if (days <= 1) {
    return 'Day Trip';
  }

  // Longer trips far from home are likely flights
  if (days >= 5) {
    return 'Flight';
  }

  // Default to road trip for domestic
  return 'Road Trip';
}

/**
 * Generate automatic notes from photo metadata
 */
function generateAutoNotes(cluster, location) {
  const photoCount = cluster.photos.length;
  const days = Math.ceil(
    (new Date(cluster.endDate) - new Date(cluster.startDate)) / (1000 * 60 * 60 * 24)
  ) + 1;

  const notes = [];

  if (photoCount > 1) {
    notes.push(`${photoCount} photos from this trip`);
  }

  if (days > 1) {
    notes.push(`${days}-day trip`);
  }

  // Add camera info if interesting
  const devices = new Set(
    cluster.photos
      .map(p => p.metadata?.model)
      .filter(Boolean)
  );
  
  if (devices.size === 1) {
    notes.push(`Photos from ${[...devices][0]}`);
  }

  return notes.join('. ');
}

/**
 * Smart clustering with adjustable sensitivity
 * @param {Array} photos - Photos to cluster
 * @param {string} sensitivity - 'strict' | 'normal' | 'loose'
 */
export async function smartCluster(photos, sensitivity = 'normal') {
  const sensitivities = {
    strict: {
      timeThresholdHours: 12,
      distanceThresholdKm: 5,
      minPhotosPerCluster: 2
    },
    normal: {
      timeThresholdHours: 24,
      distanceThresholdKm: 10,
      minPhotosPerCluster: 1
    },
    loose: {
      timeThresholdHours: 48,
      distanceThresholdKm: 25,
      minPhotosPerCluster: 1
    }
  };

  return clusterPhotosIntoTrips(photos, sensitivities[sensitivity]);
}

export default {
  clusterPhotosIntoTrips,
  smartCluster
};
