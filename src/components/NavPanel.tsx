import React from 'react';
import { Booth } from '../utils/pathfinding';
import styles from './NavPanel.module.css';

interface Props {
  navStart: Booth | null;
  navEnd: Booth | null;
  navSlot: 'start' | 'end' | null;
  navResult: { crossFloor: boolean } | null;
  collapsed: boolean;
  onSelectSlot: (slot: 'start' | 'end') => void;
  onSearch: () => void;
  onCollapsedClick: () => void;
  getFloor: (b: Booth) => string;
  getHall: (b: Booth) => string;
}

const NavPanel: React.FC<Props> = ({
  navStart, navEnd, navSlot, navResult, collapsed,
  onSelectSlot, onSearch, onCollapsedClick, getFloor, getHall,
}) => (
  <div className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}>
    <div className={styles.inner}>
      <div className={styles.slots}>

        {/* 출발 슬롯 */}
        <div
          className={`${styles.slot} ${navSlot === 'start' ? styles.slotActive : ''}`}
          onClick={() => onSelectSlot('start')}
        >
          <span className={styles.dot} style={{ backgroundColor: '#2ecc71' }} />
          <span className={styles.label}>출발</span>
          {navStart
            ? <span className={styles.value}>{navStart.publisher_name || navStart.booth_number} ({navStart.booth_number})</span>
            : <span className={styles.placeholder}>출발 부스를 선택하세요</span>}
        </div>

        {/* 도착 슬롯 */}
        <div
          className={`${styles.slot} ${navSlot === 'end' ? styles.slotActive : ''}`}
          onClick={() => onSelectSlot('end')}
        >
          <span className={styles.dot} style={{ backgroundColor: '#ff3b30' }} />
          <span className={styles.label}>도착</span>
          {navEnd
            ? <span className={styles.value}>{navEnd.publisher_name || navEnd.booth_number} ({navEnd.booth_number})</span>
            : <span className={styles.placeholder}>도착 부스를 선택하세요</span>}
        </div>

        {navStart && navEnd && (
          <button className={styles.searchBtn} onClick={onSearch}>🔎 경로 보기</button>
        )}

        {navResult && navStart && navEnd && (
          <div className={styles.summary}>
            📍 {getHall(navStart)} {getFloor(navStart)} → {getHall(navEnd)} {getFloor(navEnd)}
            {navResult.crossFloor && (
              <div className={styles.warning}>⚠️ 층이 달라요. 에스컬레이터로 이동이 필요해요.</div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* 접혔을 때 요약 바 */}
    {collapsed && (
      <div className={styles.collapsedBar} onClick={onCollapsedClick}>
        <span className={styles.collapsedDot} style={{ backgroundColor: '#2ecc71' }} />
        <span className={styles.collapsedText}>{navStart ? (navStart.publisher_name || navStart.booth_number) : '출발'}</span>
        <span className={styles.collapsedArrow}>→</span>
        <span className={styles.collapsedDot} style={{ backgroundColor: '#ff3b30' }} />
        <span className={styles.collapsedText}>{navEnd ? (navEnd.publisher_name || navEnd.booth_number) : '도착'}</span>
        <span className={styles.expandIcon}>∧</span>
      </div>
    )}
  </div>
);

export default NavPanel;