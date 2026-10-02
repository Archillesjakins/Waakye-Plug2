'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { ActiveOrderHandoffBar } from '@/app/components/ActiveOrderHandoffBar';
import {
  formatDeliveryCode,
  recallActiveOrderHandoff,
  recallDeliveryCode,
  rememberActiveOrderHandoff,
  rememberDeliveryCode,
  type ActiveOrderHandoff,
} from '@/app/lib/deliveryCode';
import { CustomerOrdersProvider, useCustomerOrders } from '@/app/context/CustomerOrdersContext';
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
  const {
    addToCart,
    clearCart,
    lines,
    deliveryMode,
    customerLocation,
    deliveryLat,
    deliveryLng,
    paymentMethod,
    totalPrice,
    quotedDeliveryFee,
    quotedDistanceKm,
    totalItems,
    pendingDeliveryFeeOwed,
    setPendingDeliveryFeeOwed,
  } = useCart();
  const { selectedVendor, clearVendor } = useVendor();

  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [platformStatus, setPlatformStatus] = useState(getPlatformOrderingStatus());
  const [orderType, setOrderType] = useState<OrderType>('waakye');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderDeliveryCode, setLastOrderDeliveryCode] = useState<string | null>(null);
  const [activeHandoff, setActiveHandoff] = useState<ActiveOrderHandoff | null>(() => recallActiveOrderHandoff());

  const refreshActiveHandoff = useCallback(() => setActiveHandoff(recallActiveOrderHandoff()), []);

  useEffect(() => {
    refreshActiveHandoff();
  }, [currentScreen, refreshActiveHandoff]);

  function openActiveOrderDetails() {
    const handoff = recallActiveOrderHandoff();
    if (!handoff) {
      refreshActiveHandoff();
      return;
    }
    setLastOrderId(handoff.orderId);
    setLastOrderDeliveryCode(handoff.deliveryCode);
    setCurrentScreen('confirm');
  }
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

  const goMyOrders = () => setCurrentScreen('myOrders');

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

  return (
    <CustomerOrdersProvider userId={userId} onHandoffChange={refreshActiveHandoff}>
      <Toaster position="top-center" richColors />
      {!selectedVendor ? (
        <VendorSelectScreen onSelect={() => setCurrentScreen('landing')} />
      ) : (
        <AppOrderingFlow
          activeHandoff={activeHandoff}
          refreshActiveHandoff={refreshActiveHandoff}
          openActiveOrderDetails={openActiveOrderDetails}
          currentScreen={currentScreen}
          setCurrentScreen={setCurrentScreen}
          platformStatus={platformStatus}
          vendorIsOpen={vendorIsOpen}
          canOrder={canOrder}
          guardOrderingAction={guardOrderingAction}
          handleSwitchVendor={handleSwitchVendor}
          goMyOrders={goMyOrders}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          breakfastOrder={breakfastOrder}
          setBreakfastOrder={setBreakfastOrder}
          setOrderType={setOrderType}
          lastOrderId={lastOrderId}
          lastOrderDeliveryCode={lastOrderDeliveryCode}
          setLastOrderId={setLastOrderId}
          setLastOrderDeliveryCode={setLastOrderDeliveryCode}
          totalItems={totalItems}
          userId={userId}
          selectedVendor={selectedVendor}
          lines={lines}
          totalPrice={totalPrice}
          deliveryLat={deliveryLat}
          deliveryLng={deliveryLng}
          customerLocation={customerLocation}
          paymentMethod={paymentMethod}
          quotedDeliveryFee={quotedDeliveryFee}
          quotedDistanceKm={quotedDistanceKm}
          clearCart={clearCart}
          pendingDeliveryFeeOwed={pendingDeliveryFeeOwed}
          setPendingDeliveryFeeOwed={setPendingDeliveryFeeOwed}
        />
      )}
    </CustomerOrdersProvider>
  );
}

type AppOrderingFlowProps = {
  activeHandoff: ActiveOrderHandoff | null;
  refreshActiveHandoff: () => void;
  openActiveOrderDetails: () => void;
  currentScreen: Screen;
  setCurrentScreen: (s: Screen) => void;
  platformStatus: ReturnType<typeof getPlatformOrderingStatus>;
  vendorIsOpen: boolean;
  canOrder: boolean;
  guardOrderingAction: () => boolean;
  handleSwitchVendor: () => void;
  goMyOrders: () => void;
  selectedItem: MenuItem | null;
  setSelectedItem: (i: MenuItem | null) => void;
  breakfastOrder: Breakfast;
  setBreakfastOrder: (b: Breakfast) => void;
  setOrderType: (t: OrderType) => void;
  lastOrderId: string | null;
  lastOrderDeliveryCode: string | null;
  setLastOrderId: (id: string | null) => void;
  setLastOrderDeliveryCode: (c: string | null) => void;
  totalItems: number;
  userId: string;
  selectedVendor: NonNullable<ReturnType<typeof useVendor>['selectedVendor']>;
  lines: import('@/app/context/CartContext').OrderLineItem[];
  totalPrice: number;
  deliveryLat: number | null;
  deliveryLng: number | null;
  customerLocation: string;
  paymentMethod: import('@/app/context/CartContext').PaymentMethod;
  quotedDeliveryFee: number;
  quotedDistanceKm: number | null;
  clearCart: () => void;
  pendingDeliveryFeeOwed: number;
  setPendingDeliveryFeeOwed: (amount: number) => void;
};

function AppOrderingFlow(props: AppOrderingFlowProps) {
  const {
    activeHandoff,
    refreshActiveHandoff,
    openActiveOrderDetails,
    currentScreen,
    setCurrentScreen,
    platformStatus,
    vendorIsOpen,
    canOrder,
    guardOrderingAction,
    handleSwitchVendor,
    goMyOrders,
    selectedItem,
    setSelectedItem,
    breakfastOrder,
    setBreakfastOrder,
    setOrderType,
    lastOrderId,
    lastOrderDeliveryCode,
    setLastOrderId,
    setLastOrderDeliveryCode,
    totalItems,
    userId,
    selectedVendor,
    lines,
    totalPrice,
    deliveryLat,
    deliveryLng,
    customerLocation,
    paymentMethod,
    quotedDeliveryFee,
    quotedDistanceKm,
    clearCart,
    pendingDeliveryFeeOwed,
    setPendingDeliveryFeeOwed,
  } = props;

  const { addToCart } = useCart();
  const { refresh: refreshOrders } = useCustomerOrders();

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
        quotedDeliveryFee,
        quotedDistanceKm,
      });
      const orderId = created?.id as string | undefined;
      if (!orderId) {
        toast.error('Order was created but id was missing — check My Orders.');
        setCurrentScreen('myOrders');
        return;
      }
      const code = formatDeliveryCode((created as { delivery_code?: string | null }).delivery_code) ?? null;
      setLastOrderId(orderId);
      setLastOrderDeliveryCode(code);
      if (code) {
        rememberDeliveryCode(orderId, code);
        rememberActiveOrderHandoff(orderId, code, 'available');
        refreshActiveHandoff();
      }
      
      // Clear pending delivery fee debt if customer had outstanding amount
      if (pendingDeliveryFeeOwed > 0) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          
          const response = await fetch(
            `${supabaseUrl}/functions/v1/clear-delivery-fee-debt`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ customer_id: userId }),
            }
          );
          
          if (!response.ok) {
            console.error('Failed to clear debt:', await response.text());
            // Non-critical: debt will be applied again next order if this fails
          } else {
            // Reset local state
            setPendingDeliveryFeeOwed(0);
          }
        } catch (debtError) {
          console.error('Error calling debt clearing function:', debtError);
          // Non-critical error, order was still created successfully
        }
      }
      
      void refreshOrders();
    } catch (e) {
      console.error('Could not create order', e);
      toast.error('Could not place your order — please try again.');
      return;
    }

    setCurrentScreen('confirm');
  }

  function handleOrderDone() {
    clearCart();
    refreshActiveHandoff();
    setCurrentScreen('myOrders');
  }

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
              const code = recallDeliveryCode(id);
              setLastOrderId(id);
              setLastOrderDeliveryCode(code);
              if (code) rememberActiveOrderHandoff(id, code);
              refreshActiveHandoff();
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
            initialDeliveryCode={lastOrderDeliveryCode}
            onDone={handleOrderDone}
            onBack={() => setCurrentScreen('home')}
            onHandoffChange={refreshActiveHandoff}
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
      {renderScreen()}
      {canOrder && ['landing', 'home', 'build', 'build2'].includes(currentScreen) && (
        <FloatingCartButton onClick={() => setCurrentScreen('summary')} />
      )}
      {activeHandoff && currentScreen !== 'confirm' && (
        <ActiveOrderHandoffBar
          handoff={activeHandoff}
          onOpenOrder={openActiveOrderDetails}
          cartVisible={canOrder && ['landing', 'home', 'build', 'build2'].includes(currentScreen) && totalItems > 0}
        />
      )}
    </div>
  );
}
