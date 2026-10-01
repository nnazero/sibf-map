import React from 'react';
import { Booth } from '../utils/pathfinding';
import styles from './BoothModal.module.css';

interface Props {
  booth: Booth;
  isFav: boolean;
  onClose: () => void;
  onToggleFav: (id: string) => void;
  searchTerm?: string;
  mode: 'search' | 'navigate' | 'multiroute';
  inRoute: boolean;
  onToggleRoute: (b: Booth) => void;
}

const BoothModal: React.FC<Props> = ({
  booth, isFav, onClose, onToggleFav, searchTerm = '', mode, inRoute, onToggleRoute,
}) => {
  const normalize = (s: string) => (s || '').replace(/[\s_]/g, '').toUpperCase();
  const tenantMatch = (t: { booth_number: string; publisher_name: string }) =>
    !!searchTerm && (
      normalize(t.booth_number).includes(normalize(searchTerm)) ||
      t.publisher_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

const renderTitleText = (text: string) => {
    if (!text) return null;

    const items = text.split(',').map(item => item.trim()).filter(Boolean);
    
    const hasMore = items.length > 8;
    const displayItems = hasMore ? items.slice(0, 8) : items;

    return (
      <div className={styles.titleContainer}>
        {displayItems.map((item, index) => {
            const showComma = index < displayItems.length - 1 || hasMore;
            
            return (
                <div key={index} className={styles.titleLine}>
                {item}{showComma ? ',' : ''}
                </div>
            );
        })}
        {hasMore && <div className={styles.titleMore}>...</div>}
      </div>
    );
  };

  // 노출할 제목 원본 텍스트 결정
  const rawTitle = booth.is_zone
    ? `책마당`
    : (booth.publisher_name || `${booth.booth_number} 구역`);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className={styles.header}>
          <span className={styles.badge}>{booth.is_zone ? '공동관 정보' : '부스 정보'}</span>
          <div className={styles.headerActions}>
            <button
              className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ''}`}
              onClick={() => onToggleFav(booth.id)}
            >
              {isFav ? '⭐ 해제' : '☆ 즐겨찾기'}
            </button>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* 제목 (수정된 부분) */}
        <h2 className={styles.title}>
          {renderTitleText(rawTitle)}
        </h2>
        <div className={styles.divider} />

        {/* 메타 */}
        <p className={styles.meta}>📍 <strong>위치:</strong> {booth.gate} ({booth.booth_number})</p>
        {booth.category && !booth.is_zone && (
          <p className={styles.meta}>🏷️ <strong>분류:</strong> {booth.category}</p>
        )}

        {/* 공동관 입주사 목록 */}
        {booth.is_zone && booth.tenants ? (
          <>
            <p className={styles.desc}>이 구역에는 {booth.tenants.length}개 독립출판사가 함께 입주해 있습니다.</p>
            <div className={styles.tenantList}>
              {booth.tenants.map(t => (
                <div
                  key={t.booth_number}
                  className={`${styles.tenantItem} ${tenantMatch(t) ? styles.tenantItemHighlight : ''}`}
                >
                  <div className={styles.tenantName}>{t.publisher_name}</div>
                  <div className={styles.tenantSub}>{t.booth_number} · {t.category}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className={styles.desc}>서울국제도서전 해당 부스에서 다양한 이벤트와 신간 도서 전시가 진행 중입니다.</p>
        )}

        {/* 루트 추가/제거 버튼 */}
        {mode === 'multiroute' && (
          <button
            className={styles.routeBtn}
            style={{ backgroundColor: inRoute ? '#ff3b30' : '#6c35de' }}
            onClick={() => { onToggleRoute(booth); onClose(); }}
          >
            {inRoute ? '✕ 루트에서 제거' : '＋ 루트에 추가'}
          </button>
        )}
      </div>
    </div>
  );
};

export default BoothModal;