'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import type { GeoPoint } from '../types/delivery.types';

interface CurrentLocationResult {
  location: GeoPoint | null;
  isLoading: boolean;
  error: string | null;
  requestLocation: () => Promise<GeoPoint | null>;
  clearLocation: () => void;
}

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return 'No se pudo acceder a tu ubicación porque rechazaste el permiso.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'No se pudo obtener tu ubicación actual.';
  if (error.code === error.TIMEOUT) return 'La búsqueda de ubicación tardó demasiado. Intentá de nuevo.';
  return 'No se pudo obtener la ubicación.';
}

export function useCurrentLocation(): CurrentLocationResult {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function requestLocation() {
    setError(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      const message = 'Tu navegador no permite obtener la ubicación actual.';
      setError(message);
      toast.error(message);
      return Promise.resolve(null);
    }

    setIsLoading(true);

    return new Promise<GeoPoint | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = {
            lat: Number(position.coords.latitude.toFixed(7)),
            lng: Number(position.coords.longitude.toFixed(7)),
          };
          setLocation(next);
          setIsLoading(false);
          toast.success('Ubicación adjuntada correctamente.');
          resolve(next);
        },
        (geoError) => {
          const message = getGeolocationErrorMessage(geoError);
          setError(message);
          setIsLoading(false);
          toast.error(message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        },
      );
    });
  }

  function clearLocation() {
    setLocation(null);
    setError(null);
  }

  return { location, isLoading, error, requestLocation, clearLocation };
}
