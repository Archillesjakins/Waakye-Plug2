'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2, LocateFixed, X } from 'lucide-react';
import { toast } from 'sonner';
import { InteractiveMap } from './InteractiveMap';

export interface DeliveryLocation {
  lat: number;
  lng: number;
  displayName: string;
}

interface LocationPickerProps {
  value: DeliveryLocation | null;
  onChange: (location: DeliveryLocation) => void;
  onClose: () => void;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
  };
}

export function LocationPicker({ value, onChange, onClose }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [locating, setLocating] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<{ lat: number; lng: number } | null>(
    value ? { lat: value.lat, lng: value.lng } : null
  );
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
    value ? { lat: value.lat, lng: value.lng } : { lat: 6.6, lng: 0.47 } // Ho, Ghana default for map center
  );
  const [isDragging, setIsDragging] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Search for places using Nominatim
  const searchPlaces = async (query: string) => {
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          new URLSearchParams({
            q: query,
            format: 'json',
            addressdetails: '1',
            limit: '5',
            countrycodes: 'gh', // Limit to Ghana
          }),
        {
          headers: { 'User-Agent': 'WaakyePlug/1.0' },
        }
      );

      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      toast.error("We couldn't search right now — try the map pin");
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(searchQuery);
      }, 500);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Use current GPS location
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location not available on this device');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Reverse geocode to get place name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            { headers: { 'User-Agent': 'WaakyePlug/1.0' } }
          );

          if (!response.ok) throw new Error('Reverse lookup failed');
          const data = await response.json();

          setSelectedMarker({ lat, lng });
          setMapCenter({ lat, lng });
          onChange({
            lat,
            lng,
            displayName: data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          });
          toast.success('Location set from device');
        } catch {
          // Fallback if reverse geocode fails
          setSelectedMarker({ lat, lng });
          setMapCenter({ lat, lng });
          onChange({
            lat,
            lng,
            displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          });
          toast.success('Location set from device');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error('Turn on location or set it on the map');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Select a search result
  const selectPlace = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    setSelectedMarker({ lat, lng });
    setMapCenter({ lat, lng });
    onChange({
      lat,
      lng,
      displayName: result.display_name,
    });
    setSearchQuery('');
    setSearchResults([]);
    toast.success('Location set');
  };

  // Handle map click to drop pin
  const handleMapClick = async (lat: number, lng: number) => {
    setSelectedMarker({ lat, lng });
    setMapCenter({ lat, lng });

    // Reverse geocode the clicked point
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'WaakyePlug/1.0' } }
      );

      if (!response.ok) throw new Error('Location lookup failed');
      const data = await response.json();

      onChange({
        lat,
        lng,
        displayName: data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
      toast.success('Pin dropped');
    } catch {
      onChange({
        lat,
        lng,
        displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
      toast.success('Pin dropped');
    }
  };

  const confirmLocation = () => {
    if (!selectedMarker) {
      toast.error('Please choose a location first');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-lg">Set delivery location</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a place, landmark, or area..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-[#7a1d1d]/40"
            />
            {searching && (
              <Loader2 className="w-4 h-4 text-[#7a1d1d] absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
            )}
          </div>

          <button
            onClick={useCurrentLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#7a1d1d] text-[#7a1d1d] font-bold hover:bg-[#7a1d1d]/5 disabled:opacity-50 transition-colors"
          >
            <LocateFixed className="w-4 h-4" />
            {locating ? 'Finding you...' : 'Use my current location'}
          </button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="border-b border-gray-100 max-h-48 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.place_id}
                onClick={() => selectPlace(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#7a1d1d] shrink-0 mt-1" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{result.display_name}</p>
                    <p className="text-xs text-gray-500">{result.type}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Map view */}
        <div className="flex-1 p-4 overflow-hidden">
          <InteractiveMap
            center={mapCenter}
            marker={selectedMarker}
            onMapClick={handleMapClick}
            zoom={14}
          />

          {/* Selected location display */}
          {value && (
            <div className="mt-3 p-3 bg-[#7a1d1d]/5 rounded-xl border border-[#7a1d1d]/20">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#7a1d1d] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Delivery location</p>
                  <p className="text-sm font-bold text-gray-900 break-words">{value.displayName}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={confirmLocation}
            disabled={!selectedMarker}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors ${
              !selectedMarker
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#7a1d1d] text-white hover:bg-[#6a1717]'
            }`}
          >
            Confirm this location
          </button>
        </div>
      </div>
    </div>
  );
}
