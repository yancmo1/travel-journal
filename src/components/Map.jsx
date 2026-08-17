import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2 } from 'lucide-react';
import { formatDateOnly } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { HOME_ICONS, homeBadgeHtml } from '../utils/homeIcons';
import { getBrandColor } from '../utils/brandTokens';

// Default home base used until a user saves one in Settings (Oklahoma City).
const DEFAULT_HOME = { latitude: 35.4676, longitude: -97.5164, label: 'Oklahoma City, OK' };

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createHomeMarker(latitude, longitude, label, iconId) {
  const icon = L.divIcon({
    className: 'custom-marker',
    html: homeBadgeHtml(iconId),
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  return L.marker([latitude, longitude], { icon })
    .bindPopup(`<strong>Home</strong><br/>${escapeHtml(label)}`);
}

function distanceFromHome(homeLat, homeLon, latitude, longitude) {
  const values = [homeLat, homeLon, latitude, longitude].map(Number);
  if (values.some(value => !Number.isFinite(value))) return null;
  const [aLat, aLon, bLat, bLon] = values;
  const radians = value => value * Math.PI / 180;
  const dLat = radians(bLat - aLat);
  const dLon = radians(bLon - aLon);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(value));
}

export default function MapView({ trips = [], onSelectTrip, showRoutes = false, compact = false }) {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const onSelectTripRef = useRef(onSelectTrip);
  const { user } = useAuth();

  const homeLatitude = user?.home_latitude != null ? Number(user.home_latitude) : DEFAULT_HOME.latitude;
  const homeLongitude = user?.home_longitude != null ? Number(user.home_longitude) : DEFAULT_HOME.longitude;
  const homeLabel = user?.home_label || (user?.home_latitude != null ? 'Home' : DEFAULT_HOME.label);
  const homeIcon = HOME_ICONS[user?.home_icon] ? user.home_icon : 'h';

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

    // Home marker is managed by a dedicated effect so it follows the user's
    // saved home base and icon from Settings.

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

  // Keep the home marker in sync with the user's saved home base from Settings.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map._homeMarker && map.hasLayer(map._homeMarker)) {
      map.removeLayer(map._homeMarker);
    }
    map._homeMarker = createHomeMarker(homeLatitude, homeLongitude, homeLabel, homeIcon);
    map._homeMarker.addTo(map);
  }, [homeLatitude, homeLongitude, homeLabel, homeIcon]);

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
      const color = getBrandColor('--brand-terracotta-500');
      
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 25px; height: 25px; border-radius: 50%; border: 3px solid var(--brand-paper-50); box-shadow: var(--brand-shadow-marker); display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <span style="color: var(--brand-paper-50); font-size: 12px; font-weight: bold;">${index + 1}</span>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([trip.latitude, trip.longitude], { icon });
      
      const dateStr = trip.start_date ? formatDate(trip.start_date) : trip.date_label || 'Date unknown';
      const endStr = trip.end_date && trip.end_date !== trip.start_date 
        ? ` - ${formatDate(trip.end_date)}` 
        : '';
      const placeLine = trip.place_name || trip.formatted_address
        ? `
          ${trip.place_name ? `<div style="margin-top: 4px; font-size: 12px; color: var(--brand-forest-700); font-weight: 600;">${trip.place_name}</div>` : ''}
          ${trip.formatted_address ? `<div style="margin-top: 2px; font-size: 11px; color: var(--brand-ink-muted);">${trip.formatted_address}</div>` : ''}
        `
        : '';

      const displayedHomeDistance = distanceFromHome(homeLatitude, homeLongitude, trip.latitude, trip.longitude);
      marker.bindPopup(`
        <div style="min-width: 180px;">
          <strong style="font-size: 14px; color: var(--brand-forest-800);">${trip.location_name}</strong>
          ${placeLine}
          <div style="color: var(--brand-ink-muted); font-size: 12px; margin-top: 4px;">${dateStr}${endStr}</div>
          <div style="margin-top: 6px;">
            <span style="background: ${color}; color: var(--brand-paper-50); padding: 2px 8px; border-radius: 12px; font-size: 11px;">${trip.trip_type}</span>
          </div>
          ${trip.notes ? `<div style="margin-top: 8px; font-size: 12px; color: var(--brand-ink-muted);">${trip.notes.substring(0, 100)}${trip.notes.length > 100 ? '...' : ''}</div>` : ''}
          ${displayedHomeDistance != null ? `<div style="margin-top: 6px; font-size: 11px; color: var(--brand-forest-500);">📍 ${Math.round(displayedHomeDistance).toLocaleString()} miles from home</div>` : ''}
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
        color: getBrandColor('--brand-brass-500'),
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
      bounds.extend([homeLatitude, homeLongitude]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    }
  }, [trips, showRoutes, homeLatitude, homeLongitude]);

  return (
    <div className={`relative ${isFullscreen ? 'map-fullscreen' : 'z-10'}`}>
      <button
        onClick={toggleFullscreen}
        aria-pressed={isFullscreen}
        title={isFullscreen ? 'Exit full screen map (Esc)' : 'Open full screen map'}
        className="leaflet-control-fullscreen absolute right-3 top-3 z-[1010] bg-white/90 hover:bg-white shadow-md rounded-md px-3 py-2 text-sm font-medium text-gray-800 transition-colors"
      >
        {isFullscreen ? <><Minimize2 aria-hidden="true" /> Exit Fullscreen</> : <><Maximize2 aria-hidden="true" /> Fullscreen</>}
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
