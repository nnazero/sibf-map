"""
build_walk_grid.py

booth 사각형(부스)들을 "장애물"로 표시한 통로 격자(occupancy grid)를 만든다.
같은 줄(row)에 붙어있는 부스 사이는 원래 통로가 없는 게 맞고(둘 다 막힘),
줄과 줄 사이의 넓은 간격만 실제 통로로 인식되게 한다.

출력: src/data/walk_grid.json
{
  "A": { "cellSize": 12, "originX": ..., "originY": ..., "cols": N, "rows": M, "grid": ["0001100...", ...] },
  "B": { ... }
}
grid의 각 문자열은 한 행(row)이고, 각 문자는 한 칸(cell). '1' = 막힘(부스/장애물), '0' = 통행 가능.
"""
import json
import math

CELL_SIZE = 12       # px 단위 격자 한 칸 크기 (작을수록 정밀하지만 데이터가 커짐)
PADDING = 30          # 부스 전체 bbox 바깥으로 여유 통로 공간을 얼마나 둘지
BOOTH_INFLATE = 2     # 부스 사각형을 살짝 부풀려서 경로가 모서리에 너무 바짝 붙지 않게 함


def rect_of(booth):
    x0 = booth["location"]["x"] - booth["size"]["w"] / 2 - BOOTH_INFLATE
    y0 = booth["location"]["y"] - booth["size"]["h"] / 2 - BOOTH_INFLATE
    x1 = booth["location"]["x"] + booth["size"]["w"] / 2 + BOOTH_INFLATE
    y1 = booth["location"]["y"] + booth["size"]["h"] / 2 + BOOTH_INFLATE
    return x0, y0, x1, y1


def build_grid_for_hall(booths, hall_prefix):
    hall_booths = [b for b in booths if b["booth_number"].startswith(hall_prefix)]
    if not hall_booths:
        return None

    rects = [rect_of(b) for b in hall_booths]
    min_x = min(r[0] for r in rects) - PADDING
    min_y = min(r[1] for r in rects) - PADDING
    max_x = max(r[2] for r in rects) + PADDING
    max_y = max(r[3] for r in rects) + PADDING

    cols = math.ceil((max_x - min_x) / CELL_SIZE)
    rows = math.ceil((max_y - min_y) / CELL_SIZE)

    # 0 = 통행 가능, 1 = 막힘
    grid = [[0] * cols for _ in range(rows)]

    for (x0, y0, x1, y1) in rects:
        c0 = max(0, int((x0 - min_x) / CELL_SIZE))
        c1 = min(cols - 1, int((x1 - min_x) / CELL_SIZE))
        r0 = max(0, int((y0 - min_y) / CELL_SIZE))
        r1 = min(rows - 1, int((y1 - min_y) / CELL_SIZE))
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                grid[r][c] = 1

    blocked = sum(sum(row) for row in grid)
    total = cols * rows
    print(f"  [{hall_prefix}홀] grid {cols}x{rows} ({total}칸), 막힌 칸 {blocked}개 ({blocked/total*100:.1f}%)")

    return {
        "cellSize": CELL_SIZE,
        "originX": min_x,
        "originY": min_y,
        "cols": cols,
        "rows": rows,
        # 문자열 행으로 압축 저장 (JSON 크기 절약)
        "grid": ["".join(str(v) for v in row) for row in grid],
    }


def main(booths_path, out_path):
    booths = json.load(open(booths_path, encoding="utf-8"))
    result = {}
    for hall in ["A", "B"]:
        g = build_grid_for_hall(booths, hall)
        if g:
            result[hall] = g

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f)

    print("저장 완료:", out_path)


if __name__ == "__main__":
    main(
        "src/data/auto_booths.json",
        "src/data/walk_grid.json",
    )