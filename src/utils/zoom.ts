export const MAP_W = 2000;
export const MAP_H = 2000;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;

/** 뷰포트 좌표 → 맵 SVG 좌표 */
export function viewToMap(vx: number, vy: number, zoom: number, ox: number, oy: number) {
  return { x: (vx - ox) / zoom, y: (vy - oy) / zoom };
}

/** 맵 SVG 좌표 → 뷰포트 좌표 */
export function mapToView(mx: number, my: number, zoom: number, ox: number, oy: number) {
  return { x: mx * zoom + ox, y: my * zoom + oy };
}

/** offset을 clamp해서 지도가 뷰포트 밖으로 나가지 않게 */
export function clampOffset(ox: number, oy: number, zoom: number, vw: number, vh: number) {
  const mapW = MAP_W * zoom;
  const mapH = MAP_H * zoom;
  const minOx = mapW < vw ? (vw - mapW) / 2 : vw - mapW;
  const maxOx = mapW < vw ? (vw - mapW) / 2 : 0;
  const minOy = mapH < vh ? (vh - mapH) / 2 : vh - mapH;
  const maxOy = mapH < vh ? (vh - mapH) / 2 : 0;
  return {
    x: Math.min(maxOx, Math.max(minOx, ox)),
    y: Math.min(maxOy, Math.max(minOy, oy)),
  };
}