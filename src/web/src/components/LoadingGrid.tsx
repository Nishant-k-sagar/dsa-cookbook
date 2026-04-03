import type { ReactNode } from 'react';
import './LoadingGrid.css';

interface LoadingGridProps {
  loading: boolean;
  error: string | null;
  itemCount?: number;
  skeleton: ReactNode;
  emptyMessage?: string;
  emptyHint?: string;
  children: ReactNode;
}

export function LoadingGrid({
  loading,
  error,
  itemCount = 6,
  skeleton,
  emptyHint,
  children,
}: LoadingGridProps) {
  if (loading) {
    return (
      <div className="loading-grid">
        {Array.from({ length: itemCount }).map((_, i) => (
          <div key={i}>{skeleton}</div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-grid-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      {children}
      {emptyHint && <p className="loading-grid-hint">{emptyHint}</p>}
    </>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="loading-grid-empty">
      <p>{message}</p>
      {hint && <p className="loading-grid-hint">{hint}</p>}
    </div>
  );
}