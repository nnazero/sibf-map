import { useRef, useCallback} from 'react';
import { MIN_ZOOM, MAX_ZOOM, clampOffset, viewToMap } from '../utils/zoom';

interface Offset { x: number; y: number; }

interface UseMapGestureProps {
  zoom: number;
  offset: Offset;
  sheetHeight: number;
  onZoomChange: (z: number) => void;
  onOffsetChange: (o: Offset) => void;
  onAnimatingChange: (a: boolean) => void;
  onGestureStart?: () => void;
  onMapMoveStart?: () => void;
}

export function useMapGesture({
  zoom, offset, sheetHeight,
  onZoomChange, onOffsetChange, onAnimatingChange,
  onGestureStart,
  onMapMoveStart,
}: UseMapGestureProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const panStartRef    = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchRef       = useRef<{ dist: number; zoom: number; ox: number; oy: number; cx: number; cy: number } | null>(null);
  const lastTapRef     = useRef<{ time: number; x: number; y: number } | null>(null);
  const mouseDownRef   = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const triggerAnim = useCallback((ms = 220) => {
    onAnimatingChange(true);
    clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => onAnimatingChange(false), ms);
  }, [onAnimatingChange]);

  const applyZoom = useCallback((newZoom: number, pivotVx: number, pivotVy: number, animate = false) => {
    const w = wrapperRef.current; if (!w) return;
    const vw = w.clientWidth, vh = w.clientHeight - sheetHeight;
    const mapPt = viewToMap(pivotVx, pivotVy, zoom, offset.x, offset.y);
    const newOx = pivotVx - mapPt.x * newZoom;
    const newOy = pivotVy - mapPt.y * newZoom;
    const clamped = clampOffset(newOx, newOy, newZoom, vw, vh);
    if (animate) triggerAnim();
    onZoomChange(newZoom);
    onOffsetChange(clamped);
  }, [zoom, offset, sheetHeight, onZoomChange, onOffsetChange, triggerAnim]);

  /** 버튼 줌: 화면 중앙 기준 */
  const zoomAt = useCallback((factor: number) => {
    const w = wrapperRef.current; if (!w) return;
    const vw = w.clientWidth, vh = w.clientHeight - sheetHeight;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    applyZoom(newZoom, vw / 2, vh / 2, true);
  }, [zoom, sheetHeight, applyZoom]);

  // ── 터치 ──────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    onGestureStart?.();
    if (e.touches.length === 1) {
      panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offset.x, oy: offset.y };
      pinchRef.current = null;

      // 더블탭
      const now = Date.now(), t = e.touches[0];
      if (lastTapRef.current && now - lastTapRef.current.time < 300
        && Math.hypot(t.clientX - lastTapRef.current.x, t.clientY - lastTapRef.current.y) < 30) {
        e.preventDefault();
        const w = wrapperRef.current; if (!w) return;
        const rect = w.getBoundingClientRect();
        const vx = t.clientX - rect.left, vy = t.clientY - rect.top;
        const newZoom = zoom >= MAX_ZOOM * 0.85 ? Math.max(MIN_ZOOM, zoom / 2) : Math.min(MAX_ZOOM, zoom * 2);
        applyZoom(newZoom, vx, vy, true);
        lastTapRef.current = null;
        panStartRef.current = null;
      } else {
        lastTapRef.current = { time: now, x: t.clientX, y: t.clientY };
      }
    } else if (e.touches.length === 2) {
      e.preventDefault();
      panStartRef.current = null;
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const cx = (t0.clientX + t1.clientX) / 2, cy = (t0.clientY + t1.clientY) / 2;
      const w = wrapperRef.current; if (!w) return;
      const rect = w.getBoundingClientRect();
      pinchRef.current = { dist, zoom, ox: offset.x, oy: offset.y, cx: cx - rect.left, cy: cy - rect.top };
    }
  }, [zoom, offset, applyZoom, onGestureStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const w = wrapperRef.current; if (!w) return;
    const vw = w.clientWidth, vh = w.clientHeight - sheetHeight;

    if (e.touches.length === 2 && pinchRef.current) {
      onMapMoveStart?.();

      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const scale = dist / pinchRef.current.dist;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.zoom * scale));
      const { cx, cy, ox, oy, zoom: pz } = pinchRef.current;
      const mapCx = (cx - ox) / pz, mapCy = (cy - oy) / pz;
      const newOx = cx - mapCx * newZoom, newOy = cy - mapCy * newZoom;
      const clamped = clampOffset(newOx, newOy, newZoom, vw, vh);
      onZoomChange(newZoom);
      onOffsetChange(clamped);
    } else if (e.touches.length === 1 && panStartRef.current) {
      const dx = e.touches[0].clientX - panStartRef.current.x;
      const dy = e.touches[0].clientY - panStartRef.current.y;

      if (Math.hypot(dx, dy) > 5) {
        onMapMoveStart?.();
      }

      const clamped = clampOffset(panStartRef.current.ox + dx, panStartRef.current.oy + dy, zoom, vw, vh);
      onOffsetChange(clamped);
    }
  }, [zoom, sheetHeight, onZoomChange, onOffsetChange, onMapMoveStart]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) panStartRef.current = null;
  }, []);

  // ── 마우스 (데스크탑) ─────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    onGestureStart?.();

    mouseDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y
    };
  }, [offset, onGestureStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseDownRef.current) return;
    const w = wrapperRef.current; if (!w) return;

    const vw = w.clientWidth, vh = w.clientHeight - sheetHeight;
    const dx = e.clientX - mouseDownRef.current.x;
    const dy = e.clientY - mouseDownRef.current.y;

    if (Math.hypot(dx, dy) > 5) {
      onMapMoveStart?.();
    }

    const clamped = clampOffset(mouseDownRef.current.ox + dx, mouseDownRef.current.oy + dy, zoom, vw, vh);
    onOffsetChange(clamped);
  }, [zoom, sheetHeight, onOffsetChange, onMapMoveStart]);

  const handleMouseUp = useCallback(() => { mouseDownRef.current = null; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    onMapMoveStart?.();

    const w = wrapperRef.current; if (!w) return;
    const rect = w.getBoundingClientRect();
    const vx = e.clientX - rect.left, vy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    applyZoom(newZoom, vx, vy, false);
    triggerAnim(120);
  }, [zoom, applyZoom, triggerAnim, onMapMoveStart]);

  return {
    wrapperRef,
    zoomAt,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp,
      onWheel: handleWheel,
    },
  };
}