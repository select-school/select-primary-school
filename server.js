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

app.get('/api/schools', (req, res) => {
  const userData = loadUserData();
  const merged = schools.map(school => ({
    ...school,
    userData: userData[school.id] || null,
  }));
  res.json(merged);
});

app.get('/api/school-nets', (req, res) => {
  res.json(schoolNets);
});

app.put('/api/schools/:id/ranking', (req, res) => {
  const { id } = req.params;
  const { rating, ratingReason } = req.body;
  if (!schools.find(s => s.id === id)) {
    return res.status(404).json({ error: 'School not found' });
  }
  const valid = [null, 'Top', 'High', 'Medium'];
  if (!valid.includes(rating)) {
    return res.status(400).json({ error: 'Invalid rating. Must be Top, High, Medium, or null' });
  }
  const userData = loadUserData();
  if (!userData[id]) userData[id] = {};
  userData[id].rating = rating;
  userData[id].ratingReason = ratingReason || '';
  userData[id].updatedAt = new Date().toISOString();
  saveUserData(userData);
  res.json({ success: true });
});

app.put('/api/schools/:id/notes', (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  if (!schools.find(s => s.id === id)) {
    return res.status(404).json({ error: 'School not found' });
  }
  const userData = loadUserData();
  if (!userData[id]) userData[id] = {};
  userData[id].notes = notes || '';
  userData[id].updatedAt = new Date().toISOString();
  saveUserData(userData);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Loaded ${schools.length} schools`);
});
