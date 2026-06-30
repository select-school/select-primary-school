const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const schools = JSON.parse(fs.readFileSync(path.join(__dirname, 'schools.json'), 'utf-8'));
const schoolNets = JSON.parse(fs.readFileSync(path.join(__dirname, 'school_nets.json'), 'utf-8'));

const DATA_DIR = process.env.DATA_DIR || __dirname;
const USER_DATA_PATH = path.join(DATA_DIR, 'user_data.json');

function loadUserData() {
  try {
    return JSON.parse(fs.readFileSync(USER_DATA_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveUserData(data) {
  fs.writeFileSync(USER_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/schools', (req, res) => res.json(schools));
app.get('/api/school-nets', (req, res) => res.json(schoolNets));

app.get('/api/user-data', (req, res) => {
  res.json(loadUserData());
});

app.put('/api/user-data', (req, res) => {
  const { id, rating, ratingReason, notes } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing id' });
  const userData = loadUserData();
  if (!userData[id]) userData[id] = {};
  if (rating !== undefined) userData[id].rating = rating;
  if (ratingReason !== undefined) userData[id].ratingReason = ratingReason;
  if (notes !== undefined) userData[id].notes = notes;
  userData[id].updatedAt = new Date().toISOString();
  saveUserData(userData);
  res.json({ success: true });
});

app.put('/api/preferences', (req, res) => {
  const userData = loadUserData();
  userData._preferences = { ...req.body, updatedAt: new Date().toISOString() };
  saveUserData(userData);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Loaded ${schools.length} schools`);
});
