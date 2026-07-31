import type { CartItem, CartTotals } from '../types/carrito.types';
import { readLocalStorage, writeLocalStorage } from '@/shared/utils/storage.utils';
import { createId } from '@/shared/utils/id.utils';

const CART_KEY = 'central_cart';
const FALLBACK_PRODUCT_IMAGE = '/images/productos/burger-simple.svg';

function sanitizeCartItem(item: CartItem): CartItem {
  return {
    ...item,
    imageUrl: item.imageUrl?.startsWith('data:') ? FALLBACK_PRODUCT_IMAGE : item.imageUrl,
  };
}

export function getCart(): CartItem[] {
  return readLocalStorage<CartItem[]>(CART_KEY, []).map(sanitizeCartItem);
}

export function saveCart(items: CartItem[]) {
  writeLocalStorage(CART_KEY, items.map(sanitizeCartItem));
}

export function addToCart(item: Omit<CartItem, 'id'>): CartItem[] {
  const safeItem = sanitizeCartItem({ ...item, id: 'preview' });
  const cart = getCart();
  const sameItem = cart.find((cartItem) => cartItem.productId === safeItem.productId && (cartItem.note ?? '') === (safeItem.note ?? ''));
  const next = sameItem
    ? cart.map((cartItem) => cartItem.id === sameItem.id ? { ...cartItem, quantity: cartItem.quantity + safeItem.quantity } : cartItem)
    : [{ ...safeItem, id: createId('cart') }, ...cart];
  saveCart(next);
  return next;
}

export function updateCartItemQuantity(id: string, quantity: number): CartItem[] {
  const next = getCart().map((item) => item.id === id ? { ...item, quantity: Math.max(quantity, 1) } : item);
  saveCart(next);
  return next;
}

export function updateCartItemNote(id: string, note: string): CartItem[] {
  const normalizedNote = note.trim() || undefined;
  const cart = getCart();
  const current = cart.find((item) => item.id === id);

  if (!current) return cart;

  const duplicate = cart.find((item) =>
    item.id !== id
    && item.productId === current.productId
    && (item.note ?? '') === (normalizedNote ?? ''),
  );

  const next = duplicate
    ? cart
        .filter((item) => item.id !== id)
        .map((item) => item.id === duplicate.id ? { ...item, quantity: item.quantity + current.quantity } : item)
    : cart.map((item) => item.id === id ? { ...item, note: normalizedNote } : item);

  saveCart(next);
  return next;
}

export function removeFromCart(id: string): CartItem[] {
  const next = getCart().filter((item) => item.id !== id);
  saveCart(next);
  return next;
}

export function clearCart(): CartItem[] {
  saveCart([]);
  return [];
}

export function calculateCartTotals(items: CartItem[], deliveryCost = 0): CartTotals {
  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  return { subtotal, deliveryCost, total: subtotal + deliveryCost };
}
