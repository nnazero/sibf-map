import { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import MapArea from './components/MapArea';
import styles from './App.module.css';

interface Booth {
  id: string;
  name: string;
  gate: string;
  category: string;
  location: { x: number; y: number };
  description: string;
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

  const handleBoothSelect = (booth: Booth) => {
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
        {/* 지도가 배경 전체 레이어를 차지 */}
        <main style={{ width: '100%', height: '100%', position: 'relative' }}>
          <MapArea selectedBooth={selectedBooth} />
        </main>

        {/* 하단 모바일 슬라이드 시트 구조로 사이드바 결합 */}
        <div className={styles.sheetContainer}>
          <Sidebar onBoothSelect={handleBoothSelect} />
        </div>

        {/* 부스 터치/클릭 시 상단에 깔끔하게 카드 형태로 노출되는 디테일 창 */}
        {selectedBooth && (
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            padding: '12px 16px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 60
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#111' }}>📍 {selectedBooth.name}</h4>
              <button 
                onClick={() => setSelectedBooth(null)}
                style={{ border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer', color: '#999' }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>{selectedBooth.category}</p>
            {selectedBooth.description && (
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#444', borderTop: '1px solid #eee', paddingTop: '6px' }}>
                {selectedBooth.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}