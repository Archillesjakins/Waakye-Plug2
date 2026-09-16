'use client';

import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Minus, Plus, Trash2, Banknote, Smartphone, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MenuItemThumbnail } from '@/app/components/MenuItemThumbnail';
import { useCart, CartLine, lineUnitPrice } from '@/app/context/CartContext';
import { DELIVERY_FEE, SERVICE_FEE } from '@/app/types/orderTypes';

interface OrderSummaryScreenProps {
  onBack: () => void;
  onConfirm: () => void;
}

/** Ho (Volta Region) — default map center / GPS fallback. Never Accra. */
const HO_DEFAULT = { lat: 6.6008, lng: 0.4713 };
/** GPS accuracy worse than this (meters) → warn + Precise Location copy. */
const MAX_ACCURACY_M = 250;
const BRAND = '#7a1d1d';

function makeDropPinIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      background:${BRAND};border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.45);
      transform:rotate(-45deg);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

export function OrderSummaryScreen({ onBack, onConfirm }: OrderSummaryScreenProps) {
  const {
    lines, updateQuantity, removeLine,
    customerPhone, setCustomerPhone,
    customerLocation, setCustomerLocation,
    deliveryLat, deliveryLng, setDeliveryCoords,
    paymentMethod, setPaymentMethod,
    itemsSubtotal, totalPrice,
  } = useCart();

  const [locating, setLocating] = useState(false);
  const [accuracyWarning, setAccuracyWarning] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ok' | 'fallback'>('idle');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const userDraggedRef = useRef(false);
  const setDeliveryCoordsRef = useRef(setDeliveryCoords);
  setDeliveryCoordsRef.current = setDeliveryCoords;

  const applyCoords = useCallback((lat: number, lng: number, opts?: { pan?: boolean }) => {
    setDeliveryCoordsRef.current(lat, lng);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (opts?.pan !== false && mapRef.current) {
      mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 16));
    }
  }, []);

  // Init Leaflet map once (Ho default until a good GPS fix arrives).
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([HO_DEFAULT.lat, HO_DEFAULT.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([HO_DEFAULT.lat, HO_DEFAULT.lng], {
      draggable: true,
      icon: makeDropPinIcon(),
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      userDraggedRef.current = true;
      setDeliveryCoordsRef.current(pos.lat, pos.lng);
      setAccuracyWarning(null);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // If coords were already set (e.g. revisiting summary), restore pin.
    // Otherwise seed Ho as the starting pin so submit always has a lat/lng
    // once the user confirms (they can still drag).
    // We intentionally do NOT auto-commit Ho into cart until GPS/drag —
    // require an explicit GPS fix or user drag so Accra-style wrong pins
    // are never silently accepted as "confirmed".
    // Invalidate size after layout so tiles render in flex containers.
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const reverseGeocodeAndFill = useCallback(async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'WaakyePlug/1.0' } }
      );
      if (!res.ok) throw new Error('Reverse geocode failed');
      const data = await res.json();
      const address = data?.display_name as string | undefined;
      const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
      setCustomerLocation(address ? `${address}\n🗺️ ${mapsLink}` : `${latitude}, ${longitude}\n🗺️ ${mapsLink}`);
    } catch {
      const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
      setCustomerLocation(`${latitude}, ${longitude}\n🗺️ ${mapsLink}`);
    }
  }, [setCustomerLocation]);

  const handleGpsFix = useCallback((position: GeolocationPosition, fromButton: boolean) => {
    const { latitude, longitude, accuracy } = position.coords;
    const acc = typeof accuracy === 'number' ? accuracy : Number.POSITIVE_INFINITY;

    // Don't yank the pin if the customer already placed it by hand
    // (late GPS callbacks after a drag are common on mobile).
    if (userDraggedRef.current && !fromButton) {
      setGpsStatus('ok');
      return;
    }
    if (fromButton) {
      userDraggedRef.current = false;
    }

    if (acc > MAX_ACCURACY_M) {
      setAccuracyWarning(
        `Location accuracy is ~${Math.round(acc)}m — too coarse for delivery. Turn on Precise Location in your browser/device settings, then tap Use my location again — or drag the pin to your exact dropoff.`
      );
      toast.warning('Precise Location needed — drag the pin or retry GPS');
      // Still move the pin so the customer can refine by dragging.
      applyCoords(latitude, longitude);
      setGpsStatus('ok');
      void reverseGeocodeAndFill(latitude, longitude);
      return;
    }

    setAccuracyWarning(null);
    applyCoords(latitude, longitude);
    setGpsStatus('ok');
    void reverseGeocodeAndFill(latitude, longitude);
    if (fromButton) toast.success('Dropoff pin set from GPS — drag to fine-tune');
  }, [applyCoords, reverseGeocodeAndFill]);

  const requestLocation = useCallback((fromButton: boolean) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported on this device');
      setGpsStatus('fallback');
      return;
    }
    setLocating(true);
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleGpsFix(position, fromButton);
        setLocating(false);
      },
      () => {
        toast.error('Unable to fetch location. Drag the pin on the map (Ho default).');
        setLocating(false);
        setGpsStatus('fallback');
        // Seed Ho pin into cart only after failed GPS so the map has a
        // confirmed starting point the user can drag.
        applyCoords(HO_DEFAULT.lat, HO_DEFAULT.lng);
        setAccuracyWarning(
          'GPS unavailable — map is centered on Ho. Drag the burgundy pin to your exact dropoff before confirming.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [applyCoords, handleGpsFix]);

  // Auto-request high-accuracy GPS on mount.
  useEffect(() => {
    requestLocation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const formatTo233 = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '').trim();
    if (cleaned.startsWith('0')) return '233' + cleaned.slice(1);
    if (cleaned.startsWith('233')) return cleaned;
    return cleaned;
  };

  const baseItem = (line: CartLine) => line.items.find((i) => i.category === 'base' || i.category === 'combo');
  const otherItems = (line: CartLine) => line.items.filter((i) => i.category !== 'base' && i.category !== 'combo');

  const isEmpty = lines.length === 0;

  // Delivery is the only mode — need a usable address text AND a confirmed pin.
  const hasUsableAddress = customerLocation.trim().length >= 8;
  const hasCoords =
    typeof deliveryLat === 'number' &&
    typeof deliveryLng === 'number' &&
    Number.isFinite(deliveryLat) &&
    Number.isFinite(deliveryLng);
  const canSubmit = !!customerPhone && hasUsableAddress && hasCoords;

  const handleConfirmClick = () => {
    if (!hasCoords) {
      toast.error('Set your dropoff pin on the map before confirming.');
      return;
    }
    if (!hasUsableAddress) {
      toast.error('Add a delivery address description so the rider can find you.');
      return;
    }
    onConfirm();
  };

  return (
    <div className="min-h-[100dvh] bg-[#fefaf4] flex flex-col [webkit-tap-highlight-color:transparent]">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button onClick={onBack} className="p-3 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg">Order Summary</h1>
          <div className="w-10" />
        </div>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-gray-500 mb-4">Your cart is empty.</p>
          <button onClick={onBack} className="bg-[#7a1d1d] text-white px-6 py-3 rounded-2xl font-bold hover:bg-[#6a1717] transition-colors">
            Back to Menu
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto pb-40 [-webkit-overflow-scrolling:touch]">
            <div className="max-w-2xl mx-auto p-4 space-y-3">

              {/* ── Cart lines ── */}
              <div className="space-y-2.5">
                {lines.map((line, i) => (
                  <motion.div
                    key={line.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MenuItemThumbnail imageUrl={baseItem(line)?.imageUrl} category={baseItem(line)?.category ?? 'base'} size="md" />
                        <div>
                          <div className="font-bold text-sm">{baseItem(line)?.name ?? 'Item'}</div>
                          <div className="text-xs text-gray-500">GH₵{lineUnitPrice(line)} each</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => (line.quantity === 1 ? removeLine(line.id) : updateQuantity(line.id, -1))}
                          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                        >
                          {line.quantity === 1 ? (
                            <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <div className="w-6 text-center font-bold text-sm">{line.quantity}</div>
                        <button
                          onClick={() => updateQuantity(line.id, 1)}
                          className="w-8 h-8 rounded-full bg-[#7a1d1d] text-white flex items-center justify-center hover:bg-[#6a1717]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {otherItems(line).length > 0 && (
                      <div className="pt-2 border-t border-gray-100 space-y-1">
                        {otherItems(line).map((item) => (
                          <div key={item.id} className="flex justify-between text-xs text-gray-500">
                            <span>{item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}</span>
                            <span>GH₵{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between pt-2 border-t border-gray-100 text-sm font-bold">
                      <span>Line total</span>
                      <span className="text-[#7a1d1d]">GH₵{lineUnitPrice(line) * line.quantity}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <button
                onClick={onBack}
                className="w-full py-3 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:bg-white transition-colors"
              >
                + Add another item
              </button>

              {/* ── Payment method ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
              >
                <div className="font-bold text-sm mb-3">Payment Method</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-4 rounded-xl border transition-all ${
                      paymentMethod === 'cash' ? 'border-[#7a1d1d] bg-[#7a1d1d]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Banknote className={`w-6 h-6 mx-auto mb-2 ${paymentMethod === 'cash' ? 'text-[#7a1d1d]' : 'text-gray-400'}`} />
                    <div className="font-bold text-sm">Cash</div>
                    <div className="text-xs text-gray-500 mt-1">Pay on delivery</div>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('momo')}
                    className={`p-4 rounded-xl border transition-all ${
                      paymentMethod === 'momo' ? 'border-[#7a1d1d] bg-[#7a1d1d]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Smartphone className={`w-6 h-6 mx-auto mb-2 ${paymentMethod === 'momo' ? 'text-[#7a1d1d]' : 'text-gray-400'}`} />
                    <div className="font-bold text-sm">Mobile Money</div>
                    <div className="text-xs text-gray-500 mt-1">Pay on delivery</div>
                  </button>
                </div>
              </motion.div>

              {/* ── Contact + delivery pin ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="e.g. 024XXXXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(formatTo233(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl p-3 focus:border-[#7a1d1d] outline-none text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Dropoff pin</label>
                    <button
                      type="button"
                      onClick={() => requestLocation(true)}
                      disabled={locating}
                      className="text-xs font-bold text-[#7a1d1d] hover:underline disabled:opacity-50"
                    >
                      {locating || gpsStatus === 'locating' ? 'Locating…' : 'Use my location'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#7a1d1d]" />
                    Drag the burgundy pin to where the rider should deliver. Default city: Ho (Volta).
                  </p>
                  <div
                    ref={mapContainerRef}
                    className="w-full h-56 rounded-xl overflow-hidden border border-gray-200 z-0"
                    style={{ minHeight: 224 }}
                  />
                  {hasCoords && (
                    <p className="text-[11px] text-gray-400 mt-1 font-mono">
                      {deliveryLat!.toFixed(5)}, {deliveryLng!.toFixed(5)}
                    </p>
                  )}
                  {accuracyWarning && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                      {accuracyWarning}
                    </p>
                  )}
                  {!hasCoords && (
                    <p className="text-xs text-red-500 mt-1">
                      Set your dropoff pin (GPS or drag) before confirming the order.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Location (notes)</label>
                  <textarea
                    placeholder="Landmark / house description (helps the rider)"
                    value={customerLocation}
                    onChange={(e) => setCustomerLocation(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 focus:border-[#7a1d1d] outline-none text-sm"
                    rows={3}
                  />
                  {customerLocation.trim().length > 0 && !hasUsableAddress && (
                    <p className="text-xs text-red-500 mt-1">Please add a bit more detail so the rider can find you.</p>
                  )}
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xs text-gray-400 text-center px-2"
              >
                📍 Your confirmed pin is what the rider navigates to — drag it carefully.
              </motion.p>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-lg">
            <div className="max-w-2xl mx-auto">
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-700">GH₵{itemsSubtotal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Delivery Fee</span>
                  <span className="text-gray-700">GH₵{DELIVERY_FEE}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Service Fee</span>
                  <span className="text-gray-700">GH₵{SERVICE_FEE}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="font-bold">Total</span>
                  <span className="text-2xl font-bold text-[#7a1d1d]">GH₵{totalPrice}</span>
                </div>
              </div>
              <button
                onClick={handleConfirmClick}
                disabled={!canSubmit}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors ${
                  !canSubmit
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#7a1d1d] text-white hover:bg-[#6a1717]'
                }`}
              >
                Confirm Order
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
