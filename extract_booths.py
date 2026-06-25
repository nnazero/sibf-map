import os
import json
from bs4 import BeautifulSoup

def split_top_level(line, sep='/'):
    """괄호 '(' ')' 안에 있는 구분자는 무시하고 최상위 레벨에서만 자른다.
    예: '문학(SF/장르)' -> 한 덩어리로 유지됨 (안에 있는 / 는 무시)
    """
    parts = []
    buf = []
    depth = 0
    for ch in line:
        if ch == '(':
            depth += 1
            buf.append(ch)
        elif ch == ')':
            depth = max(0, depth - 1)
            buf.append(ch)
        elif ch == sep and depth == 0:
            parts.append(''.join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append(''.join(buf))
    return [p.strip() for p in parts]


def load_companies_map(txt_path):
    """
    {부스번호: {"name": "출판사명", "cat": "카테고리"}} 형태로 저장.
    'A305 /청아출판사 / 봄마중 / 종합출판' 처럼 출판사명에 '/'가 섞여
    4개 이상으로 쪼개지는 줄이나, 'A1407 / 아작 / 문학(SF/장르)' 처럼
    카테고리 자체에 괄호 안 '/'가 들어있는 줄도 안전하게 처리한다.
    (괄호 밖 '/' 만 구분자로 인식, 마지막 조각 = 카테고리,
     가운데 조각들을 ', '로 합쳐서 출판사명으로 취급)
    """
    mapping = {}
    skipped = []
    if os.path.exists(txt_path):
        with open(txt_path, 'r', encoding='utf-8') as f:
            for line_no, line in enumerate(f, 1):
                line = line.strip()
                if not line or '/' not in line:
                    continue
                parts = split_top_level(line, '/')
                if len(parts) < 3:
                    skipped.append((line_no, line))
                    continue
                booth_num = parts[0].upper()
                category = parts[-1]
                name = ', '.join(p for p in parts[1:-1] if p)
                mapping[booth_num] = {"name": name, "cat": category}
                if len(parts) > 3:
                    print(f"  [주의] {line_no}행 '{booth_num}': '/' 가 {len(parts)-1}개라 자동 보정함 -> name='{name}', cat='{category}'")
    return mapping, skipped


import re

ZONE_GROUPS = {
    "B400": re.compile(r"^B4\d{2}$"), 
}


def parse_svg_by_id(svg_path, txt_path, out_path):
    companies, skipped = load_companies_map(txt_path)
    with open(svg_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'xml')

    final_booths = []
    matched_booth_nums = set()
    unmatched_svg_rects = []
    zone_tenant_nums = set() 
    for rect in soup.find_all('rect'):
        booth_id = rect.get('id', '')
        if not booth_id:
            continue
        booth_id_upper = booth_id.upper()
        booth_num = booth_id_upper.split('_')[0]

        if not (booth_num.startswith('A') or booth_num.startswith('B')):
            continue
        if not booth_num[1:].isdigit():
            continue
        if booth_id_upper.startswith('BLOCKED'):
            continue

        x = float(rect.get('x', 0))
        y = float(rect.get('y', 0))
        w = float(rect.get('width', 0))
        h = float(rect.get('height', 0))

        data = companies.get(booth_num)
        if data is None:
            if booth_num in ZONE_GROUPS:
                data = {"name": "독립출판 마켓 공동관", "cat": "독립출판"}
            else:
                unmatched_svg_rects.append(booth_num)
                data = {"name": "미등록 부스", "cat": "일반"}
        else:
            matched_booth_nums.add(booth_num)

        booth_entry = {
            "id": f"booth_{booth_num}",
            "booth_number": booth_num,
            "gate": "A 출입구" if booth_num.startswith('A') else "B1 출입구",
            "location": {"x": round(x + w / 2), "y": round(y + h / 2)},
            "size": {"w": round(w), "h": round(h)},
            "publisher_name": data["name"],
            "category": data["cat"]
        }

        if booth_num in ZONE_GROUPS:
            pattern = ZONE_GROUPS[booth_num]
            tenants = []
            for cnum, cdata in companies.items():
                if cnum == booth_num:
                    continue
                if pattern.match(cnum):
                    tenants.append({
                        "booth_number": cnum,
                        "publisher_name": cdata["name"],
                        "category": cdata["cat"],
                    })
                    zone_tenant_nums.add(cnum)
            tenants.sort(key=lambda t: t["booth_number"])
            if tenants:
                booth_entry["tenants"] = tenants
                booth_entry["is_zone"] = True

        final_booths.append(booth_entry)

    final_booths.sort(key=lambda b: b["booth_number"])

    missing_in_svg = sorted(set(companies.keys()) - matched_booth_nums - zone_tenant_nums)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(final_booths, f, ensure_ascii=False, indent=4)

    return {
        "total_booths": len(final_booths),
        "matched": len(matched_booth_nums),
        "zone_tenants_bundled (공동관으로 묶인 입주사 수)": len(zone_tenant_nums),
        "unmatched_svg_rects (SVG에는 있지만 명단에 없음)": sorted(set(unmatched_svg_rects)),
        "missing_in_svg (명단에는 있지만 SVG/zone 어디에도 없음)": missing_in_svg,
        "skipped_lines (텍스트 파싱 실패)": skipped,
    }


if __name__ == "__main__":
    result = parse_svg_by_id(
        "public/map.svg",
        "companies.txt",
        "src/data/auto_booths.json",
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))