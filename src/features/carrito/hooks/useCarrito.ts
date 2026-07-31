'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { CartItem } from '../types/carrito.types';
import { addToCart, calculateCartTotals, clearCart, getCart, removeFromCart, updateCartItemNote, updateCartItemQuantity } from '../services/carrito.service';

export function useCarrito(deliveryCost = 0) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart());

    function sync() {
      setItems(getCart());
    }

    window.addEventListener('storage', sync);
    window.addEventListener('central-storage-change', sync as EventListener);

    return () => {
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
