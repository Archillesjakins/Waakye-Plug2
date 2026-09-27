'use client';

import { useState, useEffect } from 'react';
import { getPlatformOrderingStatus, canPlaceOrders as canPlaceOrdersNow } from '@/app/utils/timeUtils';
import { vendorAcceptingOrders } from '@/app/lib/vendorHours';
import { Breakfast } from '@/app/types/orderTypes';
import { LandingScreen } from '@/app/components/screens/LandingScreen';
import { HomeScreen } from '@/app/components/screens/HomeScreen';
import { ItemDetailScreen } from '@/app/components/screens/ItemDetailScreen';
import { ClosedScreen } from '@/app/components/screens/ClosedScreen';
import { VendorClosedScreen } from '@/app/components/screens/VendorClosedScreen';
import { BuildWaakyeScreen } from '@/app/components/screens/BuildWaakyeScreen';
import { SBlinkspage } from '@/app/components/screens/SBlinkspage';
import { OrderSummaryScreen } from '@/app/components/screens/OrderSummaryScreen';
import { ConfirmationScreen } from '@/app/components/screens/ConfirmationScreen';
import { MyOrdersScreen } from '@/app/components/screens/MyOrdersScreen';
import { UsernameScreen } from '@/app/components/screens/UsernameScreen';
import { VendorSelectScreen } from '@/app/components/screens/VendorSelectScreen';
import { useUser } from '@/app/context/UserContext';
import { CartProvider, useCart } from '@/app/context/CartContext';
import { VendorProvider, useVendor } from '@/app/context/VendorContext';
import { FloatingCartButton } from '@/app/components/FloatingCartButton';
import { createOrder } from '@/app/lib/orders';
import type { MenuItem } from '@/app/lib/vendorMenu';
import { Toaster, toast } from 'sonner';

type Screen = 'landing' | 'home' | 'itemDetail' | 'build' | 'build2' | 'summary' | 'confirm' | 'myOrders';
type OrderType = 'waakye' | 'breakfast';

