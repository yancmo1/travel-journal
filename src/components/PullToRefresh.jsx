import React, { useEffect, useRef, useState } from 'react';
import { useData } from '../context/DataContext';

const TRIGGER_DISTANCE = 82;

export default function PullToRefresh() {
  const { offline, refreshing, refreshAll } = useData();
  const startY = useRef(null);
  const tracking = useRef(false);
  const distanceRef = useRef(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    function canStart(target) {
      if (window.scrollY > 0 || refreshing || offline) return false;
      if (!(target instanceof Element)) return true;
      return !target.closest('.leaflet-container, input, textarea, select, button, [data-no-pull-refresh]');
    }

    function handleStart(event) {
      if (!canStart(event.target)) return;
      startY.current = event.touches[0]?.clientY ?? null;
      tracking.current = startY.current !== null;
    }

    function handleMove(event) {
      if (!tracking.current || startY.current === null) return;
      const currentY = event.touches[0]?.clientY ?? startY.current;
      const nextDistance = Math.max(0, Math.min(currentY - startY.current, 116));
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
    }

    async function handleEnd() {
      const shouldRefresh = tracking.current && distanceRef.current >= TRIGGER_DISTANCE;
      tracking.current = false;
      startY.current = null;
      distanceRef.current = 0;
      setDistance(0);
      if (shouldRefresh) await refreshAll();
    }

    window.addEventListener('touchstart', handleStart, { passive: true });
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd, { passive: true });
    window.addEventListener('touchcancel', handleEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleStart);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [offline, refreshing, refreshAll]);

  if (!distance && !refreshing) return null;

  const ready = distance >= TRIGGER_DISTANCE;
  return (
    <div
      className={`pull-refresh-indicator ${ready || refreshing ? 'is-ready' : ''}`}
      style={{ transform: `translate(-50%, ${Math.min(distance, TRIGGER_DISTANCE) - 44}px)` }}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">{refreshing ? '↻' : ready ? '↓' : '⌄'}</span>
      {refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}
    </div>
  );
}
