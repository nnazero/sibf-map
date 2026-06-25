import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import boothsData from '../data/auto_booths.json';
import walkGridsData from '../data/walk_grid.json';
import styles from './MapArea.module.css';
import GateSelector, { GateId, GATES, GATE_KEY } from './Gateselector';

// ── 타입 ────────────────────────────────────────────────────
interface Tenant { booth_number: string; publisher_name: string; category: string; }
interface Booth {
  id: string; booth_number: string; gate: string;
  location: { x: number; y: number }; size: { w: number; h: number };
  publisher_name: string; category: string; tenants?: Tenant[]; is_zone?: boolean;
}
interface MapAreaProps { selectedBooth: Booth | null; onBoothSelect: (b: Booth | null) => void; }
interface PathPoint { x: number; y: number; }
interface WalkGridData {
  originX: number; originY: number; cellSize: number;
  cols: number; rows: number; grid: number[][];
}
interface RouteSegment { path: PathPoint[]; crossFloor: boolean; }
type Mode = 'search' | 'navigate' | 'multiroute';
type TabType = 'A' | 'B' | 'FAC' | 'FAV';
type RouteSlot = 'start' | 'end' | null;

// ── 상수 ────────────────────────────────────────────────────
const SHEET_MIN = 100;
const FAV_KEY = 'sibf_favorites';
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3.0;

// ── walkGrid 타입 캐스팅 ──────────────────────────────────────
const walkGrids = walkGridsData as Record<string, WalkGridData>;

// ── 편의시설 ─────────────────────────────────────────────────
interface FacilityItem {
  id: string; label: string;
  type: 'toilet' | 'info' | 'escalator' | 'gate';
  hall: 'A' | 'B';
  location: { x: number; y: number }; emoji: string;
}
const FACILITIES: FacilityItem[] = [
  { id: 'toilet-a1', label: '화장실 A-1', type: 'toilet', hall: 'A', location: { x: 336, y: 958 }, emoji: '🚻' },
  { id: 'toilet-a2', label: '화장실 A-2', type: 'toilet', hall: 'A', location: { x: 810, y: 1812 }, emoji: '🚻' },
  { id: 'toilet-a3', label: '화장실 A-3', type: 'toilet', hall: 'A', location: { x: 1126, y: 1812 }, emoji: '🚻' },
  { id: 'toilet-a4', label: '화장실 A-4', type: 'toilet', hall: 'A', location: { x: 1612, y: 958 }, emoji: '🚻' },
  { id: 'toilet-b1', label: '화장실 B-1', type: 'toilet', hall: 'B', location: { x: 1822, y: 594 }, emoji: '🚻' },
  { id: 'toilet-b2', label: '화장실 B-2', type: 'toilet', hall: 'B', location: { x: 1820, y: 158 }, emoji: '🚻' },
  { id: 'info-a1', label: '인포·티켓 A홀', type: 'info', hall: 'A', location: { x: 1723, y: 1887 }, emoji: 'ℹ️' },
  { id: 'info-b1', label: '인포·티켓 B1홀', type: 'info', hall: 'B', location: { x: 1896, y: 594 }, emoji: 'ℹ️' },
  { id: 'gate-a1-out', label: 'A홀 출구', type: 'gate', hall: 'A', location: { x: 492, y: 1918 }, emoji: '🚪' },
  { id: 'gate-a1-in', label: 'A홀 입구', type: 'gate', hall: 'A', location: { x: 1403, y: 1918 }, emoji: '🚶' },
  { id: 'gate-b1', label: 'B1홀 출입구', type: 'gate', hall: 'B', location: { x: 1836, y: 422 }, emoji: '🏛️' },
  { id: 'esc-ab-1', label: '에스컬레이터 1', type: 'escalator', hall: 'A', location: { x: 1084, y: 925 }, emoji: '🪜' },
  { id: 'esc-ab-2', label: '에스컬레이터 2', type: 'escalator', hall: 'A', location: { x: 1396, y: 925 }, emoji: '🪜' },
];

/**
 * 에스컬레이터 연결점
 * - aEntry: A홀에서 에스컬레이터 탑승 지점 (A hall walkable 영역 경계 근처)
 * - bEntry: B홀에서 에스컬레이터 하차 지점 (B hall walkable 영역 경계 근처)
 */
const ESC_LINKS: { aEntry: PathPoint; bEntry: PathPoint }[] = [
  { aEntry: { x: 1084, y: 975 }, bEntry: { x: 1084, y: 940 } },
  { aEntry: { x: 1396, y: 975 }, bEntry: { x: 1396, y: 940 } },
];

/** 출발점 기준 가장 가까운 에스컬레이터 하나 선택 */
function nearestEsc(from: PathPoint): { aEntry: PathPoint; bEntry: PathPoint } {
  return ESC_LINKS.reduce((best, esc) => {
    const dB = Math.hypot(best.aEntry.x - from.x, best.aEntry.y - from.y);
    const dC = Math.hypot(esc.aEntry.x - from.x, esc.aEntry.y - from.y);
    return dC < dB ? esc : best;
  });
}

/** 편의시설 → Booth 변환 (hall로 booth_number 첫 글자 결정) */
const facilityToBooth = (fac: FacilityItem): Booth => ({
  id: fac.id,
  booth_number: fac.hall === 'A' ? `A_${fac.id}` : `B_${fac.id}`,
  gate: fac.hall === 'A' ? 'A 출입구' : 'B1 출입구',
  location: fac.location,
  size: { w: 40, h: 40 },
  publisher_name: fac.label,
  category: fac.type,
});

/** 부스 홀 키 ('A' | 'B') — booth_number 첫 글자 기준 */
const hallKey = (b: Booth): 'A' | 'B' => (b.booth_number.startsWith('A') ? 'A' : 'B');

