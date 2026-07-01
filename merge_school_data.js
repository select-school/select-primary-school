#!/usr/bin/env node
/**
 * Merge extracted school details from EDB PDFs into the existing schools.json.
 *
 * - Matches by school name
 * - Preserves existing fields (id, rank, schoolNet)
 * - Adds all new detailed fields from school_details.json
 * - Outputs enriched public/schools.json and root schools.json
 */

const fs = require('fs');
const path = require('path');

const existingSchools = JSON.parse(fs.readFileSync('schools.json', 'utf-8'));
const detailsRaw = fs.readFileSync('school_details.json', 'utf-8');
const details = JSON.parse(detailsRaw);

// Build lookup by name
const detailsByName = {};
for (const d of details) {
  detailsByName[d.name] = d;
}

let enrichedCount = 0;

const merged = existingSchools.map(school => {
  const detail = detailsByName[school.name];
  if (!detail) {
    // Standardize gender even for non-enriched schools
    if (school.gender === '男') school.gender = '男校';
    else if (school.gender === '男女') school.gender = '男女校';
    return school;
  }

  enrichedCount++;

  // Start with all detail fields, then override with existing canonical fields
  const enriched = { ...detail };

  // Preserve existing fields that are authoritative
  enriched.id = school.id;
  enriched.rank = school.rank;
  enriched.name = school.name;
  enriched.district = school.district;
  enriched.schoolNet = school.schoolNet; // array from original data

  // Standardize and keep gender
  const rawGender = detail.gender || school.gender;
  if (rawGender === '男' || rawGender === '男校') enriched.gender = '男校';
  else if (rawGender === '男女' || rawGender === '男女校') enriched.gender = '男女校';
  else if (rawGender === '女' || rawGender === '女校') enriched.gender = '女校';
  else enriched.gender = rawGender;
  enriched.tuition = school.tuition;
  enriched.campusArea = detail.campusArea || school.campusArea;
  enriched.classroomCount = detail.facilities?.classrooms || school.classroomCount;
  enriched.specialRooms = detail.facilities?.specialRooms || school.specialRooms;

  // Build a combined relatedSecondary string for backward compat
  if (detail.linkedSecondary && detail.linkedSecondary.length > 0) {
    enriched.relatedSecondary = detail.linkedSecondary
      .map(s => `${s.type}：${s.name}`)
      .join('；');
  } else {
    enriched.relatedSecondary = school.relatedSecondary;
  }

  // Remove temp/internal fields
  delete enriched.schoolNetNumber;

  return enriched;
});

// Write outputs
const output = JSON.stringify(merged, null, 2);
fs.writeFileSync('schools.json', output, 'utf-8');
fs.writeFileSync('public/schools.json', output, 'utf-8');

console.log(`Merged ${enrichedCount} schools with detailed data`);
console.log(`Total schools: ${merged.length}`);
console.log(`Written to schools.json and public/schools.json`);

// Validation: show a sample enriched school
const sample = merged.find(s => detailsByName[s.name]);
if (sample) {
  const newFields = Object.keys(sample).filter(k =>
    !['id', 'rank', 'name', 'gender', 'district', 'schoolNet', 'tuition',
      'assessment', 'relatedSecondary', 'campusArea', 'classroomCount',
      'specialRooms', 'facilities'].includes(k)
  );
  console.log(`\nSample enriched school: ${sample.name}`);
  console.log(`New fields added: ${newFields.length}`);
  console.log(`Fields: ${newFields.join(', ')}`);
}
