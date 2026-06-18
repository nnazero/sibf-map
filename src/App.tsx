import { useState, useEffect } from 'react';
import Login from './components/Login';
import MapArea from './components/MapArea';
import styles from './App.module.css';

interface Booth {
  id: string;
  booth_number: string;
  gate: string;
  category: string;
  location: { x: number; y: number };
  size: { w: number; h: number };
  publisher_name: string;
}

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);

  useEffect(() => {
    const savedNickname = sessionStorage.getItem('nickname');
    if (savedNickname) setNickname(savedNickname);
  }, []);

  const handleLoginSuccess = (name: string) => setNickname(name);

  const handleResetData = () => {
    if (!nickname) return;
    if (confirm('모든 데이터를 초기화하시겠습니까?')) {
      sessionStorage.clear();
      setNickname(null);
      setSelectedBooth(null);
    }
  };

  const handleBoothSelect = (booth: Booth | null) => {
    setSelectedBooth(booth);
  };

  if (!nickname) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <span className={styles.nickname}>👤 {nickname}</span>
        <button onClick={handleResetData} className={styles.resetButton}>초기화 🗑️</button>
      </header>

      <div className={styles.mainLayout}>
        <main style={{ width: '100%', height: '100%', position: 'relative' }}>
          <MapArea 
            selectedBooth={selectedBooth} 
            onBoothSelect={handleBoothSelect} /* 👈 에러 해결의 핵심 자석 연결! */
          />
        </main>
      </div>
    </div>
  );
}