// ── A* 경로탐색 ───────────────────────────────────────────────
function wToG(wg: WalkGridData, p: PathPoint): { c: number; r: number } {
  return {
    c: Math.round((p.x - wg.originX) / wg.cellSize),
    r: Math.round((p.y - wg.originY) / wg.cellSize),
  };
}
function gToW(wg: WalkGridData, c: number, r: number): PathPoint {
  return { x: wg.originX + c * wg.cellSize, y: wg.originY + r * wg.cellSize };
}
function walkable(wg: WalkGridData, c: number, r: number): boolean {
  if (r < 0 || r >= wg.rows || c < 0 || c >= wg.cols) return false;
  return wg.grid[r][c] === 1;
}
function nearestWalkableCell(
  wg: WalkGridData, c: number, r: number
): { c: number; r: number } | null {
  if (walkable(wg, c, r)) return { c, r };
  for (let rad = 1; rad <= 12; rad++) {
    for (let dc = -rad; dc <= rad; dc++) {
      for (let dr = -rad; dr <= rad; dr++) {
        if (Math.abs(dc) !== rad && Math.abs(dr) !== rad) continue;
        if (walkable(wg, c + dc, r + dr)) return { c: c + dc, r: r + dr };
      }
    }
  }
  return null;
}

const DIRS8 = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];

function astar(wg: WalkGridData, from: PathPoint, to: PathPoint): PathPoint[] {
  const sg = wToG(wg, from);
  const eg = wToG(wg, to);
  const sn = nearestWalkableCell(wg, sg.c, sg.r);
  const en = nearestWalkableCell(wg, eg.c, eg.r);
  if (!sn || !en) return [from, to];

  const key = (c: number, r: number) => (r << 16) | c;
  const h   = (c: number, r: number) => Math.abs(c - en.c) + Math.abs(r - en.r);

  type Node = { c: number; r: number; g: number; f: number; pk: number };
  const nodeMap = new Map<number, Node>();
  const parentMap = new Map<number, number>();
  const open  = new Set<number>();
  const closed = new Set<number>();

  const sk = key(sn.c, sn.r);
  nodeMap.set(sk, { c: sn.c, r: sn.r, g: 0, f: h(sn.c, sn.r), pk: -1 });
  open.add(sk);

  const ek = key(en.c, en.r);
  let found = false;
  let iters = 0;

  while (open.size > 0 && iters++ < 80000) {
    // pick lowest f
    let bestK = -1, bestF = Infinity;
    for (const k of open) {
      const n = nodeMap.get(k)!;
      if (n.f < bestF) { bestF = n.f; bestK = k; }
    }
    if (bestK === -1) break;
    if (bestK === ek) { found = true; break; }

    const cur = nodeMap.get(bestK)!;
    open.delete(bestK);
    closed.add(bestK);

    for (const [dc, dr] of DIRS8) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (!walkable(wg, nc, nr)) continue;
      const nk = key(nc, nr);
      if (closed.has(nk)) continue;
      // diagonal: require both axis-adjacent cells walkable
      if (dc !== 0 && dr !== 0) {
        if (!walkable(wg, cur.c + dc, cur.r) || !walkable(wg, cur.c, cur.r + dr)) continue;
      }
      const cost = (dc !== 0 && dr !== 0) ? 1.414 : 1;
      const ng = cur.g + cost;
      const existing = nodeMap.get(nk);
      if (!existing || ng < existing.g) {
        nodeMap.set(nk, { c: nc, r: nr, g: ng, f: ng + h(nc, nr), pk: bestK });
        open.add(nk);
      }
    }
  }

  if (!found) return [from, to];

  // reconstruct
  const raw: PathPoint[] = [];
  let k: number = ek;
  while (k !== -1 && k !== sk) {
    const n = nodeMap.get(k)!;
    raw.unshift(gToW(wg, n.c, n.r));
    k = n.pk;
  }
  raw.unshift(gToW(wg, sn.c, sn.r));

  if (raw.length > 0) { raw[0] = from; raw[raw.length - 1] = to; }
  return simplify(raw);
}

/** 직선 구간 중간점 제거 */
function simplify(pts: PathPoint[], tol = 3): PathPoint[] {
  if (pts.length <= 2) return pts;
  const out: PathPoint[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) > tol) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** 맨해튼 보정 (대각 꺾임 제거) */
function toManhattan(pts: PathPoint[]): PathPoint[] {
  if (pts.length <= 1) return pts;
  const out: PathPoint[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = out[out.length - 1], c = pts[i];
    if (Math.abs(c.x - p.x) > 1 && Math.abs(c.y - p.y) > 1) out.push({ x: c.x, y: p.y });
    out.push(c);
  }
  return out;
}

// ── 경로 세그먼트 계산 ────────────────────────────────────────
function computeSegment(from: Booth, to: Booth): RouteSegment {
  if (!from.location || !to.location) return { path: [], crossFloor: false };

  const fh = hallKey(from), th = hallKey(to);
  const crossFloor = fh !== th;

  if (!crossFloor) {
    const wg = walkGrids[fh];
    const path = wg
      ? toManhattan(astar(wg, from.location, to.location))
      : toManhattan([from.location, to.location]);
    return { path, crossFloor: false };
  }

  // 층간 이동: 출발 홀에서 가장 가까운 에스컬레이터 1개만 경유
  const esc = nearestEsc(from.location);
  // from hall → esc entry (from hall side)
  const entryFrom = fh === 'A' ? esc.aEntry : esc.bEntry;
  // exit on destination hall side
  const entryTo   = fh === 'A' ? esc.bEntry : esc.aEntry;

  const wgF = walkGrids[fh];
  const wgT = walkGrids[th];

  const seg1 = wgF
    ? toManhattan(astar(wgF, from.location, entryFrom))
    : toManhattan([from.location, entryFrom]);
  const seg2 = wgT
    ? toManhattan(astar(wgT, entryTo, to.location))
    : toManhattan([entryTo, to.location]);

  const path = simplify([...seg1, ...seg2]);
  return { path, crossFloor: true };
}

