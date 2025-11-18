import React, { useState, useEffect } from 'react';
import { Upload, TrendingUp, Database, Target, BarChart3, AlertCircle } from 'lucide-react';

const SportsPredictionModel = () => {
  const [selectedSport, setSelectedSport] = useState('nfl');
  const [trainingData, setTrainingData] = useState([]);
  const [modelTrained, setModelTrained] = useState(false);
  const [modelParams, setModelParams] = useState(null); // weights, bias, means, stds, features
  const [prediction, setPrediction] = useState(null);
  const [matchupInputs, setMatchupInputs] = useState({});
  const [fileName, setFileName] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStats, setTrainingStats] = useState(null); // accuracy, samplesUsed

  // Base URL for the API.  If VITE_API_BASE is defined in your environment, it
  // will be used; otherwise it defaults to localhost:4000.  This makes it
  // simple to point the frontend at a remote server once deployed.
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

  /*
   * When the component mounts or the selectedSport changes, attempt to load
   * any previously saved training data and model parameters from the backend.
   * This means you only need to upload and train once per sport; after that
   * the most recent model will automatically be available whenever you
   * revisit the page or switch sports.
   */
  useEffect(() => {
    const loadSaved = async () => {
      try {
        // Attempt to load a saved model for the current sport
        const modelRes = await fetch(`${API_BASE}/api/model?sport=${selectedSport}`);
        if (modelRes.ok) {
          const data = await modelRes.json();
          if (data.modelParams) {
            setModelParams(data.modelParams);
            setModelTrained(true);
          }
          if (data.trainingStats) {
            setTrainingStats(data.trainingStats);
          }
        }

        // Attempt to load saved training data for the current sport
        const tdRes = await fetch(`${API_BASE}/api/training-data?sport=${selectedSport}`);
        if (tdRes.ok) {
          const tdData = await tdRes.json();
          if (Array.isArray(tdData.rows)) {
            setTrainingData(tdData.rows);
          }
        }
      } catch (error) {
        console.error('Error loading saved data', error);
      }
    };
    loadSaved();
  }, [selectedSport]);

  // Feature configs per sport
  const sports = {
  nfl: {
    name: 'NFL',
    // Model uses moneylines + last-5 win counts (scores only used in CSV history)
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
  tennis: {
    name: 'Tennis',
    features: [
      'player1_ranking',
      'player2_ranking',
      'surface', // numeric encode (1=clay,2=grass,3=hard, etc.)
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


  // -------------------------
  // Helpers
  // -------------------------

  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  // Basic logistic regression with feature normalization
  const trainLogisticRegression = (X, y, options = {}) => {
    const nSamples = X.length;
    const nFeatures = X[0].length;

    const learningRate = options.learningRate ?? 0.1;
    const epochs = options.epochs ?? 400;

    const means = Array(nFeatures).fill(0);
    const stds = Array(nFeatures).fill(0);

    // Means
    for (let j = 0; j < nFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < nSamples; i++) {
        sum += X[i][j];
      }
      means[j] = sum / nSamples;
    }

    // Stds
    for (let j = 0; j < nFeatures; j++) {
      let variance = 0;
      for (let i = 0; i < nSamples; i++) {
        const diff = X[i][j] - means[j];
        variance += diff * diff;
      }
      variance /= nSamples;
      stds[j] = Math.sqrt(variance) || 1; // avoid divide-by-zero
    }

    // Normalize X
    const Xnorm = X.map((row) =>
      row.map((val, j) => (val - means[j]) / stds[j])
    );

    // Init weights and bias
    let weights = Array(nFeatures).fill(0);
    let bias = 0;

    // Gradient descent
    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradW = Array(nFeatures).fill(0);
      let gradB = 0;

      for (let i = 0; i < nSamples; i++) {
        const xi = Xnorm[i];
        const yi = y[i];

        let z = bias;
        for (let j = 0; j < nFeatures; j++) {
          z += weights[j] * xi[j];
        }

        const p = sigmoid(z);
        const error = p - yi;

        for (let j = 0; j < nFeatures; j++) {
          gradW[j] += error * xi[j];
        }
        gradB += error;
      }

      for (let j = 0; j < nFeatures; j++) {
        gradW[j] /= nSamples;
      }
      gradB /= nSamples;

      for (let j = 0; j < nFeatures; j++) {
        weights[j] -= learningRate * gradW[j];
      }
      bias -= learningRate * gradB;
    }

    // Training accuracy
    let correct = 0;
    for (let i = 0; i < nSamples; i++) {
      const xi = Xnorm[i];
      let z = bias;
      for (let j = 0; j < nFeatures; j++) {
        z += weights[j] * xi[j];
      }
      const p = sigmoid(z);
      const pred = p >= 0.5 ? 1 : 0;
      if (pred === y[i]) correct++;
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

  // Auto-compute last-5 wins per team from chronological rows
  // Assumes rows are in time order (Week 1 -> Week 2 -> ...)
  const addLast5WinColumns = (rows) => {
    const history = {}; // { TEAM: [1,0,1,...] }

    return rows.map((row) => {
      const team1 = row.team1;
      const team2 = row.team2;

      const t1Hist = history[team1] || [];
      const t2Hist = history[team2] || [];

      const t1Last5Wins = t1Hist.slice(-5).reduce((sum, r) => sum + r, 0);
      const t2Last5Wins = t2Hist.slice(-5).reduce((sum, r) => sum + r, 0);

      const winner = Number(row.winner); // 1 = team1, 0 = team2
      const t1Result = winner === 1 ? 1 : 0;
      const t2Result = winner === 0 ? 1 : 0;

      // Update history AFTER using previous results
      history[team1] = [...t1Hist, t1Result];
      history[team2] = [...t2Hist, t2Result];

      return {
        ...row,
        // overwrite any existing values (strings like "0-0") with numeric win counts
        team1_last5: t1Last5Wins,
        team2_last5: t2Last5Wins,
      };
    });
  };

  // -------------------------
  // File upload / parsing
  // -------------------------

  const handleDataUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = text
          .split('\n')
          .map((r) => r.trim())
          .filter((r) => r.length > 0);

        if (rows.length < 2) {
          alert('CSV appears to be empty or missing data rows.');
          setTrainingData([]);
          return;
        }

        const headers = rows[0].split(',').map((h) => h.trim());

        const data = rows.slice(1).reduce((acc, row) => {
          const values = row.split(',').map((v) => v.trim());
          if (values.length !== headers.length) {
            // skip malformed rows
            return acc;
          }

          const obj = {};
          headers.forEach((header, i) => {
            const value = values[i];
            // keep strings as strings; numbers become numbers
            obj[header] =
              value === '' || isNaN(value) ? value : parseFloat(value);
          });
          acc.push(obj);
          return acc;
        }, []);

        if (data.length === 0) {
          alert('No valid rows found in CSV. Please check your format.');
          setTrainingData([]);
          return;
        }

        let processedData = data;

        // For NFL / NCAAF / NCAAB, auto-add last-5 win counts
        if (sports[selectedSport].isTeamSeasonSport) {
          processedData = addLast5WinColumns(data);
        }

        setTrainingData(processedData);
        setModelTrained(false);
        setModelParams(null);
        setPrediction(null);
        setTrainingStats(null);
      } catch (error) {
        console.error(error);
        alert('Error parsing CSV. Please ensure proper format.');
      }
    };
    reader.readAsText(file);
  };

  // -------------------------
  // Training
  // -------------------------

  const trainModel = async () => {
    if (trainingData.length < 10) {
      alert('Need at least 10 historical records to train the model');
      return;
    }

    const sportConfig = sports[selectedSport];
    const features = sportConfig.features;
    const labelKey = 'winner';

    // Filter to rows with numeric features and binary winner label
    const usableRows = trainingData.filter((row) => {
      const label = row[labelKey];
      if (label !== 0 && label !== 1) return false;

      return features.every(
        (f) => typeof row[f] === 'number' && !isNaN(row[f])
      );
    });

    if (usableRows.length < 10) {
      alert(
        'Not enough clean rows with numeric features and winner labels (0/1). Please check your CSV.'
      );
      return;
    }

    const X = usableRows.map((row) => features.map((f) => row[f]));
    const y = usableRows.map((row) => row[labelKey]);

    setIsTraining(true);

    try {
      const { weights, bias, means, stds, accuracy, samplesUsed } =
        trainLogisticRegression(X, y, {
          learningRate: 0.1,
          epochs: 400,
        });

      setModelParams({ weights, bias, means, stds, features });
      setModelTrained(true);
      setTrainingStats({
        accuracy: (accuracy * 100).toFixed(1),
        samplesUsed,
      });

      alert(
        `Model trained on ${samplesUsed} records for ${sports[selectedSport].name}!`
      );

      // After successfully training the model, persist the model parameters
      // and training data to the backend.  This allows the model to be
      // restored automatically in future sessions without re-uploading.
      try {
        // Save model parameters and training statistics
        await fetch(`${API_BASE}/api/model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sport: selectedSport,
            modelParams: { weights, bias, means, stds, features },
            trainingStats: {
              accuracy: (accuracy * 100).toFixed(1),
              samplesUsed,
            },
          }),
        });

        // Save the complete training dataset.  You can change this to
        // usableRows instead of trainingData if you prefer only the clean rows.
        await fetch(`${API_BASE}/api/training-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sport: selectedSport,
            rows: trainingData,
          }),
        });
        console.log('Saved model and training data to server');
      } catch (err) {
        console.error('Error saving model or data to server', err);
      }
    } catch (err) {
      console.error(err);
      alert('Error during training. Check your data format and try again.');
      setModelTrained(false);
      setModelParams(null);
      setTrainingStats(null);
    } finally {
      setIsTraining(false);
    }
  };

  // -------------------------
  // Prediction
  // -------------------------

  const calculatePrediction = () => {
    if (!modelTrained || !modelParams) {
      alert('Please train the model first');
      return;
    }

    const { weights, bias, means, stds, features } = modelParams;

    const missingFields = features.filter(
      (f) => matchupInputs[f] === undefined || matchupInputs[f] === ''
    );
    if (missingFields.length > 0) {
      alert(`Please fill in all fields: ${missingFields.join(', ')}`);
      return;
    }

    const rawInputs = features.map((f) => parseFloat(matchupInputs[f]));
    if (rawInputs.some((v) => isNaN(v))) {
      alert('All inputs must be numeric values.');
      return;
    }

    const xNorm = rawInputs.map(
      (val, j) => (val - means[j]) / stds[j]
    );

    let z = bias;
    for (let j = 0; j < weights.length; j++) {
      z += weights[j] * xNorm[j];
    }

    const probability1 = sigmoid(z);
    const probability2 = 1 - probability1;

    const impliedOdds1 =
      probability1 > 0.5
        ? -(probability1 / (1 - probability1) * 100)
        : ((1 - probability1) / probability1 * 100);

    const impliedOdds2 =
      probability2 > 0.5
        ? -(probability2 / (1 - probability2) * 100)
        : ((1 - probability2) / probability2 * 100);

    setPrediction({
      team1_win_prob: (probability1 * 100).toFixed(1),
      team2_win_prob: (probability2 * 100).toFixed(1),
      team1_implied_line: impliedOdds1.toFixed(0),
      team2_implied_line: impliedOdds2.toFixed(0),
      confidence: (Math.abs(probability1 - 0.5) * 200).toFixed(1),
    });
  };

  // -------------------------
  // Data import/export helpers
  // -------------------------

  /**
   * Export the current training dataset as a CSV file.  This will convert
   * whatever is stored in `trainingData` into a CSV string and trigger a
   * download in the browser.  If there is no training data loaded, an
   * alert will be shown instead.
   */
  const exportTrainingData = () => {
    if (!trainingData || trainingData.length === 0) {
      alert('No training data to export. Please upload or load data first.');
      return;
    }
    // Derive the header order from the keys of the first row.  This should
    // include all columns present in the uploaded CSV as well as any
    // computed fields like last-5 win counts.
    const headers = Object.keys(trainingData[0]);
    const csvLines = [headers.join(',')];
    trainingData.forEach((row) => {
      const line = headers
        .map((key) => {
          const val = row[key];
          return val === undefined || val === null ? '' : val;
        })
        .join(',');
      csvLines.push(line);
    });
    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${sports[selectedSport].name.toLowerCase()}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Manually reload the saved training data and model for the current sport
   * from the backend.  This is useful if you've trained on another device
   * or cleared your browser state and want to restore the last known good
   * dataset and model.  It reuses the same logic from the useEffect hook.
   */
  const importSavedData = async () => {
    try {
      // Fetch saved model
      const modelRes = await fetch(`${API_BASE}/api/model?sport=${selectedSport}`);
      if (modelRes.ok) {
        const data = await modelRes.json();
        if (data.modelParams) {
          setModelParams(data.modelParams);
          setModelTrained(true);
        }
        if (data.trainingStats) {
          setTrainingStats(data.trainingStats);
        }
      } else {
        alert('No saved model found for this sport');
      }

      // Fetch saved training data
      const tdRes = await fetch(`${API_BASE}/api/training-data?sport=${selectedSport}`);
      if (tdRes.ok) {
        const tdData = await tdRes.json();
        if (Array.isArray(tdData.rows)) {
          setTrainingData(tdData.rows);
        } else {
          alert('No saved training data found for this sport');
        }
      }
    } catch (error) {
      console.error('Error loading saved data', error);
      alert('Error loading saved data. Please check the server logs.');
    }
  };

  // -------------------------
  // UI helpers
  // -------------------------

  const handleInputChange = (feature, value) => {
    setMatchupInputs((prev) => ({
      ...prev,
      [feature]: value,
    }));
  };

  const getFeatureLabel = (feature) =>
    feature
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  const getDataTemplate = () => {
    const sport = sports[selectedSport];

    // For NFL / NCAAF / NCAAB, show the team/score/moneyline + last5 layout you wanted
    if (sport.isTeamSeasonSport) {
      const headers = [
        'team1',
        'team2',
        'team1_moneyline',
        'team2_moneyline',
        'team1_score',
        'team2_score',
        'team1_last5',
        'team2_last5',
        'winner',
      ].join(',');

      // last5 can be left blank or 0/0; we will overwrite with computed values on upload
      const ex1 =
        'PHI,DAL,-180,160,24,20,,,' + '1';
      const ex2 =
        'NYG,WAS,110,-130,17,21,,,' + '0';

      return `${headers}\n${ex1}\n${ex2}`;
    }

    // Default template for non-team-season sports
    const headers = [...sport.features, 'winner'].join(',');
    const example1 = sport.features.map(() => '0').join(',') + ',1';
    const example2 = sport.features.map(() => '0').join(',') + ',0';
    return `${headers}\n${example1}\n${example2}`;
  };

  const downloadTemplate = () => {
    const csv = getDataTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${sports[selectedSport].name.toLowerCase()}_training_template.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // -------------------------
  // JSX
  // -------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="w-10 h-10 text-blue-400" />
            <h1 className="text-4xl font-bold text-white">Sports Prediction Model</h1>
          </div>

          {/* Sport Selection */}
          <div className="mb-8">
            <label className="block text-white text-sm font-semibold mb-3">
              Select Sport
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(sports).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedSport(key);
                    setTrainingData([]);
                    setModelTrained(false);
                    setModelParams(null);
                    setPrediction(null);
                    setMatchupInputs({});
                    setFileName('');
                    setTrainingStats(null);
                  }}
                  className={`py-3 px-4 rounded-xl font-semibold transition-all ${
                    selectedSport === key
                      ? 'bg-blue-500 text-white shadow-lg scale-105'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {value.name}
                </button>
              ))}
            </div>
          </div>

          {/* Data Upload Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Training Data</h2>
              </div>

              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <Upload className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                  <p className="text-white font-semibold mb-1">Upload CSV File</p>
                  <p className="text-gray-300 text-sm mb-1">Historical matchup data</p>
                  {fileName && (
                    <p className="text-xs text-gray-400 mt-1">Selected: {fileName}</p>
                  )}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleDataUpload}
                    className="hidden"
                  />
                </div>
              </label>

              {trainingData.length > 0 && (
                <div className="mt-4 p-4 bg-green-500/20 rounded-lg border border-green-400/30">
                  <p className="text-green-300 font-semibold">
                    ✓ {trainingData.length} records loaded
                  </p>
                  {trainingStats && (
                    <p className="text-xs text-green-200 mt-1">
                      Used {trainingStats.samplesUsed} clean records • Training accuracy:{' '}
                      {trainingStats.accuracy}%
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={trainModel}
                disabled={trainingData.length === 0 || isTraining}
                className="w-full mt-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTraining ? 'Training...' : 'Train Model'}
              </button>

              {modelTrained && !isTraining && (
                <div className="mt-4 p-4 bg-blue-500/20 rounded-lg border border-blue-400/30">
                  <p className="text-blue-300 font-semibold">✓ Model trained &amp; ready</p>
                </div>
              )}
            </div>

            {/* CSV Template */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
                <h2 className="text-xl font-bold text-white">Data Format</h2>
              </div>

              <p className="text-gray-300 text-sm mb-3">
                Your CSV should be chronological (Week 1 → Week 2 → ...) for{' '}
                {sports[selectedSport].name}. For NFL/NCAAF/NCAAB, last-5 win counts will be
                calculated for you on upload.
              </p>

              <div className="bg-black/30 rounded-lg p-4 mb-4 max-h-60 overflow-auto">
                <code className="text-green-400 text-xs whitespace-pre">
                  {getDataTemplate()}
                </code>
              </div>

              <button
                type="button"
                onClick={downloadTemplate}
                className="mb-4 w-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Download CSV Template
              </button>

              {/* Export the current training dataset to a CSV file */}
              <button
                type="button"
                onClick={exportTrainingData}
                className="mb-4 w-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Export Training Data
              </button>

              {/* Manually reload saved data and model from the backend */}
              <button
                type="button"
                onClick={importSavedData}
                className="mb-4 w-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Load Saved Data
              </button>

              <div className="text-gray-300 text-xs space-y-2">
                <p>
                  <strong className="text-white">Required columns:</strong>
                </p>

                {sports[selectedSport].isTeamSeasonSport ? (
                  <ul className="list-disc list-inside space-y-1">
                    <li>Team1 (home team name)</li>
                    <li>Team2 (away team name)</li>
                    <li>Team1 Moneyline</li>
                    <li>Team2 Moneyline</li>
                    <li>Team1 Score</li>
                    <li>Team2 Score</li>
                    <li>Team1 Last 5 (can be blank; auto-filled)</li>
                    <li>Team2 Last 5 (can be blank; auto-filled)</li>
                    <li>Winner (1 for team1, 0 for team2)</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    {sports[selectedSport].features.map((f) => (
                      <li key={f}>{getFeatureLabel(f)}</li>
                    ))}
                    <li>Winner (1 for side 1 / player 1, 0 for side 2 / player 2)</li>
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Matchup Input */}
          {modelTrained && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white">Enter Matchup Details</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {sports[selectedSport].features.map((feature) => (
                  <div key={feature}>
                    <label className="block text-white text-sm font-semibold mb-2">
                      {getFeatureLabel(feature)}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={matchupInputs[feature] ?? ''}
                      onChange={(e) => handleInputChange(feature, e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                      placeholder="Enter value"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={calculatePrediction}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-4 rounded-lg font-bold text-lg hover:shadow-xl transition-all"
              >
                Generate Prediction
              </button>
            </div>
          )}

          {/* Prediction Results */}
          {prediction && (
            <div className="bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-xl p-6 border border-green-400/30">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-6 h-6 text-green-400" />
                <h2 className="text-2xl font-bold text-white">Prediction Results</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white/10 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-blue-300 mb-4">Team/Player 1</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-gray-300 text-sm">Win Probability</p>
                      <p className="text-3xl font-bold text-white">
                        {prediction.team1_win_prob}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-300 text-sm">Implied Money Line</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {Number(prediction.team1_implied_line) > 0 ? '+' : ''}
                        {prediction.team1_implied_line}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/10 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-purple-300 mb-4">Team/Player 2</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-gray-300 text-sm">Win Probability</p>
                      <p className="text-3xl font-bold text-white">
                        {prediction.team2_win_prob}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-300 text-sm">Implied Money Line</p>
                      <p className="text-2xl font-bold text-purple-400">
                        {Number(prediction.team2_implied_line) > 0 ? '+' : ''}
                        {prediction.team2_implied_line}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-500/20 rounded-lg border border-yellow-400/30">
                <p className="text-yellow-300 font-semibold">
                  Model Confidence: {prediction.confidence}%
                </p>
                <p className="text-gray-300 text-sm mt-2">
                  Compare these implied lines with actual money lines to identify value bets.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SportsPredictionModel;
