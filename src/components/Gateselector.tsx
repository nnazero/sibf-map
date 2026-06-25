import { useEffect, useState, useRef } from 'react';
import styles from './Gateselector.module.css';
import logoSvg from '../assets/logo.svg';

export type GateId = 'gate-a1-out' | 'gate-a1-in' | 'gate-b1';

interface GateInfo {
  id: GateId;
  label: string;
  sublabel: string;
  emoji: string;
  hall: string;
  scrollX: number;
  scrollY: number;
}

const GATES: GateInfo[] = [
  { id: 'gate-a1-out', label: 'A홀 출구', sublabel: '서울 A홀 남측', emoji: '🚪', hall: 'A', scrollX: 492, scrollY: 1918 },
  { id: 'gate-a1-in', label: 'A홀 입구', sublabel: '서울 A홀 동측', emoji: '🚶', hall: 'A', scrollX: 1403, scrollY: 1918 },
  { id: 'gate-b1', label: 'B1홀 출입구', sublabel: 'B1홀 북측', emoji: '🏛️', hall: 'B', scrollX: 1836, scrollY: 422 },
];

const GATE_KEY = 'sibf_gate';

interface GateSelectorProps {
  onSelect: (gate: GateId) => void;
  inline?: boolean;
  currentGate?: GateId | null;
}

export default function GateSelector({ onSelect, inline, currentGate }: GateSelectorProps) {
  const saved = localStorage.getItem(GATE_KEY) as GateId | null;
  const [visible, setVisible] = useState(!inline && !saved);
  
  // 외부 클릭 감지를 위한 ref 생성
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 이벤트 핸들러
  useEffect(() => {
    if (!inline || !visible) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setVisible(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [inline, visible]);

  if (inline) {
    const current = GATES.find(g => g.id === currentGate);
    return (
      <div className={styles.inlineWrapper} ref={containerRef}>
        <button className={styles.inlineBtn} onClick={() => setVisible(prev => !prev)}>
          {current ? `${current.emoji} ${current.label}` : '🚪 출입구 선택'}
          <p className={styles.inlineBtnDownIcon}>▼</p>
        </button>
        {visible && (
          <div className={styles.popover}>
            <div className={styles.popoverTitle}>출입구 변경</div>
            {GATES.map(g => (
              <button
                key={g.id}
                className={`${styles.popoverItem} ${currentGate === g.id ? styles.popoverItemActive : ''}`}
                onClick={() => { onSelect(g.id); localStorage.setItem(GATE_KEY, g.id); setVisible(false); }}
              >
                <span className={styles.popoverEmoji}>{g.emoji}</span>
                <span>
                  <div className={styles.popoverLabel}>{g.label}</div>
                  <div className={styles.popoverSub}>{g.sublabel}</div>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src={logoSvg} alt="도서전 로고" className={styles.logoImg} />
        </div>
        <h1 className={styles.title}>서울국제도서전</h1>
        <p className={styles.subtitle}>입장하신 출입구를 선택해주세요.<br/>선택한 출입구 근처로 지도가 이동돼요.</p>
        <div className={styles.gateList}>
          {GATES.map(g => (
            <button
              key={g.id}
              className={styles.gateBtn}
              onClick={() => { onSelect(g.id); localStorage.setItem(GATE_KEY, g.id); setVisible(false); }}
            >
              <span className={styles.gateEmoji}>{g.emoji}</span>
              <span className={styles.gateText}>
                <span className={styles.gateLabel}>{g.label}</span>
                <span className={styles.gateSub}>{g.sublabel}</span>
              </span>
              <span className={styles.gateBadge}>{g.hall}홀</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { GATES, GATE_KEY };