function computeChained(ordered: Booth[]): RouteSegment[] {
  return ordered.slice(0, -1).map((b, i) => computeSegment(b, ordered[i + 1]));
}

// ── TSP ───────────────────────────────────────────────────────
function solveTSP(booths: Booth[]): Booth[] {
  if (booths.length <= 1) return booths;
  const d = (a: Booth, b: Booth) =>
    Math.hypot(a.location.x - b.location.x, a.location.y - b.location.y);
  let best: Booth[] = [], bestDist = Infinity;
  for (let si = 0; si < booths.length; si++) {
    const rem = [...booths], route: Booth[] = [rem.splice(si, 1)[0]];
    while (rem.length) {
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
}

// ── 즐겨찾기 ─────────────────────────────────────────────────
const loadFavs = (): Set<string> => {
  try { const r = localStorage.getItem(FAV_KEY); return r ? new Set(JSON.parse(r)) : new Set(); } catch { return new Set(); }
};
const saveFavs = (s: Set<string>) => { try { localStorage.setItem(FAV_KEY, JSON.stringify([...s])); } catch {} };

// ── 컴포넌트 ─────────────────────────────────────────────────
const MapArea: React.FC<MapAreaProps> = ({ selectedBooth, onBoothSelect }) => {
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState(SHEET_MIN);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0); const dragStartH = useRef(0); const dragStartT = useRef(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('A');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBooth, setModalBooth] = useState<Booth | null>(null);
  const [miniTooltip, setMiniTooltip] = useState<{ booth: Booth; x: number; y: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(0.5);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavs);
  const [mode, setMode] = useState<Mode>('search');
  const [selectedGate, setSelectedGate] = useState<GateId | null>(
    () => (localStorage.getItem(GATE_KEY) as GateId) || null
  );

  // 길찾기
  const [navStart, setNavStart] = useState<Booth | null>(null);
  const [navEnd,   setNavEnd]   = useState<Booth | null>(null);
  const [navSlot,  setNavSlot]  = useState<RouteSlot>(null);
  const [navResult, setNavResult] = useState<RouteSegment | null>(null);
  const [navPanelCollapsed, setNavPanelCollapsed] = useState(false);

  // 루트
  const [routeBooths, setRouteBooths] = useState<Booth[]>([]);
  const [multiResult, setMultiResult] = useState<{ ordered: Booth[]; segs: RouteSegment[] } | null>(null);

  // 핀치줌
  const pinchStartDistRef  = useRef<number | null>(null);
  const pinchStartZoomRef  = useRef<number>(1);
  const pinchStartScrollRef = useRef<{ left: number; top: number; centerX: number; centerY: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  // 초기 게이트 스크롤
  useEffect(() => {
    const w = mapWrapperRef.current; if (!w) return;
    if (selectedGate) {
      const gate = GATES.find(g => g.id === selectedGate);
      if (gate) setTimeout(() => {
        w.scrollLeft = Math.max(0, gate.scrollX * mapZoom - w.clientWidth / 2);
        w.scrollTop  = Math.max(0, gate.scrollY * mapZoom - w.clientHeight / 2);
      }, 100);
    } else { w.scrollLeft = 0; w.scrollTop = 0; }
  }, [selectedGate]);

  const toggleFav = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveFavs(next); return next;
    });
  }, []);

  const zoomToFit = useCallback((pts: PathPoint[]) => {
    const w = mapWrapperRef.current; if (!w || !pts.length) return;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const [mnX, mxX, mnY, mxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const PAD = 80;
    const zoom = Math.min(
      w.clientWidth  / (mxX - mnX + PAD * 2),
      (w.clientHeight - SHEET_MIN - 8) / (mxY - mnY + PAD * 2),
      MAX_ZOOM
    );
    const cz = Math.max(MIN_ZOOM, zoom);
    setMapZoom(cz); setSheetHeight(SHEET_MIN);
    setTimeout(() => {
      w.scrollTo({
        left: Math.max(0, (mnX + mxX) / 2 * cz - w.clientWidth / 2),
        top:  Math.max(0, (mnY + mxY) / 2 * cz - (w.clientHeight - SHEET_MIN) / 2),
        behavior: 'smooth',
      });
    }, 50);
  }, []);

  // 핀치줌 핸들러
  const handleMapTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      pinchStartDistRef.current = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      pinchStartZoomRef.current = mapZoom;
      const w = mapWrapperRef.current;
      if (w) pinchStartScrollRef.current = {
        left: w.scrollLeft, top: w.scrollTop,
        centerX: (t0.clientX + t1.clientX) / 2, centerY: (t0.clientY + t1.clientY) / 2,
      };
    }
  }, [mapZoom]);

  const handleMapTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoomRef.current * dist / pinchStartDistRef.current));
      setMapZoom(nz);
      const w = mapWrapperRef.current, ref = pinchStartScrollRef.current;
      if (w && ref) {
        const rect = w.getBoundingClientRect();
        const lx = ref.centerX - rect.left, ly = ref.centerY - rect.top;
        w.scrollLeft = (ref.left + lx) / pinchStartZoomRef.current * nz - lx;
        w.scrollTop  = (ref.top  + ly) / pinchStartZoomRef.current * nz - ly;
      }
    }
  }, []);

  const handleMapTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchStartDistRef.current = null;
  }, []);

  const handleMapDoubleTap = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const now = Date.now(), touch = e.touches[0];
    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      e.preventDefault();
      const w = mapWrapperRef.current; if (!w) return;
      const rect = w.getBoundingClientRect();
      const lx = touch.clientX - rect.left, ly = touch.clientY - rect.top;
      const mapX = (w.scrollLeft + lx) / mapZoom, mapY = (w.scrollTop + ly) / mapZoom;
      const nz = mapZoom >= MAX_ZOOM * 0.9 ? 1 : Math.min(MAX_ZOOM, mapZoom * 1.8);
      setMapZoom(nz);
      setTimeout(() => {
        if (!mapWrapperRef.current) return;
        mapWrapperRef.current.scrollLeft = mapX * nz - lx;
        mapWrapperRef.current.scrollTop  = mapY * nz - ly;
      }, 0);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
    }
  }, [mapZoom]);

  const handleZoomIn = useCallback(() => {
    const w = mapWrapperRef.current;
    setMapZoom(prev => {
      const next = Math.min(MAX_ZOOM, prev * 1.3);
      if (w) { const cx = w.scrollLeft + w.clientWidth/2, cy = w.scrollTop + w.clientHeight/2; setTimeout(() => { w.scrollLeft = cx/prev*next - w.clientWidth/2; w.scrollTop = cy/prev*next - w.clientHeight/2; }, 0); }
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    const w = mapWrapperRef.current;
    setMapZoom(prev => {
      const next = Math.max(MIN_ZOOM, prev / 1.3);
      if (w) { const cx = w.scrollLeft + w.clientWidth/2, cy = w.scrollTop + w.clientHeight/2; setTimeout(() => { w.scrollLeft = cx/prev*next - w.clientWidth/2; w.scrollTop = cy/prev*next - w.clientHeight/2; }, 0); }
      return next;
    });
  }, []);

  // 모드 전환
  const switchMode = useCallback((m: Mode) => {
    setMode(m); setMiniTooltip(null);
    if (m !== 'navigate')   setNavResult(null);
    if (m !== 'multiroute') setMultiResult(null);
    if (m !== 'search')     { onBoothSelect(null); setModalOpen(false); setModalBooth(null); }
    if (m === 'navigate')   setNavSlot(navStart ? (navEnd ? null : 'end') : 'start');
    setNavPanelCollapsed(false);
  }, [navStart, navEnd, onBoothSelect]);

  // 길찾기
  const runNavSearch = useCallback((from: Booth, to: Booth) => {
    if (!from?.location || !to?.location) return;
    const seg = computeSegment(from, to);
    setNavResult(seg); setNavPanelCollapsed(false); zoomToFit(seg.path);
  }, [zoomToFit]);

  const assignNavPoint = useCallback((booth: Booth) => {
    if (!navSlot) return;
    setNavResult(null); setNavPanelCollapsed(false);
    if (navSlot === 'start') {
      setNavStart(booth);
      setNavSlot(navEnd ? null : 'end');
      if (navEnd) setTimeout(() => runNavSearch(booth, navEnd), 0);
    } else {
      setNavEnd(booth);
      setNavSlot(navStart ? null : 'start');
      if (navStart) setTimeout(() => runNavSearch(navStart, booth), 0);
    }
  }, [navSlot, navStart, navEnd, runNavSearch]);

  // 루트
  const toggleRouteBooth = useCallback((booth: Booth) => {
    setMultiResult(null);
    setRouteBooths(prev =>
      prev.some(b => b.id === booth.id) ? prev.filter(b => b.id !== booth.id) : [...prev, booth]
    );
  }, []);

  const handleMultiSearch = useCallback(() => {
    if (routeBooths.length < 2) return;
    const ordered = solveTSP(routeBooths);
    const segs = computeChained(ordered);
    setMultiResult({ ordered, segs });
    zoomToFit(segs.flatMap(s => s.path));
  }, [routeBooths, zoomToFit]);

  const displayRouteBooths = multiResult ? multiResult.ordered : routeBooths;
  const getRouteOrder = (id: string) => displayRouteBooths.findIndex(b => b.id === id) + 1;

  // 클릭
  const handleBlockClick = (booth: Booth) => {
    setMiniTooltip(null);
    if (mode === 'navigate')   { assignNavPoint(booth); return; }
    if (mode === 'multiroute') { toggleRouteBooth(booth); return; }
    onBoothSelect(booth); setModalBooth(booth); setModalOpen(true);
  };

  const handleBlockClickWithTooltip = (booth: Booth) => {
    if (mode === 'search') { handleBlockClick(booth); return; }
    const w = mapWrapperRef.current;
    if (!w || !booth.location || !booth.size) return;
    const rect = w.getBoundingClientRect();
    const sx = (booth.location.x * mapZoom) - w.scrollLeft + rect.left;
    const sy = ((booth.location.y - booth.size.h / 2) * mapZoom) - w.scrollTop + rect.top;
    setMiniTooltip({ booth, x: sx, y: sy });
  };

  const handleCardClick = (booth: Booth) => {
    if (mode === 'navigate')   { assignNavPoint(booth); return; }
    if (mode === 'multiroute') { setModalBooth(booth); setModalOpen(true); return; }
    if (selectedBooth?.id === booth.id) { setModalBooth(booth); setModalOpen(true); return; }
    onBoothSelect(booth); setModalBooth(booth); setSheetHeight(SHEET_MIN); setModalOpen(false);
  };

  useEffect(() => {
    if (mode === 'search' && selectedBooth?.location && mapWrapperRef.current) {
      const w = mapWrapperRef.current;
      w.scrollTo({
        left: Math.max(0, selectedBooth.location.x * mapZoom - w.clientWidth / 2),
        top:  Math.max(0, selectedBooth.location.y * mapZoom - w.clientHeight / 2),
        behavior: 'smooth',
      });
    }
  }, [selectedBooth, mode]);

  // 드래그 (바텀시트)
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
    const dy = dragStartY.current - y, dt = Date.now() - dragStartT.current;
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

  const boothListRef = useRef<HTMLDivElement>(null);
  const lastListScrollTop = useRef(0);
  const handleBoothListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (mode !== 'navigate' || !navResult) return;
    const top = e.currentTarget.scrollTop;
    if (top > 10 && top > lastListScrollTop.current) setNavPanelCollapsed(true);
    else if (top < lastListScrollTop.current - 5 || top <= 0) setNavPanelCollapsed(false);
    lastListScrollTop.current = top;
  }, [mode, navResult]);

  // 필터
  const normalize = (s: string) => (s || '').replace(/[\s_]/g, '').toUpperCase();
  const matchBoothOrTenant = (b: Booth, raw: string): { matched: boolean; tenant?: Tenant } => {
    if (!raw) return { matched: true };
    const cs = normalize(raw);
    const sw = /^\d+$/.test(cs) && activeTab !== 'FAV' && activeTab !== 'FAC' ? activeTab + cs : cs;
    if (normalize(b.booth_number).includes(sw) || (b.publisher_name || '').toLowerCase().includes(raw.toLowerCase())) return { matched: true };
    for (const t of b.tenants ?? []) {
      if (normalize(t.booth_number).includes(sw) || (t.publisher_name || '').toLowerCase().includes(raw.toLowerCase()))
        return { matched: true, tenant: t };
    }
    return { matched: false };
  };

  const filteredBooths = useMemo(() => {
    if (activeTab === 'FAC') return [];
    return (boothsData as Booth[])
      .filter(b => {
        if (!b?.booth_number) return false;
        if (activeTab === 'FAV') return favorites.has(b.id);
        return b.booth_number.replace(/[\s_]/g, '').toUpperCase()[0] === activeTab;
      })
      .map(b => ({ booth: b, ...matchBoothOrTenant(b, searchTerm) }))
      .filter(r => r.matched)
      .map(r => ({ ...r.booth, _matchedTenant: r.tenant } as Booth & { _matchedTenant?: Tenant }));
  }, [searchTerm, activeTab, favorites]);

  const filteredFacilities = useMemo(() => {
    if (activeTab !== 'FAC') return [];
    return FACILITIES.filter(f => !searchTerm || f.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [activeTab, searchTerm]);

  const tenantMatchSearch = (t: Tenant) =>
    !!searchTerm && (normalize(t.booth_number).includes(normalize(searchTerm)) ||
      (t.publisher_name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  // 경로 선분 렌더
  const renderSegs = (pts: PathPoint[], cls: string, kp: string) =>
    pts.slice(0, -1).map((pt, i) => {
      const nx = pts[i + 1], dx = nx.x - pt.x, dy = nx.y - pt.y;
      const len = Math.hypot(dx, dy); if (len < 0.5) return null;
      return (
        <div key={`${kp}-${i}`} className={cls} style={{
          left: pt.x, top: pt.y, width: len,
          transform: `rotate(${Math.round(Math.atan2(dy, dx) * 180 / Math.PI)}deg)`,
        }} />
      );
    });

  const getFloor = (b: Booth) => hallKey(b) === 'A' ? '1층' : 'B1층';
  const getHall  = (b: Booth) => hallKey(b) === 'A' ? 'A홀' : 'B홀';

  // 에스컬레이터 표시 포인트
  const navEscPt = useMemo(() => {
    if (!navResult?.crossFloor || !navStart) return null;
    return nearestEsc(navStart.location);
  }, [navResult, navStart]);

  const multiDist = useMemo(() => {
    if (!multiResult) return null;
    let t = 0;
    multiResult.segs.forEach(s => {
      for (let i = 1; i < s.path.length; i++)
        t += Math.hypot(s.path[i].x - s.path[i-1].x, s.path[i].y - s.path[i-1].y);
    });
    return Math.round(t);
  }, [multiResult]);

  const scrollToFacility = (fac: FacilityItem) => {
    const w = mapWrapperRef.current; if (!w) return;
    w.scrollTo({
      left: Math.max(0, fac.location.x * mapZoom - w.clientWidth / 2),
      top:  Math.max(0, fac.location.y * mapZoom - w.clientHeight / 2),
      behavior: 'smooth',
    });
    setSheetHeight(SHEET_MIN);
  };

  // ── 렌더 ─────────────────────────────────────────────────
  return (
    <div className={styles.mapComponentWrapper}>
      <GateSelector
        inline
        currentGate={selectedGate}
        onSelect={gid => {
          setSelectedGate(gid);
          const gate = GATES.find(g => g.id === gid);
          if (gate && mapWrapperRef.current) {
            const w = mapWrapperRef.current;
            w.scrollTo({
              left: Math.max(0, gate.scrollX * mapZoom - w.clientWidth / 2),
              top:  Math.max(0, gate.scrollY * mapZoom - w.clientHeight / 2),
              behavior: 'smooth',
            });
          }
        }}
      />
      {!selectedGate && <GateSelector onSelect={gid => setSelectedGate(gid)} />}

      {/* 지도 영역 */}
      <div
        className={styles.mapWrapper}
        ref={mapWrapperRef}
        onTouchStart={handleMapTouchStart}
        onTouchMove={handleMapTouchMove}
        onTouchEnd={handleMapTouchEnd}
        onTouchStartCapture={handleMapDoubleTap}
        onClick={() => setMiniTooltip(null)}
      >
        <div className={styles.mapContainer} style={{ zoom: mapZoom } as React.CSSProperties}>
          <img src="/map.svg" alt="SIBF Map" className={styles.mapImage} />

          {/* 부스 블록 */}
          {(boothsData as Booth[]).map(booth => {
            if (!booth?.size || !booth?.location) return null;
            const inRoute = mode === 'multiroute' && displayRouteBooths.some(b => b.id === booth.id);
            const isActive =
              (mode === 'search' && selectedBooth?.id === booth.id) ||
              (mode === 'navigate' && (navStart?.id === booth.id || navEnd?.id === booth.id)) ||
              inRoute;
            const { w, h } = booth.size;
            return (
              <div
                key={booth.id}
                className={`${styles.boothBlock} ${isActive ? styles.activeBlock : ''} ${booth.is_zone ? styles.zoneBlock : ''}`}
                style={{ left: booth.location.x - w/2, top: booth.location.y - h/2, width: w, height: h }}
                onClick={e => { e.stopPropagation(); handleBlockClickWithTooltip(booth); }}
              >
                {w > 35 && (
                  <span className={styles.blockLabel}>
                    {booth.is_zone ? `${booth.booth_number} 공동관` : booth.booth_number}
                  </span>
                )}
              </div>
            );
          })}

          {/* 검색 선택 핀 */}
          {mode === 'search' && selectedBooth?.location && !modalOpen && (
            <div className={styles.selectionPin} style={{ left: selectedBooth.location.x, top: selectedBooth.location.y }} />
          )}

          {/* 길찾기: 핀 + 경로 + 에스컬레이터 마커(1개) */}
          {mode === 'navigate' && navStart?.location && (
            <div className={styles.routePinStart} style={{ left: navStart.location.x, top: navStart.location.y }} />
          )}
          {mode === 'navigate' && navEnd?.location && (
            <div className={styles.routePinEnd} style={{ left: navEnd.location.x, top: navEnd.location.y }} />
          )}
          {mode === 'navigate' && navResult && renderSegs(
            navResult.path,
            navResult.crossFloor ? styles.routeLineCrossFloor : styles.routeLine,
            'nav'
          )}
          {mode === 'navigate' && navResult?.crossFloor && navEscPt && (
            <div className={styles.escMarker} style={{ left: navEscPt.aEntry.x, top: navEscPt.aEntry.y }}>🪜</div>
          )}
          {mode === 'navigate' && navResult?.crossFloor && navStart && navEnd && navEscPt && (() => {
            const mid = navResult.path[Math.floor(navResult.path.length / 2)];
            return (
              <div className={styles.floorBadge} style={{ left: mid.x, top: mid.y }}>
                🪜 {getHall(navStart)} {getFloor(navStart)} → {getHall(navEnd)} {getFloor(navEnd)}
              </div>
            );
          })()}

          {/* 루트: 번호 핀 + 경로 + 에스컬레이터 마커(세그먼트별 1개) */}
          {mode === 'multiroute' && displayRouteBooths.map((booth, idx) =>
            booth.location ? (
              <div key={`mr-pin-${booth.id}`} className={styles.multiRoutePinNum}
                style={{ left: booth.location.x, top: booth.location.y }}>
                {idx + 1}
              </div>
            ) : null
          )}
          {mode === 'multiroute' && multiResult && multiResult.segs.map((seg, si) =>
            renderSegs(seg.path, seg.crossFloor ? styles.routeLineCrossFloor : styles.routeLineMulti, `mr-${si}`)
          )}
          {mode === 'multiroute' && multiResult && multiResult.segs.map((seg, si) => {
            if (!seg.crossFloor) return null;
            const fromBooth = multiResult.ordered[si];
            if (!fromBooth?.location) return null;
            const esc = nearestEsc(fromBooth.location);
            return (
              <div key={`mr-esc-${si}`} className={styles.escMarker}
                style={{ left: esc.aEntry.x, top: esc.aEntry.y }}>🪜</div>
            );
          })}
        </div>

        {/* 미니 툴팁 */}
        {miniTooltip && (
          <div
            className={styles.miniTooltip}
            style={{ position: 'fixed', left: miniTooltip.x, top: miniTooltip.y, transform: 'translate(-50%, -120%)', zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.miniTooltipName}>{miniTooltip.booth.publisher_name || miniTooltip.booth.booth_number}</div>
            <div className={styles.miniTooltipSub}>{miniTooltip.booth.booth_number}</div>
            {mode === 'navigate' && (
              <div className={styles.miniTooltipActions}>
                <button className={styles.miniTooltipBtn} style={{ background: '#2ecc71' }}
                  onClick={() => { setNavSlot('start'); assignNavPoint(miniTooltip.booth); setMiniTooltip(null); }}>출발</button>
                <button className={styles.miniTooltipBtn} style={{ background: '#ff3b30' }}
                  onClick={() => { setNavSlot('end');   assignNavPoint(miniTooltip.booth); setMiniTooltip(null); }}>도착</button>
              </div>
            )}
            {mode === 'multiroute' && (
              <div className={styles.miniTooltipActions}>
                <button className={styles.miniTooltipBtn}
                  style={{ background: displayRouteBooths.some(b => b.id === miniTooltip.booth.id) ? '#ff3b30' : '#6c35de' }}
                  onClick={() => { toggleRouteBooth(miniTooltip.booth); setMiniTooltip(null); }}>
                  {displayRouteBooths.some(b => b.id === miniTooltip.booth.id) ? '제거' : '추가'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 줌 버튼 */}
      <div className={styles.zoomBtnGroup}>
        <button className={styles.zoomBtn} onClick={handleZoomIn}>＋</button>
        <button className={styles.zoomBtn} onClick={handleZoomOut}>－</button>
      </div>

      {/* 바텀 시트 */}
      <div className={styles.bottomSheet} style={{ height: sheetHeight }}>
        <div className={styles.sheetHandleWrapper} onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
          <div className={styles.sheetHandle} />
        </div>
        <div className={styles.sheetContent}>
          <h3 className={styles.sheetTitle}>📜 부스 검색</h3>

          {/* 모드 전환 탭 */}
          <div className={styles.modeToggleWrapper}>
            <button className={`${styles.modeBtn} ${mode === 'search'     ? styles.modeBtnActive : ''}`} onClick={() => switchMode('search')}>🔍 검색</button>
            <button className={`${styles.modeBtn} ${mode === 'navigate'   ? styles.modeBtnActive : ''}`} onClick={() => switchMode('navigate')}>🧭 길찾기</button>
            <button className={`${styles.modeBtn} ${mode === 'multiroute' ? styles.modeBtnActive : ''}`} onClick={() => switchMode('multiroute')}>🗺️ 루트</button>
          </div>

          {/* 길찾기 패널 */}
          {mode === 'navigate' && (
            <div className={`${styles.navPanel} ${navPanelCollapsed ? styles.navPanelCollapsed : ''}`}>
              <div className={styles.navPanelInner}>
                <div className={styles.routeSlots}>
                  <div className={`${styles.routeSlot} ${navSlot === 'start' ? styles.routeSlotActive : ''}`}
                    onClick={() => { setNavSlot('start'); setNavPanelCollapsed(false); }}>
                    <span className={styles.routeSlotDot} style={{ backgroundColor: '#2ecc71' }} />
                    <span className={styles.routeSlotLabel}>출발</span>
                    {navStart
                      ? <span className={styles.routeSlotValue}>{navStart.publisher_name || navStart.booth_number} ({navStart.booth_number})</span>
                      : <span className={styles.routeSlotPlaceholder}>출발 부스를 선택하세요</span>}
                  </div>
                  <div className={`${styles.routeSlot} ${navSlot === 'end' ? styles.routeSlotActive : ''}`}
                    onClick={() => { setNavSlot('end'); setNavPanelCollapsed(false); }}>
                    <span className={styles.routeSlotDot} style={{ backgroundColor: '#ff3b30' }} />
                    <span className={styles.routeSlotLabel}>도착</span>
                    {navEnd
                      ? <span className={styles.routeSlotValue}>{navEnd.publisher_name || navEnd.booth_number} ({navEnd.booth_number})</span>
                      : <span className={styles.routeSlotPlaceholder}>도착 부스를 선택하세요</span>}
                  </div>
                  {navStart && navEnd && (
                    <button className={styles.routeSearchBtn}
                      onClick={() => runNavSearch(navStart, navEnd)}>🔎 경로 보기</button>
                  )}
                  {navResult && (
                    <div className={styles.routeSummary}>
                      📍 {getHall(navStart!)} {getFloor(navStart!)} → {getHall(navEnd!)} {getFloor(navEnd!)}
                      {navResult.crossFloor && (
                        <div className={styles.routeFloorWarning}>⚠️ 층이 달라요. 에스컬레이터로 이동이 필요해요.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {navPanelCollapsed && (
                <div className={styles.navPanelCollapsedBar} onClick={() => setNavPanelCollapsed(false)}>
                  <span className={styles.navPanelCollapsedDot} style={{ backgroundColor: '#2ecc71' }} />
                  <span className={styles.navPanelCollapsedText}>{navStart ? (navStart.publisher_name || navStart.booth_number) : '출발'}</span>
                  <span className={styles.navPanelCollapsedArrow}>→</span>
                  <span className={styles.navPanelCollapsedDot} style={{ backgroundColor: '#ff3b30' }} />
                  <span className={styles.navPanelCollapsedText}>{navEnd ? (navEnd.publisher_name || navEnd.booth_number) : '도착'}</span>
                  <span className={styles.navPanelExpandIcon}>∧</span>
                </div>
              )}
            </div>
          )}

          {/* 루트 패널 */}
          {mode === 'multiroute' && (
            <div className={styles.routeSlots}>
              {displayRouteBooths.length > 0 ? (
                <div className={styles.routeBoothsList}>
                  {displayRouteBooths.map((b, idx) => (
                    <div key={b.id} className={styles.routeBoothItem}>
                      <span className={styles.routeBoothIdx}>{idx + 1}</span>
                      <span className={styles.routeBoothName}>{b.publisher_name || b.booth_number} ({b.booth_number})</span>
                      <button className={styles.routeBoothRemoveBtn} onClick={() => toggleRouteBooth(b)}>✕</button>
                    </div>
                  ))}
                  <button className={styles.routeClearBtn} onClick={() => { setRouteBooths([]); setMultiResult(null); }}>전체 초기화</button>
                </div>
              ) : (
                <p className={styles.routeBoothsHint}>아래 목록에서 2개 이상의 부스를 선택하세요</p>
              )}
              {displayRouteBooths.length >= 2 && (
                <button className={styles.routeSearchBtn} onClick={handleMultiSearch}>🔎 최단 루트 보기</button>
              )}
              {multiResult && (
                <div className={styles.routeSummary}>🗺️ {multiResult.ordered.length}개 부스 최단 루트 (약 {multiDist}px 동선)</div>
              )}
            </div>
          )}

          {/* 검색 바 */}
          <div className={styles.searchBarWrapper}>
            <input
              type="text" className={styles.searchInput}
              placeholder={
                mode === 'navigate'   ? `${navSlot === 'end' ? '도착' : '출발'} 부스 검색...` :
                mode === 'multiroute' ? '추가할 부스 검색...' :
                '출판사명 또는 부스 번호 검색...'
              }
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && <button className={styles.searchClearBtn} onClick={() => setSearchTerm('')}>✕</button>}
          </div>

          {/* 탭 */}
          <div className={styles.tabWrapper}>
            <button className={`${styles.tabBtn} ${activeTab === 'A'   ? styles.activeTab : ''}`} onClick={() => setActiveTab('A')}>A홀</button>
            <button className={`${styles.tabBtn} ${activeTab === 'B'   ? styles.activeTab : ''}`} onClick={() => setActiveTab('B')}>B홀</button>
            <button className={`${styles.tabBtn} ${activeTab === 'FAC' ? styles.activeTab : ''}`} onClick={() => setActiveTab('FAC')}>🏗️ 편의</button>
            <button className={`${styles.tabBtn} ${activeTab === 'FAV' ? styles.activeTab : ''}`} onClick={() => setActiveTab('FAV')}>⭐</button>
          </div>

          {/* 카드 리스트 */}
          <div className={styles.boothList} ref={boothListRef} onScroll={handleBoothListScroll}>

            {/* 편의시설 탭 */}
            {activeTab === 'FAC' && filteredFacilities.map(fac => (
              <div key={fac.id} className={styles.boothCard} onClick={() => {
                const fb = facilityToBooth(fac);
                if (mode === 'navigate')   assignNavPoint(fb);
                else if (mode === 'multiroute') toggleRouteBooth(fb);
                else scrollToFacility(fac);
              }}>
                <div className={styles.cardRow}>
                  <div className={styles.cardMain}>
                    <h4>{fac.emoji} {fac.label}</h4>
                    <p>{fac.hall}홀 · {
                      fac.type === 'toilet' ? '화장실' :
                      fac.type === 'info'   ? '인포·티켓 데스크' :
                      fac.type === 'gate'   ? '출입구' : '에스컬레이터'
                    }</p>
                  </div>
                  {mode === 'multiroute' && (
                    <div className={styles.cardActions}>
                      <button
                        className={`${styles.addRouteBtn} ${displayRouteBooths.some(b => b.id === fac.id) ? styles.addRouteBtnActive : ''}`}
                        onClick={e => { e.stopPropagation(); toggleRouteBooth(facilityToBooth(fac)); }}
                      >
                        {displayRouteBooths.some(b => b.id === fac.id) ? getRouteOrder(fac.id) : '+'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* 부스 탭 */}
            {activeTab !== 'FAC' && (filteredBooths.length > 0 ? filteredBooths.map((b: any) => {
              const inRoute = mode === 'multiroute' && displayRouteBooths.some(rb => rb.id === b.id);
              const routeOrder = inRoute ? getRouteOrder(b.id) : 0;
              const isFav = favorites.has(b.id);
              const isSelected =
                (mode === 'search'     && selectedBooth?.id === b.id) ||
                (mode === 'navigate'   && (navStart?.id === b.id || navEnd?.id === b.id)) ||
                inRoute;
              return (
                <div key={b.id} className={`${styles.boothCard} ${isSelected ? styles.selectedCard : ''}`} onClick={() => handleCardClick(b)}>
                  <div className={styles.cardRow}>
                    <div className={styles.cardMain}>
                      {b._matchedTenant ? (
                        <><h4>{b._matchedTenant.publisher_name}</h4>
                          <p>위치: {b.gate} ({b._matchedTenant.booth_number} · {b.booth_number} 공동관 내)</p></>
                      ) : (
                        <><h4>{b.publisher_name || `${b.booth_number} 부스 구역`}</h4>
                          <p>위치: {b.gate} ({b.booth_number}){b.is_zone && ` · 입주사 ${b.tenants?.length ?? 0}곳`}</p></>
                      )}
                    </div>
                    <div className={styles.cardActions}>
                      {mode === 'multiroute' && (
                        <button className={`${styles.addRouteBtn} ${inRoute ? styles.addRouteBtnActive : ''}`}
                          onClick={e => { e.stopPropagation(); toggleRouteBooth(b); }}>
                          {inRoute ? routeOrder : '+'}
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
                {activeTab === 'FAV' ? '즐겨찾기한 부스가 없어요.' : '검색 결과가 없습니다. 😥'}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* 모달 */}
      {modalOpen && modalBooth && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalBadge}>{modalBooth.is_zone ? '공동관 정보' : '부스 정보'}</span>
              <div className={styles.modalHeaderActions}>
                <button className={`${styles.modalFavBtn} ${favorites.has(modalBooth.id) ? styles.modalFavBtnActive : ''}`}
                  onClick={() => toggleFav(modalBooth.id)}>
                  {favorites.has(modalBooth.id) ? '⭐ 해제' : '☆ 즐겨찾기'}
                </button>
                <button className={styles.modalCloseBtn} onClick={() => setModalOpen(false)}>✕</button>
              </div>
            </div>
            <h2 className={styles.modalTitle}>
              {modalBooth.is_zone
                ? `${modalBooth.booth_number} 독립출판 마켓 공동관`
                : (modalBooth.publisher_name || `${modalBooth.booth_number} 구역`)}
            </h2>
            <div className={styles.modalDivider} />
            <p className={styles.modalMeta}>📍 <strong>위치:</strong> {modalBooth.gate} ({modalBooth.booth_number})</p>
            {modalBooth.category && !modalBooth.is_zone && (
              <p className={styles.modalMeta}>🏷️ <strong>분류:</strong> {modalBooth.category}</p>
            )}
            {modalBooth.is_zone && modalBooth.tenants ? (
              <>
                <p className={styles.modalDesc}>이 구역에는 {modalBooth.tenants.length}개 독립출판사가 함께 입주해 있습니다.</p>
                <div style={{ maxHeight: '40vh', overflowY: 'auto', marginTop: 8 }}>
                  {modalBooth.tenants.map(t => (
                    <div key={t.booth_number} style={{
                      padding: '8px 10px', marginBottom: 4, borderRadius: 8,
                      background: tenantMatchSearch(t) ? 'rgba(0,122,255,0.12)' : 'transparent',
                      border: tenantMatchSearch(t) ? '1px solid #007AFF' : '1px solid transparent',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{t.publisher_name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{t.booth_number} · {t.category}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.modalDesc}>서울국제도서전 해당 부스에서 다양한 이벤트와 신간 도서 전시가 진행 중입니다.</p>
            )}
            {mode === 'multiroute' && (
              <button className={styles.routeSearchBtn}
                style={{ marginTop: 14, backgroundColor: displayRouteBooths.some(b => b.id === modalBooth.id) ? '#ff3b30' : '#6c35de' }}
                onClick={() => { toggleRouteBooth(modalBooth); setModalOpen(false); }}>
                {displayRouteBooths.some(b => b.id === modalBooth.id) ? '✕ 루트에서 제거' : '＋ 루트에 추가'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapArea;