#!/usr/bin/env python3
"""Extract comprehensive school details from EDB district PDF profiles.

Reads official Education Bureau school profile PDFs (organized by district),
matches against ranked schools in schools.json, and extracts ~50 structured
fields per school into school_details.json.
"""

import json
import re
import sys
import pdfplumber

PDF_FILES = {
    "中西區": "school-details/中西區.pdf",
    "九龍城區": "school-details/九龍城區.pdf",
    "元朗區": "school-details/元朗區.pdf",
    "北區": "school-details/北區.pdf",
    "南區": "school-details/香港南區.pdf",
    "大埔區": "school-details/大埔區.pdf",
    "屯門區": "school-details/屯門區.pdf",
    "東區": "school-details/香港東區.pdf",
    "沙田區": "school-details/沙田區.pdf",
    "油尖旺區": "school-details/油尖旺區.pdf",
    "深水埗區": "school-details/深水埗區.pdf",
    "灣仔區": "school-details/灣仔區.pdf",
    "荃灣區": "school-details/荃灣區.pdf",
    "葵青區": "school-details/葵青區.pdf",
    "西貢區": "school-details/西貢區.pdf",
    "觀塘區": "school-details/觀塘區.pdf",
    "黃大仙區": "school-details/黃大仙區.pdf",
    "離島區": "school-details/離島區.pdf",
}

# Name mappings for schools whose PDF names differ from schools.json
NAME_ALIASES = {
    "軒尼詩道官立小學": "軒尼詩道官立小學（灣仔）",
    "高主教書院小學部": "高主教書院（小學部）",
    "香港真光中學附屬小學暨幼稚園": "香港真光中學（小學部）",
    "德望小學暨幼稚園": "德望小學暨幼稚園（小學部）",
}


def load_targets():
    with open("schools.json", encoding="utf-8") as f:
        schools = json.load(f)
    return {s["name"]: s for s in schools}


def parse_int(s):
    if not s:
        return None
    m = re.search(r"\d+", s.replace(",", ""))
    return int(m.group()) if m else None


def parse_pct(s):
    if not s:
        return None
    m = re.search(r"(\d+)", s.replace("%", ""))
    return int(m.group()) if m else None


def parse_fee(s):
    if not s or s.strip() in ("-", "—", ""):
        return None
    m = re.search(r"\$?([\d,]+)", s)
    return int(m.group(1).replace(",", "")) if m else None


def clean(s):
    if s is None:
        return None
    return s.replace("\n", "").strip() or None


