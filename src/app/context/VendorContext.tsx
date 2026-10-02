'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { getApprovedVendors, getVendorById, distanceKm, type Vendor } from '@/app/lib/vendorMenu';
import { supabase } from '@/app/lib/supabase';

export type { Vendor } from '@/app/lib/vendorMenu';

export type VendorWithDistance = Vendor & { distanceKm: number | null };

export type LocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable';

interface VendorContextType {
  vendors: VendorWithDistance[];
  loadingVendors: boolean;
  selectedVendor: Vendor | null;
  selectVendor: (vendor: Vendor) => void;
  clearVendor: () => void;
  refreshSelectedVendor: () => Promise<void>;
  refreshVendors: () => Promise<void>;
  locationStatus: LocationStatus;
  requestLocation: () => void;
  customerCoords: { lat: number; lng: number } | null;
  setCustomerCoords: (coords: { lat: number; lng: number }) => void;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

const MAX_DISTANCE_KM = 6;

export function VendorProvider({ children }: { children: ReactNode }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('pending');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getApprovedVendors();
        if (!cancelled) setVendors(data);
      } catch (err) {
        console.error('Could not load vendors', err);
      } finally {
        if (!cancelled) setLoadingVendors(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }
    setLocationStatus('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('granted');
      },
      (err) => {
        // code 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        setLocationStatus(err.code === 1 ? 'denied' : 'unavailable');
      },
      { timeout: 8000 }
    );
  }

  useEffect(() => {
    requestLocation();
  }, []);

  const sortedVendors: VendorWithDistance[] = useMemo(() => {
    if (!customerCoords) return [];

    const withDistance = vendors.map((v) => ({
      ...v,
      distanceKm:
        v.latitude != null && v.longitude != null
          ? distanceKm(customerCoords.lat, customerCoords.lng, v.latitude, v.longitude)
          : null,
    }));

    // Location is mandatory now, so we can only show vendors we can actually
    // confirm are nearby — a vendor with no GPS set stays hidden until they
    // set one, mirroring how Bolt/Uber won't surface something they can't place.
    return withDistance
      .filter((v) => v.distanceKm != null && v.distanceKm <= MAX_DISTANCE_KM)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [vendors, customerCoords]);

  function selectVendor(vendor: Vendor) {
    setSelectedVendor(vendor);
  }

  function clearVendor() {
    setSelectedVendor(null);
  }

  const refreshVendors = useCallback(async () => {
    try {
      const data = await getApprovedVendors();
      setVendors(data);
    } catch (err) {
      console.error('Could not refresh vendors', err);
    }
  }, []);

  async function refreshSelectedVendor() {
    if (!selectedVendor) return;
    try {
      const fresh = await getVendorById(selectedVendor.id);
      if (fresh) setSelectedVendor(fresh);
    } catch (err) {
      console.error('Could not refresh vendor', err);
    }
  }

  function handleSetCustomerCoords(coords: { lat: number; lng: number }) {
    setCustomerCoords(coords);
    setLocationStatus('granted');
  }

  // Live vendor row (is_open, daily hours) — no reload when admin toggles.
  useEffect(() => {
    if (!selectedVendor) return;

    refreshSelectedVendor();

    const channel = supabase
      .channel(`vendor-live-${selectedVendor.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vendors', filter: `id=eq.${selectedVendor.id}` },
        (payload) => {
          const row = payload.new as Partial<Vendor> & { id?: string };
          if (!row?.id) return;
          setSelectedVendor((prev) => (prev ? { ...prev, ...row } : prev));
          setVendors((prev) => prev.map((v) => (v.id === row.id ? { ...v, ...row } : v)));
        },
      )
      .subscribe();

    const interval = setInterval(refreshSelectedVendor, 120_000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when vendor id changes only
  }, [selectedVendor?.id]);

  return (
    <VendorContext.Provider
      value={{
        vendors: sortedVendors,
        loadingVendors,
        selectedVendor,
        selectVendor,
        clearVendor,
        refreshSelectedVendor,
        refreshVendors,
        locationStatus,
        requestLocation,
        customerCoords,
        setCustomerCoords: handleSetCustomerCoords,
      }}
    >
      {children}
    </VendorContext.Provider>
  );
}

export function useVendor() {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error('useVendor must be used within a VendorProvider');
  return ctx;
}