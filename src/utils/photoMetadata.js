import { reverseGeocode } from './geocoding';

function localDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function distanceMiles(first, second) {
  const radians = value => Number(value) * Math.PI / 180;
  const latDelta = radians(second.latitude - first.latitude);
  const lonDelta = radians(second.longitude - first.longitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(lonDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function inspectPhotoMetadata(files) {
  const { default: exifr } = await import('exifr');
  const inspected = [];

  for (const file of files) {
    let data = null;
    try {
      data = await exifr.parse(file, {
        gps: true,
        tiff: true,
        exif: true,
        ifd0: true,
        ifd1: false,
        iptc: false,
        interop: false,
      });
    } catch (error) {
      console.warn(`Could not read photo metadata from ${file.name}`, error);
    }

    const dateTaken = localDate(data?.DateTimeOriginal || data?.CreateDate || data?.DateTime || data?.DateCreated);
    const latitude = Number.isFinite(Number(data?.latitude)) ? Number(data.latitude) : null;
    const longitude = Number.isFinite(Number(data?.longitude)) ? Number(data.longitude) : null;
    inspected.push({ filename: file.name, dateTaken, latitude, longitude, hasGPS: latitude !== null && longitude !== null });
  }

  const dates = inspected.map(photo => photo.dateTaken).filter(Boolean).sort();
  const gpsPhotos = inspected.filter(photo => photo.hasGPS);
  const primaryGps = gpsPhotos[0] || null;
  let location = null;

  if (primaryGps) {
    try {
      const result = await reverseGeocode(primaryGps.latitude, primaryGps.longitude);
      location = {
        displayName: result.display_name,
        locationName: result.city || result.state || result.country || 'Photo location',
        city: result.city || '',
        state: result.state || '',
        country: result.country || '',
      };
    } catch {
      location = { displayName: 'GPS coordinates found', locationName: 'Photo location', city: '', state: '', country: '' };
    }
  }

  return {
    totalPhotos: inspected.length,
    photosWithDate: dates.length,
    photosWithGPS: gpsPhotos.length,
    startDate: dates[0] || null,
    endDate: dates.length > 1 ? dates[dates.length - 1] : null,
    latitude: primaryGps?.latitude ?? null,
    longitude: primaryGps?.longitude ?? null,
    location,
    multipleLocations: primaryGps ? gpsPhotos.some(photo => distanceMiles(primaryGps, photo) > 25) : false,
    photos: inspected,
  };
}
