'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  MapPin,
  Search,
  UtensilsCrossed,
  Heart,
  Plus,
  Package,
  Loader2,
  Store,
  ChevronRight,
} from 'lucide-react';
import { useVendor } from '@/app/context/VendorContext';
import { getVendorMenu, type MenuItem } from '@/app/lib/vendorMenu';
import { MenuItemThumbnail } from '@/app/components/MenuItemThumbnail';
import { useCart } from '@/app/context/CartContext';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabase';

interface HomeScreenProps {
  onOpenItem: (item: MenuItem) => void;
  onBuildOwn: () => void;
  onSwitchVendor: () => void;
  onMyOrders: () => void;
}

export function HomeScreen({ onOpenItem, onBuildOwn, onSwitchVendor, onMyOrders }: HomeScreenProps) {
  const { selectedVendor } = useVendor();
  const { addToCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedVendor) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const items = await getVendorMenu(selectedVendor!.id);
        if (!cancelled) setAllItems(items);
      } catch (err) {
        console.error('Could not load menu', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    const vendorId = selectedVendor.id;
    const channel = supabase
      .channel(`vendor-menu-${vendorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendor_menu_items', filter: `vendor_id=eq.${vendorId}` },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selectedVendor]);

  // The browse grid only ever shows fixed, standalone items (Combos).
  // Size/Protein/Extra/Drink/Breakfast Item are build-components only —
  // they're picked inside the Build flow, never ordered on their own here.
  const comboItems = useMemo(() => allItems.filter((i) => i.category === 'combo'), [allItems]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return comboItems;
    const q = query.toLowerCase();
    return comboItems.filter(
      (i) => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
    );
  }, [comboItems, query]);

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function quickAdd(item: MenuItem) {
    if (!selectedVendor) return;
    addToCart(selectedVendor.id, [
      { id: item.id, name: item.name, price: item.price, category: item.category, quantity: 1, imageUrl: item.image_url },
    ]);
    toast.success(`Added ${item.name} to cart`);
  }

  const showsBuildBanner = selectedVendor?.supports_build === true;

  return (
    <div className="min-h-[100dvh] bg-[#fefaf4] [webkit-tap-highlight-color:transparent]">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28">

        {/* ── Location header ── */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={onSwitchVendor} className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#7a1d1d]/10 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-[#7a1d1d]" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs text-gray-400 font-medium">Ordering from</p>
              <p className="font-bold text-sm truncate flex items-center gap-1">
                {selectedVendor?.business_name ?? 'Vendor'}
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </p>
            </div>
          </button>
          {selectedVendor?.location && (
            <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
              <MapPin className="w-3.5 h-3.5" />
              <span className="max-w-[90px] truncate">{selectedVendor.location}</span>
            </div>
          )}
               <button
            onClick={onMyOrders}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0"
            aria-label="My Orders"
          >
            <Package className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Search ── */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#7a1d1d]/40"
          />
        </div>

        {/* ── "Build Your Own" banner — only for vendors that actually offer it ── */}
        {showsBuildBanner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-[#7a1d1d] text-white p-5 mb-6 relative overflow-hidden"
          >
            <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10" />
            <p className="text-white/70 text-xs font-bold uppercase tracking-wide mb-1">Also available</p>
            <p className="font-bold text-lg leading-tight mb-3">You can also build your own bowl here</p>
            <button
              onClick={onBuildOwn}
              className="bg-white text-[#7a1d1d] text-sm font-bold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors"
            >
              Build Your Own →
            </button>
          </motion.div>
        )}

        {/* ── Item grid: fixed/Combo items only ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 text-[#7a1d1d] animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">
              {showsBuildBanner ? 'No set items right now — try Build Your Own above.' : 'Nothing here yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item, i) => {
              const isFav = favorites.has(item.id);
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  onClick={() => onOpenItem(item)}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden text-left flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="relative h-28">
                    <MenuItemThumbnail imageUrl={item.image_url} category={item.category} size="full" />
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm"
                    >
                      <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-[#7a1d1d] text-[#7a1d1d]' : 'text-gray-400'}`} />
                    </span>
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="font-bold text-sm leading-tight truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <span className="text-[#7a1d1d] font-bold text-sm">
                        {item.pricing_type === 'variable' ? 'From ' : ''}GH₵{item.price}
                      </span>
                      <span
                        onClick={(e) => { e.stopPropagation(); quickAdd(item); }}
                        className="w-8 h-8 rounded-full bg-[#7a1d1d] text-white flex items-center justify-center hover:bg-[#6a1717] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}