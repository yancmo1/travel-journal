import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Image size configurations
export const IMAGE_SIZES = {
  thumbnail: { width: 320, height: 320, fit: 'cover' },
  medium: { width: 800, height: 800, fit: 'inside' },
  large: { width: 1600, height: 1600, fit: 'inside' }
};

/**
 * Process uploaded image - create optimized versions
 * @param {string} inputPath - Original file path
 * @param {string} outputDir - Directory for processed images
 * @param {string} baseFilename - Base filename (without extension)
 * @returns {Promise<Object>} Paths to processed images
 */
export async function processImage(inputPath, outputDir, baseFilename) {
  try {
    // Ensure output directories exist
    const dirs = {
      original: path.join(outputDir, 'original'),
      thumbnails: path.join(outputDir, 'thumbnails'),
      medium: path.join(outputDir, 'medium')
    };

    for (const dir of Object.values(dirs)) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Load image and get metadata
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Auto-rotate based on EXIF orientation
    image.rotate();

    const ext = '.jpg'; // Convert all to JPEG for consistency
    const results = {
      original: null,
      thumbnail: null,
      medium: null,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: null
      }
    };

    // Keep a display-quality copy rather than the full camera original.
    const originalPath = path.join(dirs.original, `${baseFilename}${ext}`);
    await image
      .clone()
      .resize(IMAGE_SIZES.large.width, IMAGE_SIZES.large.height, {
        fit: IMAGE_SIZES.large.fit,
        withoutEnlargement: true
      })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toFile(originalPath);
    
    const originalStats = await fs.stat(originalPath);
    results.original = originalPath;
    results.metadata.size = originalStats.size;

    // Generate thumbnail
    const thumbnailPath = path.join(dirs.thumbnails, `${baseFilename}${ext}`);
    await sharp(inputPath)
      .rotate()
      .resize(IMAGE_SIZES.thumbnail.width, IMAGE_SIZES.thumbnail.height, {
        fit: IMAGE_SIZES.thumbnail.fit,
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);
    
    results.thumbnail = thumbnailPath;

    // The optimized display copy is also the medium view, avoiding a third stored copy.
    results.medium = originalPath;

    // Delete temporary uploaded file
    await fs.unlink(inputPath);

    return results;
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

/**
 * Batch process multiple images
 */
export async function batchProcessImages(files, baseOutputDir) {
  const results = [];

  for (const file of files) {
    try {
      const uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const baseFilename = file.filename.replace(/\.[^/.]+$/, '') + '-' + uniqueId;
      
      const processed = await processImage(
        file.path,
        baseOutputDir,
        baseFilename
      );

      results.push({
        originalFilename: file.originalname,
        processed,
        success: true
      });
    } catch (error) {
      results.push({
        originalFilename: file.originalname,
        error: error.message,
        success: false
      });
    }
  }

  return results;
}

/**
 * Delete all processed versions of an image
 */
export async function deleteProcessedImages(basePath, filename) {
  const dirs = ['original', 'thumbnails', 'medium'];
  
  for (const dir of dirs) {
    try {
      const filePath = path.join(basePath, dir, filename);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, continue
    }
  }
}

/**
 * Get image dimensions without loading full image
 */
export async function getImageDimensions(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    };
  } catch (error) {
    console.error('Failed to get image dimensions:', error);
    return null;
  }
}

export default {
  processImage,
  batchProcessImages,
  deleteProcessedImages,
  getImageDimensions,
  IMAGE_SIZES
};
