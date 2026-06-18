import React, { useState } from 'react';
import styles from './Login.module.css';

interface LoginProps {
  onLoginSuccess: (nickname: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError('');

    // 임시 Mock 로그인 처리를 위해 0.5초 뒤에 바로 통과시킵니다.
    setTimeout(() => {
      const trimmedName = nickname.trim();
      
      // 기획 스펙 4번: 브라우저 세션(탭 닫히면 날아감)에 저장하여 휘발성 처리
      sessionStorage.setItem('nickname', trimmedName);
      
      // 로그인 성공 상태를 부모(App.tsx)로 전달
      onLoginSuccess(trimmedName);
      setLoading(false);
    }, 500);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>📚 도서전 비밀 배치도</h2>
      <p className={styles.subtitle}>친구와 공유할 닉네임을 입력하세요. (임시 모드)</p>
      <form onSubmit={handleLogin} className={styles.form}>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임 입력 (예: 곰돌이)"
          disabled={loading}
          className={styles.input}
        />
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? '확인 중...' : '입장하기'}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}