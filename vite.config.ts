import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'map.png'],
      manifest: {
        name: '서울국제도서전 비밀 배치도',
        short_name: '도서전배치도',
        description: '오프라인 구동 및 실시간 위치 공유가 가능한 도서전 부스 지도',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // 빌드 시 배치도 데이터(.json)와 이미지 등 모든 자산을 캐싱 목록에 포함
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        // 대용량 배치도 이미지(map.png) 유실을 막기 위해 캐싱 한도를 10MB로 확장
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, 
      }
    })
  ],
  server: {
    host: true,
  }
});