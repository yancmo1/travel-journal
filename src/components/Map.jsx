import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
    
    // Initialize map centered on Oklahoma City
    const map = L.map(mapContainer.current, {
      center: [35.4676, -97.5164],
      zoom: 4,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    // Ocean-themed tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Home marker (Oklahoma City)
    const homeIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="background: #1E3A8A; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-size: 10px;">🏠</span>
      </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([35.4676, -97.5164], { icon: homeIcon })
      .addTo(map)
      .bindPopup('<strong>Home</strong><br/>Oklahoma City, OK');

    // No custom pointer-based zoom centering — rely on Leaflet's native behavior to avoid jerky zoom.

    return () => {
      map.remove();
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

    // Filter trips with coordinates and sort by date
    const tripsWithCoords = trips
      .filter(t => t.latitude && t.longitude)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    // Check if trips have actually changed
    const newTripIds = tripsWithCoords
      .map(t => `${t.id}:${t.latitude}:${t.longitude}:${t.location_name}:${t.start_date || t.date_label || ''}`)
      .join(',');
    const showRoutesState = showRoutes ? 'routes' : 'no-routes';
    const currentState = `${newTripIds}:${showRoutesState}`;
    
    if (map._currentState === currentState && map._tripMarkers && map.hasLayer(map._tripMarkers)) {
      // Trips haven't changed and markers are still on map, don't rebuild
      return;
    }
    map._currentState = currentState;

    // Clear existing trip layers only when trips change
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
      const color = tripTypeColors[trip.trip_type] || tripTypeColors['Other'];
      
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <span style="color: white; font-size: 12px; font-weight: bold;">${index + 1}</span>
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
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
