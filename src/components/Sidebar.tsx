import React, { useState } from 'react';
import boothsData from '../data/booths.json';
import styles from './Sidebar.module.css';

// 부스 데이터의 타입 정의
interface Booth {
  id: string;
  name: string;
  gate: string;
  category: string;
  location: { x: number; y: number };
  description: string;
}

interface SidebarProps {
  onBoothSelect: (booth: Booth) => void;
}

export default function Sidebar({ onBoothSelect }: SidebarProps) {
  // 현재 어떤 출입구를 보고 있는지 선택하는 상태 (기본값: A홀 출입구)
  const [activeGate, setActiveGate] = useState<string>('A홀 출입구');

  // 중복 없는 출입구 리스트 추출 ('A홀 출입구', 'B홀 출입구' 등)
  const gates = Array.from(new Set(boothsData.map((b) => b.gate)));

  // 선택된 출입구에 속한 부스들만 필터링
  const filteredBooths = boothsData.filter((b) => b.gate === activeGate);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.title}>🚪 출입구별 부스</div>
      
      {/* 출입구 탭 버튼 세트 */}
      <div className={styles.tabContainer}>
        {gates.map((gate) => (
          <button
            key={gate}
            className={`${styles.tabButton} ${activeGate === gate ? styles.activeTab : ''}`}
            onClick={() => setActiveGate(gate)}
          >
            {gate.replace(' 출입구', '')} {/* 화면엔 깔끔하게 'A홀', 'B홀'만 노출 */}
          </button>
        ))}
      </div>

      {/* 필터링된 부스 리스트 */}
      <ul className={styles.listContainer}>
        {filteredBooths.map((booth) => (
          <li
            key={booth.id}
            className={styles.boothItem}
            onClick={() => onBoothSelect(booth)}
          >
            <div className={styles.boothName}>{booth.name}</div>
            <div className={styles.boothCategory}>{booth.category || '일반'}</div>
          </li>
        ))}
      </ul>
    </aside>
  );
}