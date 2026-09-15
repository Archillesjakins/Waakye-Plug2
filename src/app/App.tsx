'use client';

import { useState, useEffect } from 'react';
import { checkOrderingStatus } from '@/app/utils/timeUtils';
import { Breakfast } from '@/app/types/orderTypes';
import { LandingScreen } from '@/app/components/screens/LandingScreen';
import { HomeScreen } from '@/app/components/screens/HomeScreen';
import { ItemDetailScreen } from '@/app/components/screens/ItemDetailScreen';
import { ClosedScreen } from '@/app/components/screens/ClosedScreen';
import { BuildWaakyeScreen } from '@/app/components/screens/BuildWaakyeScreen';
import { SBlinkspage } from '@/app/components/screens/SBlinkspage';
import { OrderSummaryScreen } from '@/app/components/screens/OrderSummaryScreen';
import { ConfirmationScreen } from '@/app/components/screens/ConfirmationScreen';
import { MyOrdersScreen } from '@/app/components/screens/MyOrdersScreen';import { UsernameScreen } from '@/app/components/screens/UsernameScreen';
import { VendorSelectScreen } from '@/app/components/screens/VendorSelectScreen';
import { MyOrdersScreen } from '@/app/components/screens/MyOrdersScreen';
import { useUser } from '@/app/context/UserContext';
import { CartProvider, useCart } from '@/app/context/CartContext';
import { VendorProvider, useVendor } from '@/app/context/VendorContext';
import { FloatingCartButton } from '@/app/components/FloatingCartButton';
import { createOrder } from '@/app/lib/orders';
import type { MenuItem } from '@/app/lib/vendorMenu';
import { Toaster, toast } from 'sonner';

type Screen = 'landing' | 'home' | 'itemDetail' | 'closed' | 'build' | 'build2' | 'summary' | 'confirm' | 'myOrders';
type OrderType = 'waakye' | 'breakfast';

// CartProvider has to sit above everything that calls useCart(), so App itself
// is now just a thin wrapper and the real logic lives in AppContent.
export default function App() {
  return (
    <CartProvider>
      <VendorProvider>
        <AppContent />
      </VendorProvider>
    </CartProvider>
  );
}

