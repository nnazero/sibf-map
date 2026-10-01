// ── 타입 ────────────────────────────────────────────────────
export interface PathPoint { x: number; y: number; }
export interface WalkGridData {
  originX: number; originY: number; cellSize: number;
  cols: number; rows: number; grid: number[][];
}
export interface RouteSegment { path: PathPoint[]; crossFloor: boolean; escPt?: PathPoint; }

// ── 에스컬레이터 연결점 ──────────────────────────────────────
export const ESC_LINKS = [
  { id: 1, worldPos: { x: 1084, y: 925 }, bExit: { x: 1081, y: 658 }, aEntry: { x: 1129, y: 974 } },
  { id: 2, worldPos: { x: 1396, y: 925 }, bExit: { x: 1391, y: 658 }, aEntry: { x: 1389, y: 974 } },
];

export function pickEsc(from: PathPoint) {
  return ESC_LINKS.reduce((best, esc) => {
    const dB = Math.hypot(best.worldPos.x - from.x, best.worldPos.y - from.y);
    const dC = Math.hypot(esc.worldPos.x  - from.x, esc.worldPos.y  - from.y);
    return dC < dB ? esc : best;
  });
}

// ── A* 내부 함수 ─────────────────────────────────────────────
function wToG(wg: WalkGridData, p: PathPoint) {
  return { c: Math.round((p.x - wg.originX) / wg.cellSize), r: Math.round((p.y - wg.originY) / wg.cellSize) };
}
function gToW(wg: WalkGridData, c: number, r: number): PathPoint {
  return { x: wg.originX + c * wg.cellSize, y: wg.originY + r * wg.cellSize };
}
function walkable(wg: WalkGridData, c: number, r: number) {
  if (r < 0 || r >= wg.rows || c < 0 || c >= wg.cols) return false;
  return wg.grid[r][c] === 1;
}
function nearestWalkable(wg: WalkGridData, c: number, r: number) {
  if (walkable(wg, c, r)) return { c, r };
  for (let rad = 1; rad <= 15; rad++)
    for (let dc = -rad; dc <= rad; dc++)
      for (let dr = -rad; dr <= rad; dr++) {
        if (Math.abs(dc) !== rad && Math.abs(dr) !== rad) continue;
        if (walkable(wg, c + dc, r + dr)) return { c: c + dc, r: r + dr };
      }
  return null;
}
function simplify(pts: PathPoint[], tol = 2): PathPoint[] {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > tol) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const DIRS4 = [[0,1],[0,-1],[1,0],[-1,0]] as const;

export function astar(wg: WalkGridData, from: PathPoint, to: PathPoint): PathPoint[] {
  const sg = wToG(wg, from), eg = wToG(wg, to);
  const sn = nearestWalkable(wg, sg.c, sg.r), en = nearestWalkable(wg, eg.c, eg.r);
  if (!sn || !en) return [from, to];

  const key = (c: number, r: number) => r * wg.cols + c;
  const h   = (c: number, r: number) => Math.abs(c - en.c) + Math.abs(r - en.r);
  type Node = { c: number; r: number; g: number; f: number; pk: number };
  const nodeMap = new Map<number, Node>();
  const open = new Set<number>(), closed = new Set<number>();
  const sk = key(sn.c, sn.r), ek = key(en.c, en.r);
  nodeMap.set(sk, { c: sn.c, r: sn.r, g: 0, f: h(sn.c, sn.r), pk: -1 });
  open.add(sk);

  let found = false, iters = 0;
  while (open.size > 0 && iters++ < 100000) {
    let bestK = -1, bestF = Infinity;
    for (const k of open) { const n = nodeMap.get(k)!; if (n.f < bestF) { bestF = n.f; bestK = k; } }
    if (bestK === -1) break;
    if (bestK === ek) { found = true; break; }
    const cur = nodeMap.get(bestK)!;
    open.delete(bestK); closed.add(bestK);
    for (const [dc, dr] of DIRS4) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (!walkable(wg, nc, nr)) continue;
      const nk = key(nc, nr); if (closed.has(nk)) continue;
      const ng = cur.g + 1, existing = nodeMap.get(nk);
      if (!existing || ng < existing.g) {
        nodeMap.set(nk, { c: nc, r: nr, g: ng, f: ng + h(nc, nr), pk: bestK });
        open.add(nk);
      }
    }
  }
  if (!found) return [from, to];

  const raw: PathPoint[] = [];
  let k = ek;
  while (k !== -1) {
    const n = nodeMap.get(k)!; raw.unshift(gToW(wg, n.c, n.r)); k = n.pk;
    if (k === sk) { raw.unshift(gToW(wg, sn.c, sn.r)); break; }
  }
  if (raw.length > 0) { raw[0] = from; raw[raw.length - 1] = to; }
  return simplify(raw);
}

