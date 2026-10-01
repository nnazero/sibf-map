import React, { useMemo } from 'react';
import { Booth } from '../utils/pathfinding';
import { FacilityItem, facilityToBooth, facilityTypeLabel } from '../utils/facilities';
import styles from './BoothList.module.css';

type TabType = 'A' | 'B' | 'FAC' | 'FAV';
type Mode = 'search' | 'navigate' | 'multiroute';

interface Props {
  booths: Booth[];
  facilities: FacilityItem[];
  activeTab: TabType;
  searchTerm: string;
  mode: Mode;
  selectedBooth: Booth | null;
  navStart: Booth | null;
  navEnd: Booth | null;
  routeBooths: Booth[];
  favorites: Set<string>;
  listRef: React.RefObject<HTMLDivElement>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onBoothClick: (b: Booth) => void;
  onFacilityClick: (f: FacilityItem) => void;
  onToggleFav: (id: string) => void;
  onToggleRoute: (b: Booth) => void;
  getRouteOrder: (id: string) => number;
}

const BoothList: React.FC<Props> = ({
  booths, facilities, activeTab, searchTerm, mode,
  selectedBooth, navStart, navEnd, routeBooths, favorites,
  listRef, onScroll, onBoothClick, onFacilityClick, onToggleFav, onToggleRoute, getRouteOrder,
}) => {
  const normalize = (s: string) => (s || '').replace(/[\s_]/g, '').toUpperCase();

  const routeBoothIds = useMemo(() => {
    return new Set(routeBooths.map(b => b.id));
  }, [routeBooths]);

  const favoriteBooths = useMemo(() => {
    return booths.filter(b => favorites.has(b.id));
  }, [booths, favorites]);

  const filteredBooths = useMemo(() => {
    if (activeTab === 'FAC') return [];

    const baseBooths = activeTab === 'FAV'
      ? favoriteBooths
      : booths;

    return baseBooths
      .filter(b => {
        if (!b?.booth_number) return false;
        if (activeTab === 'FAV') return true;
        return normalize(b.booth_number)[0] === activeTab;
      })
      .filter(b => {
        if (!searchTerm) return true;

        const cs = normalize(searchTerm);
        const sw = /^\d+$/.test(cs) && activeTab !== 'FAV' ? activeTab + cs : cs;
        const lowerTerm = searchTerm.toLowerCase();

        if (
          normalize(b.booth_number).includes(sw) ||
          b.publisher_name?.toLowerCase().includes(lowerTerm)
        ) return true;

        return b.tenants?.some(t =>
          normalize(t.booth_number).includes(sw) ||
          t.publisher_name?.toLowerCase().includes(lowerTerm)
        ) ?? false;
      });
  }, [booths, activeTab, searchTerm, favoriteBooths]);

  const filteredFacilities = useMemo(() => {
    if (activeTab !== 'FAC') return [];
    const lowerTerm = searchTerm.toLowerCase();
    return facilities.filter(f => !searchTerm || f.label.toLowerCase().includes(lowerTerm));
  }, [facilities, activeTab, searchTerm]);

  return (
    <div className={styles.list} ref={listRef} onScroll={onScroll}>

      {/* 편의시설 탭 */}
      {activeTab === 'FAC' && filteredFacilities.map(fac => {
        const inRoute = routeBoothIds.has(fac.id);
        return (
          <div key={fac.id} className={styles.card} onClick={() => onFacilityClick(fac)}>
            <div className={styles.cardRow}>
              <div className={styles.cardMain}>
                <h4>{fac.emoji} {fac.label}</h4>
                <p>{fac.hall}홀 · {facilityTypeLabel(fac.type)}</p>
              </div>
              {mode === 'multiroute' && (
                <div className={styles.cardActions}>
                  <button
                    className={`${styles.addRouteBtn} ${inRoute ? styles.addRouteBtnActive : ''}`}
                    onClick={e => { e.stopPropagation(); onToggleRoute(facilityToBooth(fac)); }}
                  >
                    {inRoute ? getRouteOrder(fac.id) : '+'}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 부스 탭 */}
      {activeTab !== 'FAC' && (filteredBooths.length > 0 ? filteredBooths.map(b => {
        const inRoute = mode === 'multiroute' && routeBoothIds.has(b.id);
        const isFav = favorites.has(b.id);
        const isSelected =
          (mode === 'search'     && selectedBooth?.id === b.id) ||
          (mode === 'navigate'   && (navStart?.id === b.id || navEnd?.id === b.id)) ||
          inRoute;
        return (
          <div
            key={b.id}
            className={`${styles.card} ${isSelected ? styles.selectedCard : ''}`}
            onClick={() => onBoothClick(b)}
          >
            <div className={styles.cardRow}>
              <div className={styles.cardMain}>
                <h4>{b.publisher_name || `${b.booth_number} 부스 구역`}</h4>
                <p>위치: {b.gate} ({b.booth_number}){b.is_zone ? ` · 입주사 ${b.tenants?.length ?? 0}곳` : ''}</p>
              </div>
              <div className={styles.cardActions}>
                {mode === 'multiroute' && (
                  <button
                    className={`${styles.addRouteBtn} ${inRoute ? styles.addRouteBtnActive : ''}`}
                    onClick={e => { e.stopPropagation(); onToggleRoute(b); }}
                  >
                    {inRoute ? getRouteOrder(b.id) : '+'}
                  </button>
                )}
                <button
                  className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ''}`}
                  onClick={e => { e.stopPropagation(); onToggleFav(b.id); }}
                >
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
  );
};

export default React.memo(BoothList);