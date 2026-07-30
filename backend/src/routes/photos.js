import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { query } from '../utils/db.js';
import { upload } from '../middleware/upload.js';
import { extractExifData, hasGPSData } from '../utils/exifReader.js';
import { processImage, deleteProcessedImages } from '../utils/imageProcessor.js';
import { smartCluster } from '../utils/photoClustering.js';
import { reverseGeocode, areCoordinatesClose } from '../utils/geocoding.js';
import { v4 as uuidv4 } from 'uuid';
import { backfillPhotoLocations, getLocationBackfillCandidates } from '../services/locationBackfill.js';

const router = Router();
const storagePath = process.env.PHOTO_STORAGE_PATH || '/app/media/travel-photos';

// Serve temp upload files (convert HEIC to JPEG on the fly for browser preview)
router.get('/temp/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params;
    const tempPath = path.join(storagePath, 'temp', filename);
    // Check file exists
    await fs.access(tempPath);

    const ext = path.extname(filename).toLowerCase();
    // If HEIC/HEIF, convert to JPEG for browser compatibility
    if (ext === '.heic' || ext === '.heif') {
      try {
        const sharp = (await import('../utils/imageProcessor.js')).defaultSharp || (await import('sharp')).default;
        const buffer = await sharp(tempPath).rotate().resize({ width: 400 }).jpeg({ quality: 80 }).toBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        return res.send(buffer);
      } catch (err) {
        // fall back to sending raw file
        console.warn('HEIC conversion failed, sending raw file:', err.message);
      }
    }

    // For other images, stream directly
    res.sendFile(tempPath);
  } catch (err) {
    next(err);
  }
});

// =====================================================
// IMPORTANT: Specific routes MUST come before /:tripId
// =====================================================

