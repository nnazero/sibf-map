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
    const [activeGate, setActiveGate] = useState<string>('A홀 출입구');
    const gates = Array.from(new Set(boothsData.map((b) => b.gate)));
    const filteredBooths = boothsData.filter((b) => b.gate === activeGate);

    return (
        <aside className={styles.sidebar}>
        <div className={styles.handle} />
        <div className={styles.title}>🚪 출입구별 부스</div>
        <div className={styles.tabContainer}>
            {gates.map((gate) => (
            <button
                key={gate}
                className={`${styles.tabButton} ${activeGate === gate ? styles.activeTab : ''}`}
                onClick={() => setActiveGate(gate)}
            >
                {gate.replace(' 출입구', '')}
            </button>
            ))}
        </div>

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