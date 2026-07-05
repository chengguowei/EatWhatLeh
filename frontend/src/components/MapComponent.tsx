import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Restaurant } from './RestaurantCard';

interface MapComponentProps {
  restaurants: Restaurant[];
  isItinerary?: boolean;
}

export default function MapComponent({ restaurants, isItinerary }: MapComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([2.1896, 102.2501], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers and Routes
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    // Clear previous elements
    layerGroup.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (restaurants.length === 0) {
      map.setView([2.1896, 102.2501], 13);
      return;
    }

    const markers: L.Marker[] = [];

    restaurants.forEach((r, idx) => {
      // Custom divicon with nice emoji or numbering for itineraries
      const html = isItinerary
        ? `<div class="map-marker-step">${idx + 1}</div>`
        : `<div class="map-marker-pin">📍</div>`;

      const icon = L.divIcon({
        className: 'custom-map-icon',
        html: html,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([r.lat, r.lng], { icon })
        .bindPopup(`
          <div style="font-family: var(--font-sans); color: #0d0d14; padding: 4px; min-width: 140px;">
            <h4 style="margin: 0 0 4px; font-weight: 700; font-size: 13px;">${r.name}</h4>
            <p style="margin: 0 0 6px; font-size: 11px; color: #555;">${r.cuisine} · ${r.priceRange}</p>
            <span style="background: #f97316; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">★ ${r.rating}</span>
          </div>
        `);

      layerGroup.addLayer(marker);
      markers.push(marker);
    });

    // Draw route if it's an itinerary
    if (isItinerary && restaurants.length > 1) {
      const latlngs = restaurants.map((r) => L.latLng(r.lat, r.lng));
      const polyline = L.polyline(latlngs, {
        color: '#f97316',
        weight: 4,
        dashArray: '8, 8',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      polylineRef.current = polyline;
    }

    // Zoom/Fit bounds
    try {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [45, 45] });
    } catch {
      // Fallback if bounds fit fails
      map.setView([restaurants[0].lat, restaurants[0].lng], 14);
    }
  }, [restaurants, isItinerary]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />;
}
