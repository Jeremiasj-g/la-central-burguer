'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { CartItem } from '../types/carrito.types';
import { getOrderableProductIds, subscribeToProducts } from '@/features/productos/services/productos.service';
import { addToCart, calculateCartTotals, clearCart, getCart, removeFromCart, saveCart, updateCartItemNote, updateCartItemQuantity } from '../services/carrito.service';

export function useCarrito(deliveryCost = 0) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    let mounted = true;
    setItems(getCart());

    async function reconcileAvailability() {
      const cart = getCart();
      if (!cart.length) return;

      const productIds = [...new Set(cart.map((item) => item.productId))];
      try {
        const orderableIds = await getOrderableProductIds(productIds);
        if (!mounted) return;

        // No eliminar artículos agregados mientras se verificaba una lista anterior.
        const invalidIds = new Set(productIds.filter((id) => !orderableIds.has(id)));
        const current = getCart();
        const validItems = current.filter((item) => !invalidIds.has(item.productId));
        if (validItems.length !== current.length) {
          saveCart(validItems);
          setItems(validItems);
          toast.info('Se quitaron del carrito productos que ya no están disponibles.');
        }
      } catch (error) {
        // Ante un problema de red conservamos el carrito; el servidor verifica al confirmar.
        console.warn('No se pudo revisar la disponibilidad del carrito.', error);
      }
    }

    function sync() {
      setItems(getCart());
      void reconcileAvailability();
    }

    void reconcileAvailability();
    const unsubscribeProducts = subscribeToProducts(() => void reconcileAvailability());
    window.addEventListener('storage', sync);
    window.addEventListener('central-storage-change', sync as EventListener);

    return () => {
      mounted = false;
      unsubscribeProducts();
      window.removeEventListener('storage', sync);
      window.removeEventListener('central-storage-change', sync as EventListener);
    };
  }, []);

  const totals = useMemo(() => calculateCartTotals(items, deliveryCost), [items, deliveryCost]);

  return {
    items,
    totals,
    addItem: (item: Omit<CartItem, 'id'>) => {
      const next = addToCart(item);
      setItems(next);
      toast.success(`${item.productName} agregado al pedido.`);
    },
    updateQuantity: (id: string, quantity: number) => {
      const next = updateCartItemQuantity(id, quantity);
      setItems(next);
    },
    updateNote: (id: string, note: string) => {
      const next = updateCartItemNote(id, note);
      setItems(next);
      toast.success(note.trim() ? 'Aclaración actualizada.' : 'Aclaración eliminada.');
    },
    removeItem: (id: string) => {
      const current = items.find((item) => item.id === id);
      const next = removeFromCart(id);
      setItems(next);
      if (current) toast.info(`${current.productName} quitado del pedido.`);
    },
    clear: () => {
      setItems(clearCart());
      toast.info('Pedido vaciado.');
    },
  };
}
