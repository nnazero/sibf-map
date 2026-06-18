import React, { useEffect, useRef } from 'react';
import QuickPinchZoom from 'react-quick-pinch-zoom';
import styles from './MapArea.module.css';

const makeTransformStr = ({ x, y, scale }: { x: number; y: number; scale: number }) => {
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
};

interface Booth {
  id: string;
  name: string;
  gate: string;
  category: string;
  location: { x: number; y: number };
  description: string;
}

interface MapAreaProps {
  selectedBooth: Booth | null;
}

export default function MapArea({ selectedBooth }: MapAreaProps) {
  const pzRef = useRef<QuickPinchZoom>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 대용량 배치도 이미지 대신 임시로 쓸 격자무늬 지도 베이스라인 (나중에 public/map.png로 대체 가능)
  const mapImgUrl = 'https://placehold.co/1200x1200/cccccc/999999?text=SIBF+MAP+BASE';

  // 1, 3번 요구사항: 리스트에서 부스 클릭 시 해당 좌표로 지도 초점 이동 및 확대
  useEffect(() => {
    if (selectedBooth && pzRef.current && containerRef.current) {
      const { x, y } = selectedBooth.location;
      
      // 컨테이너 절반 크기를 계산하여 클릭한 좌표가 화면 정중앙에 오도록 보정
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      pzRef.current.alignCenter({
        x,
        y,
        scale: 2, // 클릭 시 2배 확대되면서 포커싱
        duration: 400, // 0.4초 동안 부드럽게 이동
      });
    }
  }, [selectedBooth]);

  // Pinch Zoom 라이브러리가 연산한 움직임을 실제 DOM 레이어에 입혀주는 함수
  const onUpdate = ({ x, y, scale }: { x: number; y: number; scale: number }) => {
    const el = containerRef.current;
    if (el) {
      el.style.transform = makeTransformStr({ x, y, scale });
    }
  };

  return (
    <div className={styles.mapContainer}>
      <QuickPinchZoom ref={pzRef} onUpdate={onUpdate} wheelScaleFactor={1.1}>
        <div ref={containerRef} className={styles.mapWrapper}>
          {/* 도서전 배치도 이미지 배경 */}
          <img 
            src={mapImgUrl} 
            alt="도서전 배치도" 
            className={styles.mapImage} 
          />

          {/* 선택된 부스가 있을 때 해당 좌표에 핀 꼽기 */}
          {selectedBooth && (
            <div 
              className={styles.pin} 
              style={{ 
                left: `${selectedBooth.location.x}px`, 
                top: `${selectedBooth.location.y}px` 
              }} 
            />
          )}
        </div>
      </QuickPinchZoom>
    </div>
  );
}