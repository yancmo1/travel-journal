import exifr from 'exifr';

/**
 * Extract GPS coordinates and metadata from image EXIF data
 * @param {string|Buffer} input - File path or buffer
 * @returns {Promise<Object>} Extracted metadata
 */
export async function extractExifData(input) {
  try {
    const data = await exifr.parse(input, {
      gps: true,
      tiff: true,
      exif: true,
      iptc: true,
      ifd0: true,
      ifd1: true,
      interop: false
    });

    if (!data) {
      return null;
    }

    // Extract key information
    const metadata = {
      // GPS Coordinates
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      altitude: data.GPSAltitude || null,
      
      // Date/Time
      dateTaken: extractDateTaken(data),
      
      // Camera/Device
      make: data.Make || null,
      model: data.Model || null,
      
      // Image properties
      width: data.ImageWidth || data.PixelXDimension || null,
      height: data.ImageHeight || data.PixelYDimension || null,
      orientation: data.Orientation || 1,
      
      // Additional metadata
      iso: data.ISO || null,
      fNumber: data.FNumber || null,
      exposureTime: data.ExposureTime || null,
      focalLength: data.FocalLength || null,
    };

    return metadata;
  } catch (error) {
    console.error('EXIF extraction error:', error.message);
    return null;
  }
}

/**
 * Extract date taken from EXIF data (tries multiple fields)
 */
function extractDateTaken(data) {
  // Try multiple date fields in order of preference
  const dateFields = [
    'DateTimeOriginal',
    'CreateDate',
    'DateTime',
    'DateCreated',
    'GPSDateStamp'
  ];

  for (const field of dateFields) {
    if (data[field]) {
      const date = parseExifDate(data[field]);
      if (date) return date;
    }
  }

  return null;
}

/**
 * Parse EXIF date string to ISO format
 * EXIF format: "2023:12:25 14:30:45"
 */
function parseExifDate(dateString) {
  if (!dateString) return null;

  try {
    // EXIF uses "YYYY:MM:DD HH:MM:SS" format
    if (typeof dateString === 'string' && dateString.includes(':')) {
      const cleaned = dateString.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const date = new Date(cleaned);
      return date.toISOString();
    }

    // If it's already a Date object
    if (dateString instanceof Date) {
      return dateString.toISOString();
    }

    // Try parsing as-is
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (error) {
    console.error('Date parsing error:', error.message);
  }

  return null;
}

/**
 * Check if image has GPS coordinates
 */
export function hasGPSData(metadata) {
  return metadata && 
         metadata.latitude !== null && 
         metadata.longitude !== null &&
         !isNaN(metadata.latitude) && 
         !isNaN(metadata.longitude);
}

/**
 * Batch extract EXIF from multiple files
 */
export async function batchExtractExif(files) {
  const results = [];

  for (const file of files) {
    const metadata = await extractExifData(file.path || file.buffer);
    results.push({
      filename: file.filename || file.originalname,
      metadata,
      hasGPS: hasGPSData(metadata)
    });
  }

  return results;
}

export default {
  extractExifData,
  hasGPSData,
  batchExtractExif
};