// ── 세그먼트 / TSP ───────────────────────────────────────────
import walkGridsData from '../data/walk_grid.json';
const walkGrids = walkGridsData as Record<string, WalkGridData>;

export interface Booth {
  id: string; booth_number: string; gate: string;
  location: { x: number; y: number }; size: { w: number; h: number };
  publisher_name: string; category: string;
  tenants?: { booth_number: string; publisher_name: string; category: string; }[];
  is_zone?: boolean;
}

export const hallKey = (b: Booth): 'A' | 'B' => b.booth_number.startsWith('A') ? 'A' : 'B';

function pathDistance(path: PathPoint[]) {
  let total = 0;

  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(
      path[i].x - path[i - 1].x,
      path[i].y - path[i - 1].y
    );
  }

  return total;
}

export function computeSegment(from: Booth, to: Booth): RouteSegment {
  if (!from.location || !to.location) {
    return {
      path: [],
      crossFloor: false,
    };
  }

  const fh = hallKey(from);
  const th = hallKey(to);

  // 같은 층
  if (fh === th) {
    const wg = walkGrids[fh];

    return {
      path: wg
        ? astar(wg, from.location, to.location)
        : [from.location, to.location],
      crossFloor: false,
    };
  }

  // 다른 층 → 모든 에스컬레이터 후보 계산
  const wgFrom = walkGrids[fh];
  const wgTo = walkGrids[th];

  let bestRoute: RouteSegment | null = null;
  let bestDistance = Infinity;

  for (const esc of ESC_LINKS) {
    const escExitFrom = fh === "A" ? esc.aEntry : esc.bExit;
    const escEntryTo = fh === "A" ? esc.bExit : esc.aEntry;

    const seg1 = wgFrom
      ? astar(wgFrom, from.location, escExitFrom)
      : [from.location, escExitFrom];

    const seg2 = wgTo
      ? astar(wgTo, escEntryTo, to.location)
      : [escEntryTo, to.location];

    const path = simplify([
      ...seg1,
      esc.worldPos,
      ...seg2,
    ]);

    const dist = pathDistance(path);

    if (dist < bestDistance) {
      bestDistance = dist;
      bestRoute = {
        path,
        crossFloor: true,
        escPt: esc.worldPos,
      };
    }
  }

  return bestRoute!;
}

export function computeChained(ordered: Booth[]): RouteSegment[] {
  return ordered.slice(0, -1).map((b, i) => computeSegment(b, ordered[i + 1]));
}

export function solveTSP(booths: Booth[]): Booth[] {
  if (booths.length <= 1) return booths;

  const realDistance = (a: Booth, b: Booth) => {
    return pathDistance(computeSegment(a, b).path);
  };

  let bestRoute: Booth[] = [];
  let bestTotal = Infinity;

  for (let start = 0; start < booths.length; start++) {
    const remain = [...booths];
    const route = [remain.splice(start, 1)[0]];

    while (remain.length) {
      const current = route[route.length - 1];

      let bestIndex = 0;
      let bestDist = realDistance(current, remain[0]);

      for (let i = 1; i < remain.length; i++) {
        const d = realDistance(current, remain[i]);

        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }

      route.push(remain.splice(bestIndex, 1)[0]);
    }

    let total = 0;

    for (let i = 1; i < route.length; i++) {
      total += realDistance(route[i - 1], route[i]);
    }

    if (total < bestTotal) {
      bestTotal = total;
      bestRoute = route;
    }
  }

  return bestRoute;
}