def extract_school_info_table(table):
    """Parse the school info table (table 1 on page 1)."""
    info = {}
    if len(table) < 7:
        return info

    # Row 0: headers, Row 1: values
    row1 = table[1]
    info["principal"] = clean(row1[1]) if len(row1) > 1 else None
    info["imcEstablished"] = clean(row1[2]) == "已成立" if len(row1) > 2 else None

    imc_pct_raw = clean(row1[3]) if len(row1) > 3 else None
    info["imcTrainingPct"] = parse_pct(imc_pct_raw)

    cat_raw = clean(row1[4]) if len(row1) > 4 else None
    if cat_raw:
        cat_raw = cat_raw.replace("全日", "").strip()
    info["schoolCategory"] = cat_raw
    info["gender"] = clean(row1[5]) if len(row1) > 5 else None
    info["religion"] = clean(row1[6]) if len(row1) > 6 else None

    # Row 2: headers, Row 3: values
    row3 = table[3]
    info["sponsoringBody"] = clean(row3[0]) if len(row3) > 0 else None
    info["motto"] = clean(row3[1]) if len(row3) > 1 else None
    info["foundingYear"] = parse_int(clean(row3[2])) if len(row3) > 2 else None
    teaching_lang = clean(row3[3]) if len(row3) > 3 else None
    if not teaching_lang and len(row3) > 4:
        teaching_lang = clean(row3[4])
    info["teachingLanguage"] = teaching_lang

    bus_idx = 5 if len(row3) > 5 else 4
    info["schoolBusService"] = clean(row3[bus_idx]) if len(row3) > bus_idx else None

    area_idx = 6 if len(row3) > 6 else 5
    info["campusArea"] = clean(row3[area_idx]) if len(row3) > area_idx else None

    # Row 4-5: linked secondary, alumni, PTA
    if len(table) > 5:
        row4 = table[4]
        row5 = table[5]
        linked_type_raw = clean(row4[0]) if len(row4) > 0 else ""
        linked_name = clean(row5[0]) if len(row5) > 0 else None

        linked_secondaries = []
        if linked_name and linked_name not in ("-", "—", ""):
            sec_type = "一條龍"
            if linked_type_raw:
                if "直屬" in linked_type_raw:
                    sec_type = "直屬"
                elif "聯繫" in linked_type_raw:
                    sec_type = "聯繫"
                elif "一條龍" in linked_type_raw:
                    sec_type = "一條龍"
            for name in re.split(r"[、，,\n]", linked_name):
                name = name.strip()
                if name and name not in ("-", "—"):
                    linked_secondaries.append({"name": name, "type": sec_type})
        info["linkedSecondary"] = linked_secondaries

        alumni_val = clean(row5[2]) if len(row5) > 2 else None
        info["hasAlumniAssociation"] = alumni_val == "有" if alumni_val else False

        pta_val = clean(row5[5]) if len(row5) > 5 else (clean(row5[-1]) if row5 else None)
        info["hasPTA"] = pta_val == "有" if pta_val else False

    # Row 6: 4Rs charter etc
    if len(table) > 6:
        row6 = table[6]
        charter_val = clean(row6[1]) if len(row6) > 1 else None
        info["has4RsCharter"] = charter_val == "有" if charter_val else False

    return info


def extract_fees_table(table):
    """Parse fees table (table 2)."""
    fees = {
        "tuition": None,
        "hallFees": None,
        "ptaFees": None,
        "nonStandardFees": None,
        "nonStandardFeesDesc": None,
        "otherFees": None,
        "otherFeesDesc": None,
    }
    if len(table) < 2:
        return fees

    row = table[1]
    fees["tuition"] = parse_fee(row[0]) if len(row) > 0 else None
    fees["hallFees"] = parse_fee(row[1]) if len(row) > 1 else None
    fees["ptaFees"] = parse_fee(row[2]) if len(row) > 2 else None

    if len(row) > 3:
        nsf_raw = clean(row[3])
        if nsf_raw and nsf_raw not in ("-", "—"):
            fees["nonStandardFees"] = parse_fee(nsf_raw)
            fees["nonStandardFeesDesc"] = nsf_raw

    if len(row) > 4:
        other_raw = clean(row[4])
        if other_raw and other_raw not in ("-", "—"):
            fees["otherFees"] = parse_fee(other_raw)
            fees["otherFeesDesc"] = other_raw

    return fees


def extract_facilities_table(table):
    """Parse facilities table (table 3)."""
    fac = {
        "classrooms": None,
        "playgrounds": None,
        "halls": None,
        "libraries": None,
        "otherFacilities": None,
        "specialRooms": None,
        "senFacilities": None,
    }
    if len(table) < 2:
        return fac

    row1 = table[1]
    fac["classrooms"] = parse_int(row1[0]) if len(row1) > 0 else None
    fac["playgrounds"] = parse_int(row1[1]) if len(row1) > 1 else None
    fac["halls"] = parse_int(row1[2]) if len(row1) > 2 else None
    fac["libraries"] = parse_int(row1[3]) if len(row1) > 3 else None
    fac["otherFacilities"] = clean(row1[4]) if len(row1) > 4 else None

    if len(table) > 3:
        row3 = table[3]
        fac["specialRooms"] = clean(row3[0]) if len(row3) > 0 else None
        fac["senFacilities"] = clean(row3[4]) if len(row3) > 4 else None

    return fac


