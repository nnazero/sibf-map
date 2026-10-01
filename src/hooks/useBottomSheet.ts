import { useState, useRef, useCallback, useEffect } from 'react';

export const SHEET_MIN = 108;

export function useBottomSheet() {
  const [sheetHeight, setSheetHeight] = useState(SHEET_MIN);
  const [isDragging, setIsDragging]   = useState(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const dragStartT = useRef(0);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y;
    dragStartH.current = sheetHeight;
    dragStartT.current = Date.now();
  }, [sheetHeight]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const DRAG_SENSITIVITY = 1.25;
    const maxH = window.innerHeight - 150;
    const nextHeight = dragStartH.current + (dragStartY.current - y) * DRAG_SENSITIVITY;

    setSheetHeight(Math.max(SHEET_MIN, Math.min(maxH, nextHeight)));
  }, [isDragging]);

  const handleDragEnd = useCallback((e: MouseEvent | TouchEvent) => {
    setIsDragging(false);
    const y = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;
    const dy = dragStartY.current - y, dt = Date.now() - dragStartT.current;
    const maxH = window.innerHeight - 160;
    if (dt < 220 && Math.abs(dy) > 30) { setSheetHeight(dy > 0 ? maxH : SHEET_MIN); return; }
    setSheetHeight(sheetHeight >= (maxH + SHEET_MIN) / 2 ? maxH : SHEET_MIN);
  }, [isDragging, sheetHeight]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup',   handleDragEnd);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('touchend',  handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup',   handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend',  handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  return { sheetHeight, setSheetHeight, handleDragStart };
}