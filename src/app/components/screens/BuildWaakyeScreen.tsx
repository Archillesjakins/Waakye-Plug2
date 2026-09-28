'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Plus, Minus, Check, Loader2, Flame } from 'lucide-react';
import { useVendor } from '@/app/context/VendorContext';
import { getVendorMenu, groupMenuByCategory } from '@/app/lib/vendorMenu';
import { MenuItemThumbnail } from '@/app/components/MenuItemThumbnail';
import type { OrderLineItem } from '@/app/context/CartContext';

interface BuildWaakyeScreenProps {
  onBack: () => void;
  onAddToCart: (items: OrderLineItem[]) => void;
}

function formatMenuSubtitle(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function baseChoiceLabel(name: string, description: string | null | undefined): string {
  const sub = description?.trim();
  if (!sub) return name;
  return `${name} · ${formatMenuSubtitle(sub)}`;
}

export function BuildWaakyeScreen({ onBack, onAddToCart }: BuildWaakyeScreenProps) {
  const { selectedVendor } = useVendor();
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(() => groupMenuByCategory([]));

  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [proteinQty, setProteinQty] = useState<Record<string, number>>({});
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedVendor) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const items = await getVendorMenu(selectedVendor!.id);
        if (cancelled) return;
        const grouped = groupMenuByCategory(items);
        setMenu(grouped);
        if (grouped.base.length > 0) setSelectedBaseId(grouped.base[0].id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [selectedVendor]);

  const updateProteinQty = (itemId: string, delta: number) => {
    setProteinQty((prev) => {
      const next = Math.max(0, (prev[itemId] || 0) + delta);
      const updated = { ...prev };
      if (next === 0) delete updated[itemId];
      else updated[itemId] = next;
      return updated;
    });
  };

  const toggleExtra = (itemId: string) => {
    setSelectedExtraIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const selectedBase = menu.base.find((b) => b.id === selectedBaseId) ?? null;
  const baseGridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedBaseId || !baseGridRef.current) return;
    const el = baseGridRef.current.querySelector(`[data-base-id="${selectedBaseId}"]`);
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [selectedBaseId]);

  const bowlSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedBase) {
      parts.push(baseChoiceLabel(selectedBase.name, selectedBase.description));
    }
    Object.entries(proteinQty).forEach(([id, qty]) => {
      if (qty <= 0) return;
      const item = menu.protein.find((p) => p.id === id);
      if (item) parts.push(`${qty}× ${item.name}`);
    });
    selectedExtraIds.forEach((id) => {
      const item = menu.extra.find((e) => e.id === id);
      if (item) parts.push(`+ ${item.name}`);
    });
    return parts.join(' · ');
  }, [selectedBase, proteinQty, selectedExtraIds, menu.protein, menu.extra]);

  const total =
    (selectedBase?.price ?? 0) +
    Object.entries(proteinQty).reduce((sum, [id, qty]) => {
      const item = menu.protein.find((p) => p.id === id);
      return sum + (item ? item.price * qty : 0);
    }, 0) +
    selectedExtraIds.reduce((sum, id) => {
      const item = menu.extra.find((e) => e.id === id);
      return sum + (item ? item.price : 0);
    }, 0);

  const handleAddCombo = (comboId: string) => {
    const item = menu.combo.find((c) => c.id === comboId);
    if (!item) return;
    onAddToCart([{ id: item.id, name: item.name, price: item.price, category: 'combo', quantity: 1, imageUrl: item.image_url }]);
  };

  const handleAdd = () => {
    if (!selectedBase) return;

    const items: OrderLineItem[] = [
      { id: selectedBase.id, name: selectedBase.name, price: selectedBase.price, category: 'base', quantity: 1, imageUrl: selectedBase.image_url },
    ];

    Object.entries(proteinQty).forEach(([id, qty]) => {
      const item = menu.protein.find((p) => p.id === id);
      if (item && qty > 0) {
        items.push({ id: item.id, name: item.name, price: item.price, category: 'protein', quantity: qty, imageUrl: item.image_url });
      }
    });

    selectedExtraIds.forEach((id) => {
      const item = menu.extra.find((e) => e.id === id);
      if (item) items.push({ id: item.id, name: item.name, price: item.price, category: 'extra', quantity: 1, imageUrl: item.image_url });
    });

    onAddToCart(items);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#fefaf4] flex items-center justify-center">
        <Loader2 size={32} className="text-[#7a1d1d] animate-spin" />
      </div>
    );
  }

  const menuIsEmpty = menu.base.length === 0 && menu.protein.length === 0 && menu.extra.length === 0 && menu.combo.length === 0;
  const hasBuilder = menu.base.length > 0 || menu.protein.length > 0 || menu.extra.length > 0;

  // Use the first combo/base image as the "hero" shot, like the pizza banner in the reference
  const heroImage = menu.combo[0]?.image_url ?? menu.base[0]?.image_url ?? null;

  return (
    <div className="min-h-[100dvh] bg-[#fefaf4] flex flex-col [webkit-tap-highlight-color:transparent]">

      {/* ── Hero header, standing in for the reference's big pizza banner ── */}
      <div className="relative h-56 shrink-0 bg-gray-200 overflow-hidden">
        {heroImage ? (
          <img src={heroImage} alt={selectedVendor?.business_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#7a1d1d]/10 flex items-center justify-center">
            <Flame className="w-10 h-10 text-[#7a1d1d]/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/40" />

        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center backdrop-blur-sm"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-white/80 text-xs font-bold uppercase tracking-wide mb-1">Now Building</p>
          <h1 className="text-white font-bold text-2xl leading-tight">{selectedVendor?.business_name ?? 'Your Order'}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-40 [-webkit-overflow-scrolling:touch]">
        <div className="max-w-2xl mx-auto p-4 space-y-8">

          {menuIsEmpty && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="font-bold">This vendor hasn't added their menu yet.</p>
              <p className="text-sm text-gray-400 mt-1">Check back soon.</p>
            </div>
          )}

          {/* ── Ready-made combos: image-top card, badge overlay, price/action row ── */}
          {menu.combo.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="font-bold text-xl mb-4">Ready to Order</h2>
              <div className="grid grid-cols-2 gap-3">
                {menu.combo.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="relative h-28 bg-gray-50">
                      <MenuItemThumbnail imageUrl={item.image_url} category="combo" size="full" />
                      <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-[#7a1d1d] shadow-sm">
                        15 Mins
                      </span>
                    </div>
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <div className="font-bold text-sm leading-tight">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 line-clamp-2">{item.description}</div>
                      )}
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <span className="text-[#7a1d1d] font-bold text-sm">
                          {item.pricing_type === 'variable' ? 'From ' : ''}GH₵{item.price}
                        </span>
                        <button
                          onClick={() => handleAddCombo(item.id)}
                          className="w-8 h-8 rounded-full bg-[#7a1d1d] text-white flex items-center justify-center hover:bg-[#6a1717] transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {menu.combo.length > 0 && hasBuilder && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Or Build Your Own</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          )}

          {menu.base.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="font-bold text-xl mb-1">Choose your base</h2>
              <p className="text-sm text-gray-500 mb-4">Pick dish and size — one option required.</p>
              <div ref={baseGridRef} className="grid grid-cols-2 gap-3">
                {menu.base.map((item) => {
                  const isSelected = selectedBaseId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-base-id={item.id}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedBaseId(item.id)}
                      className={`relative rounded-2xl bg-white shadow-sm overflow-hidden text-left transition-all ${
                        isSelected ? 'ring-2 ring-[#7a1d1d] shadow-md' : 'ring-1 ring-gray-100'
                      }`}
                    >
                      <div className="relative h-24 bg-gray-50">
                        <MenuItemThumbnail imageUrl={item.image_url} category="base" size="full" />
                        <div
                          className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-[#7a1d1d] text-white'
                              : 'bg-white/95 ring-2 ring-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="font-bold text-sm">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1 capitalize">{item.description}</div>
                        )}
                        <div className="text-[#7a1d1d] font-bold mt-1 text-sm">GH₵{item.price}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* ── Proteins: card row echoing the grid card's image + price/action layout ── */}
          {menu.protein.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h2 className="font-bold text-xl mb-1">Add proteins</h2>
              <p className="text-sm text-gray-500 mb-4">Optional — skip this section if you don&apos;t want any.</p>
              <div className="grid grid-cols-2 gap-3">
                {menu.protein.map((item) => {
                  const qty = proteinQty[item.id] || 0;
                  const isActive = qty > 0;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col transition-all ${
                        isActive ? 'ring-2 ring-[#7a1d1d]' : ''
                      }`}
                    >
                      <div className="relative h-20 bg-gray-50">
                        <MenuItemThumbnail imageUrl={item.image_url} category="protein" size="full" />
                        {isActive && (
                          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7a1d1d] text-white">
                            ×{qty}
                          </span>
                        )}
                      </div>
                      <div className="p-3 flex flex-col gap-1">
                        <div className="font-bold text-sm leading-tight">{item.name}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[#7a1d1d] font-bold text-sm">GH₵{item.price}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateProteinQty(item.id, -1)}
                              disabled={qty === 0}
                              className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-4 text-center font-bold text-sm">{qty}</span>
                            <button
                              onClick={() => updateProteinQty(item.id, 1)}
                              className="w-7 h-7 rounded-full bg-[#7a1d1d] text-white flex items-center justify-center hover:bg-[#6a1717]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* ── Extras: kept compact/checkbox since these are true add-ons, not focal items ── */}
          {menu.extra.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="font-bold text-xl mb-1">Extras</h2>
              <p className="text-sm text-gray-500 mb-4">Optional add-ons.</p>
              <div className="space-y-2">
                {menu.extra.map((item) => {
                  const isChecked = selectedExtraIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-2xl bg-white shadow-sm cursor-pointer transition-all ${
                        isChecked ? 'ring-2 ring-[#7a1d1d]' : 'ring-1 ring-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MenuItemThumbnail imageUrl={item.image_url} category="extra" size="sm" />
                        <div>
                          <div className="font-bold text-sm">{item.name}</div>
                          <div className="text-xs text-gray-500">+GH₵{item.price}</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleExtra(item.id)}
                        className="w-5 h-5 accent-[#7a1d1d]"
                      />
                    </label>
                  );
                })}
              </div>
            </motion.section>
          )}
        </div>
      </div>

      {hasBuilder && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-lg">
          <div className="max-w-2xl mx-auto">
            <div className="mb-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">Bowl total</span>
                <span className="text-2xl font-bold text-[#7a1d1d]">GH₵{total}</span>
              </div>
              {bowlSummary ? (
                <p className="text-xs text-gray-600 leading-relaxed">{bowlSummary}</p>
              ) : (
                <p className="text-xs text-gray-400">Choose a base to start.</p>
              )}
              <p className="text-[10px] text-gray-400">Delivery &amp; service fee added at checkout.</p>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedBase}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors ${
                selectedBase ? 'bg-[#7a1d1d] text-white hover:bg-[#6a1717]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}