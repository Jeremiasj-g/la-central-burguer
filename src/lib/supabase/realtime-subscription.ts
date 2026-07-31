import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './client';

type RealtimeListener = () => void;
type ConfigureRealtimeChannel = (
  channel: RealtimeChannel,
  notifyListeners: RealtimeListener,
) => RealtimeChannel;

/**
 * Creates one shared Supabase Realtime channel per feature module.
 *
 * React development mode can mount, clean up, and mount effects again in quick
 * succession. Several components can also consume the same hook at once. This
 * helper keeps a single channel alive, registers every local listener in a Set,
 * and only removes the channel when the last listener leaves.
 */
export function createSharedRealtimeSubscription(
  scope: string,
  configureChannel: ConfigureRealtimeChannel,
) {
  const listeners = new Set<RealtimeListener>();
  let channel: RealtimeChannel | null = null;
  let supabase: ReturnType<typeof getSupabaseBrowserClient> | null = null;
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  let channelSequence = 0;

  function notifyListeners() {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error(`[Realtime:${scope}] listener error`, error);
      }
    });
  }

  function createChannelName() {
    channelSequence += 1;
    const uniqueId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${channelSequence}`;

    return `${scope}:${uniqueId}`;
  }

  function ensureChannel() {
    if (channel) return;

    supabase = getSupabaseBrowserClient();
    const configuredChannel = configureChannel(
      supabase.channel(createChannelName()),
      notifyListeners,
    );

    channel = configuredChannel.subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[Realtime:${scope}] ${status}`, error);
      }
    });
  }

  return function subscribe(listener: RealtimeListener) {
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }

    listeners.add(listener);
    ensureChannel();

    return () => {
      listeners.delete(listener);

      if (listeners.size > 0 || !channel || !supabase) return;

      // Deferring cleanup avoids a remove/create race caused by React StrictMode.
      cleanupTimer = setTimeout(() => {
        cleanupTimer = null;
        if (listeners.size > 0 || !channel || !supabase) return;

        const channelToRemove = channel;
        const client = supabase;
        channel = null;
        supabase = null;
        void client.removeChannel(channelToRemove);
      }, 0);
    };
  };
}