def extract_teachers_table(table):
    """Parse teachers table (table 4).

    Consistent structure: 8 columns.
    Row 0: [核准編制..., None, VALUE, 全校教師總人數, None, None, VALUE, None]
    Row 3: [trained%, bachelor%, master%, specialEd%, 0-4yr%, 5-9yr%, None, 10+yr%]
    """
    teachers = {}
    if len(table) < 4:
        return teachers

    row0 = table[0]
    # Approved positions always at index 2, total count at index 6
    teachers["approvedPositions"] = parse_int(row0[2]) if len(row0) > 2 else None
    teachers["totalCount"] = parse_int(row0[6]) if len(row0) > 6 else None

    row3 = table[3]
    teachers["trainedPct"] = parse_pct(row3[0]) if len(row3) > 0 else None
    teachers["bachelorPct"] = parse_pct(row3[1]) if len(row3) > 1 else None
    teachers["masterPlusPct"] = parse_pct(row3[2]) if len(row3) > 2 else None
    teachers["specialEdPct"] = parse_pct(row3[3]) if len(row3) > 3 else None
    teachers["exp0to4Pct"] = parse_pct(row3[4]) if len(row3) > 4 else None
    teachers["exp5to9Pct"] = parse_pct(row3[5]) if len(row3) > 5 else None
    teachers["exp10plusPct"] = parse_pct(row3[7]) if len(row3) > 7 else None

    return teachers


def extract_class_structure_table(table):
    """Parse class structure table (table 5)."""
    classes = {"current": {}, "next": {}, "teachingMode": None, "remarks": None}
    if len(table) < 3:
        return classes

    grade_keys = ["p1", "p2", "p3", "p4", "p5", "p6", "total"]

    # Row 1: 2024/2025
    row1 = table[1]
    for i, key in enumerate(grade_keys):
        idx = i + 2
        classes["current"][key] = parse_int(row1[idx]) if len(row1) > idx else None

    # Row 2: 2025/2026
    row2 = table[2]
    for i, key in enumerate(grade_keys):
        idx = i + 2
        classes["next"][key] = parse_int(row2[idx]) if len(row2) > idx else None

    # Row 3: teaching mode
    if len(table) > 3:
        row3 = table[3]
        if len(row3) > 1:
            classes["teachingMode"] = clean(row3[1])

    # Row 4: remarks
    if len(table) > 4:
        row4 = table[4]
        if len(row4) > 1:
            remarks = clean(row4[1])
            if remarks and remarks not in ("-", "—"):
                classes["remarks"] = remarks

    return classes


def extract_assessment_table(table):
    """Parse assessment table (table 6)."""
    assessment = {}
    if len(table) < 2:
        return assessment

    row0 = table[0]
    assessment["p1Tests"] = parse_int(row0[2]) if len(row0) > 2 else None
    assessment["p1Exams"] = parse_int(row0[6]) if len(row0) > 6 else None

    if len(table) > 1:
        row1 = table[1]
        assessment["p2to6Tests"] = parse_int(row1[2]) if len(row1) > 2 else None
        assessment["p2to6Exams"] = parse_int(row1[6]) if len(row1) > 6 else None

    if len(table) > 2:
        row2 = table[2]
        prog_val = clean(row2[6]) if len(row2) > 6 else None
        assessment["progressiveAssessment"] = prog_val == "有" if prog_val else None

    if len(table) > 4:
        row4 = table[4]
        assessment["multiAssessment"] = clean(row4[1]) if len(row4) > 1 else None

    if len(table) > 5:
        row5 = table[5]
        no_exam_val = None
        for cell in row5:
            if cell and "有" == clean(cell):
                no_exam_val = True
                break
        assessment["noExamBeforeHoliday"] = no_exam_val

    if len(table) > 6:
        row6 = table[6]
        assessment["classStreaming"] = clean(row6[1]) if len(row6) > 1 else None

    return assessment


