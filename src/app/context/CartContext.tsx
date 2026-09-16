'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { DELIVERY_FEE, SERVICE_FEE } from '@/app/types/orderTypes';
import type { MenuItem } from '@/app/lib/vendorMenu';

// Flat shape matching exactly what orders.items needs in Supabase —
// building the cart around this from the start means checkout doesn't
// need to convert anything.
export type OrderLineItem = {
  id: string;      // vendor_menu_items id
  name: string;
  price: number;   // unit price at time of adding
  category: MenuItem['category'];
  quantity: number; // per-unit quantity within ONE composed order (e.g. 2 eggs)
  imageUrl?: string | null; // display-only — not part of the real orders.items shape
};

export type CartLine = {
  id: string;               // client-side cart line id
  vendorId: string;
  items: OrderLineItem[];   // composition for one order: base (qty 1) + chosen proteins/extras
  quantity: number;         // how many of this exact composed order
};

type DeliveryMode = 'pickup' | 'delivery';
export type PaymentMethod = 'cash' | 'momo';

interface CartContextType {
  lines: CartLine[];
  addToCart: (vendorId: string, items: OrderLineItem[]) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeLine: (id: string) => void;
  clearCart: () => void;

  deliveryMode: DeliveryMode;
  toggleDeliveryMode: () => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  customerLocation: string;
  setCustomerLocation: (loc: string) => void;
  /** Customer-confirmed dropoff pin (rider nav source of truth). */
  deliveryLat: number | null;
  deliveryLng: number | null;
  setDeliveryCoords: (lat: number, lng: number) => void;
  clearDeliveryCoords: () => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;

  itemsSubtotal: number;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function lineUnitPrice(line: CartLine): number {
  return line.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  // Defaults to 'delivery' — Pickup is a disabled "coming soon" button right
  // now, so defaulting to 'pickup' meant someone could hit Confirm without
  // ever being asked for phone/address.
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('delivery');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const addToCart = (vendorId: string, items: OrderLineItem[]) => {
    const id = `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setLines((prev) => [...prev, { id, vendorId, items, quantity: 1 }]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((line) => (line.id === id ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line))
        .filter((line) => line.quantity > 0)
    );
  };

  const removeLine = (id: string) => setLines((prev) => prev.filter((line) => line.id !== id));

  const setDeliveryCoords = (lat: number, lng: number) => {
    setDeliveryLat(lat);
    setDeliveryLng(lng);
  };

  const clearDeliveryCoords = () => {
    setDeliveryLat(null);
    setDeliveryLng(null);
  };

  const clearCart = () => {
    setLines([]);
    setDeliveryMode('delivery');
    setCustomerPhone('');
    setCustomerLocation('');
    setDeliveryLat(null);
    setDeliveryLng(null);
    setPaymentMethod('cash');
  };

  const toggleDeliveryMode = () => setDeliveryMode((m) => (m === 'pickup' ? 'delivery' : 'pickup'));

  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0);
  const itemsSubtotal = lines.reduce((sum, l) => sum + lineUnitPrice(l) * l.quantity, 0);
  const totalPrice =
    lines.length === 0 ? 0 : itemsSubtotal + (deliveryMode === 'delivery' ? DELIVERY_FEE : 0) + SERVICE_FEE;

  return (
    <CartContext.Provider
      value={{
        lines, addToCart, updateQuantity, removeLine, clearCart,
        deliveryMode, toggleDeliveryMode,
        customerPhone, setCustomerPhone,
        customerLocation, setCustomerLocation,
        deliveryLat, deliveryLng, setDeliveryCoords, clearDeliveryCoords,
        paymentMethod, setPaymentMethod,
        itemsSubtotal, totalItems, totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
