import os
import json
from bs4 import BeautifulSoup

def parse_pure_coordinates(svg_path):
    if not os.path.exists(svg_path):
        print(f"❌ SVG 파일이 없습니다: {svg_path}")
        return

    print(f"⏳ '{svg_path}'에서 순수 기하학 좌표 데이터 추출 및 자동 정렬 시작...")
    
    with open(svg_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'xml')

    rects = soup.find_all('rect')
    
    raw_a_hall = []
    raw_b_hall = []

    for rect in rects:
        w = int(float(rect.get('width', 0)))
        h = int(float(rect.get('height', 0)))
        x = int(float(rect.get('x', 0)))
        y = int(float(rect.get('y', 0)))

        if w > 1500 or h > 1500 or w < 10 or h < 10:
            continue

        center_x = x + (w // 2)
        center_y = y + (h // 2)

        booth_item = {
            "x": center_x,
            "y": center_y,
            "w": w,
            "h": h
        }

        # 도면 Y 좌표 기준으로 A홀과 B1홀을 수학적으로 대칭 분할 (기준점 850px)
        if center_y > 850:
            raw_a_hall.append(booth_item)
        else:
            raw_b_hall.append(booth_item)

    # (위 -> 아래, 좌 -> 우)로 정렬 알고리즘 
    sorted_a_hall = sorted(raw_a_hall, key=lambda k: (k['y'] // 50, k['x']))
    sorted_b_hall = sorted(raw_b_hall, key=lambda k: (k['y'] // 50, k['x']))

    final_booths = []
    id_counter = 1

    # B1홀 순서대로 ID 마킹 및 규격화
    for i, b in enumerate(sorted_b_hall):
        booth_num = f"B_{i+1:03d}"
        final_booths.append({
            "id": f"b_{id_counter:03d}",
            "booth_number": booth_num,
            "gate": "B1 출입구",
            "location": {"x": b['x'], "y": b['y']},
            "size": {"w": b['w'], "h": b['h']},
            "publisher_name": "엑셀 매칭 대기 중",
            "category": "일반 부스"
        })
        id_counter += 1

    # A홀 순서대로 ID 마킹 및 규격화
    for i, b in enumerate(sorted_a_hall):
        booth_num = f"A_{i+1:03d}"
        final_booths.append({
            "id": f"b_{id_counter:03d}",
            "booth_number": booth_num,
            "gate": "A 출입구",
            "location": {"x": b['x'], "y": b['y']},
            "size": {"w": b['w'], "h": b['h']},
            "publisher_name": "엑셀 매칭 대기 중",
            "category": "일반 부스"
        })
        id_counter += 1

    output_path = 'src/data/auto_booths.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_booths, f, ensure_ascii=False, indent=4)

    print(f"🎉 순수 좌표 매칭 기반 컴파일 대성공!")
    print(f"📦 총 생성된 세부 부스: {len(final_booths)}개")
    print(f"   - B1홀 구역: {len(sorted_b_hall)}개")
    print(f"   - A홀 구역: {len(sorted_a_hall)}개")
    print(f"📂 JSON 맵 데이터 저장 완료: {output_path}")

if __name__ == "__main__":
    parse_pure_coordinates('public/map.svg')