def extract_school_life_table(table):
    """Parse school life table (table 7)."""
    life = {}
    if len(table) < 2:
        return life

    row1 = table[1]
    life["daysPerWeek"] = parse_int(row1[0]) if len(row1) > 0 else None
    life["lessonsPerDay"] = parse_int(row1[1]) if len(row1) > 1 else None
    life["lessonDuration"] = clean(row1[2]) if len(row1) > 2 else None
    life["startTime"] = clean(row1[3]) if len(row1) > 3 else None
    life["endTime"] = clean(row1[4]) if len(row1) > 4 else None
    life["lunchTime"] = clean(row1[5]) if len(row1) > 5 else None

    if len(table) > 3:
        row3 = table[3]
        life["lunchArrangement"] = clean(row3[0]) if len(row3) > 0 else None
        life["healthCampus"] = clean(row3[1]) if len(row3) > 1 else None
        life["remarks"] = clean(row3[3]) if len(row3) > 3 else None

    return life


def extract_header(text_lines):
    """Extract school name, English name, address, contact from first lines.

    Consistent structure (verified across all district PDFs):
      Line 0: Chinese name
      Line 1: {page_number} {English name}
      Line 2: School net number (or 不適用)
      Line 3: Address
      Line 4: SEING {phone} {email}
      Line 5: {fax} {website} 小一學校網
    """
    header = {}
    if not text_lines:
        return header

    header["name"] = text_lines[0].strip()

    # Line 1: English name (strip leading page number)
    if len(text_lines) > 1:
        en_line = text_lines[1].strip()
        header["nameEn"] = re.sub(r"^\d+\s*", "", en_line).strip() or None

    # Line 2: School net number
    if len(text_lines) > 2:
        net_line = text_lines[2].strip()
        net_match = re.match(r"^(\d{1,2})$", net_line)
        header["schoolNetFromHeader"] = int(net_match.group(1)) if net_match else None

    # Line 3: Address
    if len(text_lines) > 3:
        header["address"] = text_lines[3].strip()

    # Line 4: Phone and email (may have SEING/icon artifact prefix)
    phone = None
    email = None
    if len(text_lines) > 4:
        line4 = text_lines[4]
        phones = re.findall(r"\d{8}", line4)
        if phones:
            phone = phones[0]
        email_match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", line4)
        if email_match:
            email = email_match.group()
    header["phone"] = phone
    header["email"] = email

    # Line 5: Fax and website
    fax = None
    website = None
    if len(text_lines) > 5:
        line5 = text_lines[5]
        fax_match = re.search(r"(\d{8})", line5)
        if fax_match:
            fax = fax_match.group(1)
        web_match = re.search(r"https?://[\w./%+-]+", line5)
        if web_match:
            website = web_match.group()
    header["fax"] = fax
    header["website"] = website

    return header


