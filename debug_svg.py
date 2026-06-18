import os
from bs4 import BeautifulSoup

def debug_svg_structure(svg_path):
    if not os.path.exists(svg_path):
        print(f"❌ SVG 파일이 없습니다: {svg_path}")
        return

    with open(svg_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'xml')

    rects = soup.find_all('rect')
    print(f"📊 발견된 총 <rect> 태그 개수: {len(rects)}개")
    print("\n--- 상위 10개 사각형 속성 상세 분석 ---")
    
    count = 0
    for rect in rects:
        # 무의미한 거대 배경판 패스
        w = float(rect.get('width', 0))
        if w > 2000:
            continue
            
        print(f"\n[사각형 #{count+1}]")
        print(f"  - 태그 속성들: {rect.attrs}")
        
        # 자식 태그(title 등)가 있는지 확인
        children = list(rect.children)
        child_tags = [c.name for c in children if c.name]
        if child_tags:
            print(f"  - 자식 태그 목록: {child_tags}")
            for c in rect.find_all():
                print(f"    <{c.name}>: {c.text.strip()}")
                
        # 부모 태그 정보 확인
        if rect.parent and rect.parent.name != '[document]':
            print(f"  - 부모 태그: <{rect.parent.name}> | 부모 속성: {rect.parent.attrs}")

        count += 1
        if count >= 10:
            break

if __name__ == "__main__":
    debug_svg_structure('public/map.svg')