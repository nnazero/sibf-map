import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import boothsData from './data/auto_booths.json';

import { Booth, RouteSegment, computeSegment, computeChained, solveTSP, hallKey } from './utils/pathfinding';
import { FACILITIES, facilityToBooth }   from './utils/facilities';
import { MIN_ZOOM, clampOffset, mapToView } from './utils/zoom';
import { useMapGesture }   from './hooks/useMapGesture';
import { useBottomSheet, SHEET_MIN } from './hooks/useBottomSheet';
import { useFavorites }    from './hooks/useFavorites';

import MapCanvas   from './components/MapCanvas';
import BoothModal  from './components/BoothModal';
import MiniTooltip from './components/MiniTooltip';
import NavPanel    from './components/NavPanel';
import RoutePanel  from './components/RoutePanel';
import BoothList   from './components/BoothList';

import GateSelector, { GateId, GATES, GATE_KEY } from './components/Gateselector';
import styles from './MapArea.module.css';

type Mode    = 'search' | 'navigate' | 'multiroute';
type TabType = 'A' | 'B' | 'FAC' | 'FAV';
type RouteSlot = 'start' | 'end' | null;

interface MapAreaProps { selectedBooth: Booth | null; onBoothSelect: (b: Booth | null) => void; }

const MapArea: React.FC<MapAreaProps> = ({ selectedBooth, onBoothSelect }) => {
  // ── 줌/오프셋 ─────────────────────────────────────────────
  const [zoom,      setZoom]      = useState(0.45);
  const [offset,    setOffset]    = useState({ x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);
  const closeFloatingUi = useCallback(() => {
    setModalOpen(false);
    setModalBooth(null);
    setMiniTooltip(null);
  }, []);

  // ── 바텀시트 ──────────────────────────────────────────────
  const { sheetHeight, setSheetHeight, handleDragStart } = useBottomSheet();

  // ── 즐겨찾기 ──────────────────────────────────────────────
  const { favorites, toggleFav } = useFavorites();

  // ── 제스처 훅 ─────────────────────────────────────────────
  const { wrapperRef, zoomAt, handlers } = useMapGesture({
    zoom,
    offset,
    sheetHeight,
    onZoomChange: setZoom,
    onOffsetChange: setOffset,
    onAnimatingChange: setAnimating,
    onMapMoveStart: closeFloatingUi,
  });

  // ── 출입구 ────────────────────────────────────────────────
  const [selectedGate, setSelectedGate] = useState<GateId | null>(
    () => (localStorage.getItem(GATE_KEY) as GateId) || null
  );

  const applyOffset = useCallback((newOx: number, newOy: number) => {
    const w = wrapperRef.current; if (!w) return;
    const vw = w.clientWidth, vh = w.clientHeight - sheetHeight;
    setAnimating(true);
    setTimeout(() => setAnimating(false), 260);
    setOffset(clampOffset(newOx, newOy, zoom, vw, vh));
  }, [zoom, sheetHeight, wrapperRef]);

  const handleGateSelect = useCallback((gid: GateId) => {
    setSelectedGate(gid);
    const gate = GATES.find(g => g.id === gid);
    if (!gate || !wrapperRef.current) return;
    const w = wrapperRef.current;
    applyOffset(w.clientWidth / 2 - gate.scrollX * zoom, w.clientHeight / 2 - gate.scrollY * zoom);
  }, [zoom, wrapperRef, applyOffset]);

  // ── UI 상태 ───────────────────────────────────────────────
  const [mode,     setMode]     = useState<Mode>('search');
  const [activeTab, setActiveTab] = useState<TabType>('A');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen,  setModalOpen]  = useState(false);
  const [modalBooth, setModalBooth] = useState<Booth | null>(null);
  const [miniTooltip, setMiniTooltip] = useState<{ booth: Booth; x: number; y: number } | null>(null);

  // ── 길찾기 ────────────────────────────────────────────────
  const navStartRef = useRef<Booth | null>(null);
  const navEndRef   = useRef<Booth | null>(null);
  const [navStartS, setNavStartS] = useState<Booth | null>(null);
  const [navEndS,   setNavEndS]   = useState<Booth | null>(null);
  const [navSlot,   setNavSlot]   = useState<RouteSlot>(null);
  const [navResult, setNavResult] = useState<RouteSegment | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);

  // ── 루트 ──────────────────────────────────────────────────
  const [routeBooths, setRouteBooths] = useState<Booth[]>([]);
  const [multiResult, setMultiResult] = useState<{ ordered: Booth[]; segs: RouteSegment[] } | null>(null);
  const [routeCollapsed, setRouteCollapsed] = useState(false);

  // ── zoomToFit ─────────────────────────────────────────────
  const zoomToFit = useCallback((pts: { x: number; y: number }[]) => {
    const w = wrapperRef.current; 
    if (!w || !pts.length) return;

    const targetSheetHeight = SHEET_MIN;
    const vw = w.clientWidth;
    const vh = w.clientHeight - targetSheetHeight - 8;

    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);

    const [mnX, mxX, mnY, mxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys)
    ];

    const PAD = 80;

    const newZoom = Math.max(
      MIN_ZOOM,
      Math.min(
        4.0,
        vw / (mxX - mnX + PAD * 2),
        vh / (mxY - mnY + PAD * 2)
      )
    );

    const cx = (mnX + mxX) / 2;
    const cy = (mnY + mxY) / 2;

    setZoom(newZoom);
    setSheetHeight(SHEET_MIN);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 260);

    setOffset(clampOffset(
      vw / 2 - cx * newZoom,
      vh / 2 - cy * newZoom,
      newZoom,
      vw,
      vh
    ));
  }, [wrapperRef, setSheetHeight]);

  // ── 길찾기 로직 ───────────────────────────────────────────
  const runNavSearch = useCallback((from: Booth, to: Booth) => {
    const seg = computeSegment(from, to);
    setNavResult(seg); setNavCollapsed(false); zoomToFit(seg.path);
  }, [zoomToFit]);

  const assignNavPoint = useCallback((booth: Booth, forcedSlot?: 'start' | 'end') => {
    const slot = forcedSlot ?? navSlot;
    if (!slot) return;

    setNavResult(null);
    setNavCollapsed(false);

    if (slot === 'start') {
      // 새 출발지를 선택하면 기존 도착지는 초기화
      navStartRef.current = booth;
      navEndRef.current = null;

      setNavStartS(booth);
      setNavEndS(null);
      setNavSlot('end');

      return;
    }

    if (slot === 'end') {
      const currentStart = navStartRef.current ?? navStartS;

      navEndRef.current = booth;
      setNavEndS(booth);

      if (currentStart) {
        setNavSlot(null);
        setTimeout(() => runNavSearch(currentStart, booth), 0);
      } else {
        setNavSlot('start');
      }
    }
  }, [navSlot, navStartS, runNavSearch]);

  // ── 루트 로직 ─────────────────────────────────────────────
  const toggleRouteBooth = useCallback((booth: Booth) => {
    setRouteBooths(prev => {
      const exists = prev.some(b => b.id === booth.id);

      if (exists) {
        return prev.filter(b => b.id !== booth.id);
      }

      return [...prev, booth];
    });
  }, []);

  const handleMultiSearch = useCallback(() => {
    const targetBooths = multiResult ? multiResult.ordered : routeBooths;
    if (targetBooths.length < 2) return;

    const segs = multiResult
      ? multiResult.segs
      : computeChained(targetBooths);

    zoomToFit(segs.flatMap(s => s.path));
  }, [routeBooths, multiResult, zoomToFit]);

  const displayRouteBooths = multiResult ? multiResult.ordered : routeBooths;

  useEffect(() => {
  if (mode !== 'multiroute') return;

  if (routeBooths.length < 2) {
    setMultiResult(null);
    return;
  }

  const ordered = solveTSP(routeBooths);
  const segs = computeChained(ordered);

  setMultiResult({ ordered, segs });
}, [mode, routeBooths]);

  const getRouteOrder = useCallback(
    (id: string) => displayRouteBooths.findIndex(b => b.id === id) + 1,
    [displayRouteBooths]
  );

  const multiDist = useMemo(() => {
    if (!multiResult) return null;
    let t = 0;
    multiResult.segs.forEach(s => { for (let i = 1; i < s.path.length; i++) t += Math.hypot(s.path[i].x - s.path[i-1].x, s.path[i].y - s.path[i-1].y); });
    return Math.round(t);
  }, [multiResult]);

  // ── 모드 전환 ─────────────────────────────────────────────
  const switchMode = useCallback((m: Mode) => {
    setMode(m); setMiniTooltip(null);
    if (m !== 'navigate')   setNavResult(null);
    if (m !== 'multiroute') setMultiResult(null);
    if (m !== 'search')     { onBoothSelect(null); setModalOpen(false); setModalBooth(null); }
    if (m === 'navigate')   setNavSlot(navStartRef.current ? (navEndRef.current ? null : 'end') : 'start');
    setNavCollapsed(false);
    setRouteCollapsed(false);
  }, [onBoothSelect]);

  // ── 부스 클릭 ─────────────────────────────────────────────
  const boothToScreen = useCallback((booth: Booth) => {
    const w = wrapperRef.current; if (!w || !booth.location || !booth.size) return null;
    const rect = w.getBoundingClientRect();
    const vpt = mapToView(booth.location.x, booth.location.y - booth.size.h / 2, zoom, offset.x, offset.y);
    return { x: vpt.x + rect.left, y: vpt.y + rect.top };
  }, [zoom, offset, wrapperRef]);

  const handleBoothClick = useCallback((booth: Booth) => {
    setMiniTooltip(null);
    if (mode === 'search') {
      onBoothSelect(booth); setModalBooth(booth); setModalOpen(true); return;
    }
    const pos = boothToScreen(booth);
    if (pos) setMiniTooltip({ booth, x: pos.x, y: pos.y });
  }, [mode, boothToScreen, onBoothSelect]);

  const handleCardClick = useCallback((booth: Booth) => {
    if (mode === 'navigate')   { assignNavPoint(booth); return; }
    if (mode === 'multiroute') { setModalBooth(booth); setModalOpen(true); return; }
    if (selectedBooth?.id === booth.id) { setModalBooth(booth); setModalOpen(true); return; }
    onBoothSelect(booth); setModalBooth(booth); setSheetHeight(SHEET_MIN); setModalOpen(false);
    // 카드 클릭 시 지도 이동
    const w = wrapperRef.current; if (!w || !booth.location) return;
    const TARGET_ZOOM = Math.max(zoom, 1.5);
    const vw = w.clientWidth;
    const vh = w.clientHeight - SHEET_MIN; // 바텀시트 접힌 상태 기준
    setSheetHeight(SHEET_MIN);
    setZoom(TARGET_ZOOM);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 260);
    setOffset(clampOffset(
      vw / 2 - booth.location.x * TARGET_ZOOM,
      vh / 2 - booth.location.y * TARGET_ZOOM,
      TARGET_ZOOM,
      vw,
      vh
    ));
  }, [mode, selectedBooth, assignNavPoint, onBoothSelect, setSheetHeight, zoom, wrapperRef]);

  const handleFacilityClick = useCallback((fac: typeof FACILITIES[0]) => {
    const fb = facilityToBooth(fac);
    if (mode === 'navigate')   { assignNavPoint(fb); return; }
    if (mode === 'multiroute') { toggleRouteBooth(fb); return; }
    // 검색 모드: 지도 이동
    const w = wrapperRef.current; if (!w) return;
    const vw = w.clientWidth, vh = w.clientHeight - sheetHeight;
    applyOffset(vw / 2 - fac.location.x * zoom, vh / 2 - fac.location.y * zoom);
    setSheetHeight(SHEET_MIN);
  }, [mode, assignNavPoint, toggleRouteBooth, zoom, sheetHeight, wrapperRef, applyOffset, setSheetHeight]);

  // 리스트 스크롤로 NavPanel 접기
  const boothListRef = useRef<HTMLDivElement>(null);
  const lastListScrollTop = useRef(0);
  const routeCount = displayRouteBooths.length;

  const handleListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const scrollingDown = top > 10 && top > lastListScrollTop.current;

    if (mode === 'navigate' && navResult) {
      if (scrollingDown && !navCollapsed) {
        setNavCollapsed(true);
      } else if ((top < lastListScrollTop.current - 5 || top <= 0) && navCollapsed) {
        setNavCollapsed(false);
      }
    }

    if (mode === 'multiroute' && routeCount > 0) {
      if (scrollingDown && !routeCollapsed) {
        setRouteCollapsed(true);
      } else if ((top < lastListScrollTop.current - 5 || top <= 0) && routeCollapsed) {
        setRouteCollapsed(false);
      }
    }

    lastListScrollTop.current = top;
  }, [mode, navResult, navCollapsed, routeCollapsed, routeCount]);

  const getFloor = (b: Booth) => hallKey(b) === 'A' ? '1층' : 'B1층';
  const getHall  = (b: Booth) => hallKey(b) === 'A' ? 'A홀' : 'B홀';

  // ── 렌더 ─────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      <MapCanvas
        booths={boothsData as Booth[]}
        mode={mode}
        zoom={zoom}
        offset={offset}
        animating={animating}
        selectedBooth={selectedBooth}
        navStart={navStartS}
        navEnd={navEndS}
        navResult={navResult}
        routeBooths={displayRouteBooths}
        multiResult={multiResult}
        modalOpen={modalOpen}
        gestureHandlers={handlers}
        onBoothClick={handleBoothClick}
        onWrapperClick={() => setMiniTooltip(null)}
        wrapperRef={wrapperRef}
      >
        {/* 출입구 선택 */}
        <GateSelector
          inline
          currentGate={selectedGate}
          onSelect={handleGateSelect}
        />

        {/* 미니 툴팁 */}
        {miniTooltip && mode !== 'search' && (
          <MiniTooltip
            booth={miniTooltip.booth}
            x={miniTooltip.x}
            y={miniTooltip.y}
            mode={mode as 'navigate' | 'multiroute'}
            inRoute={displayRouteBooths.some(b => b.id === miniTooltip.booth.id)}
            onClose={() => setMiniTooltip(null)}
            onSetStart={() => {
              assignNavPoint(miniTooltip.booth, 'start');
              setMiniTooltip(null);
            }}

            onSetEnd={() => {
              assignNavPoint(miniTooltip.booth, 'end');
              setMiniTooltip(null);
            }}
            onToggleRoute={() => toggleRouteBooth(miniTooltip.booth)}
          />
        )}
      </MapCanvas>

      {!selectedGate && (
        <GateSelector
          onSelect={gid => {
            setSelectedGate(gid);
            handleGateSelect(gid);
          }}
        />
      )}
      {/* 줌 버튼 */}
      <div className={styles.zoomBtnGroup}>
        <button className={styles.zoomBtn} onClick={() => zoomAt(1.4)}>＋</button>
        <button className={styles.zoomBtn} onClick={() => zoomAt(1/1.4)}>－</button>
      </div>

      {/* 바텀 시트 */}
      <div className={styles.bottomSheet} style={{ height: sheetHeight }}>
        <div className={styles.sheetHandle} onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
          <div className={styles.sheetHandleBar} />
        </div>
        <div className={styles.sheetContent}>
          <h3 className={styles.sheetTitle}>📜 부스 검색</h3>

          {/* 모드 탭 */}
          <div className={styles.modeTabs}>
            {(['search','navigate','multiroute'] as Mode[]).map(m => (
              <button key={m} className={`${styles.modeBtn} ${mode===m?styles.modeBtnActive:''}`} onClick={() => switchMode(m)}>
                {m==='search'?'🔍 검색':m==='navigate'?'🧭 길찾기':'🗺️ 루트'}
              </button>
            ))}
          </div>

          {/* 길찾기 패널 */}
          {mode === 'navigate' && (
            <NavPanel
              navStart={navStartS} navEnd={navEndS}
              navSlot={navSlot} navResult={navResult}
              collapsed={navCollapsed}
              onSelectSlot={slot => {
                setNavSlot(slot);
                setNavCollapsed(false);
                setNavResult(null);
              }}
              onSearch={() => navStartS && navEndS && runNavSearch(navStartS, navEndS)}
              onCollapsedClick={() => setNavCollapsed(false)}
              getFloor={getFloor} getHall={getHall}
            />
          )}

          {/* 루트 패널 */}
          {mode === 'multiroute' && (
            <RoutePanel
              booths={displayRouteBooths}
              totalDist={multiDist}
              collapsed={routeCollapsed}
              onCollapsedClick={() => setRouteCollapsed(false)}
              onRemove={toggleRouteBooth}
              onClear={() => { setRouteBooths([]); setMultiResult(null); }}
              onSearch={handleMultiSearch}
            />
          )}

          {/* 검색 바 */}
          <div className={styles.searchBar}>
            <input
              className={styles.searchInput}
              placeholder={
                mode==='navigate'   ? `${navSlot==='end'?'도착':'출발'} 부스 검색...` :
                mode==='multiroute' ? '추가할 부스 검색...' : '출판사명 또는 부스 번호 검색...'
              }
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && <button className={styles.searchClear} onClick={() => setSearchTerm('')}>✕</button>}
          </div>

          {/* 탭 */}
          <div className={styles.tabs}>
            {(['A','B','FAC','FAV'] as TabType[]).map(t => (
              <button key={t} className={`${styles.tabBtn} ${activeTab===t?styles.tabBtnActive:''}`} onClick={() => setActiveTab(t)}>
                {t==='FAC'?'🏗️ 편의':t==='FAV'?'⭐':t+'홀'}
              </button>
            ))}
          </div>

          {/* 부스/편의시설 목록 */}
          <BoothList
            booths={boothsData as Booth[]}
            facilities={FACILITIES}
            activeTab={activeTab}
            searchTerm={searchTerm}
            mode={mode}
            selectedBooth={selectedBooth}
            navStart={navStartS}
            navEnd={navEndS}
            routeBooths={displayRouteBooths}
            favorites={favorites}
            listRef={boothListRef}
            onScroll={handleListScroll}
            onBoothClick={handleCardClick}
            onFacilityClick={handleFacilityClick}
            onToggleFav={toggleFav}
            onToggleRoute={toggleRouteBooth}
            getRouteOrder={getRouteOrder}
          />
        </div>
      </div>

      {/* 모달 */}
      {modalOpen && modalBooth && (
        <BoothModal
          booth={modalBooth}
          isFav={favorites.has(modalBooth.id)}
          onClose={() => setModalOpen(false)}
          onToggleFav={toggleFav}
          searchTerm={searchTerm}
          mode={mode}
          inRoute={displayRouteBooths.some(b => b.id === modalBooth.id)}
          onToggleRoute={b => { toggleRouteBooth(b); setModalOpen(false); }}
        />
      )}
    </div>
  );
};

export default MapArea;