def parse_narrative_page(text):
    """Parse the narrative page (page 2) using section headers."""
    sections = {}

    section_markers = [
        ("ecas", "全方位學習"),
        ("mission", "辦學宗旨"),
        ("schoolFeatures", "學校特色"),
        ("management", "學校管理"),
        ("teachingPlan", "教學規劃"),
        ("curriculumUpdates", "小學教育課程更新重點的發展"),
        ("genericSkills", "共通能力的培養"),
        ("valuesEducation", "正確價值觀、態度和行為的培養"),
        ("studentSupport", "學生支援"),
        ("parentCooperation", "家校合作及校風"),
        ("futureDevelopment", "未來發展"),
        ("achievements", "其他"),
    ]

    # Split text into lines
    lines = text.split("\n")
    full_text = text

    for key, marker in section_markers:
        idx = full_text.find(marker)
        if idx == -1:
            continue

        # Find the next section marker after this one
        next_idx = len(full_text)
        for _, next_marker in section_markers:
            if next_marker == marker:
                continue
            ni = full_text.find(next_marker, idx + len(marker))
            if ni != -1 and ni < next_idx:
                next_idx = ni

        content = full_text[idx + len(marker) : next_idx].strip()
        # Remove leading colons or newlines
        content = re.sub(r"^[：:\n\s]+", "", content)
        if content:
            sections[key] = content

    # Extract sub-sections from schoolFeatures if present
    features_text = sections.get("schoolFeatures", "")
    if features_text:
        sub_sections = {
            "managementStructure": "學校管理架構",
            "imcInfo": "法團校董會／學校管理委員會／校董會",
            "envPolicy": "環保政策",
            "keyConcerns": "學校關注事項",
            "teachingStrategies": "學習和教學策略",
            "ncsSupport": "非華語學生的教育支援",
            "curriculumAdaptation": "課程剪裁及調適措施",
            "inclusiveEd": "全校參與模式融合教育",
            "studentDiversity": "全校參與照顧學生的多樣性",
        }
        for key, marker in sub_sections.items():
            idx = features_text.find(marker)
            if idx == -1:
                continue
            # Find content after the marker header line
            content_start = features_text.find("\n", idx)
            if content_start == -1:
                continue
            # Find next sub-section
            next_idx = len(features_text)
            for _, nm in sub_sections.items():
                if nm == marker:
                    continue
                ni = features_text.find(nm, content_start)
                if ni != -1 and ni < next_idx:
                    next_idx = ni
            # Also check main section markers
            for _, nm in section_markers:
                ni = features_text.find(nm, content_start)
                if ni != -1 and ni < next_idx:
                    next_idx = ni

            content = features_text[content_start:next_idx].strip()
            content = re.sub(r"^[：:\n\s]+", "", content)
            if content:
                sections[key] = content

    # Extract parentCooperation and schoolEthos from the combined section
    pc_text = sections.get("parentCooperation", "")
    if pc_text:
        ethos_marker = "校風"
        ethos_idx = pc_text.find(ethos_marker + "：")
        if ethos_idx == -1:
            ethos_idx = pc_text.find(ethos_marker + "\n")
        if ethos_idx == -1:
            ethos_idx = pc_text.find(ethos_marker + ":")
        if ethos_idx != -1:
            sections["schoolEthos"] = pc_text[ethos_idx + len(ethos_marker) :].strip().lstrip("：:\n ")
            # Also extract just the cooperation part
            coop_marker = "家校合作"
            coop_idx = pc_text.find(coop_marker + "：")
            if coop_idx == -1:
                coop_idx = pc_text.find(coop_marker + "\n")
            if coop_idx != -1:
                sections["parentCooperation"] = pc_text[coop_idx + len(coop_marker) : ethos_idx].strip().lstrip("：:\n ")

    return sections


def extract_school(pdf, page_idx, district):
    """Extract all data for one school from its 2 PDF pages."""
    page1 = pdf.pages[page_idx]
    page2 = pdf.pages[page_idx + 1] if page_idx + 1 < len(pdf.pages) else None

    # Extract tables from page 1
    tables = page1.extract_tables()
    text1 = page1.extract_text() or ""
    text2 = page2.extract_text() if page2 else ""

    # Parse header from text
    header = extract_header(text1.split("\n"))

    school = {
        "name": header.get("name"),
        "nameEn": header.get("nameEn"),
        "district": district,
        "address": header.get("address"),
        "phone": header.get("phone"),
        "fax": header.get("fax"),
        "email": header.get("email"),
        "website": header.get("website"),
    }

    # Parse each table
    if len(tables) >= 1:
        info = extract_school_info_table(tables[0])
        school.update(info)
        # Use school net from header if available, otherwise from info table
        if header.get("schoolNetFromHeader"):
            school["schoolNetNumber"] = header["schoolNetFromHeader"]

    if len(tables) >= 2:
        school["fees"] = extract_fees_table(tables[1])

    if len(tables) >= 3:
        school["facilities"] = extract_facilities_table(tables[2])

    if len(tables) >= 4:
        school["teachers"] = extract_teachers_table(tables[3])

    if len(tables) >= 5:
        classes = extract_class_structure_table(tables[4])
        school["classStructure"] = {
            "current": classes["current"],
            "next": classes["next"],
        }
        school["teachingMode"] = classes["teachingMode"]

    if len(tables) >= 6:
        school["assessment"] = extract_assessment_table(tables[5])

    if len(tables) >= 7:
        school["schoolLife"] = extract_school_life_table(tables[6])

    # Parse narrative page
    if text2:
        narrative = parse_narrative_page(text2)
        school["ecas"] = narrative.get("ecas")
        school["mission"] = narrative.get("mission")
        school["teachingStrategies"] = narrative.get("teachingStrategies")
        school["curriculumUpdates"] = narrative.get("curriculumUpdates")
        school["genericSkills"] = narrative.get("genericSkills")
        school["valuesEducation"] = narrative.get("valuesEducation")
        school["studentDiversity"] = narrative.get("studentDiversity")
        school["inclusiveEd"] = narrative.get("inclusiveEd")
        school["ncsSupport"] = narrative.get("ncsSupport")
        school["curriculumAdaptation"] = narrative.get("curriculumAdaptation")
        school["parentCooperation"] = narrative.get("parentCooperation")
        school["schoolEthos"] = narrative.get("schoolEthos")
        school["futureDevelopment"] = narrative.get("futureDevelopment")
        school["achievements"] = narrative.get("achievements")

    # Clean up temp keys
    school.pop("schoolNetFromHeader", None)

    return school


