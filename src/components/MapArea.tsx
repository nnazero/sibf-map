import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import boothsData from '../data/auto_booths.json';
import walkGrids from '../data/walk_grid.json';
import styles from './MapArea.module.css';
import { findWalkingPath, WalkGrid, PathPoint } from '../utils/pathfinding';

interface Tenant { booth_number: string; publisher_name: string; category: string; }
interface Booth {
  id: string; booth_number: string; gate: string;
  location: { x: number; y: number }; size: { w: number; h: number };
  publisher_name: string; category: string; tenants?: Tenant[]; is_zone?: boolean;
}
interface MapAreaProps { selectedBooth: Booth | null; onBoothSelect: (b: Booth | null) => void; }
interface RouteSegment { path: PathPoint[]; crossFloor: boolean; }

type Mode    = 'search' | 'navigate' | 'multiroute';
type TabType = 'A' | 'B' | 'FAV';
type RouteSlot = 'start' | 'end' | null;

const SHEET_MIN = 100;
const BOOTH_START_X = 0;
const BOOTH_START_Y = 0;
const FAV_KEY = 'sibf_favorites';

// ── 유틸 함수들 ──────────────────────────────────────────────

const toManhattanPath = (pts: PathPoint[]): PathPoint[] => {
  if (pts.length <= 1) return pts;
  const res: PathPoint[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = res[res.length - 1], c = pts[i];
    if (Math.abs(c.x - p.x) > 0.5 && Math.abs(c.y - p.y) > 0.5) res.push({ x: c.x, y: p.y });
    res.push(c);
  }
  return res;
};

const solveTSP = (booths: Booth[]): Booth[] => {
  if (booths.length <= 1) return booths;
  const d = (a: Booth, b: Booth) => Math.hypot(a.location.x - b.location.x, a.location.y - b.location.y);
  let best: Booth[] = [], bestDist = Infinity;
  for (let si = 0; si < booths.length; si++) {
    const rem = [...booths], route: Booth[] = [rem.splice(si, 1)[0]];
    while (rem.length > 0) {
      const cur = route[route.length - 1];
      let ni = 0, nd = d(cur, rem[0]);
      for (let i = 1; i < rem.length; i++) { const di = d(cur, rem[i]); if (di < nd) { nd = di; ni = i; } }
      route.push(rem.splice(ni, 1)[0]);
    }
    let total = 0;
    for (let i = 1; i < route.length; i++) total += d(route[i-1], route[i]);
    if (total < bestDist) { bestDist = total; best = route; }
  }
  return best;
};

const computeChainedSegments = (ordered: Booth[]): RouteSegment[] => {
  const segs: RouteSegment[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i], to = ordered[i + 1];
    if (!from.location || !to.location) continue;
    const crossFloor = from.booth_number[0] !== to.booth_number[0];
    let path: PathPoint[] | null = null;
    if (!crossFloor) {
      const grid = (walkGrids as Record<string, WalkGrid>)[from.booth_number[0]];
      if (grid) path = findWalkingPath(grid, from.location, to.location);
    }
    path = path ? toManhattanPath(path) : toManhattanPath([from.location, to.location]);
    segs.push({ path, crossFloor });
  }
  return segs;
};

const loadFavs = (): Set<string> => {
  try { const r = localStorage.getItem(FAV_KEY); return r ? new Set(JSON.parse(r)) : new Set(); }
  catch { return new Set(); }
};
const saveFavs = (s: Set<string>) => {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...s])); } catch {}
};

// ── 컴포넌트 ─────────────────────────────────────────────────

