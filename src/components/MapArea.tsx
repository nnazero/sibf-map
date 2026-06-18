import React, { useState, useRef, useEffect } from 'react';
import boothsData from '../data/auto_booths.json';
import styles from './MapArea.module.css';

interface Booth {
  id: string;
  booth_number: string;
  gate: string;
  location: { x: number; y: number };
  size: { w: number; h: number };
  publisher_name: string;
  category: string;
}

interface MapAreaProps {
  selectedBooth: Booth | null;
  onBoothSelect: (booth: Booth | null) => void;
}

const MapArea: React.FC<MapAreaProps> = ({ selectedBooth, onBoothSelect }) => {
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  
  const [sheetHeight, setSheetHeight] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const dragStartTime = useRef(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');

  const handleListBoothSelect = (booth: Booth) => {
    onBoothSelect(booth);
    setSheetHeight(40);
  };

  useEffect(() => {
    if (selectedBooth && mapWrapperRef.current) {
      const wrapper = mapWrapperRef.current;
      const clientWidthHalf = wrapper.clientWidth / 2;
      const clientHeightHalf = wrapper.clientHeight / 2;

      const targetLeft = selectedBooth.location.x - clientWidthHalf;
      const targetTop = selectedBooth.location.y - clientHeightHalf;

      wrapper.scrollTo({
        left: Math.max(0, targetLeft),
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      });
    }
  }, [selectedBooth]);

  // 드래그 제스처 핸들러
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = sheetHeight;
    dragStartTime.current = Date.now();
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragStartY.current - clientY;
    const newHeight = Math.max(40, Math.min(window.innerHeight - 150, dragStartHeight.current + deltaY));
    setSheetHeight(newHeight);
  };

  const handleDragEnd = (e: MouseEvent | TouchEvent) => {
    setIsDragging(false);

    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;
    const totalDeltaY = dragStartY.current - clientY; 
    const deltaTime = Date.now() - dragStartTime.current;

    const maxHeight = window.innerHeight - 160;
    const minHeight = 40;

    const isFlick = deltaTime < 220 && Math.abs(totalDeltaY) > 30;
    if (isFlick) {
      if (totalDeltaY > 0) setSheetHeight(maxHeight);
      else setSheetHeight(minHeight);
      return;
    }

    const midPoint = (maxHeight + minHeight) / 2;
    if (sheetHeight >= midPoint) setSheetHeight(maxHeight);
    else setSheetHeight(minHeight);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, sheetHeight]);

  const filteredBooths = boothsData
    .filter(b => activeTab === 'A' ? b.gate === "A 출입구" : b.gate === "B1 출입구")
    .filter(b => {
      let cleanSearch = searchTerm.replace(/[\s_]/g, '').toUpperCase();
      const cleanBoothNumber = b.booth_number.replace(/[\s_]/g, '').toUpperCase();
      
      const isOnlyNumbers = /^\d+$/.test(cleanSearch);
      if (isOnlyNumbers) {
        cleanSearch = activeTab + cleanSearch;
      }

      const matchNumber = cleanBoothNumber.includes(cleanSearch);
      const matchName = b.publisher_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchName || matchNumber;
    });

  return (
    <div className={styles.mapComponentWrapper}>
      
      {/* 🗺️ 지도 영역 */}
      <div className={styles.mapWrapper} ref={mapWrapperRef}>
        <div className={styles.mapContainer}>
          <img src="/map.png" alt="SIBF Map" className={styles.mapImage} />
          
          {boothsData.map((booth) => {
            const isSelected = selectedBooth?.id === booth.id;
            const w = booth.size.w;
            const h = booth.size.h;
            const leftPosition = booth.location.x - w / 2;
            const topPosition = booth.location.y - h / 2;

            return (
              <div
                key={booth.id}
                className={`${styles.boothBlock} ${isSelected ? styles.activeBlock : ''}`}
                style={{
                  left: `${leftPosition}px`,
                  top: `${topPosition}px`,
                  width: `${w}px`,
                  height: `${h}px`,
                }}
                onClick={() => onBoothSelect(booth)}
              >
                {w > 35 && <span className={styles.blockLabel}>{booth.booth_number}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 🛑 스와이프 바텀 시트 */}
      <div className={styles.bottomSheet} style={{ height: `${sheetHeight}px` }}>
        <div 
          className={styles.sheetHandleWrapper} 
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className={styles.sheetHandle} />
        </div>

        <div className={styles.sheetContent}>
          <h3 className={styles.sheetTitle}>📜 출입구별 부스 검색</h3>
          <div className={styles.searchBarWrapper}>
            <input 
              type="text"
              className={styles.searchInput}
              placeholder="출판사명 또는 부스 번호 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className={styles.searchClearBtn} onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>

          <div className={styles.tabWrapper}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'A' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('A')}
            >
              A홀
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'B' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('B')}
            >
              B홀
            </button>
          </div>

          <div className={styles.boothList}>
            {filteredBooths.length > 0 ? (
              filteredBooths.map(b => (
                <div 
                  key={b.id} 
                  className={`${styles.boothCard} ${selectedBooth?.id === b.id ? styles.selectedCard : ''}`}
                  onClick={() => handleListBoothSelect(b)}
                >
                  <h4>{b.publisher_name || `${b.booth_number} 부스 구역`}</h4>
                  <p>위치: {b.gate} ({b.booth_number})</p>
                </div>
              ))
            ) : (
              <p className={styles.noResult}>검색 결과가 없습니다. 😥</p>
            )}
          </div>
        </div>
      </div>

      {/* 🎯 [요구사항] 부스 클릭 시 화면 중앙에 나타나는 모달 창 팝업 */}
      {selectedBooth && (
        <div className={styles.modalOverlay} onClick={() => onBoothSelect(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalBadge}>부스 정보</span>
              <button className={styles.modalCloseBtn} onClick={() => onBoothSelect(null)}>✕</button>
            </div>
            <h2 className={styles.modalTitle}>{selectedBooth.publisher_name || `${selectedBooth.booth_number} 구역`}</h2>
            <div className={styles.modalDivider} />
            <p className={styles.modalMeta}>📍 <strong>위치:</strong> {selectedBooth.gate} ({selectedBooth.booth_number})</p>
            {selectedBooth.category && (
              <p className={styles.modalMeta}>🏷️ <strong>분류:</strong> {selectedBooth.category}</p>
            )}
            <p className={styles.modalDesc}>서울국제도서전 해당 부스에서 다양한 이벤트와 신간 도서 전시가 진행 중입니다.</p>
          </div>
        </div>
      )}

    </div>
  );
};

export default MapArea;