const ORDERING_SCREENS: Screen[] = ['landing', 'home', 'itemDetail', 'build', 'build2', 'summary'];

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
  const { hasUser, userId, ready } = useUser();
  const { addToCart, clearCart, lines, deliveryMode, customerLocation, deliveryLat, deliveryLng, paymentMethod, totalPrice } =
    useCart();
  const { selectedVendor, clearVendor } = useVendor();

  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [platformStatus, setPlatformStatus] = useState(getPlatformOrderingStatus());
  const [orderType, setOrderType] = useState<OrderType>('waakye');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [breakfastOrder, setBreakfastOrder] = useState<Breakfast>({
    drink: 'tea',
    extras: [],
    deliveryMode: 'delivery',
  });

  const vendorIsOpen = selectedVendor ? vendorAcceptingOrders(selectedVendor) : false;
  const canOrder = canPlaceOrdersNow(platformStatus.isOpen, vendorIsOpen);

  useEffect(() => {
    const tick = () => setPlatformStatus(getPlatformOrderingStatus());
    tick();
    const interval = setInterval(tick, 10_000);
    return () => clearInterval(interval);
  }, []);

  function handleSwitchVendor() {
    clearCart();
    clearVendor();
  }

  function guardOrderingAction(): boolean {
    if (!platformStatus.isOpen) {
      toast.error('Waakye Plug is closed for tonight — ordering opens at midnight.');
      return false;
    }
    if (!selectedVendor?.is_open) {
      toast.error(`${selectedVendor?.business_name ?? 'This vendor'} is closed (admin toggle).`);
      return false;
    }
    if (!vendorIsOpen) {
      toast.error(`${selectedVendor?.business_name ?? 'This vendor'} is outside their ordering hours.`);
      return false;
    }
    return true;
  }

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

  if (!hasUser) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <UsernameScreen />
      </>
    );
  }

  if (!selectedVendor) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <VendorSelectScreen onSelect={() => setCurrentScreen('landing')} />
      </>
    );
  }

  function handleWaakyeAddToCart(items: import('@/app/context/CartContext').OrderLineItem[]) {
    if (!selectedVendor || !guardOrderingAction()) return;
    addToCart(selectedVendor.id, items);
    setCurrentScreen('summary');
  }

  function handleItemAddToCart(items: import('@/app/context/CartContext').OrderLineItem[]) {
    if (!selectedVendor || !guardOrderingAction()) return;
    addToCart(selectedVendor.id, items);
    toast.success('Added to cart');
    setCurrentScreen('home');
  }

  async function handleOrderConfirmed() {
    if (!selectedVendor || !guardOrderingAction()) return;

    try {
      if (
        typeof deliveryLat !== 'number' ||
        typeof deliveryLng !== 'number' ||
        !Number.isFinite(deliveryLat) ||
        !Number.isFinite(deliveryLng)
      ) {
        toast.error('Set your dropoff pin on the map before confirming.');
        return;
      }

      const created = await createOrder({
        customerId: userId,
        vendorId: selectedVendor.id,
        lines,
        totalAmount: totalPrice,
        deliveryAddress: customerLocation,
        paymentMethod,
        deliveryLat,
        deliveryLng,
      });
      setLastOrderId(created.id);
    } catch (e) {
      console.error('Could not create order', e);
      toast.error('Could not place your order — please try again.');
      return;
    }

    setCurrentScreen('confirm');
  }

  function handleOrderDone() {
    clearCart();
    setCurrentScreen('myOrders');
  }

  const goMyOrders = () => setCurrentScreen('myOrders');

  const renderScreen = () => {
    const onOrderingFlow = ORDERING_SCREENS.includes(currentScreen);

    if (!platformStatus.isOpen && onOrderingFlow) {
      return <ClosedScreen timeUntilOpen={platformStatus.timeUntilOpen} onViewOrders={goMyOrders} />;
    }

    if (platformStatus.isOpen && !vendorIsOpen && onOrderingFlow) {
      return (
        <VendorClosedScreen onSwitchVendor={handleSwitchVendor} onViewOrders={goMyOrders} />
      );
    }

    switch (currentScreen) {
      case 'landing':
        return (
          <LandingScreen
            timeUntilClose={platformStatus.timeUntilClose}
            platformIsOpen={platformStatus.isOpen}
            vendorIsOpen={vendorIsOpen}
            onStart={() => {
              if (!guardOrderingAction()) return;
              setOrderType('waakye');
              setCurrentScreen('home');
            }}
            onBuild={() => toast('Breakfast ordering is coming soon!')}
            onSwitchVendor={handleSwitchVendor}
          />
        );
      case 'home':
        return (
          <HomeScreen
            onOpenItem={(item) => {
              if (!guardOrderingAction()) return;
              setSelectedItem(item);
              setCurrentScreen('itemDetail');
            }}
            onBuildOwn={() => {
              if (!guardOrderingAction()) return;
              setCurrentScreen('build');
            }}
            onSwitchVendor={handleSwitchVendor}
            onMyOrders={goMyOrders}
          />
        );

      case 'myOrders':
        return (
          <MyOrdersScreen
            onBack={() => setCurrentScreen('home')}
            onViewOrder={(id) => {
              setLastOrderId(id);
              setCurrentScreen('confirm');
            }}
            onOrderAgain={() => {
              if (!guardOrderingAction()) return;
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

      case 'build':
        return (
          <BuildWaakyeScreen
            onBack={() => setCurrentScreen('home')}
            onAddToCart={handleWaakyeAddToCart}
          />
        );

      case 'build2':
        return (
          <SBlinkspage
            order={breakfastOrder}
            onUpdateOrder={setBreakfastOrder}
            onBack={() => setCurrentScreen('landing')}
            onContinue={() => setCurrentScreen('landing')}
          />
        );

      case 'summary':
        return (
          <OrderSummaryScreen
            onBack={() => setCurrentScreen('home')}
            onConfirm={handleOrderConfirmed}
            canPlaceOrders={canOrder}
          />
        );

      case 'confirm':
        return (
          <ConfirmationScreen
            orderId={lastOrderId}
            onDone={handleOrderDone}
            onBack={() => setCurrentScreen('home')}
          />
        );

      default:
        return (
          <LandingScreen
            timeUntilClose={platformStatus.timeUntilClose}
            platformIsOpen={platformStatus.isOpen}
            vendorIsOpen={vendorIsOpen}
            onStart={() => setCurrentScreen('home')}
            onBuild={() => toast('Breakfast ordering is coming soon!')}
            onSwitchVendor={handleSwitchVendor}
          />
        );
    }
  };

  return (
    <div className="size-full">
      <Toaster position="top-center" richColors />
      {renderScreen()}
      {canOrder && ['landing', 'home', 'build', 'build2'].includes(currentScreen) && (
        <FloatingCartButton onClick={() => setCurrentScreen('summary')} />
      )}
    </div>
  );
}
