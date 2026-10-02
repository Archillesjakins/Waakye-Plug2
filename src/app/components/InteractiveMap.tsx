'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

interface InteractiveMapProps {
  center: { lat: number; lng: number };
  marker: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  zoom?: number;
}

export function InteractiveMap({ center, marker, onMapClick, zoom = 14 }: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tileUrl, setTileUrl] = useState('');

  useEffect(() => {
    // Calculate tile coordinates for OpenStreetMap
    const z = zoom;
    const lat_rad = (center.lat * Math.PI) / 180;
    const n = Math.pow(2, z);
    const xtile = Math.floor(((center.lng + 180) / 360) * n);
    const ytile = Math.floor(((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2) * n);

    setTileUrl(`https://tile.openstreetmap.org/${z}/${xtile}/${ytile}.png`);
  }, [center.lat, center.lng, zoom]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert pixel coordinates to lat/lng (approximate for the visible area)
    const pixelsPerDegree = rect.width / (360 / Math.pow(2, zoom));
    const lng = center.lng + ((x - rect.width / 2) / pixelsPerDegree) * (360 / Math.pow(2, zoom));
    
    // Latitude calculation is more complex due to Mercator projection
    const latRad = (center.lat * Math.PI) / 180;
    const mercatorY = Math.log(Math.tan(latRad) + 1 / Math.cos(latRad));
    const pixelY = y - rect.height / 2;
    const scale = rect.height / (2 * Math.PI * Math.pow(2, zoom - 8));
    const newMercatorY = mercatorY - pixelY / scale;
    const lat = (Math.atan(Math.sinh(newMercatorY)) * 180) / Math.PI;

    onMapClick(lat, lng);
  };

  // Calculate marker position relative to center
  const getMarkerPosition = () => {
    if (!marker || !containerRef.current) return { x: 0, y: 0 };

    const rect = containerRef.current.getBoundingClientRect();
    const pixelsPerDegree = rect.width / (360 / Math.pow(2, zoom));

    // X position (longitude)
    const x = rect.width / 2 + (marker.lng - center.lng) * pixelsPerDegree * (Math.pow(2, zoom) / 360);

    // Y position (latitude - Mercator)
    const centerLatRad = (center.lat * Math.PI) / 180;
    const markerLatRad = (marker.lat * Math.PI) / 180;
    const centerMercatorY = Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad));
    const markerMercatorY = Math.log(Math.tan(markerLatRad) + 1 / Math.cos(markerLatRad));
    const scale = rect.height / (2 * Math.PI * Math.pow(2, zoom - 8));
    const y = rect.height / 2 - (markerMercatorY - centerMercatorY) * scale;

    return { x, y };
  };

  const markerPos = getMarkerPosition();

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="w-full h-64 bg-gray-100 rounded-2xl relative overflow-hidden cursor-crosshair border border-gray-200"
    >
      {/* OSM Tile - this is a simple single-tile view */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${tileUrl})`,
        }}
      >
        {/* Fallback pattern if tile fails to load */}
        <div className="w-full h-full" style={{ 
          backgroundImage: 'repeating-linear-gradient(0deg, #f0f0f0 0px, #f0f0f0 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #f0f0f0 0px, #f0f0f0 1px, transparent 1px, transparent 20px)',
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Marker pin */}
      {marker && (
        <div
          className="absolute pointer-events-none transition-all duration-200"
          style={{
            left: `${markerPos.x}px`,
            top: `${markerPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <MapPin className="w-8 h-8 text-[#7a1d1d] drop-shadow-lg fill-[#7a1d1d]" />
        </div>
      )}

      {/* Instructions overlay */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 px-3 py-2 rounded-lg shadow-sm text-xs font-medium pointer-events-none">
        Tap anywhere to drop a pin
      </div>

      {/* Attribution (required by OSM) */}
      <div className="absolute bottom-1 right-1 text-[8px] text-gray-500 bg-white/80 px-1 rounded pointer-events-none">
        © OpenStreetMap
      </div>
    </div>
  );
}
