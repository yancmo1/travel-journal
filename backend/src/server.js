import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import tripsRoutes from './routes/trips.js';
import travelersRoutes from './routes/travelers.js';
import photosRoutes from './routes/photos.js';
import analyticsRoutes from './routes/analytics.js';
import journeysRoutes from './routes/journeys.js';
import placesRoutes from './routes/places.js';
import maintenanceRoutes from './routes/maintenance.js';
import sharedRoutes from './routes/shared.js';
import { authMiddleware } from './middleware/auth.js';
import { initDatabase } from './utils/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded photos
const photoPath = process.env.PHOTO_STORAGE_PATH || '/app/media/travel-photos';
app.use('/photos', express.static(photoPath));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/shared', sharedRoutes);

// Protected routes
app.use('/api/trips', authMiddleware, tripsRoutes);
app.use('/api/travelers', authMiddleware, travelersRoutes);
app.use('/api/photos', authMiddleware, photosRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/journeys', authMiddleware, journeysRoutes);
app.use('/api/places', authMiddleware, placesRoutes);
app.use('/api/maintenance', authMiddleware, maintenanceRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    console.log('Database initialized');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Travel Tracker API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
