'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import type { GeoPoint } from '../types/delivery.types';

interface CurrentLocationResult {
  location: GeoPoint | null;
  isLoading: boolean;
  isRetrying: boolean;
  error: string | null;
  requestLocation: () => Promise<GeoPoint | null>;
  clearLocation: () => void;
}

// No tomar una ubicación aproximada por IP como si fuera el domicilio exacto.
const MAX_LOCATION_ACCURACY_METERS = 1000;

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return 'No se pudo acceder a tu ubicación. Revisá los permisos del navegador y la ubicación del dispositivo.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'No pudimos determinar tu ubicación. Activá la ubicación del dispositivo o probá desde un celular.';
  }
  if (error.code === error.TIMEOUT) {
    return 'El navegador no logró obtener tu ubicación. Activá la ubicación de Windows o del celular e intentá nuevamente.';
  }
  return 'No se pudo obtener la ubicación. Revisá los permisos de tu dispositivo.';
}

export function useCurrentLocation(): CurrentLocationResult {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function requestLocation(): Promise<GeoPoint | null> {
    setError(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      const message = 'Tu navegador no permite obtener la ubicación actual.';
      setError(message);
      toast.error(message);
      return Promise.resolve(null);
    }

    setIsLoading(true);
    setIsRetrying(false);

    return new Promise<GeoPoint | null>((resolve) => {
      function finish(next: GeoPoint | null, message?: string) {
        setIsLoading(false);
        setIsRetrying(false);
        if (message) {
          setLocation(null);
          setError(message);
          toast.error(message);
        } else if (next) {
          setLocation(next);
        }
        resolve(next);
      }

      function onSuccess(position: GeolocationPosition) {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(latitude)
          || !Number.isFinite(longitude)
          || (Number.isFinite(accuracy) && accuracy > MAX_LOCATION_ACCURACY_METERS)
        ) {
          finish(null, 'La ubicación obtenida es demasiado imprecisa para un delivery. Activá la ubicación precisa o probá desde un celular.');
          return;
        }

        finish({
          lat: Number(latitude.toFixed(7)),
          lng: Number(longitude.toFixed(7)),
        });
      }

      function onFirstError(geoError: GeolocationPositionError) {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          finish(null, getGeolocationErrorMessage(geoError));
          return;
        }

        // En computadoras sin GPS de alta precisión, intentar nuevamente
        // mediante ubicación de red / Wi-Fi, sin perder el permiso otorgado.
        setIsRetrying(true);
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (retryError) => finish(null, getGeolocationErrorMessage(retryError)),
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 },
        );
      }

      navigator.geolocation.getCurrentPosition(
        onSuccess,
        onFirstError,
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 },
      );
    });
  }

  function clearLocation() {
    setLocation(null);
    setError(null);
    setIsRetrying(false);
  }

  return { location, isLoading, isRetrying, error, requestLocation, clearLocation };
}
