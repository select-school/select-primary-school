import requests
import re
import json
import csv
import time
import sys

MAIN_URL = "https://topschool.hket.com/article/3923190/%E5%85%A8%E6%B8%AF%E5%B0%8F%E5%AD%B8%E6%8E%92%E5%90%8D2026%EF%BD%9C%E5%85%A8%E6%B8%AFTOP100%E5%B0%8F%E5%AD%B8%E6%8E%92%E5%90%8D-18%E5%8D%80%E5%B0%8F%E5%AD%B8%E9%A0%AD5%E5%90%8D%E3%80%80%E6%9C%80%E9%BD%8A%E5%AD%B8%E6%A0%A1%E8%B3%87%E8%A8%8A-%E9%9D%A2%E8%A9%A6%E6%8B%86%E8%A7%A3-%E6%A0%A1%E9%95%B7%E5%B0%88%E8%A8%AA"

def fetch_main_page():
    resp = requests.get(MAIN_URL)
    resp.raise_for_status()
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', resp.text)
    if not match:
        raise RuntimeError("Could not find __NEXT_DATA__")
    return json.loads(match.group(1))

def parse_ranking_table(next_data):
    build_id = next_data["buildId"]
    html = next_data["props"]["pageProps"]["data"]["content"]["html"]

    table_match = re.search(r'<table[^>]*>(.*?)</table>', html, re.DOTALL)
    if not table_match:
        raise RuntimeError("Could not find ranking table")

    rows = re.findall(r'<tr>(.*?)</tr>', table_match.group(1), re.DOTALL)
    schools = []
    for row in rows[1:]:
        cells = re.findall(r'<td>(.*?)</td>', row, re.DOTALL)
        if len(cells) < 5:
            continue
        rank = re.sub(r'<[^>]+>', '', cells[0]).strip()
        name_matches = re.findall(r'>([^<]+)<', cells[1])
        chinese_name = name_matches[0].replace('&#39;', "'").replace('&amp;', '&') if name_matches else ''
        id_match = re.search(r'primary-school/(\d+)', cells[1])
        school_id = id_match.group(1) if id_match else ''
        district = re.sub(r'<[^>]+>', '', cells[2]).strip()
        category = re.sub(r'<[^>]+>', '', cells[3]).strip()
        funding = re.sub(r'<[^>]+>', '', cells[4]).strip()
        schools.append({
            'rank': rank,
            'name': chinese_name,
            'id': school_id,
            'district': district,
            'category': category,
            'funding': funding,
        })
    return build_id, schools

def format_related_schools(data):
    parts = []
    if data.get('throughTrainSchool'):
        names = ', '.join(s['schoolName'] for s in data['throughTrainSchool'])
        parts.append(f"一條龍：{names}")
    if data.get('feederSchool'):
        names = ', '.join(s['schoolName'] for s in data['feederSchool'])
        parts.append(f"直屬：{names}")
    if data.get('nominatedSchool'):
        names = ', '.join(s['schoolName'] for s in data['nominatedSchool'])
        parts.append(f"聯繫：{names}")
    return '；'.join(parts) if parts else ''

def fetch_school_detail(build_id, school_id):
    url = f"https://topschool.hket.com/_next/data/{build_id}/primary-school/{school_id}.json"
    resp = requests.get(url)
    resp.raise_for_status()
    data = resp.json()
    s = data.get('pageProps', {}).get('schoolData', {})
    if not s:
        return {}

    assessment = (s.get('diversifiedAssessment') or '').replace('<br>', '\n').replace('<br/>', '\n')
    school_net = s.get('schoolNet')
    return {
        '學費': s.get('primarySchoolFee') or '-',
        '多元學習評估': assessment,
        '相關中學': format_related_schools(s),
        '校網': str(school_net) if school_net else '',
        '學校佔地面積': f"{s['areaOccupied']}平方米" if s.get('areaOccupied') else '',
        '課室數目': s.get('classroomCount') or '',
        '特別室': s.get('specialRoom') or '',
        '學校設施': s.get('facility') or '',
    }

def main():
    print("Fetching main ranking page...")
    next_data = fetch_main_page()
    build_id, schools = parse_ranking_table(next_data)
    print(f"Found {len(schools)} schools, build ID: {build_id}")

    print(f"Processing all {len(schools)} schools")

    columns = ['排名', '學校名稱', '學生性別', '校網地區', '學費', '多元學習評估', '相關中學', '校網', '學校佔地面積', '課室數目', '特別室', '學校設施']

    results = []
    for i, school in enumerate(schools):
        print(f"  [{i+1}/{len(schools)}] Fetching {school['name']}...", end='', flush=True)
        try:
            detail = fetch_school_detail(build_id, school['id'])
            row = {
                '排名': school['rank'],
                '學校名稱': school['name'],
                '學生性別': school['category'],
                '校網地區': school['district'],
                **detail,
            }
            results.append(row)
            print(" OK")
        except Exception as e:
            print(f" ERROR: {e}")
            results.append({
                '排名': school['rank'],
                '學校名稱': school['name'],
                '學生性別': school['category'],
                '校網地區': school['district'],
            })
        time.sleep(0.3)

    output_file = 'top100_schools.csv'
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(results)

    print(f"\nDone! Wrote {len(results)} schools to {output_file}")

if __name__ == '__main__':
    main()
