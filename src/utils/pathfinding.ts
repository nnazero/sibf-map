// 부스(장애물)를 피해 통로로만 이동하는 실제 보행 경로를 계산하는 모듈.
// build_walk_grid.py 가 만든 walk_grid.json(점유 격자)을 바탕으로
// A* 탐색 + 직선 단순화(string-pulling)를 수행한다.

export interface WalkGrid {
  cellSize: number;
  originX: number;
  originY: number;
  cols: number;
  rows: number;
  grid: string[]; // 각 행 문자열, '0'=통행가능 '1'=막힘
}

type Cell = [number, number]; // [col, row]

const isFree = (g: WalkGrid, c: number, r: number): boolean => {
  if (c < 0 || r < 0 || r >= g.rows || c >= g.cols) return false;
  return g.grid[r][c] === '0';
};

const toCell = (g: WalkGrid, x: number, y: number): Cell => [
  Math.floor((x - g.originX) / g.cellSize),
  Math.floor((y - g.originY) / g.cellSize),
];

const cellCenter = (g: WalkGrid, c: number, r: number): { x: number; y: number } => ({
  x: g.originX + c * g.cellSize + g.cellSize / 2,
  y: g.originY + r * g.cellSize + g.cellSize / 2,
});

// 부스 한가운데(=장애물 칸)에서 시작하므로, 가장 가까운 통행 가능한 칸을 BFS로 찾는다.
const nearestFree = (g: WalkGrid, c: number, r: number): Cell | null => {
  if (isFree(g, c, r)) return [c, r];
  const seen = new Set<string>([`${c},${r}`]);
  const queue: Cell[] = [[c, r]];
  let head = 0;
  while (head < queue.length) {
    const [cc, rr] = queue[head++];
    const neighbors: Cell[] = [[cc - 1, rr], [cc + 1, rr], [cc, rr - 1], [cc, rr + 1]];
    for (const [nc, nr] of neighbors) {
      const key = `${nc},${nr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isFree(g, nc, nr)) return [nc, nr];
      queue.push([nc, nr]);
    }
    if (queue.length > 20000) break; // 안전장치
  }
  return null;
};

// 최소 힙 (A* 우선순위 큐)
class MinHeap<T> {
  private items: { priority: number; value: T }[] = [];
  push(priority: number, value: T) {
    this.items.push({ priority, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }
  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      const n = this.items.length;
      while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.items[l].priority < this.items[smallest].priority) smallest = l;
        if (r < n && this.items[r].priority < this.items[smallest].priority) smallest = r;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top.value;
  }
  get size() {
    return this.items.length;
  }
}

const DIRS: [number, number, number][] = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2],
];

const aStar = (g: WalkGrid, start: Cell, goal: Cell): Cell[] | null => {
  const key = (c: Cell) => `${c[0]},${c[1]}`;
  const gScore = new Map<string, number>([[key(start), 0]]);
  const cameFrom = new Map<string, Cell | null>([[key(start), null]]);
  const heap = new MinHeap<Cell>();
  const h = (a: Cell, b: Cell) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  heap.push(h(start, goal), start);
  const visited = new Set<string>();

  let iterations = 0;
  while (heap.size > 0) {
    iterations++;
    if (iterations > 200000) return null; // 안전장치
    const cur = heap.pop()!;
    const ck = key(cur);
    if (visited.has(ck)) continue;
    visited.add(ck);

    if (cur[0] === goal[0] && cur[1] === goal[1]) {
      const path: Cell[] = [];
      let node: Cell | null = cur;
      while (node) {
        path.push(node);
        node = cameFrom.get(key(node)) ?? null;
      }
      return path.reverse();
    }

    for (const [dc, dr, cost] of DIRS) {
      const nc = cur[0] + dc;
      const nr = cur[1] + dr;
      if (!isFree(g, nc, nr)) continue;
      // 대각선 이동 시 양 옆 칸도 뚫려 있어야 벽 모서리를 가로지르지 않음
      if (dc !== 0 && dr !== 0) {
        if (!isFree(g, cur[0] + dc, cur[1]) || !isFree(g, cur[0], cur[1] + dr)) continue;
      }
      const ng = (gScore.get(ck) ?? 0) + cost;
      const nk = `${nc},${nr}`;
      if (!gScore.has(nk) || ng < gScore.get(nk)!) {
        gScore.set(nk, ng);
        cameFrom.set(nk, cur);
        heap.push(ng + h([nc, nr], goal), [nc, nr]);
      }
    }
  }
  return null;
};

// 두 칸 사이를 일직선으로 가도 장애물에 막히지 않는지 (Bresenham)
const lineClear = (g: WalkGrid, c1: number, r1: number, c2: number, r2: number): boolean => {
  let c = c1;
  let r = r1;
  const dx = Math.abs(c2 - c1);
  const dy = Math.abs(r2 - r1);
  const sx = c1 < c2 ? 1 : -1;
  const sy = r1 < r2 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    if (!isFree(g, c, r)) return false;
    if (c === c2 && r === r2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      c += sx;
    }
    if (e2 < dx) {
      err += dx;
      r += sy;
    }
  }
  return true;
};

// 불필요한 중간 waypoint를 직선으로 건너뛸 수 있으면 합쳐서 경로를 단순화 (string-pulling)
const simplifyPath = (g: WalkGrid, path: Cell[]): Cell[] => {
  if (path.length <= 2) return path;
  const result: Cell[] = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !lineClear(g, path[i][0], path[i][1], path[j][0], path[j][1])) {
      j--;
    }
    result.push(path[j]);
    i = j;
  }
  return result;
};

export interface PathPoint {
  x: number;
  y: number;
}

/**
 * 두 좌표(부스 중심점) 사이의, 부스/장애물을 피해가는 실제 보행 경로를 계산한다.
 * 같은 hall(같은 격자)에 속한 두 점 사이에서만 호출해야 한다.
 */
export const findWalkingPath = (
  grid: WalkGrid,
  start: PathPoint,
  end: PathPoint
): PathPoint[] | null => {
  const startCellRaw = toCell(grid, start.x, start.y);
  const endCellRaw = toCell(grid, end.x, end.y);
  const startCell = nearestFree(grid, startCellRaw[0], startCellRaw[1]);
  const endCell = nearestFree(grid, endCellRaw[0], endCellRaw[1]);
  if (!startCell || !endCell) return null;

  const rawPath = aStar(grid, startCell, endCell);
  if (!rawPath) return null;

  const simplified = simplifyPath(grid, rawPath);

  // 실제 출발/도착 좌표를 양 끝에 붙여서 부스 중심까지 자연스럽게 이어지게 함
  const points: PathPoint[] = [start, ...simplified.map(([c, r]) => cellCenter(grid, c, r)), end];
  return points;
};