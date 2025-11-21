// server/server.js
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for large datasets

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to read JSON files
const readJson = (file) => {
  try {
    const fullPath = path.join(DATA_DIR, file);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
    return null;
  }
};

// Helper to write JSON files
const writeJson = (file, data) => {
  try {
    const fullPath = path.join(DATA_DIR, file);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Error writing ${file}:`, e.message);
    return false;
  }
};

// Helper to delete files
const deleteFile = (file) => {
  try {
    const fullPath = path.join(DATA_DIR, file);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch (e) {
    console.error(`Error deleting ${file}:`, e.message);
    return false;
  }
};

// ==========================================
// TRAINING DATA ENDPOINTS
// ==========================================

// Save training data (POST)
app.post('/api/training-data', (req, res) => {
  const { sport, rows } = req.body;
  
  if (!sport || !Array.isArray(rows)) {
    return res.status(400).json({ 
      error: 'sport and rows required',
      received: { sport: typeof sport, rows: typeof rows }
    });
  }

  const success = writeJson(`training_${sport}.json`, rows);
  
  if (success) {
    res.json({ 
      ok: true, 
      count: rows.length,
      sport,
      saved: true
    });
  } else {
    res.status(500).json({ error: 'Failed to save training data' });
  }
});

// Get training data (GET)
app.get('/api/training-data', (req, res) => {
  const sport = req.query.sport;
  
  if (!sport) {
    return res.status(400).json({ error: 'sport parameter required' });
  }

  const data = readJson(`training_${sport}.json`);
  
  if (data === null) {
    return res.status(404).json({ 
      error: 'No training data found',
      sport 
    });
  }

  res.json({ 
    sport, 
    rows: Array.isArray(data) ? data : []
  });
});

// ✅ NEW: Delete training data (DELETE)
app.delete('/api/training-data', (req, res) => {
  const sport = req.query.sport;
  
  if (!sport) {
    return res.status(400).json({ error: 'sport parameter required' });
  }

  const deleted = deleteFile(`training_${sport}.json`);
  
  res.json({ 
    ok: true, 
    deleted,
    sport,
    message: deleted ? 'Training data deleted' : 'No training data found to delete'
  });
});

// ==========================================
// MODEL ENDPOINTS
// ==========================================

// Save model (POST)
app.post('/api/model', (req, res) => {
  const { sport, modelParams, trainingStats } = req.body;
  
  if (!sport || !modelParams) {
    return res.status(400).json({ 
      error: 'sport and modelParams required',
      received: { sport: typeof sport, modelParams: typeof modelParams }
    });
  }

  const payload = {
    sport,
    modelParams,
    trainingStats: trainingStats || null,
    savedAt: new Date().toISOString(),
  };

  const success = writeJson(`model_${sport}.json`, payload);
  
  if (success) {
    res.json({ 
      ok: true,
      sport,
      saved: true
    });
  } else {
    res.status(500).json({ error: 'Failed to save model' });
  }
});

// Get model (GET)
app.get('/api/model', (req, res) => {
  const sport = req.query.sport;
  
  if (!sport) {
    return res.status(400).json({ error: 'sport parameter required' });
  }

  const data = readJson(`model_${sport}.json`);
  
  if (!data) {
    return res.status(404).json({ 
      error: 'No model found',
      sport 
    });
  }

  res.json(data);
});

// ✅ NEW: Delete model (DELETE)
app.delete('/api/model', (req, res) => {
  const sport = req.query.sport;
  
  if (!sport) {
    return res.status(400).json({ error: 'sport parameter required' });
  }

  const deleted = deleteFile(`model_${sport}.json`);
  
  res.json({ 
    ok: true, 
    deleted,
    sport,
    message: deleted ? 'Model deleted' : 'No model found to delete'
  });
});

// ==========================================
// UTILITY ENDPOINTS
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    dataDir: DATA_DIR
  });
});

// List all saved sports
app.get('/api/sports', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const sports = new Set();
    
    files.forEach(file => {
      const match = file.match(/^(training|model)_(.+)\.json$/);
      if (match) {
        sports.add(match[2]);
      }
    });
    
    res.json({ 
      sports: Array.from(sports),
      count: sports.size
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list sports' });
  }
});

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`✅ Sports Prediction Model Server running on http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET    /api/health`);
  console.log(`  GET    /api/sports`);
  console.log(`  POST   /api/training-data`);
  console.log(`  GET    /api/training-data?sport=nfl`);
  console.log(`  DELETE /api/training-data?sport=nfl`);
  console.log(`  POST   /api/model`);
  console.log(`  GET    /api/model?sport=nfl`);
  console.log(`  DELETE /api/model?sport=nfl`);
});
