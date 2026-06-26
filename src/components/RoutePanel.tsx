import React from 'react';
import { Booth } from '../utils/pathfinding';
import styles from './RoutePanel.module.css';

interface Props {
  booths: Booth[];
  totalDist: number | null;
  onRemove: (b: Booth) => void;
  onClear: () => void;
  onSearch: () => void;
}

const RoutePanel: React.FC<Props> = ({ booths, totalDist, onRemove, onClear, onSearch }) => (
  <div className={styles.container}>
    {booths.length > 0 ? (
      <div className={styles.list}>
        {booths.map((b, idx) => (
          <div key={b.id} className={styles.item}>
            <span className={styles.idx}>{idx + 1}</span>
            <span className={styles.name}>{b.publisher_name || b.booth_number} ({b.booth_number})</span>
            <button className={styles.removeBtn} onClick={() => onRemove(b)}>✕</button>
          </div>
        ))}
        <button className={styles.clearBtn} onClick={onClear}>전체 초기화</button>
      </div>
    ) : (
      <p className={styles.hint}>아래 목록에서 2개 이상의 부스를 선택하세요</p>
    )}

    {booths.length >= 2 && (
      <button className={styles.searchBtn} onClick={onSearch}>🔎 최단 루트 보기</button>
    )}

    {totalDist !== null && (
      <div className={styles.summary}>🗺️ {booths.length}개 부스 최단 루트 (약 {totalDist}px 동선)</div>
    )}
  </div>
);

export default RoutePanel;