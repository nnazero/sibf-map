import React from 'react';
import { Booth, RouteSegment, PathPoint } from '../utils/pathfinding';
import styles from './MapCanvas.module.css';

const MAP_W = 2000;
const MAP_H = 2000;

interface Props {
  booths: Booth[];
  mode: 'search' | 'navigate' | 'multiroute';
  zoom: number;
  offset: { x: number; y: number };
  animating: boolean;
  selectedBooth: Booth | null;
  navStart: Booth | null;
  navEnd: Booth | null;
  navResult: RouteSegment | null;
  routeBooths: Booth[];
  multiResult: { ordered: Booth[]; segs: RouteSegment[] } | null;
  modalOpen: boolean;
  gestureHandlers: React.HTMLAttributes<HTMLDivElement>;
  onBoothClick: (b: Booth) => void;
  onWrapperClick: () => void;
  wrapperRef: React.RefObject<HTMLDivElement>;
  children?: React.ReactNode; // 미니툴팁 등
}

const MapCanvas: React.FC<Props> = ({
  booths, mode, zoom, offset, animating,
  selectedBooth, navStart, navEnd, navResult,
  routeBooths, multiResult, modalOpen,
  gestureHandlers, onBoothClick, onWrapperClick,
  wrapperRef, children,
}) => {
  const displayRouteBooths = multiResult ? multiResult.ordered : routeBooths;

  const renderSegs = (pts: PathPoint[], cls: string, kp: string) =>
    pts.slice(0, -1).map((pt, i) => {
      const nx = pts[i + 1], dx = nx.x - pt.x, dy = nx.y - pt.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return null;
      return (
        <div key={`${kp}-${i}`} className={cls} style={{
          left: pt.x, top: pt.y, width: len,
          transform: `rotate(${Math.round(Math.atan2(dy, dx) * 180 / Math.PI)}deg)`,
        }} />
      );
    });

  const mapTransform = `translate(${offset.x}px,${offset.y}px) scale(${zoom})`;
  const mapTransition = animating ? 'transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      {...gestureHandlers}
      onClick={onWrapperClick}
    >
      {/* 맵 transform 컨테이너 */}
      <div
        className={styles.container}
        style={{ transform: mapTransform, transition: mapTransition, willChange: 'transform' }}
      >
        <img
          src="/map.svg" alt="SIBF Map"
          style={{ display: 'block', width: MAP_W, height: MAP_H, userSelect: 'none', pointerEvents: 'none' }}
        />

        {/* 부스 블록 */}
        {booths.map(booth => {
          if (!booth?.size || !booth?.location) return null;
          const inRoute = mode === 'multiroute' && displayRouteBooths.some(b => b.id === booth.id);
          const isActive =
            (mode === 'search'     && selectedBooth?.id === booth.id) ||
            (mode === 'navigate'   && (navStart?.id === booth.id || navEnd?.id === booth.id)) ||
            inRoute;
          const { w, h } = booth.size;
          return (
            <div
              key={booth.id}
              className={`${styles.boothBlock} ${isActive ? styles.activeBlock : ''} ${booth.is_zone ? styles.zoneBlock : ''}`}
              style={{ left: booth.location.x - w/2, top: booth.location.y - h/2, width: w, height: h }}
              onClick={e => { e.stopPropagation(); onBoothClick(booth); }}
            >
              {w > 35 && (
                <span className={styles.blockLabel}>
                  {booth.is_zone ? `${booth.booth_number} 공동관` : booth.booth_number}
                </span>
              )}
            </div>
          );
        })}

        {/* 검색 핀 */}
        {mode === 'search' && selectedBooth?.location && !modalOpen && (
          <div className={styles.pinSelection} style={{ left: selectedBooth.location.x, top: selectedBooth.location.y }} />
        )}

        {/* 길찾기 핀 + 경로 */}
        {mode === 'navigate' && navStart?.location && (
          <div className={styles.pinStart} style={{ left: navStart.location.x, top: navStart.location.y }} />
        )}
        {mode === 'navigate' && navEnd?.location && (
          <div className={styles.pinEnd} style={{ left: navEnd.location.x, top: navEnd.location.y }} />
        )}
        {mode === 'navigate' && navResult && renderSegs(
          navResult.path,
          navResult.crossFloor ? styles.routeLineCross : styles.routeLine,
          'nav'
        )}
        {mode === 'navigate' && navResult?.crossFloor && navResult.escPt && (
          <div className={styles.escMarker} style={{ left: navResult.escPt.x, top: navResult.escPt.y }}>🪜</div>
        )}
        {mode === 'navigate' && navResult?.crossFloor && navStart && navEnd && navResult.escPt && (() => {
          const mid = navResult.path[Math.floor(navResult.path.length / 2)];
          const getFloor = (b: Booth) => b.booth_number.startsWith('A') ? '1층' : 'B1층';
          const getHall  = (b: Booth) => b.booth_number.startsWith('A') ? 'A홀' : 'B홀';
          return (
            <div className={styles.floorBadge} style={{ left: mid.x, top: mid.y }}>
              🪜 {getHall(navStart)} {getFloor(navStart)} → {getHall(navEnd)} {getFloor(navEnd)}
            </div>
          );
        })()}

        {/* 루트 핀 + 경로 */}
        {mode === 'multiroute' && displayRouteBooths.map((booth, idx) =>
          booth.location ? (
            <div key={`mr-pin-${booth.id}`} className={styles.pinRoute}
              style={{ left: booth.location.x, top: booth.location.y }}>
              {idx + 1}
            </div>
          ) : null
        )}
        {mode === 'multiroute' && multiResult && multiResult.segs.map((seg, si) =>
          renderSegs(seg.path, seg.crossFloor ? styles.routeLineCross : styles.routeLineMulti, `mr-${si}`)
        )}
        {mode === 'multiroute' && multiResult && multiResult.segs.map((seg, si) =>
          seg.crossFloor && seg.escPt ? (
            <div key={`mr-esc-${si}`} className={styles.escMarker} style={{ left: seg.escPt.x, top: seg.escPt.y }}>🪜</div>
          ) : null
        )}
      </div>

      {/* 뷰포트 위에 렌더되는 오버레이 (미니툴팁 등) */}
      {children}
    </div>
  );
};

export default MapCanvas;