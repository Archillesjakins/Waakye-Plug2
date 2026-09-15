// Order types and configuration

export type BowlSize = 'small' | 'medium' | 'large';
export type Sbreakfast = 'tea' | 'lipton' | 'coffee';

export interface Protein {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface Extra {
  id: string;
  name: string;
  price: number;
  available: boolean;
}
export interface Sbextra {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface OrderItem {
  size: BowlSize;
  proteins: { [key: string]: number }; // protein id -> quantity
  extras: string[]; // extra ids
  deliveryMode: 'delivery';
  customerPhone?: string;
  customerLocation?: string;
}
export interface Breakfast {
  drink: Sbreakfast;
  proteins?: { [key: string]: number };
  size?: string;
  extras: string[];
  deliveryMode: 'delivery';
}

export const BOWL_SIZES = {
  small: {
    name: 'Small',
    price: 10,
    description: 'Perfect for a light breakfast',
  },
  medium: {
    name: 'Medium',
    price: 14,
    description: 'Most popular choice',
  },
  large: {
    name: 'Large',
    price: 18,
    description: 'Extra hungry this morning?',
  },
} as const;

export const S_Breakfast={
  tea:{
    name: 'Small',
    price: 12,
    description: 'Your morning choice',
  },
  lipton:{
    name:'Medium',
    price: 16,
    description:'A little boost for the body',
  },
  coffee:{
    name: 'Large',
    price:20,
    description:'An ultimate boost'
  }
} as const;

export const PROTEINS: Protein[] = [
  { id: 'egg', name: 'Egg', price: 3, available: true },
  { id: 'chicken', name: 'Chicken', price: 10, available: true },
  { id: 'sausage', name: 'Sausage', price: 4, available: true },
  { id: 'fish', name: 'Fish', price: 10, available: true }, // Example sold out
];
export const BREAKFAST_EXTRAS: Sbextra[] = [
  { id: 'eggs', name: 'Eggs', price: 3, available: true },
  // { id: 'breadandeggs', name: 'Bread and eggs', price: 9, available: true },
  { id: 'sausage', name: 'Sausage', price: 4, available: true },
  { id: 'chicken', name: 'Chicken', price:10 , available: true },
  { id: 'fish', name: 'Fish', price:10 , available: true },
  { id: 'mixedSalad', name: 'Mixed Salad', price:10 , available: true },
  { id: 'Salad', name: 'Salad', price:4 , available: true },
];
export const EXTRAS: Extra[] = [
  { id: 'gari', name: 'Gari', price: 2, available: true },
  { id: 'salad', name: 'Salad', price: 2, available: true },
  { id: 'mixedsalad', name: 'Mixed-Salad', price: 8, available: true },
  { id: 'plantain', name: 'Plantain', price: 4, available: true },
  { id: 'spaghetti', name: 'Spaghetti', price: 3, available: true },
  { id: 'wele', name: 'Wele', price: 6, available: true },
  { id: 'drink', name: 'Ice-Kenkey', price: 10, available: true },
];

export const DELIVERY_FEE = 8;
export const SERVICE_FEE = 1;

export function calculateBreakfastTotal(order: Breakfast): number {
  let total = S_Breakfast[order.drink].price;

  order.extras.forEach(extraId => {
    const extra = BREAKFAST_EXTRAS.find(e => e.id === extraId);
    if (extra) {
      total += extra.price;
    }
  });

  total += SERVICE_FEE;

  if (order.deliveryMode === 'delivery') {
    total += DELIVERY_FEE;
  }

  return total;
}
export function formatBreakfastMessage(order: Breakfast): string {
  let message = `🍳 *BREAKFAST ORDER*\n\n`;

  message += `  🍚 Jollof: ${S_Breakfast[order.drink].name}`;

  const extrasList: string[] = [];
  order.extras.forEach(extraId => {
    const extra = BREAKFAST_EXTRAS.find(e => e.id === extraId);
    if (extra) {
      extrasList.push(extra.name);
    }
  });

  if (extrasList.length > 0) {
    message += `\nExtras: ${extrasList.join(', ')}`;
  }

  message += `\n\n🚚 ${order.deliveryMode === 'delivery' ? 'Delivery' : 'Pickup'}`;

  if (order.customerPhone) {
    message += `\n📞 Phone: ${order.customerPhone}`;
  }

  if (order.deliveryMode === 'delivery' && order.customerLocation) {
    message += `\n📍 Location: ${order.customerLocation}`;
  }

  const total = calculateBreakfastTotal(order);
  message += `\n\n💰 *Total: GH₵${total}*`;

  message += `\n\n⚡ Sent from Waakye Plug`;

  return message;
}

export function calculateOrderTotal(order: OrderItem): number {
  let total = BOWL_SIZES[order.size].price;

  // Add proteins
  Object.entries(order.proteins).forEach(([proteinId, quantity]) => {
    const protein = PROTEINS.find(p => p.id === proteinId);
    if (protein) {
      total += protein.price * quantity;
    }
  });
  // Add extras
  order.extras.forEach(extraId => {
    const extra = EXTRAS.find(e => e.id === extraId);
    if (extra) {
      total += extra.price;
    }
  });
 total += SERVICE_FEE;

  // Add delivery fee if applicable
  if (order.deliveryMode === 'delivery') {
    total += DELIVERY_FEE;
  }

  return total;
}
export function formatOrderMessage(order: OrderItem): string {
  let message = `🍚 *WAAKYE PLUG ORDER*\n\n`;

  message += `📦 Order\n`;
  message += `${BOWL_SIZES[order.size].name} Waakye`;

  // Add proteins
  const proteinList: string[] = [];
  Object.entries(order.proteins).forEach(([proteinId, quantity]) => {
    const protein = PROTEINS.find(p => p.id === proteinId);
    if (protein && quantity > 0) {
      proteinList.push(quantity > 1 ? `${quantity}x ${protein.name}` : protein.name);
    }
  });

  if (proteinList.length > 0) {
    message += ` + ${proteinList.join(' + ')}`;
  }

  // Add extras
  const extrasList: string[] = [];
  order.extras.forEach(extraId => {
    const extra = EXTRAS.find(e => e.id === extraId);
    if (extra) {
      extrasList.push(extra.name);
    }
  });

  if (extrasList.length > 0) {
    message += `\nExtras: ${extrasList.join(', ')}`;
  }

  message += `\n\n🚚 ${order.deliveryMode === 'delivery' ? 'Delivery' : 'Pickup'}`;

  // Phone
  if (order.customerPhone) {
    message += `\n📞 Phone: ${order.customerPhone}`;
  }

  // Location
  if (order.deliveryMode === 'delivery' && order.customerLocation) {
    message += `\n📍 Location: ${order.customerLocation}`;
  }

  // Total price
  const total = calculateOrderTotal(order);
  message += `\n\n💰 *Total: GH₵${total}*`;

  message += `\n\n⚡ Sent from Waakye Plug`;

  return message;
}
