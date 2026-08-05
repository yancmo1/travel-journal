import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDateOnly } from '../utils/format';

// Color mapping for trip types
const tripTypeColors = {
  'Road Trip': '#10B981', // green
  'Flight': '#3B82F6', // blue
  'Cruise': '#8B5CF6', // purple
  'Day Trip': '#F59E0B', // amber
  'Other': '#6B7280', // gray
};

export default function MapView({ trips = [], onSelectTrip, showRoutes = false, compact = false }) {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const onSelectTripRef = useRef(onSelectTrip);

  // Keep ref updated
  useEffect(() => {
    onSelectTripRef.current = onSelectTrip;
  }, [onSelectTrip]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(v => !v);
  }, []);

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    
    // Start with a quiet world view so an empty atlas still feels like a map
    // of a life well traveled. Once memories exist, the map fits their bounds.
    const map = L.map(mapContainer.current, {
      center: [25, 0],
      zoom: 2,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    // Free, no-key CARTO Positron tiles keep the map legible and quiet beneath the memories.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Home marker (Oklahoma City)
    const homeIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="background: #12392f; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #fff9ec; box-shadow: 0 2px 6px rgba(18,57,47,0.28); display: flex; align-items: center; justify-content: center;">
        <span style="color: #fff9ec; font: 600 10px Georgia, serif;">H</span>
      </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([35.4676, -97.5164], { icon: homeIcon })
      .addTo(map)
      .bindPopup('<strong>Home</strong><br/>Oklahoma City, OK');

    // Leaflet can calculate a zero-sized viewport when a page is restored from
    // the PWA cache or when the map was mounted while its parent was hidden.
    // Recalculate after the first paint and whenever the container changes.
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => map.invalidateSize({ pan: false }))
      : null;
    resizeObserver?.observe(mapContainer.current);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') map.invalidateSize({ pan: false });
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    requestAnimationFrame(() => map.invalidateSize({ pan: false }));

    // No custom pointer-based zoom centering — rely on Leaflet's native behavior to avoid jerky zoom.

    return () => {
      map.remove();
      resizeObserver?.disconnect();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      mapRef.current = null;
    };
  }, []);

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Handle map resize when fullscreen changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [isFullscreen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Filter trips with valid numeric coordinates and sort by date. Truthiness
    // checks drop valid zero coordinates, while malformed values can make
    // Leaflet reject the entire bounds calculation.
    const tripsWithCoords = trips
      .map(trip => ({ ...trip, latitude: Number(trip.latitude), longitude: Number(trip.longitude) }))
      .filter(trip => Number.isFinite(trip.latitude) && Number.isFinite(trip.longitude)
        && trip.latitude >= -90 && trip.latitude <= 90
        && trip.longitude >= -180 && trip.longitude <= 180)
      .sort((a, b) => dateValue(a.start_date) - dateValue(b.start_date));

    // Replace the trip layers as a single unit so a refresh can never leave
    // the map showing a stale or partially rebuilt set of locations.
    if (map._tripMarkers && map.hasLayer(map._tripMarkers)) {
      map.removeLayer(map._tripMarkers);
    }
    if (map._tripRoutes && map.hasLayer(map._tripRoutes)) {
      map.removeLayer(map._tripRoutes);
    }

    const markers = L.layerGroup();
    const routes = L.layerGroup();

    // Add markers
    tripsWithCoords.forEach((trip, index) => {
      const color = '#b95835';
      
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 25px; height: 25px; border-radius: 50%; border: 3px solid #fff9ec; box-shadow: 0 2px 6px rgba(18,57,47,0.28); display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <span style="color: #fff9ec; font-size: 12px; font-weight: bold;">${index + 1}</span>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([trip.latitude, trip.longitude], { icon });
      
      const dateStr = trip.start_date ? formatDate(trip.start_date) : trip.date_label || 'Date unknown';
      const endStr = trip.end_date && trip.end_date !== trip.start_date 
        ? ` - ${formatDate(trip.end_date)}` 
        : '';

      marker.bindPopup(`
        <div style="min-width: 180px;">
          <strong style="font-size: 14px; color: #1E3A8A;">${trip.location_name}</strong>
          <div style="color: #666; font-size: 12px; margin-top: 4px;">${dateStr}${endStr}</div>
          <div style="margin-top: 6px;">
            <span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${trip.trip_type}</span>
          </div>
          ${trip.notes ? `<div style="margin-top: 8px; font-size: 12px; color: #555;">${trip.notes.substring(0, 100)}${trip.notes.length > 100 ? '...' : ''}</div>` : ''}
          ${trip.home_distance_miles ? `<div style="margin-top: 6px; font-size: 11px; color: #888;">📍 ${Math.round(trip.home_distance_miles).toLocaleString()} miles from home</div>` : ''}
        </div>
      `);

      marker.on('click', () => {
        if (onSelectTripRef.current) onSelectTripRef.current(trip);
      });

      marker.addTo(markers);
    });

    // Add routes if enabled
    if (showRoutes && tripsWithCoords.length > 1) {
      const routeCoords = tripsWithCoords.map(t => [t.latitude, t.longitude]);
      
      const polyline = L.polyline(routeCoords, {
        color: '#FB923C',
        weight: 2,
        opacity: 0.7,
        dashArray: '10, 5',
      });
      
      polyline.addTo(routes);
    }

    markers.addTo(map);
    routes.addTo(map);
    map._tripMarkers = markers;
    map._tripRoutes = routes;

    // Keep newly added or newly geocoded memories visible.
    if (tripsWithCoords.length > 0) {
      const bounds = L.latLngBounds(tripsWithCoords.map(t => [t.latitude, t.longitude]));
      // Include home in bounds
      bounds.extend([35.4676, -97.5164]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    }
  }, [trips, showRoutes]);

  return (
    <div className={`relative ${isFullscreen ? 'map-fullscreen' : 'z-10'}`}>
      <button
        onClick={toggleFullscreen}
        aria-pressed={isFullscreen}
        title={isFullscreen ? 'Exit full screen map (Esc)' : 'Open full screen map'}
        className="absolute right-3 top-3 z-[1010] bg-white/90 hover:bg-white shadow-md rounded-md px-3 py-2 text-sm font-medium text-gray-800 transition-colors"
      >
        {isFullscreen ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
      </button>

      <div
        ref={mapContainer}
        className="w-full rounded-b-xl"
        style={{ height: isFullscreen ? '100vh' : compact ? '360px' : '500px' }}
      />
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return formatDateOnly(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateValue(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}