function AppContent() {
  const { hasUser, userId, phone, username, ready } = useUser();
  const { addToCart, clearCart, itemsSubtotal, lines, deliveryMode, customerLocation, paymentMethod, totalPrice } = useCart();
  const { selectedVendor, clearVendor } = useVendor();

  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [orderingStatus, setOrderingStatus] = useState(checkOrderingStatus());
  const [orderType, setOrderType] = useState<OrderType>('waakye');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [breakfastOrder, setBreakfastOrder] = useState<Breakfast>({
    drink: 'tea',
    extras: [],
    deliveryMode: 'pickup',
  });

  // ── Time-based open/close polling ──────────────────────────────────────────
  useEffect(() => {
    const status = checkOrderingStatus();
    setOrderingStatus(status);
    if (!status.isOpen && currentScreen === 'landing') {
      setCurrentScreen('closed');
    }

    const interval = setInterval(() => {
      const newStatus = checkOrderingStatus();
      setOrderingStatus(newStatus);
      if (!newStatus.isOpen && ['landing', 'home', 'itemDetail', 'build', 'build2', 'summary'].includes(currentScreen)) {
        setCurrentScreen('closed');
      }
      if (newStatus.isOpen && currentScreen === 'closed') {
        setCurrentScreen('landing');
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [currentScreen]);

  // ── Wait for the anonymous session + profile lookup to resolve ─────────────
  if (!ready) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <div className="min-h-[100dvh] bg-[#fefaf4] flex items-center justify-center">
          <div className="text-4xl animate-pulse">🍚</div>
        </div>
      </>
    );
  }

  // ── Username gate — show before anything else ──────────────────────────────
  if (!hasUser) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <UsernameScreen />
      </>
    );
  }

  // ── Vendor gate — pick who you're ordering from before browsing a menu ─────
  if (!selectedVendor) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <VendorSelectScreen onSelect={() => setCurrentScreen('landing')} />
      </>
    );
  }

  // ── Waakye builder → cart. Breakfast temporarily disabled (see LandingScreen
  // wiring below) since SBlinkspage hasn't been converted to this model yet.
  function handleWaakyeAddToCart(items: import('@/app/context/CartContext').OrderLineItem[]) {
    if (!selectedVendor) return;
    addToCart(selectedVendor.id, items);
    setCurrentScreen('summary');
  }

  // ── Single item added from the browse/detail flow: add + drop back into
  // browsing rather than jumping straight to checkout, matching how the
  // Bolt-style reference lets you keep shopping after adding one thing.
  function handleItemAddToCart(items: import('@/app/context/CartContext').OrderLineItem[]) {
    if (!selectedVendor) return;
    addToCart(selectedVendor.id, items);
    toast.success(`Added to cart`);
    setCurrentScreen('home');
  }

  // ── Order confirmed: write the real order ───────────────────────────────
  async function handleOrderConfirmed() {
    if (!selectedVendor) return;

    try {
      const created = await createOrder({
        customerId: userId,
        vendorId: selectedVendor.id,
        lines,
        totalAmount: totalPrice,
        deliveryAddress: customerLocation,
        paymentMethod,
      });
      setLastOrderId(created.id);
    } catch (e) {
      console.error('Could not create order', e);
      toast.error('Could not place your order — please try again.');
      return; // stay on the summary screen, nothing was actually sent
    }

    setCurrentScreen('confirm');
  }

  function handleOrderDone() {
    clearCart();
    // Single order-history destination: MyOrdersScreen reads live Supabase
    // data with realtime status updates. The duplicate OrderHistoryScreen
    // (same table, no live updates) was removed — see AUDIT.md P2.
    setCurrentScreen('myOrders');
  }

  const handleTimerComplete = () => setCurrentScreen('closed');

  const renderScreen = () => {
    if (!orderingStatus.isOpen && !['closed', 'confirm', 'myOrders'].includes(currentScreen)){
      return <ClosedScreen timeUntilOpen={orderingStatus.timeUntilOpen} />;
    }

    switch (currentScreen) {
      case 'landing':
        return (
          <LandingScreen
            timeUntilClose={orderingStatus.timeUntilClose}
            onStart={() => { setOrderType('waakye'); setCurrentScreen('home'); }}
            onBuild={() => toast('Breakfast ordering is coming soon!')}
            onTimerComplete={handleTimerComplete}
            onSwitchVendor={clearVendor}
          />
        );
      case 'home':
        return (
          <HomeScreen
            onOpenItem={(item) => { setSelectedItem(item); setCurrentScreen('itemDetail'); }}
            onBuildOwn={() => setCurrentScreen('build')}
            onSwitchVendor={clearVendor}
            onMyOrders={() => setCurrentScreen('myOrders')}
          />
        );

      case 'myOrders':
        return (
          <MyOrdersScreen
            onBack={() => setCurrentScreen('home')}
            onOrderAgain={() => {
              // "Order again" opens a fresh builder — the builder fetches
              // fresh menu data rather than accepting a prefilled order.
              setOrderType('waakye');
              setCurrentScreen('build');
            }}
          />
        );

      case 'itemDetail':
        if (!selectedItem) {
          setCurrentScreen('home');
          return null;
        }
        return (
          <ItemDetailScreen
            item={selectedItem}
            onBack={() => setCurrentScreen('home')}
            onAddToCart={handleItemAddToCart}
          />
        );

      case 'closed':
        return <ClosedScreen timeUntilOpen={orderingStatus.timeUntilOpen} />;

      case 'build':
        return (
          <BuildWaakyeScreen
            onBack={() => setCurrentScreen('home')}
            onAddToCart={handleWaakyeAddToCart}
          />
        );

      case 'build2':
        // Dormant for now — breakfast hasn't been converted to the DB-driven
        // cart model yet, and this screen is unreachable from LandingScreen
        // until it is. Left in place rather than deleted so SBlinkspage isn't
        // silently broken if it's reached some other way.
        return (
          <SBlinkspage
            order={breakfastOrder}
            onUpdateOrder={setBreakfastOrder}
            onBack={() => setCurrentScreen('landing')}
            onContinue={() => setCurrentScreen('landing')}
          />
        );

      case 'summary':
        // No more order/orderType/onUpdateOrder props — OrderSummaryScreen
        // reads everything straight from useCart().
        return (
          <OrderSummaryScreen
            onBack={() => setCurrentScreen('home')}
            onConfirm={handleOrderConfirmed}
          />
        );

      case 'confirm':
        return (
          <ConfirmationScreen
            orderId={lastOrderId}
            onDone={handleOrderDone}
          />
        );

      default:
        return (
          <LandingScreen
            timeUntilClose={orderingStatus.timeUntilClose}
            onStart={() => setCurrentScreen('build')}
            onTimerComplete={handleTimerComplete}
          />
        );
    }
  };

  return (
    <div className="size-full">
      <Toaster position="top-center" richColors />
      {renderScreen()}
      {['landing', 'home', 'build', 'build2'].includes(currentScreen) && (
        <FloatingCartButton onClick={() => setCurrentScreen('summary')} />
      )}
    </div>
  );
}