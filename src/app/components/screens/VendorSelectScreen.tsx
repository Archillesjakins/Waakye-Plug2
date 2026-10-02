'use client';

import { motion } from 'motion/react';
import { useState, useMemo, useEffect } from 'react';
import { Store, MapPin, Search, Loader2, LocateFixed, UtensilsCrossed } from 'lucide-react';
import { useVendor, type Vendor } from '@/app/context/VendorContext';
import { vendorAcceptingOrders } from '@/app/lib/vendorHours';
import { supabase } from '@/app/lib/supabase';
import { LocationPicker, type DeliveryLocation } from '@/app/components/LocationPicker';
import { toast } from 'sonner';

interface VendorSelectScreenProps {
  onSelect: () => void;
}

export function VendorSelectScreen({ onSelect }: VendorSelectScreenProps) {
  const { vendors, loadingVendors, selectVendor, locationStatus, requestLocation, customerCoords, setCustomerCoords, refreshVendors } =
    useVendor();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'nearby'>('all');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string>('Your current location');

  // Live vendor list (hours, is_open, new approvals).
  useEffect(() => {
    refreshVendors();
    const channel = supabase
      .channel('vendor-list-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => {
        void refreshVendors();
      })
      .subscribe();
    const interval = setInterval(refreshVendors, 120_000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [refreshVendors]);

  function handlePick(vendor: Vendor) {
    if (!vendorAcceptingOrders(vendor)) return;
    selectVendor(vendor);
    onSelect();
  }

  function handleLocationChange(location: DeliveryLocation) {
    setCustomerCoords({ lat: location.lat, lng: location.lng });
    setLocationLabel(location.displayName);
    toast.success('Location updated');
  }

  const filteredVendors = useMemo(() => {
    let list = vendors;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (v) => v.business_name.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q)
      );
    }
    if (filter === 'open') list = list.filter((v) => vendorAcceptingOrders(v));
    if (filter === 'nearby') list = [...list].sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
    return list;
  }, [vendors, query, filter]);

  // ── Location is mandatory: no location, no vendor list ─────────────────────
  if (locationStatus === 'pending') {
    return (
      <div className="min-h-[100dvh] bg-[#fefaf4] flex flex-col items-center justify-center px-6 text-center">
        <Loader2 className="w-8 h-8 text-[#7a1d1d] animate-spin mb-4" />
        <p className="font-bold">Finding vendors near you...</p>
      </div>
    );
  }

  if (locationStatus === 'denied' || locationStatus === 'unavailable') {
    return (
      <div className="min-h-[100dvh] bg-[#fefaf4] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#7a1d1d]/10 flex items-center justify-center mb-4">
          <LocateFixed className="w-7 h-7 text-[#7a1d1d]" />
        </div>
        <h1 className="font-bold text-xl mb-2">We need your location</h1>
        <p className="text-sm text-gray-500 max-w-xs mb-1">
          We only show vendors within 6km of you, so we can't find anyone nearby without it.
        </p>
        {locationStatus === 'denied' && (
          <p className="text-xs text-gray-400 max-w-xs mb-5">
            Looks like location access was blocked — you may need to allow it in your browser's site settings, then try again.
          </p>
        )}
        <button
          onClick={requestLocation}
          className="bg-[#7a1d1d] text-white px-6 py-3 rounded-2xl font-bold hover:bg-[#6a1717] transition-colors mb-3"
        >
          Enable Location
        </button>
        <button
          onClick={() => setShowLocationPicker(true)}
          className="bg-white text-[#7a1d1d] border border-[#7a1d1d] px-6 py-3 rounded-2xl font-bold hover:bg-[#7a1d1d]/5 transition-colors"
        >
          Set location on map
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#fefaf4] [webkit-tap-highlight-color:transparent]">
      <div className="max-w-md mx-auto px-4 pt-6 pb-24">

        {/* ── Location header, styled like the reference "current location" card ── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-[#7a1d1d]/10 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-[#7a1d1d]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400 font-medium">Ordering near</p>
            <p className="font-bold text-sm truncate">{locationLabel}</p>
          </div>
          <button
            onClick={() => setShowLocationPicker(true)}
            className="text-xs font-bold text-[#7a1d1d] hover:underline shrink-0"
          >
            Change
          </button>
        </div>

        {/* ── Search bar ── */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#7a1d1d]/40"
          />
        </div>

        {/* ── Filter chips (stand-in for the reference's category pills) ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
          {([
            { key: 'all', label: 'All' },
            { key: 'open', label: 'Open Now' },
            { key: 'nearby', label: 'Nearest' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                filter === f.key ? 'bg-[#7a1d1d] text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Promo / info banner, standing in for "Ongoing Offers" ── */}
        <div className="rounded-3xl bg-[#7a1d1d] text-white p-5 mb-6 relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10" />
          <p className="font-bold text-lg leading-tight mb-1">Hungry?</p>
          <p className="text-sm text-white/80 mb-3">Pick a vendor below to start your order</p>
        </div>

        <h2 className="font-bold text-lg mb-3">Vendors Near You</h2>

        {loadingVendors ? (
          <p className="text-center text-sm text-gray-400 py-10">Loading vendors...</p>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">No vendors match right now.</p>
          </div>
        ) : (
          /* ── Two-column grid, matching the reference's card layout ── */
          <div className="grid grid-cols-2 gap-3">
            {filteredVendors.map((vendor, i) => {
              const accepting = vendorAcceptingOrders(vendor);
              return (
              <motion.button
                key={vendor.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handlePick(vendor)}
                disabled={!accepting}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden text-left flex flex-col transition-all ${
                  accepting ? 'hover:shadow-md hover:-translate-y-0.5' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="relative h-28 bg-gray-50">
                  {vendor.logo_url ? (
                    <img src={vendor.logo_url} alt={vendor.business_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store className="w-8 h-8 text-[#7a1d1d]/30" />
                    </div>
                  )}
                  {/* status badge, top-left — plays the role of the reference's heart icon */}
                  <span
                    className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      accepting ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {accepting ? 'Open' : 'Closed'}
                  </span>
                </div>

                <div className="p-3 flex flex-col gap-1">
                  <p className="font-bold text-sm leading-tight truncate">{vendor.business_name}</p>
                  {vendor.description && (
                    <p className="text-xs text-gray-500 truncate">{vendor.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-[#7a1d1d] font-bold mt-1">
                    <MapPin className="w-3 h-3" />
                    {vendor.distanceKm!.toFixed(1)} km away
                  </div>
                </div>
              </motion.button>
            );
            })}
          </div>
        )}
      </div>

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPicker
          value={
            customerCoords
              ? { lat: customerCoords.lat, lng: customerCoords.lng, displayName: locationLabel }
              : null
          }
          onChange={handleLocationChange}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  );
}