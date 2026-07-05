import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Restaurant } from './RestaurantCard';
import { useChatContext } from '../context/chatContextStore';

interface MapModalProps {
  restaurant: Restaurant | null;
  onClose: () => void;
}

interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  coordinates: [number, number][];
}

function getDirectDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const dLng = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1[0] * Math.PI) / 180) *
      Math.cos((coord2[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapModal({ restaurant, onClose }: MapModalProps) {
  const { userCoords } = useChatContext();
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [errorRoute, setErrorRoute] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Compute memoized user location using context coordinates
  const userLocation = useMemo<[number, number]>(() => {
    return userCoords 
      ? [userCoords.lat, userCoords.lng] 
      : [2.1896, 102.2501];
  }, [userCoords]);

  // Reset route state on restaurant change
  useEffect(() => {
    if (!restaurant) return;
    setRouteInfo(null);
    setLoadingRoute(true);
    setErrorRoute(null);
  }, [restaurant]);

  // 2. Fetch OSRM street route
  useEffect(() => {
    if (!restaurant || !userLocation) return;

    const startLat = userLocation[0];
    const startLng = userLocation[1];
    const endLat = restaurant.lat;
    const endLng = restaurant.lng;

    let isMounted = true;
    async function fetchRoute() {
      try {
        // OSRM driving route endpoint (car profile)
        const url = `https://router.project-osrm.org/route/v1/car/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error(`OSRM API response error: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          throw new Error('No route solution found');
        }

        const route = data.routes[0];
        // OSRM returns coordinates as [lng, lat], map to [lat, lng] for Leaflet
        const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

        if (isMounted) {
          setRouteInfo({
            distance: route.distance,
            duration: route.duration,
            coordinates: coords,
          });
          setLoadingRoute(false);
        }
      } catch (err: any) {
        console.error('Failed to query OSRM walking route:', err);
        if (isMounted) {
          setErrorRoute(err.message || 'Route service unavailable');
          setLoadingRoute(false);
        }
      }
    }

    fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [restaurant, userLocation]);

  // 3. Initialize Leaflet Map
  useEffect(() => {
    if (!restaurant || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([restaurant.lat, restaurant.lng], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    // Trigger map update once the DOM finishes layout transitions
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      polylineRef.current = null;
    };
  }, [restaurant]);

  // 4. Update Map Markers and Route Polyline
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup || !restaurant) return;

    // Clear previous graphics
    layerGroup.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const markers: L.Marker[] = [];

    // Place Destination Marker
    const destIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div class="map-marker-pin">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const destMarker = L.marker([restaurant.lat, restaurant.lng], { icon: destIcon })
      .bindPopup(`
        <div style="font-family: var(--font-sans); color: #0d0d14; padding: 4px; min-width: 140px;">
          <h4 style="margin: 0 0 4px; font-weight: 700; font-size: 13px;">${restaurant.name}</h4>
          <p style="margin: 0 0 6px; font-size: 11px; color: #555;">${restaurant.cuisine} · ${restaurant.priceRange}</p>
          <span style="background: #f97316; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">★ ${restaurant.rating}</span>
        </div>
      `);
    layerGroup.addLayer(destMarker);
    markers.push(destMarker);

    // Place User Marker
    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `<div class="map-marker-user">🔵</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const userMarker = L.marker(userLocation, { icon: userIcon })
        .bindPopup(`
          <div style="font-family: var(--font-sans); color: #0d0d14; padding: 4px;">
            <h4 style="margin: 0; font-weight: 700; font-size: 13px;">Your Location</h4>
          </div>
        `);
      layerGroup.addLayer(userMarker);
      markers.push(userMarker);
    }

    // Draw Route Polyline
    if (routeInfo && routeInfo.coordinates.length > 0) {
      const polyline = L.polyline(routeInfo.coordinates, {
        color: '#3b82f6', // Solid premium blue
        weight: 6,
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.85
      }).addTo(map);
      polylineRef.current = polyline;
    } else if (userLocation && !loadingRoute) {
      // Fallback straight line
      const polyline = L.polyline([userLocation, [restaurant.lat, restaurant.lng]], {
        color: '#94a3b8',
        weight: 4,
        dashArray: '8, 8',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.7
      }).addTo(map);
      polylineRef.current = polyline;
    }

    // Auto-bounds mapping
    try {
      if (markers.length > 1) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
      } else {
        map.setView([restaurant.lat, restaurant.lng], 15);
      }
    } catch {
      map.setView([restaurant.lat, restaurant.lng], 15);
    }
  }, [restaurant, userLocation, routeInfo, loadingRoute]);

  if (!restaurant) return null;

  return (
    <div className="map-modal-backdrop" onClick={onClose}>
      <div className="map-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="map-modal-header">
          <div className="map-modal-title-row">
            <h2 className="map-modal-title">{restaurant.name}</h2>
            <span className="map-modal-cuisine">{restaurant.cuisine} · {restaurant.priceRange}</span>
          </div>
          <button className="map-modal-close-btn" onClick={onClose} aria-label="Close Map">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Map Container */}
        <div className="map-modal-body">
          <div ref={containerRef} className="map-modal-canvas" />

          {/* Floating Route Info Overlay */}
          {userLocation && (
            <div className="route-details-card glass-card">
              <div className="route-details-header">
                  <span className="route-type-badge">🚗 Driving Route</span>
                <span className="route-dest-name">to {restaurant.name}</span>
              </div>
              <div className="route-details-body">
                {loadingRoute ? (
                  <div className="route-loading">
                    <span className="spinner" />
                    <span>Calculating driving path...</span>
                  </div>
                ) : errorRoute ? (
                  <div className="route-error">
                    <span className="error-icon">⚠️</span>
                    <div className="error-text">
                      <span>Routing unavailable. Straight-line distance:</span>
                      <span className="route-stat-highlight">
                        {getDirectDistance(userLocation, [restaurant.lat, restaurant.lng]).toFixed(1)} km
                      </span>
                    </div>
                  </div>
                ) : routeInfo ? (
                  <div className="route-stats">
                    <div className="route-stat">
                      <span className="route-stat-label">Driving</span>
                      <span className="route-stat-val">{(routeInfo.distance / 1000).toFixed(1)} km</span>
                    </div>
                    <div className="route-stat-divider" />
                    <div className="route-stat">
                      <span className="route-stat-label">Straight-line</span>
                      <span className="route-stat-val">{getDirectDistance(userLocation, [restaurant.lat, restaurant.lng]).toFixed(1)} km</span>
                    </div>
                    <div className="route-stat-divider" />
                    <div className="route-stat">
                      <span className="route-stat-label">Est. Time</span>
                      <span className="route-stat-val">{Math.round(routeInfo.duration / 60)} mins</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
