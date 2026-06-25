import { useState } from 'react';
import MapArea from './components/MapArea';
import styles from './App.module.css';
import logoSvg from './assets/logo.svg';

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
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);

  const handleResetData = () => {
    if (confirm('즐겨찾기와 출입구 설정을 초기화하시겠습니까?')) {
      localStorage.removeItem('sibf_favorites');
      localStorage.removeItem('sibf_gate');
      setSelectedBooth(null);
      window.location.reload();
    }
  };

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <div className={styles.appTitle}>
          <img src={logoSvg} alt="도서전 로고" className={styles.logoImg} />
          <p className={styles.appName}>서울국제도서전</p>
        </div>
        <button onClick={handleResetData} className={styles.resetButton}>초기화 🗑️</button>
      </header>

      <div className={styles.mainLayout}>
        <main style={{ width: '100%', height: '100%', position: 'relative' }}>
          <MapArea
            selectedBooth={selectedBooth}
            onBoothSelect={setSelectedBooth}
          />
        </main>
      </div>
    </div>
  );
}