// Find photo-backed memories that still need place names.
router.get('/location-backfill', async (req, res, next) => {
  try {
    const candidates = await getLocationBackfillCandidates();
    res.json({
      count: candidates.length,
      candidates: candidates.map(candidate => ({
        tripId: candidate.trip_id,
        locationName: candidate.location_name,
        date: candidate.start_date || candidate.date_label || candidate.date_taken,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Safely fill only blank/unknown places, one lookup at a time.
router.post('/location-backfill', async (req, res, next) => {
  try {
    res.json(await backfillPhotoLocations());
  } catch (err) {
    next(err);
  }
});

// Inspect selected photos before a memory is saved and suggest dates/place.
// Multer stores these copies in temp; they are always removed after inspection.
router.post('/metadata-suggestions', upload.array('photos', 50), async (req, res, next) => {
  const files = req.files || [];

  try {
    if (files.length === 0) {
      return res.status(400).json({ error: 'No photos selected' });
    }

    const inspected = [];
    for (const file of files) {
      const metadata = await extractExifData(file.path);
      inspected.push({
        filename: file.originalname,
        dateTaken: metadata?.dateTaken || null,
        latitude: metadata?.latitude ?? null,
        longitude: metadata?.longitude ?? null,
        hasGPS: hasGPSData(metadata),
      });
    }

    const dates = inspected
      .map(photo => photo.dateTaken?.slice(0, 10))
      .filter(Boolean)
      .sort();
    const gpsPhotos = inspected.filter(photo => photo.hasGPS);
    const primaryGps = gpsPhotos[0] || null;
    let location = null;

    if (primaryGps) {
      location = await reverseGeocode(primaryGps.latitude, primaryGps.longitude);
    }

    const multipleLocations = primaryGps
      ? gpsPhotos.some(photo => !areCoordinatesClose(
          primaryGps.latitude,
          primaryGps.longitude,
          photo.latitude,
          photo.longitude,
          25
        ))
      : false;

    res.json({
      totalPhotos: inspected.length,
      photosWithDate: dates.length,
      photosWithGPS: gpsPhotos.length,
      startDate: dates[0] || null,
      endDate: dates.length > 1 ? dates[dates.length - 1] : null,
      latitude: primaryGps?.latitude ?? null,
      longitude: primaryGps?.longitude ?? null,
      location,
      multipleLocations,
    });
  } catch (err) {
    next(err);
  } finally {
    await Promise.allSettled(files.map(file => fs.unlink(file.path)));
  }
});

// Analyze photos for auto-trip creation (bulk upload with intelligence)
router.post('/analyze', upload.array('photos', 100), async (req, res, next) => {
  try {
    const files = req.files;
    const { sensitivity = 'normal' } = req.body;

    console.log(`[PHOTO ANALYZE] Starting analysis for ${files?.length || 0} files`);

    if (!files || files.length === 0) {
      console.log('[PHOTO ANALYZE] No files received');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`[PHOTO ANALYZE] Files: ${files.map(f => f.originalname).join(', ')}`);

    // Extract EXIF from all photos
    const photosWithMetadata = [];
    
    for (const file of files) {
      console.log(`[PHOTO ANALYZE] Extracting EXIF from ${file.originalname}...`);
      const metadata = await extractExifData(file.path);
      
      photosWithMetadata.push({
        filename: file.originalname,
        tempPath: file.path,
        tempFilename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        metadata
      });
    }

    // Filter photos with GPS and date (required for clustering)
    const validPhotos = photosWithMetadata.filter(p => 
      p.metadata && 
      p.metadata.dateTaken &&
      hasGPSData(p.metadata)
    );

    console.log(`[PHOTO ANALYZE] ${validPhotos.length} of ${files.length} photos have GPS and date data`);

    // Cluster into trip suggestions
    let suggestedTrips = [];
    if (validPhotos.length > 0) {
      console.log(`[PHOTO ANALYZE] Clustering ${validPhotos.length} valid photos...`);
      suggestedTrips = await smartCluster(validPhotos, sensitivity);
      console.log(`[PHOTO ANALYZE] Suggested ${suggestedTrips.length} trips`);
    }

    // Photos without GPS/date
    const photosWithoutMetadata = photosWithMetadata.filter(p => 
      !p.metadata || 
      !p.metadata.dateTaken ||
      !hasGPSData(p.metadata)
    );

    console.log(`[PHOTO ANALYZE] Analysis complete - returning results`);

    res.json({
      success: true,
      totalPhotos: files.length,
      validPhotos: validPhotos.length,
      photosWithoutMetadata: photosWithoutMetadata.length,
      suggestedTrips,
      allPhotos: photosWithMetadata.map(p => ({
        filename: p.filename,
        hasGPS: hasGPSData(p.metadata),
        hasDate: p.metadata?.dateTaken ? true : false,
        dateTaken: p.metadata?.dateTaken,
        location: p.metadata?.latitude && p.metadata?.longitude ? {
          lat: p.metadata.latitude,
          lon: p.metadata.longitude
        } : null
      }))
    });
  } catch (err) {
    console.error('[PHOTO ANALYZE] Error:', err);
    next(err);
  }
});

// Create trip from photo suggestions
router.post('/create-from-analysis', async (req, res, next) => {
  try {
    const { tripData, photoFilenames } = req.body;

    console.log(`[CREATE FROM ANALYSIS] Creating trip from ${photoFilenames?.length || 0} photos`);

    if (!tripData || !photoFilenames || photoFilenames.length === 0) {
      return res.status(400).json({ error: 'Trip data and photo filenames required' });
    }

    // Create the trip
    const tripResult = await query(`
      INSERT INTO trips (
        location_name, latitude, longitude, country, state,
        start_date, end_date, trip_type, notes, home_distance_miles, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      tripData.locationName,
      tripData.latitude,
      tripData.longitude,
      tripData.country || null,
      tripData.state || null,
      tripData.startDate,
      tripData.endDate || null,
      tripData.tripType || 'Road Trip',
      tripData.notes || null,
      tripData.homeDistance || null,
      req.user.id
    ]);

    const trip = tripResult.rows[0];
    console.log(`[CREATE FROM ANALYSIS] Trip created with ID ${trip.id}`);

    // Move photos from temp storage to trip storage
    const tripDir = path.join(storagePath, trip.id.toString());
    await fs.mkdir(tripDir, { recursive: true });

    const photos = [];
    const uploadDir = path.join(storagePath, 'temp');

    for (const tempFilename of photoFilenames) {
      try {
        const tempPath = path.join(uploadDir, tempFilename);
        
        // Extract metadata again
        const metadata = await extractExifData(tempPath);

        // Process image
        const uniqueId = uuidv4();
        const baseFilename = `photo-${uniqueId}`;
        const processed = await processImage(tempPath, tripDir, baseFilename);

        // Insert into database
        const result = await query(`
          INSERT INTO photos (
            trip_id, filename, file_path, thumbnail_path,
            file_size, mime_type, date_taken, latitude, longitude
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          trip.id,
          tempFilename,
          path.relative(storagePath, processed.original),
          path.relative(storagePath, processed.thumbnail),
          processed.metadata.size,
          'image/jpeg',
          metadata?.dateTaken || null,
          metadata?.latitude || null,
          metadata?.longitude || null
        ]);

        photos.push(result.rows[0]);
      } catch (error) {
        console.error(`Failed to process photo ${tempFilename}:`, error);
      }
    }

    console.log(`[CREATE FROM ANALYSIS] Trip created with ${photos.length} photos`);

    res.status(201).json({
      success: true,
      trip,
      photos
    });
  } catch (err) {
    console.error('[CREATE FROM ANALYSIS] Error:', err);
    next(err);
  }
});

// Upload photos to a trip with full EXIF extraction
router.post('/:tripId', upload.array('photos', 50), async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify trip exists
    const tripCheck = await query('SELECT id FROM trips WHERE id = $1', [tripId]);
    if (tripCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const tripDir = path.join(storagePath, tripId.toString());
    await fs.mkdir(tripDir, { recursive: true });

    const photos = [];

    for (const file of files) {
      try {
        // Extract EXIF metadata
        const metadata = await extractExifData(file.path);

        // Generate unique filename
        const uniqueId = uuidv4();
        const baseFilename = `photo-${uniqueId}`;

        // Process image (create thumbnails and optimized versions)
        const processed = await processImage(file.path, tripDir, baseFilename);

        // Prepare photo record
        const photoData = {
          tripId,
          filename: file.originalname,
          storedFilename: `${baseFilename}.jpg`,
          filePath: path.relative(storagePath, processed.original),
          thumbnailPath: path.relative(storagePath, processed.thumbnail),
          mediumPath: path.relative(storagePath, processed.medium),
          fileSize: processed.metadata.size,
          mimeType: 'image/jpeg',
          width: processed.metadata.width,
          height: processed.metadata.height,
          dateTaken: metadata?.dateTaken || null,
          latitude: metadata?.latitude || null,
          longitude: metadata?.longitude || null,
          altitude: metadata?.altitude || null,
          cameraMake: metadata?.make || null,
          cameraModel: metadata?.model || null,
          iso: metadata?.iso || null,
          fNumber: metadata?.fNumber || null,
          exposureTime: metadata?.exposureTime || null,
          focalLength: metadata?.focalLength || null
        };

        // Insert into database
        const result = await query(`
          INSERT INTO photos (
            trip_id, filename, file_path, thumbnail_path, 
            file_size, mime_type, date_taken, latitude, longitude
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          photoData.tripId,
          photoData.filename,
          photoData.filePath,
          photoData.thumbnailPath,
          photoData.fileSize,
          photoData.mimeType,
          photoData.dateTaken,
          photoData.latitude,
          photoData.longitude
        ]);

        photos.push({
          ...result.rows[0],
          hasGPS: hasGPSData(metadata),
          metadata: metadata
        });
      } catch (error) {
        console.error(`Failed to process photo ${file.originalname}:`, error);
        // Continue with other photos
      }
    }

    res.status(201).json({
      success: true,
      count: photos.length,
      photos
    });
  } catch (err) {
    next(err);
  }
});

// Get photos for a trip
router.get('/:tripId', async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const result = await query('SELECT * FROM photos WHERE trip_id = $1 ORDER BY date_taken, uploaded_at', [tripId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Delete a photo
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query('SELECT * FROM photos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = result.rows[0];

    // Delete all processed versions
    const photoDir = path.dirname(path.join(storagePath, photo.file_path));
    const filename = path.basename(photo.file_path);
    
    try {
      await deleteProcessedImages(path.dirname(photoDir), filename);
    } catch (e) {
      console.log('File deletion warning:', e.message);
    }

    await query('DELETE FROM photos WHERE id = $1', [id]);

    res.json({ 
      success: true,
      message: 'Photo deleted' 
    });
  } catch (err) {
    next(err);
  }
});

export default router;
