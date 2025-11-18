// server/server.js
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// helper to read/write JSON files
const readJson = (file) => {
  try {
    const fullPath = path.join(DATA_DIR, file);
    if (!fs.existsSync(fullPath)) return null;
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    console.error(e);
    return null;
  }
};

const writeJson = (file, data) => {
  const fullPath = path.join(DATA_DIR, file);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
};

// save training data
app.post('/api/training-data', (req, res) => {
  const { sport, rows } = req.body;
  if (!sport || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'sport and rows required' });
  }
  writeJson(`training_${sport}.json`, rows);
  res.json({ ok: true, count: rows.length });
});

// get training data
app.get('/api/training-data', (req, res) => {
  const sport = req.query.sport;
  if (!sport) return res.status(400).json({ error: 'sport required' });

  const data = readJson(`training_${sport}.json`) || [];
  res.json({ sport, rows: data });
});

// save model
app.post('/api/model', (req, res) => {
  const { sport, modelParams, trainingStats } = req.body;
  if (!sport || !modelParams) {
    return res.status(400).json({ error: 'sport and modelParams required' });
  }

  const payload = {
    sport,
    modelParams,
    trainingStats: trainingStats || null,
    savedAt: new Date().toISOString(),
  };

  writeJson(`model_${sport}.json`, payload);
  res.json({ ok: true });
});

// get model
app.get('/api/model', (req, res) => {
  const sport = req.query.sport;
  if (!sport) return res.status(400).json({ error: 'sport required' });

  const data = readJson(`model_${sport}.json`);
  if (!data) return res.status(404).json({ error: 'no model stored' });

  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