def main():
    targets = load_targets()
    print(f"Loaded {len(targets)} target schools from schools.json")

    # Build reverse lookup including aliases
    target_lookup = {}
    for name in targets:
        target_lookup[name] = name
    for pdf_name, json_name in NAME_ALIASES.items():
        if json_name in targets:
            target_lookup[pdf_name] = json_name

    all_details = []
    matched_names = set()

    for district, pdf_path in PDF_FILES.items():
        print(f"\nProcessing {district} ({pdf_path})...")
        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                print(f"  {total_pages} pages")

                # Scan all pages to find school data pages (not assuming even alignment)
                for page_idx in range(total_pages):
                    text = pdf.pages[page_idx].extract_text() or ""
                    first_line = text.split("\n")[0].strip()

                    # Skip narrative pages (start with 全方位學習)
                    if first_line == "全方位學習":
                        continue

                    school_name = first_line

                    # Check if this school is in our target list
                    json_name = target_lookup.get(school_name)
                    if not json_name:
                        continue

                    print(f"  Extracting: {school_name}")
                    school_data = extract_school(pdf, page_idx, district)

                    # Use the canonical name from schools.json
                    school_data["name"] = json_name

                    # Merge with existing ranked data
                    existing = targets[json_name]
                    school_data["id"] = existing["id"]
                    school_data["rank"] = existing["rank"]

                    all_details.append(school_data)
                    matched_names.add(json_name)

        except FileNotFoundError:
            print(f"  WARNING: {pdf_path} not found, skipping")

    # Report results
    print(f"\n{'='*60}")
    print(f"Extracted {len(all_details)} schools")
    unmatched = set(targets.keys()) - matched_names
    if unmatched:
        print(f"Unmatched ({len(unmatched)}): {unmatched}")

    # Sort by rank
    all_details.sort(key=lambda s: s.get("rank", 999))

    # Write output
    output_path = "school_details.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_details, f, ensure_ascii=False, indent=2)
    print(f"Written to {output_path}")

    return all_details


if __name__ == "__main__":
    results = main()

    # Quick validation
    print(f"\n{'='*60}")
    print("Sample output (first school):")
    if results:
        s = results[0]
        print(f"  Name: {s.get('name')}")
        print(f"  Rank: {s.get('rank')}")
        print(f"  Religion: {s.get('religion')}")
        print(f"  Teaching Language: {s.get('teachingLanguage')}")
        print(f"  Founding Year: {s.get('foundingYear')}")
        print(f"  Principal: {s.get('principal')}")
        print(f"  Category: {s.get('schoolCategory')}")
        fees = s.get("fees", {})
        print(f"  PTA Fees: ${fees.get('ptaFees')}")
        teachers = s.get("teachers", {})
        print(f"  Teachers: {teachers.get('totalCount')} (master+: {teachers.get('masterPlusPct')}%)")
        classes = s.get("classStructure", {}).get("next", {})
        print(f"  Next year P1 classes: {classes.get('p1')}")
        print(f"  Mission: {(s.get('mission') or '')[:80]}...")