const MapArea: React.FC<MapAreaProps> = ({ selectedBooth, onBoothSelect }) => {
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState(SHEET_MIN);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0); const dragStartH = useRef(0); const dragStartT = useRef(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('A');
  const [modalOpen, setModalOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavs);

  const [mode, setMode] = useState<Mode>('search');

  // 길찾기
  const [navStart, setNavStart] = useState<Booth | null>(null);
  const [navEnd,   setNavEnd]   = useState<Booth | null>(null);
  const [navSlot,  setNavSlot]  = useState<RouteSlot>(null);
  const [navResult, setNavResult] = useState<{ path: PathPoint[]; crossFloor: boolean } | null>(null);

  // 루트정하기
  const [routeBooths, setRouteBooths] = useState<Booth[]>([]);
  const [multiResult, setMultiResult] = useState<{ ordered: Booth[]; segs: RouteSegment[] } | null>(null);

  // 초기 스크롤
  useEffect(() => {
    const w = mapWrapperRef.current;
    if (w) { w.scrollLeft = BOOTH_START_X; w.scrollTop = BOOTH_START_Y; }
  }, []);

  // 즐겨찾기
  const toggleFav = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveFavs(next);
      return next;
    });
  }, []);

  // 줌+스크롤
  const zoomToFit = useCallback((pts: PathPoint[]) => {
    const w = mapWrapperRef.current;
    if (!w || !pts.length) return;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const PAD = 80;
    const zoom = Math.min(w.clientWidth / (maxX - minX + PAD*2), (w.clientHeight - SHEET_MIN - 8) / (maxY - minY + PAD*2), 1);
    setMapZoom(zoom);
    setSheetHeight(SHEET_MIN);
    setTimeout(() => {
      w.scrollTo({ left: Math.max(0, (minX+maxX)/2*zoom - w.clientWidth/2), top: Math.max(0, (minY+maxY)/2*zoom - (w.clientHeight - SHEET_MIN)/2), behavior: 'smooth' });
    }, 50);
  }, []);

  // 모드 전환
  const switchMode = useCallback((m: Mode) => {
    setMode(m); setMapZoom(1);
    if (m !== 'navigate') setNavResult(null);
    if (m !== 'multiroute') setMultiResult(null);
    if (m !== 'search') { onBoothSelect(null); setModalOpen(false); }
    if (m === 'navigate') setNavSlot(navStart ? (navEnd ? null : 'end') : 'start');
  }, [navStart, navEnd, onBoothSelect]);

  // 길찾기
  const assignNavPoint = (booth: Booth) => {
    if (!navSlot) return;
    setNavResult(null); setMapZoom(1);
    if (navSlot === 'start') { setNavStart(booth); setNavSlot(navEnd ? null : 'end'); }
    else { setNavEnd(booth); setNavSlot(navStart ? null : 'start'); }
  };

  const handleNavSearch = useCallback(() => {
    if (!navStart?.location || !navEnd?.location) return;
    const crossFloor = navStart.booth_number[0] !== navEnd.booth_number[0];
    let path: PathPoint[] | null = null;
    if (!crossFloor) {
      const grid = (walkGrids as Record<string, WalkGrid>)[navStart.booth_number[0]];
      if (grid) path = findWalkingPath(grid, navStart.location, navEnd.location);
    }
    path = path ? toManhattanPath(path) : toManhattanPath([navStart.location, navEnd.location]);
    setNavResult({ path, crossFloor });
    zoomToFit(path);
  }, [navStart, navEnd, zoomToFit]);

  // 루트정하기
  const toggleRouteBooth = useCallback((booth: Booth) => {
    setMultiResult(null); setMapZoom(1);
    setRouteBooths(prev => prev.some(b => b.id === booth.id) ? prev.filter(b => b.id !== booth.id) : [...prev, booth]);
  }, []);

  const handleMultiSearch = useCallback(() => {
    if (routeBooths.length < 2) return;
    const ordered = solveTSP(routeBooths);
    const segs = computeChainedSegments(ordered);
    setMultiResult({ ordered, segs });
    zoomToFit(segs.flatMap(s => s.path));
  }, [routeBooths, zoomToFit]);

  // 클릭
  const handleBlockClick = (booth: Booth) => {
    if (mode === 'navigate')   { assignNavPoint(booth); return; }
    if (mode === 'multiroute') { toggleRouteBooth(booth); return; }
    onBoothSelect(booth); setModalOpen(true);
  };
  const handleCardClick = (booth: Booth) => {
    if (mode === 'navigate')   { assignNavPoint(booth); return; }
    if (mode === 'multiroute') { toggleRouteBooth(booth); return; }
    if (selectedBooth?.id === booth.id) { setModalOpen(true); return; }
    onBoothSelect(booth); setSheetHeight(SHEET_MIN); setModalOpen(false);
  };

  // 검색모드 스크롤
  useEffect(() => {
    if (mode === 'search' && selectedBooth?.location && mapWrapperRef.current) {
      const w = mapWrapperRef.current;
      w.scrollTo({ left: Math.max(0, selectedBooth.location.x * mapZoom - w.clientWidth/2), top: Math.max(0, selectedBooth.location.y * mapZoom - w.clientHeight/2), behavior: 'smooth' });
    }
  }, [selectedBooth, mode]);

  // 드래그
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y; dragStartH.current = sheetHeight; dragStartT.current = Date.now();
  };
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setSheetHeight(Math.max(SHEET_MIN, Math.min(window.innerHeight - 150, dragStartH.current + dragStartY.current - y)));
  }, [isDragging]);
  const handleDragEnd = useCallback((e: MouseEvent | TouchEvent) => {
    setIsDragging(false);
    const y = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;
    const dy = dragStartY.current - y;
    const dt = Date.now() - dragStartT.current;
    const maxH = window.innerHeight - 160;
    if (dt < 220 && Math.abs(dy) > 30) { setSheetHeight(dy > 0 ? maxH : SHEET_MIN); return; }
    setSheetHeight(sheetHeight >= (maxH + SHEET_MIN) / 2 ? maxH : SHEET_MIN);
  }, [isDragging, sheetHeight]);
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove); window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove); window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove); window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove); window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 필터
  const normalize = (s: string) => (s || '').replace(/[\s_]/g, '').toUpperCase();
  const matchBoothOrTenant = (b: Booth, raw: string): { matched: boolean; tenant?: Tenant } => {
    if (!raw) return { matched: true };
    const cs = normalize(raw);
    const sw = /^\d+$/.test(cs) && activeTab !== 'FAV' ? activeTab + cs : cs;
    if (normalize(b.booth_number).includes(sw) || (b.publisher_name || '').toLowerCase().includes(raw.toLowerCase())) return { matched: true };
    for (const t of b.tenants ?? []) {
      if (normalize(t.booth_number).includes(sw) || (t.publisher_name || '').toLowerCase().includes(raw.toLowerCase()))
        return { matched: true, tenant: t };
    }
    return { matched: false };
  };
  const filteredBooths = useMemo(() => (boothsData as Booth[])
    .filter(b => {
      if (!b?.booth_number) return false;
      if (activeTab === 'FAV') return favorites.has(b.id);
      return b.booth_number.replace(/[\s_]/g, '').toUpperCase()[0] === activeTab;
    })
    .map(b => ({ booth: b, ...matchBoothOrTenant(b, searchTerm) }))
    .filter(r => r.matched)
    .map(r => ({ ...r.booth, _matchedTenant: r.tenant } as Booth & { _matchedTenant?: Tenant })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [searchTerm, activeTab, favorites]);

  const tenantMatchSearch = (t: Tenant) =>
    !!searchTerm && (normalize(t.booth_number).includes(normalize(searchTerm)) || (t.publisher_name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  // 경로 선분 렌더
  const renderSegs = (pts: PathPoint[], cls: string, kp: string) =>
    pts.slice(0, -1).map((pt, i) => {
      const nx = pts[i+1]; const dx = nx.x - pt.x; const dy = nx.y - pt.y;
      const len = Math.hypot(dx, dy); if (len < 0.5) return null;
      return <div key={`${kp}-${i}`} className={cls}
        style={{ left: pt.x, top: pt.y, width: len, transform: `rotate(${Math.round(Math.atan2(dy, dx) * 180 / Math.PI)}deg)` }} />;
    });

  const getFloor = (b: Booth) => b.booth_number.startsWith('A') ? '1층' : 'B1층';
  const getHall  = (b: Booth) => b.booth_number.startsWith('A') ? 'A홀' : 'B홀';

  const multiDist = useMemo(() => {
    if (!multiResult) return null;
    let t = 0;
    for (const s of multiResult.segs) for (let i = 1; i < s.path.length; i++) t += Math.hypot(s.path[i].x - s.path[i-1].x, s.path[i].y - s.path[i-1].y);
    return Math.round(t);
  }, [multiResult]);

  // ── 렌더 ─────────────────────────────────────────────────
  return (
    <div className={styles.mapComponentWrapper}>
      <div className={styles.mapWrapper} ref={mapWrapperRef}>
        <div className={styles.mapContainer} style={{ zoom: mapZoom } as React.CSSProperties}>
          <img src="/map.png" alt="SIBF Map" className={styles.mapImage} />

          {/* 부스 블록 */}
          {(boothsData as Booth[]).map(booth => {
            if (!booth?.size || !booth?.location) return null;
            const inRoute = mode === 'multiroute' && routeBooths.some(b => b.id === booth.id);
            const isActive = (mode === 'search' && selectedBooth?.id === booth.id) ||
              (mode === 'navigate' && (navStart?.id === booth.id || navEnd?.id === booth.id)) || inRoute;
            const w = booth.size.w; const h = booth.size.h;
            return (
              <div key={booth.id}
                className={`${styles.boothBlock} ${isActive ? styles.activeBlock : ''} ${booth.is_zone ? styles.zoneBlock : ''}`}
                style={{ left: booth.location.x - w/2, top: booth.location.y - h/2, width: w, height: h }}
                onClick={() => handleBlockClick(booth)}>
                {w > 35 && <span className={styles.blockLabel}>{booth.is_zone ? `${booth.booth_number} 공동관` : booth.booth_number}</span>}
              </div>
            );
          })}

          {/* 선택 핀 */}
          {mode === 'search' && selectedBooth?.location && !modalOpen && (
            <div className={styles.selectionPin} style={{ left: selectedBooth.location.x, top: selectedBooth.location.y }} />
          )}

          {/* 길찾기 핀 + 경로 */}
          {mode === 'navigate' && navStart?.location && <div className={styles.routePinStart} style={{ left: navStart.location.x, top: navStart.location.y }} />}
          {mode === 'navigate' && navEnd?.location   && <div className={styles.routePinEnd}   style={{ left: navEnd.location.x,   top: navEnd.location.y }}   />}
          {mode === 'navigate' && navResult && renderSegs(navResult.path, navResult.crossFloor ? styles.routeLineCrossFloor : styles.routeLine, 'nav')}
          {mode === 'navigate' && navResult?.crossFloor && navStart && navEnd && (() => {
            const mid = navResult.path[Math.floor(navResult.path.length / 2)];
            return <div className={styles.floorBadge} style={{ left: mid.x, top: mid.y }}>🪜 {getHall(navStart)} {getFloor(navStart)} → {getHall(navEnd)} {getFloor(navEnd)}</div>;
          })()}

          {/* 루트정하기 번호 핀 + 경로 */}
          {mode === 'multiroute' && multiResult && multiResult.ordered.map((booth, idx) =>
            booth.location ? <div key={`mr-pin-${booth.id}`} className={styles.multiRoutePinNum} style={{ left: booth.location.x, top: booth.location.y }}>{idx + 1}</div> : null
          )}
          {mode === 'multiroute' && multiResult && multiResult.segs.map((seg, si) =>
            renderSegs(seg.path, seg.crossFloor ? styles.routeLineCrossFloor : styles.routeLineMulti, `mr-${si}`)
          )}
        </div>
      </div>

      {/* 바텀 시트 */}
      <div className={styles.bottomSheet} style={{ height: `${sheetHeight}px` }}>
        <div className={styles.sheetHandleWrapper} onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
          <div className={styles.sheetHandle} />
        </div>
        <div className={styles.sheetContent}>
          <h3 className={styles.sheetTitle}>📜 부스 검색</h3>

          {/* 모드 전환 */}
          <div className={styles.modeToggleWrapper}>
            <button className={`${styles.modeBtn} ${mode==='search'     ? styles.modeBtnActive : ''}`} onClick={() => switchMode('search')}>🔍 검색</button>
            <button className={`${styles.modeBtn} ${mode==='navigate'   ? styles.modeBtnActive : ''}`} onClick={() => switchMode('navigate')}>🧭 길찾기</button>
            <button className={`${styles.modeBtn} ${mode==='multiroute' ? styles.modeBtnActive : ''}`} onClick={() => switchMode('multiroute')}>🗺️ 루트</button>
          </div>

          {/* 길찾기 패널 */}
          {mode === 'navigate' && (
            <div className={styles.routeSlots}>
              <div className={`${styles.routeSlot} ${navSlot==='start' ? styles.routeSlotActive : ''}`} onClick={() => setNavSlot('start')}>
                <span className={styles.routeSlotDot} style={{ backgroundColor: '#2ecc71' }} />
                <span className={styles.routeSlotLabel}>출발</span>
                {navStart ? <span className={styles.routeSlotValue}>{navStart.publisher_name || navStart.booth_number} ({navStart.booth_number})</span>
                  : <span className={styles.routeSlotPlaceholder}>출발 부스를 선택하세요</span>}
              </div>
              <div className={`${styles.routeSlot} ${navSlot==='end' ? styles.routeSlotActive : ''}`} onClick={() => setNavSlot('end')}>
                <span className={styles.routeSlotDot} style={{ backgroundColor: '#ff3b30' }} />
                <span className={styles.routeSlotLabel}>도착</span>
                {navEnd ? <span className={styles.routeSlotValue}>{navEnd.publisher_name || navEnd.booth_number} ({navEnd.booth_number})</span>
                  : <span className={styles.routeSlotPlaceholder}>도착 부스를 선택하세요</span>}
              </div>
              {navStart && navEnd && <button className={styles.routeSearchBtn} onClick={handleNavSearch}>🔎 경로 보기</button>}
              {navResult && (
                <div className={styles.routeSummary}>
                  📍 {getHall(navStart!)} {getFloor(navStart!)} → {getHall(navEnd!)} {getFloor(navEnd!)}
                  {navResult.crossFloor && <div className={styles.routeFloorWarning}>⚠️ 층이 달라요. 계단·에스컬레이터로 이동이 필요해요.</div>}
                </div>
              )}
            </div>
          )}

          {/* 루트정하기 패널 */}
          {mode === 'multiroute' && (
            <div className={styles.routeSlots}>
              {routeBooths.length > 0 ? (
                <div className={styles.routeBoothsList}>
                  {routeBooths.map((b, idx) => (
                    <div key={b.id} className={styles.routeBoothItem}>
                      <span className={styles.routeBoothIdx}>{idx + 1}</span>
                      <span className={styles.routeBoothName}>{b.publisher_name || b.booth_number} ({b.booth_number})</span>
                      <button className={styles.routeBoothRemoveBtn} onClick={() => toggleRouteBooth(b)}>✕</button>
                    </div>
                  ))}
                  <button className={styles.routeClearBtn} onClick={() => { setRouteBooths([]); setMultiResult(null); setMapZoom(1); }}>전체 초기화</button>
                </div>
              ) : <p className={styles.routeBoothsHint}>아래 목록에서 2개 이상의 부스를 선택하세요</p>}
              {routeBooths.length >= 2 && <button className={styles.routeSearchBtn} onClick={handleMultiSearch}>🔎 최단 루트 보기</button>}
              {multiResult && <div className={styles.routeSummary}>🗺️ {multiResult.ordered.length}개 부스 최단 루트 (약 {multiDist}px 동선)</div>}
            </div>
          )}

          {/* 검색 바 */}
          <div className={styles.searchBarWrapper}>
            <input type="text" className={styles.searchInput}
              placeholder={mode==='navigate' ? `${navSlot==='end' ? '도착' : '출발'} 부스 검색...` : mode==='multiroute' ? '추가할 부스 검색...' : '출판사명 또는 부스 번호 검색...'}
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && <button className={styles.searchClearBtn} onClick={() => setSearchTerm('')}>✕</button>}
          </div>

          {/* 탭 */}
          <div className={styles.tabWrapper}>
            <button className={`${styles.tabBtn} ${activeTab==='A'   ? styles.activeTab : ''}`} onClick={() => setActiveTab('A')}>A홀</button>
            <button className={`${styles.tabBtn} ${activeTab==='B'   ? styles.activeTab : ''}`} onClick={() => setActiveTab('B')}>B홀</button>
            <button className={`${styles.tabBtn} ${activeTab==='FAV' ? styles.activeTab : ''}`} onClick={() => setActiveTab('FAV')}>⭐ 즐겨찾기</button>
          </div>

          {/* 카드 리스트 */}
          <div className={styles.boothList}>
            {filteredBooths.length > 0 ? filteredBooths.map((b: any) => {
              const inRoute = mode === 'multiroute' && routeBooths.some(rb => rb.id === b.id);
              const isFav = favorites.has(b.id);
              const isSelected =
                (mode==='search' && selectedBooth?.id === b.id) ||
                (mode==='navigate' && (navStart?.id === b.id || navEnd?.id === b.id)) ||
                inRoute;
              return (
                <div key={b.id} className={`${styles.boothCard} ${isSelected ? styles.selectedCard : ''}`} onClick={() => handleCardClick(b)}>
                  <div className={styles.cardRow}>
                    <div className={styles.cardMain}>
                      {b._matchedTenant ? (
                        <><h4>{b._matchedTenant.publisher_name}</h4><p>위치: {b.gate} ({b._matchedTenant.booth_number} · {b.booth_number} 공동관 내)</p></>
                      ) : (
                        <><h4>{b.publisher_name || `${b.booth_number} 부스 구역`}</h4><p>위치: {b.gate} ({b.booth_number}){b.is_zone && ` · 입주사 ${b.tenants?.length ?? 0}곳`}</p></>
                      )}
                    </div>
                    <div className={styles.cardActions}>
                      {mode === 'multiroute' && (
                        <button className={`${styles.addRouteBtn} ${inRoute ? styles.addRouteBtnActive : ''}`}
                          onClick={e => { e.stopPropagation(); toggleRouteBooth(b); }}>
                          {inRoute ? '✓' : '+'}
                        </button>
                      )}
                      <button className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ''}`}
                        onClick={e => { e.stopPropagation(); toggleFav(b.id); }}>
                        {isFav ? '⭐' : '☆'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <p className={styles.noResult}>
                {activeTab === 'FAV' ? '즐겨찾기한 부스가 없어요. 부스 카드의 ☆를 눌러 추가해보세요.' : '검색 결과가 없습니다. 😥'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 모달 */}
      {mode === 'search' && modalOpen && selectedBooth && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalBadge}>{selectedBooth.is_zone ? '공동관 정보' : '부스 정보'}</span>
              <div className={styles.modalHeaderActions}>
                <button className={`${styles.modalFavBtn} ${favorites.has(selectedBooth.id) ? styles.modalFavBtnActive : ''}`}
                  onClick={() => toggleFav(selectedBooth.id)}>
                  {favorites.has(selectedBooth.id) ? '⭐ 해제' : '☆ 즐겨찾기'}
                </button>
                <button className={styles.modalCloseBtn} onClick={() => setModalOpen(false)}>✕</button>
              </div>
            </div>
            <h2 className={styles.modalTitle}>
              {selectedBooth.is_zone ? `${selectedBooth.booth_number} 독립출판 마켓 공동관` : (selectedBooth.publisher_name || `${selectedBooth.booth_number} 구역`)}
            </h2>
            <div className={styles.modalDivider} />
            <p className={styles.modalMeta}>📍 <strong>위치:</strong> {selectedBooth.gate} ({selectedBooth.booth_number})</p>
            {selectedBooth.category && !selectedBooth.is_zone && <p className={styles.modalMeta}>🏷️ <strong>분류:</strong> {selectedBooth.category}</p>}
            {selectedBooth.is_zone && selectedBooth.tenants ? (
              <>
                <p className={styles.modalDesc}>이 구역에는 {selectedBooth.tenants.length}개 독립출판사가 함께 입주해 있습니다.</p>
                <div style={{ maxHeight: '40vh', overflowY: 'auto', marginTop: '8px' }}>
                  {selectedBooth.tenants.map(t => (
                    <div key={t.booth_number} style={{
                      padding: '8px 10px', marginBottom: '4px', borderRadius: '8px',
                      background: tenantMatchSearch(t) ? 'rgba(0,122,255,0.12)' : 'transparent',
                      border: tenantMatchSearch(t) ? '1px solid #007AFF' : '1px solid transparent',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.publisher_name}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{t.booth_number} · {t.category}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className={styles.modalDesc}>서울국제도서전 해당 부스에서 다양한 이벤트와 신간 도서 전시가 진행 중입니다.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapArea;