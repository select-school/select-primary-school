const fs = require('fs');

const csv = fs.readFileSync('top100_schools.csv', 'utf-8');
const nets = JSON.parse(fs.readFileSync('school_nets.json', 'utf-8'));

const districtNormalize = { '元朗': '元朗區', '葵涌區': '葵青區' };
const genderNormalize = { '男女': '男女校' };

const districtToNets = {};
for (const [net, district] of Object.entries(nets)) {
  if (!districtToNets[district]) districtToNets[district] = [];
  districtToNets[district].push(parseInt(net, 10));
}
for (const arr of Object.values(districtToNets)) arr.sort((a, b) => a - b);

const lines = csv.split('\n');
const headers = parseCSVRow(lines[0]);
const schools = [];

let i = 1;
while (i < lines.length) {
  let row = lines[i];
  i++;
  while (i < lines.length && countFields(row, headers.length) < 0) {
    row += '\n' + lines[i];
    i++;
  }
  if (!row.trim()) continue;
  const fields = parseCSVRow(row);
  if (fields.length < headers.length) continue;

  const rawDistrict = fields[3].trim();
  const district = districtNormalize[rawDistrict] || rawDistrict;
  const rawGender = fields[2].trim();
  const gender = genderNormalize[rawGender] || rawGender;

  schools.push({
    id: String(schools.length + 1),
    rank: parseInt(fields[0], 10),
    name: fields[1].trim(),
    gender,
    district,
    schoolNet: districtToNets[district] || [],
    tuition: fields[4].trim(),
    assessment: fields[5].trim(),
    relatedSecondary: fields[6].trim(),
    campusArea: fields[7].trim(),
    classroomCount: parseInt(fields[8], 10) || 0,
    specialRooms: fields[9].trim(),
    facilities: fields[10].trim(),
  });
}

fs.writeFileSync('schools.json', JSON.stringify(schools, null, 2), 'utf-8');
console.log(`Converted ${schools.length} schools to schools.json`);

function parseCSVRow(row) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let c = 0; c < row.length; c++) {
    const ch = row[c];
    if (inQuotes) {
      if (ch === '"' && row[c + 1] === '"') {
        current += '"';
        c++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function countFields(row, expected) {
  const fields = parseCSVRow(row);
  return fields.length >= expected ? fields.length : -1;
}
