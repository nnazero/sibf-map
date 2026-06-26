import React from 'react';
import { Booth } from '../utils/pathfinding';
import styles from './MiniTooltip.module.css';

interface Props {
  booth: Booth;
  x: number;
  y: number;
  mode: 'navigate' | 'multiroute';
  inRoute: boolean;
  onClose: () => void;
  onSetStart?: () => void;
  onSetEnd?: () => void;
  onToggleRoute?: () => void;
}

const MiniTooltip: React.FC<Props> = ({
  booth, x, y, mode, inRoute, onClose, onSetStart, onSetEnd, onToggleRoute,
}) => (
  <div
    className={styles.tooltip}
    style={{ position: 'fixed', left: x, top: y, transform: 'translate(-50%,-120%)', zIndex: 9999 }}
    onClick={e => e.stopPropagation()}
  >
    <div className={styles.name}>{booth.publisher_name || booth.booth_number}</div>
    <div className={styles.sub}>{booth.booth_number}</div>

    {mode === 'navigate' && (
      <div className={styles.actions}>
        <button className={styles.btn} style={{ background: '#2ecc71' }}
          onClick={() => { onSetStart?.(); onClose(); }}>출발</button>
        <button className={styles.btn} style={{ background: '#ff3b30' }}
          onClick={() => { onSetEnd?.(); onClose(); }}>도착</button>
      </div>
    )}

    {mode === 'multiroute' && (
      <div className={styles.actions}>
        <button className={styles.btn}
          style={{ background: inRoute ? '#ff3b30' : '#6c35de' }}
          onClick={() => { onToggleRoute?.(); onClose(); }}>
          {inRoute ? '제거' : '추가'}
        </button>
      </div>
    )}
  </div>
);

export default MiniTooltip;