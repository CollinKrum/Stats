import React, { useState, useEffect } from 'react';
import {
  Upload,
  Database,
  Target,
  Download,
  Sparkles,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Minus,
  TrendingUp,
} from 'lucide-react';

const SportsPredictionModel = () => {
  const [selectedSport, setSelectedSport] = useState('nfl');
  const [trainingData, setTrainingData] = useState([]);
  const [modelTrained, setModelTrained] = useState(false);
  const [modelParams, setModelParams] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [matchupInputs, setMatchupInputs] = useState({});
  const [actualML1, setActualML1] = useState('');
  const [actualML2, setActualML2] = useState('');
  const [evResult, setEvResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStats, setTrainingStats] = useState(null);
  const [featureImportance, setFeatureImportance] = useState(null);
  const [appendMode, setAppendMode] = useState(false);

  const sports = {
    nfl: {
      name: 'NFL',
      features: ['team1_moneyline', 'team2_moneyline', 'team1_last5', 'team2_last5'],
      isTeamSeasonSport: true,
    },
    ncaaf: {
      name: 'NCAAF',
      features: ['team1_moneyline', 'team2_moneyline', 'team1_last5', 'team2_last5'],
      isTeamSeasonSport: true,
    },
    ncaab: {
      name: 'NCAAB',
      features: ['team1_moneyline', 'team2_moneyline', 'team1_last5', 'team2_last5'],
      isTeamSeasonSport: true,
    },
    nba: {
      name: 'NBA',
      features: ['team1_moneyline', 'team2_moneyline', 'team1_last5', 'team2_last5'],
      isTeamSeasonSport: true,
    },
    tennis: {
      name: 'Tennis',
      features: [
        'player1_ranking',
        'player2_ranking',
        'surface',
        'player1_form',
        'player2_form',
        'head_to_head',
        'fatigue_factor',
      ],
      isTeamSeasonSport: false,
    },
    table_tennis: {
      name: 'Table Tennis',
      features: [
        'player1_ranking',
        'player2_ranking',
        'player1_recent_form',
        'player2_recent_form',
        'head_to_head',
        'tournament_level',
      ],
      isTeamSeasonSport: false,
    },
  };

  useEffect(() => {
    loadSaved();
  }, [selectedSport]);

  const loadSaved = async () => {
    try {
      const tdResult = await window.storage.get(`training-${selectedSport}`, false);
      if (tdResult && tdResult.value) {
        const rows = JSON.parse(tdResult.value);
        setTrainingData(rows);
        setFileName('(loaded from storage)');
      }

      const modelResult = await window.storage.get(`model-${selectedSport}`, false);
      if (modelResult && modelResult.value) {
        const data = JSON.parse(modelResult.value);
        if (data.modelParams) {
          setModelParams(data.modelParams);
          setModelTrained(true);
        }
        if (data.trainingStats) setTrainingStats(data.trainingStats);
      }

      setPrediction(null);
      setEvResult(null);
      setMatchupInputs({});
      setAppendMode(false);
    } catch (err) {
      console.log('No saved data found');
    }
  };

  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  const moneylineToFairProb = (ml) => {
    const num = Number(ml);
    if (!Number.isFinite(num)) return 0.5;
    if (num > 0) return 100 / (num + 100);
    const neg = Math.abs(num);
    return neg / (neg + 100);
  };

  const removeVig = (p1, p2) => {
    const total = p1 + p2;
    if (!Number.isFinite(total) || total <= 1.0001) return { p1, p2 };
    return { p1: p1 / total, p2: p2 / total };
  };

  const probToMoneyline = (prob) => {
    if (!Number.isFinite(prob) || prob <= 0 || prob >= 1) return 0;
    if (prob >= 0.5) return Math.round(-(prob / (1 - prob)) * 100);
    return Math.round(((1 - prob) / prob) * 100);
  };

  const formatMoneyline = (ml) => {
    const m = Math.round(Number(ml));
    if (!Number.isFinite(m)) return 'N/A';
    return m > 0 ? `+${m}` : m.toString();
  };

  const checkSpreadWinner = (homeScore, awayScore, spread) => {
    const h = parseFloat(homeScore);
    const a = parseFloat(awayScore);
    const s = parseFloat(spread);
    
    if (!isFinite(h) || !isFinite(a) || !isFinite(s)) return null;
    
    const adjustedHome = h + s;
    if (adjustedHome > a) return 'home';
    if (adjustedHome < a) return 'away';
    return 'push';
  };

  const determineWinnerFromScores = (homeScore, awayScore, spread = null) => {
    const h = parseFloat(homeScore);
    const a = parseFloat(awayScore);
    if (!isFinite(h) || !isFinite(a)) return null;

    if (spread !== null && spread !== '') {
      const s = parseFloat(spread);
      if (isFinite(s)) {
        const result = checkSpreadWinner(homeScore, awayScore, spread);
        return result === 'home' ? 1 : result === 'away' ? 0 : null;
      }
    }
    return h > a ? 1 : 0;
  };

  const trainLogisticRegression = (X, y, options = {}) => {
    const nSamples = X.length;
    const nFeatures = X[0].length;
    const learningRate = options.learningRate ?? 0.12;
    const epochs = options.epochs ?? 500;
    const lambda = options.lambda ?? 0.012;

    const means = X[0].map((_, j) => {
      let sum = 0;
      for (let i = 0; i < nSamples; i++) {
        const v = Number.isFinite(X[i][j]) ? X[i][j] : 0;
        sum += v;
      }
      return sum / nSamples;
    });

    const stds = X[0].map((_, j) => {
      let variance = 0;
      for (let i = 0; i < nSamples; i++) {
        const v = Number.isFinite(X[i][j]) ? X[i][j] : 0;
        const diff = v - means[j];
        variance += diff * diff;
      }
      variance /= nSamples;
      const s = Math.sqrt(variance);
      return s || 1;
    });

    const Xnorm = X.map((row) =>
      row.map((val, j) => {
        const v = Number.isFinite(val) ? val : 0;
        return (v - means[j]) / stds[j];
      })
    );

    let weights = Array(nFeatures).fill(0);
    let bias = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let gradW = Array(nFeatures).fill(0);
      let gradB = 0;

      for (let i = 0; i < nSamples; i++) {
        const z = bias + weights.reduce((sum, w, j) => sum + w * Xnorm[i][j], 0);
        const p = sigmoid(z);
        const error = p - y[i];
        gradW = gradW.map((g, j) => g + error * Xnorm[i][j]);
        gradB += error;
      }

      gradW = gradW.map((g) => g / nSamples);
      gradB /= nSamples;

      weights = weights.map((w, j) => w - learningRate * (gradW[j] + lambda * w));
      bias -= learningRate * gradB;
    }

    const preds = Xnorm.map((row) => {
      const z = bias + weights.reduce((sum, w, j) => sum + w * row[j], 0);
      return sigmoid(z);
    });

    let correct = 0;
    for (let i = 0; i < nSamples; i++) {
      const p = preds[i];
      if (!Number.isFinite(p)) continue;
      const label = p >= 0.5 ? 1 : 0;
      if (label === y[i]) correct++;
    }
    const accuracy = correct / nSamples;

    return {
      weights,
      bias,
      means,
      stds,
      accuracy,
      samplesUsed: nSamples,
    };
  };

  const addLast5WinColumns = (rows) => {
    const history = {};
    return rows.map((row) => {
      const team1 = row.team1 || row.home_team;
      const team2 = row.team2 || row.away_team;
      const t1Hist = history[team1] || [];
      const t2Hist = history[team2] || [];

      const t1Last5 = t1Hist.slice(-5);
      const t2Last5 = t2Hist.slice(-5);

      const t1Rate = t1Last5.length > 0 ? t1Last5.reduce((a, b) => a + b, 0) / t1Last5.length : 0.5;
      const t2Rate = t2Last5.length > 0 ? t2Last5.reduce((a, b) => a + b, 0) / t2Last5.length : 0.5;

      let winner = row.winner;
      if (winner === undefined || winner === null || winner === '') {
        winner = determineWinnerFromScores(
          row.home_final_score || row.homeScore,
          row.away_final_score || row.awayScore,
          row.spread
        );
      }

      const t1Result = Number(winner) === 1 ? 1 : 0;
      const t2Result = Number(winner) === 0 ? 1 : 0;

      history[team1] = [...t1Hist, t1Result];
      history[team2] = [...t2Hist, t2Result];

      return {
        ...row,
        team1_last5: t1Rate,
        team2_last5: t2Rate,
        winner: Number(winner),
      };
    });
  };

  const parseCSV = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const parts = line.split(',');
      const obj = {};
      header.forEach((key, idx) => {
        const raw = (parts[idx] ?? '').trim();
        if (raw === '') {
          obj[key] = '';
        } else if (!Number.isNaN(Number(raw))) {
          obj[key] = Number(raw);
        } else {
          obj[key] = raw;
        }
      });
      return obj;
    });
  };

  const handleDataUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const text = await file.text();
      let newRows = parseCSV(text);

      let finalRows;

      if (sports[selectedSport].isTeamSeasonSport) {
        if (appendMode && trainingData.length > 0) {
          const combined = [...trainingData, ...newRows];
          finalRows = addLast5WinColumns(combined);
        } else {
          finalRows = addLast5WinColumns(newRows);
        }
      } else {
        finalRows = appendMode ? [...trainingData, ...newRows] : newRows;
      }

      setTrainingData(finalRows);
      setTrainingStats(null);
      setModelTrained(false);
      setModelParams(null);
      setPrediction(null);
      setEvResult(null);

      await window.storage.set(`training-${selectedSport}`, JSON.stringify(finalRows), false);

      alert(
        appendMode
          ? `✅ Added ${newRows.length} games (Total: ${finalRows.length})`
          : `✅ Loaded ${finalRows.length} games`
      );
    } catch (err) {
      console.error('Upload failed', err);
      alert('Failed to read CSV');
    } finally {
      e.target.value = '';
    }
  };

  const exportTrainingData = () => {
    if (!trainingData.length) {
      alert('No training data to export');
      return;
    }
    const keys = Array.from(new Set(trainingData.flatMap((row) => Object.keys(row))));
    const header = keys.join(',');
    const rows = trainingData.map((row) =>
      keys
        .map((k) => {
          const v = row[k];
          if (v === undefined || v === null) return '';
          return String(v).replace(/,/g, '');
        })
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSport}_training_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearSportData = async () => {
    if (!window.confirm(`Clear all data for ${sports[selectedSport].name}?`)) return;

    setTrainingData([]);
    setModelParams(null);
    setModelTrained(false);
    setTrainingStats(null);
    setFeatureImportance(null);
    setPrediction(null);
    setEvResult(null);
    setMatchupInputs({});
    setActualML1('');
    setActualML2('');
    setFileName('');

    try {
      await window.storage.delete(`training-${selectedSport}`, false);
      await window.storage.delete(`model-${selectedSport}`, false);
    } catch (e) {
      console.warn('Failed to clear storage', e);
    }
  };

  const downloadTemplate = () => {
    const sportDef = sports[selectedSport];
    let baseCols = [];

    if (sportDef.isTeamSeasonSport) {
      baseCols = ['date', 'team1', 'team2', 'team1_moneyline', 'team2_moneyline', 'spread', 'home_final_score', 'away_final_score'];
    } else if (selectedSport === 'tennis') {
      baseCols = [
        'player1',
        'player2',
        'player1_ranking',
        'player2_ranking',
        'surface',
        'player1_form',
        'player2_form',
        'head_to_head',
        'fatigue_factor',
        'winner',
      ];
    } else if (selectedSport === 'table_tennis') {
      baseCols = [
        'player1',
        'player2',
        'player1_ranking',
        'player2_ranking',
        'player1_recent_form',
        'player2_recent_form',
        'head_to_head',
        'tournament_level',
        'winner',
      ];
    }

    const exampleRow = baseCols
      .map((c) => {
        if (c === 'winner') return '1';
        if (c.includes('moneyline')) return '-150';
        if (c.includes('ranking')) return '10';
        if (c.includes('form')) return '0.6';
        if (c === 'surface') return 'hard';
        if (c === 'tournament_level') return '250';
        if (c === 'spread') return '-3.5';
        if (c.includes('score')) return '110';
        if (c === 'date') return '2024-01-15';
        if (c === 'team1' || c === 'player1') return 'TeamA';
        if (c === 'team2' || c === 'player2') return 'TeamB';
        return '';
      })
      .join(',');

    const csv = [baseCols.join(','), exampleRow].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSport}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const trainModel = async () => {
    if (trainingData.length < 20) {
      alert('Need at least 20 games');
      return;
    }

    const { features } = sports[selectedSport];
    const usable = trainingData.filter(
      (r) => r.winner === 0 || r.winner === 1 || r.winner === '0' || r.winner === '1'
    );

    if (!usable.length) {
      alert('No rows with winner = 0 or 1');
      return;
    }

    const X = usable.map((row) =>
      features.map((f) => {
        if (f.includes('moneyline')) {
          const p1 = moneylineToFairProb(row.team1_moneyline);
          const p2 = moneylineToFairProb(row.team2_moneyline);
          const { p1: fair1, p2: fair2 } = removeVig(p1, p2);
          const val = f === 'team1_moneyline' ? fair1 : fair2;
          return Number.isFinite(val) ? val : 0.5;
        }
        const raw = row[f];
        const num = Number(raw);
        return Number.isFinite(num) ? num : 0;
      })
    );

    const y = usable.map((r) => Number(r.winner));

    setIsTraining(true);

    let model;
    let stats;
    let importance;

    try {
      const result = trainLogisticRegression(X, y, {
        learningRate: 0.12,
        epochs: 500,
        lambda: 0.012,
      });

      const { weights, bias, means, stds, accuracy, samplesUsed } = result;

      model = { weights, bias, means, stds, features };
      stats = {
        accuracy: (accuracy * 100).toFixed(1),
        samplesUsed,
      };

      importance = features
        .map((f, i) => ({ feature: f, weight: Math.abs(weights[i]) }))
        .sort((a, b) => b.weight - a.weight);

      setModelParams(model);
      setModelTrained(true);
      setTrainingStats(stats);
      setFeatureImportance(importance);

      await window.storage.set(
        `model-${selectedSport}`,
        JSON.stringify({ modelParams: model, trainingStats: stats }),
        false
      );

      alert(`PRO MODEL TRAINED — ${samplesUsed} games — ${(accuracy * 100).toFixed(1)}% accuracy`);
    } catch (err) {
      console.error('Training error', err);
      alert(`Training failed: ${err?.message || 'unexpected error'}`);
    } finally {
      setIsTraining(false);
    }
  };

  const calculateEV = (modelProb, ml1, ml2) => {
    const fair1 = modelProb;
    const fair2 = 1 - modelProb;

    const payout1 = ml1 > 0 ? ml1 / 100 + 1 : 1 + 100 / Math.abs(ml1);
    const payout2 = ml2 > 0 ? ml2 / 100 + 1 : 1 + 100 / Math.abs(ml2);

    const ev1 = (fair1 * payout1 - (1 - fair1)) * 100;
    const ev2 = (fair2 * payout2 - (1 - fair2)) * 100;

    const bestEV = Math.max(ev1, ev2);
    const side = ev1 > ev2 ? 'Team 1' : 'Team 2';

    setEvResult({
      ev1: ev1.toFixed(1),
      ev2: ev2.toFixed(1),
      bestEV: bestEV.toFixed(1),
      side,
    });
  };

  const calculatePrediction = () => {
    if (!modelTrained || !modelParams) {
      alert('Train model first');
      return;
    }

    const { weights, bias, means, stds, features } = modelParams;

    const missing = features.filter(
      (f) => matchupInputs[f] === undefined || matchupInputs[f] === null || matchupInputs[f] === ''
    );
    if (missing.length) {
      alert(`Missing: ${missing.join(', ')}`);
      return;
    }

    let team1Fair = null;
    let team2Fair = null;

    if (features.includes('team1_moneyline') && features.includes('team2_moneyline')) {
      const ml1 = parseFloat(matchupInputs['team1_moneyline']);
      const ml2 = parseFloat(matchupInputs['team2_moneyline']);
      const p1 = moneylineToFairProb(ml1);
      const p2 = moneylineToFairProb(ml2);
      const novig = removeVig(p1, p2);
      team1Fair = novig.p1;
      team2Fair = novig.p2;
    }

    const raw = features.map((f) => {
      if (f === 'team1_moneyline' && team1Fair !== null) return team1Fair;
      if (f === 'team2_moneyline' && team2Fair !== null) return team2Fair;
      const val = parseFloat(matchupInputs[f]);
      return Number.isFinite(val) ? val : 0;
    });

    const xNorm = raw.map((v, j) => (v - means[j]) / stds[j]);
    const z = bias + weights.reduce((s, w, j) => s + w * xNorm[j], 0);
    const p = sigmoid(z);

    const t1Prob = p;
    const t2Prob = 1 - p;

    setPrediction({
      team1_win_prob: (t1Prob * 100).toFixed(1),
      team2_win_prob: (t2Prob * 100).toFixed(1),
      team1_implied_line: probToMoneyline(t1Prob),
      team2_implied_line: probToMoneyline(t2Prob),
      confidence: (Math.abs(p - 0.5) * 200).toFixed(1),
    });

    if (actualML1 && actualML2) {
      const ml1 = parseFloat(actualML1);
      const ml2 = parseFloat(actualML2);
      if (!Number.isNaN(ml1) && !Number.isNaN(ml2)) {
        calculateEV(p, ml1, ml2);
      }
    }
  };

  const downloadModelReport = () => {
    if (!modelTrained || !trainingStats || !featureImportance) return;

    const lines = [
      `=== ${sports[selectedSport].name} PRO MODEL REPORT ===`,
      `Trained on: ${trainingStats.samplesUsed} games`,
      `Accuracy: ${trainingStats.accuracy}%`,
      '',
      'Top Features:',
      ...featureImportance
        .slice(0, 5)
        .map((f, i) => `${i + 1}. ${f.feature.replace(/_/g, ' ')} → ${f.weight.toFixed(3)}`),
      '',
      'Spread auto-detection enabled for team sports',
      `Generated: ${new Date().toLocaleString()}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSport}_model_report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8">
            <div className="flex items-center gap-4">
              <Sparkles className="w-12 h-12 text-yellow-300" />
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white">
                  Pro Sports Prediction Model
                </h1>
                <p className="text-blue-100 mt-2">
                  Spread Auto-Detection • +EV Finder • Cloud Sync Across Devices
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-10 space-y-10">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {Object.entries(sports).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => setSelectedSport(key)}
                  className={`py-4 px-6 rounded-2xl font-bold text-lg transition-all ${
                    selectedSport === key
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-xl scale-105'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 flex gap-3">
              <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-200">
                <strong>✨ Syncs across devices!</strong> Upload season data with scores and spreads.
                <br />
                <strong>🎯 Auto-Detection:</strong> Winner determined from final scores + spread (negative = home favored).
                <br />
                <strong>📊 Last 5 calculated automatically</strong> for chronological season uploads.
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <Database className="text-blue-400" /> Training Data
                </h2>

                <div className="mb-6 flex items-center gap-3 p-4 bg-blue-500/10 rounded-xl border border-blue-400/30">
                  <input
                    id="append-mode"
                    type="checkbox"
                    checked={appendMode}
                    onChange={(e) => setAppendMode(e.target.checked)}
                    className="w-5 h-5 rounded accent-blue-500 cursor-pointer"
                  />
                  <label htmlFor="append-mode" className="text-white font-semibold cursor-pointer flex-1">
                    📎 Append to existing {trainingData.length} games (don't replace)
                  </label>
                </div>

                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-white/30 rounded-2xl p-10 text-center hover:border-blue-400 transition-all">
                    <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                    <p className="text-xl font-bold text-white">Upload Season CSV</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {appendMode ? 'Will add to existing data' : 'Will replace current data'}
                    </p>
                    {fileName && <p className="text-sm text-gray-400 mt-2">{fileName}</p>}
                    <input type="file" accept=".csv" onChange={handleDataUpload} className="hidden" />
                  </div>
                </label>

                {trainingData.length > 0 && (
                  <div className="mt-6 p-6 bg-green-500/20 rounded-xl border border-green-400/40">
                    <p className="text-green-300 text-lg font-bold">
                      Loaded {trainingData.length} games
                    </p>
                    {trainingStats && (
                      <p className="text-sm mt-2 text-green-200">
                        Accuracy: <strong>{trainingStats.accuracy}%</strong> on{' '}
                        {trainingStats.samplesUsed} clean games
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={trainModel}
                  disabled={isTraining || trainingData.length === 0}
                  className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-blue-600 text-white py-5 rounded-2xl font-bold text-xl hover:shadow-2xl transition-all disabled:opacity-50"
                >
                  {isTraining ? 'Training Pro Model...' : 'Train Pro Model'}
                </button>

                {modelTrained && (
                  <div className="mt-6 p-6 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-400/40">
                    <p className="text-blue-300 font-bold text-lg">Pro Model Ready</p>
                    {featureImportance && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-blue-200">Top Features:</p>
                        {featureImportance.slice(0, 4).map((f, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-blue-100">
                              {i + 1}. {f.feature.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-blue-300">{f.weight.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={downloadTemplate}
                      className="bg-white/10 hover:bg-white/20 py-4 rounded-xl text-white font-semibold"
                    >
                      Template
                    </button>
                    <button
                      onClick={exportTrainingData}
                      className="bg-white/10 hover:bg-white/20 py-4 rounded-xl text-white font-semibold"
                    >
                      Export Data
                    </button>
                    <button
                      onClick={clearSportData}
                      className="bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 py-4 rounded-xl text-red-300 font-semibold col-span-2"
                    >
                      Clear All
                    </button>
                  </div>
                  {modelTrained && (
                    <button
                      onClick={downloadModelReport}
                      className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3"
                    >
                      <Download className="w-5 h-5" /> Download Model Report
                    </button>
                  )}
                </div>
              </div>
            </div>

            {modelTrained && (
              <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
                <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-4">
                  <Target className="text-purple-400" /> Predict Matchup + Find +EV
                </h2>

                <div className="grid lg:grid-cols-4 gap-6 mb-8">
                  {sports[selectedSport].features.map((f) => (
                    <div key={f}>
                      <label className="block text-sm font-bold text-gray-300 mb-2">
                        {f.replace(/_/g, ' ').toUpperCase()}
                      </label>
                      <input
                        type="number"
                        step={f.includes('last5') ? '0.01' : '1'}
                        value={matchupInputs[f] || ''}
                        onChange={(e) =>
                          setMatchupInputs((p) => ({
                            ...p,
                            [f]: e.target.value,
                          }))
                        }
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-bold text-yellow-300 mb-2">
                      Actual Sportsbook ML (Team 1)
                    </label>
                    <input
                      type="number"
                      value={actualML1}
                      onChange={(e) => setActualML1(e.target.value)}
                      placeholder="-150"
                      className="w-full bg-yellow-500/10 border border-yellow-400/50 rounded-xl px-5 py-4 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-yellow-300 mb-2">
                      Actual Sportsbook ML (Team 2)
                    </label>
                    <input
                      type="number"
                      value={actualML2}
                      onChange={(e) => setActualML2(e.target.value)}
                      placeholder="+130"
                      className="w-full bg-yellow-500/10 border border-yellow-400/50 rounded-xl px-5 py-4 text-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={calculatePrediction}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-5 rounded-2xl font-bold text-xl hover:shadow-2xl transition-all"
                    >
                      Predict + Find Edge
                    </button>
                  </div>
                </div>

                {prediction && (
                  <div className="space-y-8">
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="bg-gradient-to-br from-blue-600/30 to-blue-800/30 rounded-2xl p-8 border border-blue-400/50">
                        <h3 className="text-2xl font-bold text-blue-300 mb-6">Team 1</h3>
                        <div className="text-5xl font-bold text-white mb-4">
                          {prediction.team1_win_prob}%
                        </div>
                        <div className="text-3xl font-bold text-blue-400">
                          {formatMoneyline(prediction.team1_implied_line)}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-2xl p-8 border border-purple-400/50">
                        <h3 className="text-2xl font-bold text-purple-300 mb-6">Team 2</h3>
                        <div className="text-5xl font-bold text-white mb-4">
                          {prediction.team2_win_prob}%
                        </div>
                        <div className="text-3xl font-bold text-purple-400">
                          {formatMoneyline(prediction.team2_implied_line)}
                        </div>
                      </div>
                    </div>

                    {evResult && (
                      <div
                        className={`p-8 rounded-2xl border-4 ${
                          parseFloat(evResult.bestEV) > 5
                            ? 'bg-green-600/30 border-green-500'
                            : 'bg-red-600/20 border-red-500'
                        }`}
                      >
                        <h3 className="text-3xl font-bold text-white mb-4">
                          {parseFloat(evResult.bestEV) > 5 ? 'STRONG +EV DETECTED' : 'No Edge Found'}
                        </h3>
                        <p className="text-5xl font-bold text-white">
                          {evResult.side === 'Team 1' ? 'BET TEAM 1' : 'BET TEAM 2'} → +
                          {evResult.bestEV}% EV
                        </p>
                        <p className="text-xl text-gray-300 mt-4">
                          Bet $100 → Expected Profit:{' '}
                          <strong className="text-green-400">
                            ${parseFloat(evResult.bestEV).toFixed(1)}
                          </strong>
                        </p>
                      </div>
                    )}

                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-400">
                        Model Confidence: {prediction.confidence}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SportsPredictionModel
