'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

interface DataLoadErrorProps {
  message: string;
  onRetry?: () => void | Promise<void>;
}

export function DataLoadError({ message, onRetry }: DataLoadErrorProps) {
  return (
    <div className="rounded-sm border border-red-200 bg-red-50 p-5 text-red-800">
      <p className="text-sm font-bold">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => void onRetry()}
        >
          <RefreshCw size={15} /> Reintentar
        </Button>
      ) : null}
    </div>
  );
}
