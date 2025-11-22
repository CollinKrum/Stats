import React, { useState, useEffect } from 'react';
import {
  Upload, TrendingUp, Download, Trash2, CheckCircle,
  XCircle, Minus, AlertCircle, Football, Basketball,
  TableTennis, Trophy, Calendar
} from 'lucide-react';
import Papa from 'papaparse'; // Add: npm install papaparse

const SPORTS = [
  { value: 'nfl', label: 'NFL', icon: Football },
  { value: 'ncaaf', label: 'NCAAF', icon: Football },
  { value: 'ncaab', label: 'NCAAB', icon: Basketball },
  { value: 'nba', label: 'NBA', icon: Basketball },
  { value: 'tennis', label: 'Tennis', icon: Trophy },
  { value: 'tabletennis', label: 'Table Tennis', icon: TableTennis },
] as const;

type Sport = typeof SPORTS[number]['value'];

interface Game {
  id: number;
  sport: Sport;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeMoneyline: string;
  awayMoneyline: string;
  spread?: string;
  total?: string;
  homeScore?: string;
  awayScore?: string;
  bet: string;
  betAmount: string;
  homeLast5?: string;
  awayLast5?: string;
  notes?: string;
}

const SportsBettingTracker = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<Sport>('nfl');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await window.storage?.get('betting-games-v3', true);
      if (result?.value) {
        const parsed = JSON.parse(result.value);
        setGames(parsed);
      }
    } catch (e) {
      console.log('No saved data');
    }
    setLoading(false);
  };

  const saveData = async (newGames: Game[]) => {
    try {
      await window.storage?.set('betting-games-v3', JSON.stringify(newGames), true);
      setGames(newGames);
    } catch (e) {
      alert('Save failed');
    }
  };

  const moneylineToProb = (ml: string): string => {
    const m = parseFloat(ml);
    if (!isFinite(m) || m === 0) return '—';
    return m > 0
      ? (100 / (m + 100) * 100).toFixed(1)
      : (Math.abs(m) / (Math.abs(m) + 100) * 100).toFixed(1);
  };

  const isTennisLike = (sport: Sport) => sport === 'tennis' || sport === 'tabletennis';

  const checkSpreadWinner = (game: Game) => {
    if (isTennisLike(game.sport) || !game.spread || !game.homeScore || !game.awayScore) return null;
    const hs = parseFloat(game.homeScore);
    const as = parseFloat(game.awayScore);
    const spread = parseFloat(game.spread);
    if (!isFinite(hs) || !isFinite(as) || !isFinite(spread)) return null;
    const adjusted = hs + spread;
    if (adjusted > as) return 'home';
    if (adjusted < as) return 'away';
    return 'push';
  };

  const checkWinner = (game: Game) => {
    if (!game.homeScore || !game.awayScore) return null;
    const hs = parseFloat(game.homeScore);
    const as = parseFloat(game.awayScore);
    if (!isFinite(hs) || !isFinite(as)) return null;
    if (hs > as) return 'home';
    if (hs < as) return 'away';
    return 'tie';
  };

  const calculateResult = (game: Game) => {
    if (!game.bet || !game.homeScore || !game.awayScore) return null;
    const amount = parseFloat(game.betAmount) || 0;
    const betLower = game.bet.toLowerCase();

    const isSpreadBet = !!game.spread && !isTennisLike(game.sport);
    let won = false;
    let push = false;

    if (isSpreadBet) {
      const res = checkSpreadWinner(game);
      if (res === 'push') push = true;
      else won = (betLower.includes('home') && res === 'home') || (betLower.includes('away') && res === 'away');
    } else {
      const res = checkWinner(game);
      if (res === 'tie') push = true;
      else won = (betLower.includes('home') && res === 'home') || (betLower.includes('away') && res === 'away');
    }

    if (push) return { result: 'push', profit: 0 } as const;
    if (!won) return { result: 'loss', profit: -amount } as const;

    const mlStr = betLower.includes('home') ? game.homeMoneyline : game.awayMoneyline;
    const ml = parseFloat(mlStr);
    if (!isFinite(ml)) return { result: 'win', profit: amount };

    const profit = ml > 0
      ? amount * (ml / 100)
      : amount * (100 / Math.abs(ml));

    return { result: 'win', profit } as const;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        try {
          const rows = results.data as string[][];
          if (rows.length < 2) throw new Error('Empty file');

          const newGames: Game[] = rows.slice(1).map((row: string[], i) => {
            return {
              id: Date.now() + i,
              sport: (row[0]?.toLowerCase() as Sport) || selectedSport,
              date: row[1] || '',
              homeTeam: row[2] || '',
              awayTeam: row[3] || '',
              homeMoneyline: row[4] || '',
              awayMoneyline: row[5] || '',
              spread: row[6] || '',
              total: row[7] || '',
              homeScore: row[8] || '',
              awayScore: row[9] || '',
              bet: row[10] || '',
              betAmount: row[11] || '',
            };
          }).filter(g => g.homeTeam && g.awayTeam);

          // Auto-calculate Last 5 per sport
          const sorted = [...games, ...newGames].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          const teamHistory: Record<string, { sport: Sport; wins: number[]; count: number }> = {};

          sorted.forEach(game => {
            if (!game.homeScore || !game.awayScore) return;

            const homeWon = parseFloat(game.homeScore) > parseFloat(game.awayScore);
            const keyHome = `${game.sport}-${game.homeTeam}`;
            const keyAway = `${game.sport}-${game.awayTeam}`;

            if (!teamHistory[keyHome]) teamHistory[keyHome] = { sport: game.sport, wins: [], count: 0 };
            if (!teamHistory[keyAway]) teamHistory[keyAway] = { sport: game.sport, wins: [], count: 0 };

            teamHistory[keyHome].wins.push(homeWon ? 1 : 0);
            teamHistory[keyAway].wins.push(homeWon ? 0 : 1);
            teamHistory[keyHome].count++;
            teamHistory[keyAway].count++;

            const h5 = teamHistory[keyHome].wins.slice(-5);
            const a5 = teamHistory[keyAway].wins.slice(-5);
            game.homeLast5 = `${h5.filter(w => w).length}-${h5.length - h5.filter(w => w).length}`;
            game.awayLast5 = `${a5.filter(w => w).length}-${a5.length - a5.filter(w => w).length}`;
          });

          saveData(sorted);
          alert(`Uploaded ${newGames.length} games! Last 5 records auto-calculated.`);
        } catch (err) {
          alert('CSV format error. Use template.');
        }
      },
      error: () => alert('Parse failed'),
    });

    e.target.value = '';
  };

  const addGame = () => {
    const newGame: Game = {
      id: Date.now(),
      sport: selectedSport,
      date: new Date().toISOString().split('T')[0],
      homeTeam: '',
      awayTeam: '',
      homeMoneyline: '',
      awayMoneyline: '',
      spread: '',
      total: '',
      homeScore: '',
      awayScore: '',
      bet: '',
      betAmount: '',
    };
    saveData([...games, newGame]);
  };

  const updateGame = (id: number, field: keyof Game, value: string) => {
    const updated = games.map(g => g.id === id ? { ...g, [field]: value } : g);
    saveData(updated);
  };

  const deleteGame = (id: number) => {
    if (confirm('Delete this bet?')) {
      saveData(games.filter(g => g.id !== id));
    }
  };

  const clearAll = () => {
    if (confirm('Delete ALL data?')) {
      window.storage?.delete('betting-games-v3', true);
      setGames([]);
    }
  };

  const stats = (() => {
    const completed = games.filter(g => g.homeScore && g.awayScore && g.bet);
    let wins = 0, losses = 0, pushes = 0, profit = 0, wagered = 0;
    completed.forEach(g => {
      const res = calculateResult(g);
      if (!res) return;
      const amt = parseFloat(g.betAmount) || 0;
      wagered += amt;
      if (res.result === 'win') { wins++; profit += res.profit; }
      else if (res.result === 'loss') { losses++; profit += res.profit; }
      else pushes++;
    });
    const roi = wagered > 0 ? (profit / wagered) * 100 : 0;
    return { wins, losses, pushes, profit: profit.toFixed(2), roi: roi.toFixed(1), total: completed.length };
  })();

  const downloadTemplate = () => {
    const csv = `Sport,Date,Home Team,Away Team,Home ML,Away ML,Spread,Total,Home Score,Away Score,Bet On,Bet Amount
nfl,2025-01-01,Chiefs,Bills,-150,+130,-3.5,48.5,27,24,Bills,100
tennis,2025-01-02,Alcaraz,Sinner,-220,+180,,,2,1,Sinner,50`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'betting-template-2025.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading...</div>;

  const filteredGames = games.filter(g => g.sport === selectedSport);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700 p-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold text-white flex items-center gap-4">
              <TrendingUp className="text-green-400" size={40} />
              SharpTracker Pro
            </h1>
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value as Sport)}
              className="bg-slate-700 text-white px-4 py-3 rounded-lg text-lg font-medium flex items-center gap-2"
            >
              {SPORTS.map(s => {
                const Icon = s.icon;
                return <option key={s.value} value={s.value} className="flex items-center gap-2">
                  <Icon size={18} /> {s.label}
                </option>;
              })}
            </select>
          </div>

          {/* Stats */}
          {stats.total > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
              <div className="bg-green-900/40 border border-green-700 rounded-lg p-4">
                <div className="text-green-400 text-2xl font-bold">{stats.wins}-{stats.losses}-{stats.pushes}</div>
                <div className="text-slate-300 text-sm">Record</div>
              </div>
              <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-4">
                <div className="text-blue-400 text-2xl font-bold">{stats.total} bets</div>
                <div className="text-slate-300 text-sm">Total</div>
              </div>
              <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg p-4">
                <div className={`text-2xl font-bold ${parseFloat(stats.profit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${stats.profit}
                </div>
                <div className="text-slate-300 text-sm">P/L</div>
              </div>
              <div className="bg-purple-900/40 border border-purple-700 rounded-lg p-4">
                <div className={`text-2xl font-bold ${parseFloat(stats.roi) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.roi}%
                </div>
                <div className="text-slate-300 text-sm">ROI</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-4 mb-6">
            <button onClick={addGame} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition">
              + Add Bet
            </button>
            <label className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg cursor-pointer transition flex items-center gap-2">
              <Upload size={20} /> Upload CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <button onClick={downloadTemplate} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition flex items-center gap-2">
              <Download size={20} /> Template
            </button>
            {games.length > 0 && (
              <button onClick={clearAll} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition flex items-center gap-2">
                <Trash2 size={20} /> Clear All
              </button>
            )}
          </div>

          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6 flex gap-3 items-start">
            <AlertCircle className="text-blue-400 mt-0.5" />
            <div className="text-blue-200 text-sm">
              <strong>New:</strong> Multi-sport support • Tennis/Table Tennis auto-handled • Robust CSV parsing • ROI tracking • Last 5 calculated automatically
            </div>
          </div>

          {/* Games List */}
          <div className="space-y-4">
            {filteredGames.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <p className="text-2xl mb-4">No bets in {SPORTS.find(s => s.value === selectedSport)?.label} yet</p>
                <p>Add one or upload a season CSV</p>
              </div>
            ) : (
              filteredGames
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(game => {
                  const result = calculateResult(game);
                  const homeProb = moneylineToProb(game.homeMoneyline);
                  const awayProb = moneylineToProb(game.awayMoneyline);

                  return (
                    <div key={game.id} className="bg-slate-700/50 rounded-xl p-6 border border-slate-600 hover:border-slate-500 transition">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div>
                          <label className="text-xs text-slate-400">Date</label>
                          <input type="date" value={game.date} onChange={e => updateGame(game.id, 'date', e.target.value)}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded" />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs text-slate-400">Home</label>
                          <input type="text" value={game.homeTeam} onChange={e => updateGame(game.id, 'homeTeam', e.target.value)}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded" />
                          {game.homeLast5 && <div className="text-xs text-cyan-400 mt-1">L5: {game.homeLast5}</div>}
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs text-slate-400">Away</label>
                          <input type="text" value={game.awayTeam} onChange={e => updateGame(game.id, 'awayTeam', e.target.value)}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded" />
                          {game.awayLast5 && <div className="text-xs text-cyan-400 mt-1">L5: {game.awayLast5}</div>}
                        </div>

                        <div>
                          <label className="text-xs text-slate-400">H ML</label>
                          <input type="text" value={game.homeMoneyline} onChange={e => updateGame(game.id, 'homeMoneyline', e.target.value)}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded text-sm" />
                          <div className="text-xs text-green-400">{homeProb}%</div>
                        </div>

                        <div>
                          <label className="text-xs text-slate-400">A ML</label>
                          <input type="text" value={game.awayMoneyline} onChange={e => updateGame(game.id, 'awayMoneyline', e.target.value)}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded text-sm" />
                          <div className="text-xs text-green-400">{awayProb}%</div>
                        </div>

                        {!isTennisLike(game.sport) && (
                          <div>
                            <label className="text-xs text-slate-400">Spread</label>
                            <input type="text" value={game.spread || ''} onChange={e => updateGame(game.id, 'spread', e.target.value)}
                              className="w-full bg-slate-600 text-white px-3 py-2 rounded text-sm" />
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-slate-400">H Score</label>
                          <input type="text" value={game.homeScore || ''} onChange={e => updateGame(game.id, 'homeScore', e.target.value)}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded font-mono" />
                        </div>

                        <div>
                          <label className="text-xs text-slate-400">A Score</label>
                          <input type="text" value={game.awayScore || ''} onChange={e => updateGame(game.id, 'awayScore', e.target.value)}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded font-mono" />
                        </div>

                        <div>
                          <label className="text-xs text-slate-400">Bet</label>
                          <input type="text" value={game.bet} onChange={e => updateGame(game.id, 'bet', e.target.value)}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded" />
                          {result && (
                            <div className={`text-sm font-bold mt-1 ${
                              result.result === 'win' ? 'text-green-400' :
                              result.result === 'loss' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {result.result === 'win' ? 'WIN' : result.result === 'loss' ? 'LOSS' : 'PUSH'}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-slate-400">Amount</label>
                          <input type="text" value={game.betAmount} onChange={e => updateGame(game.id, 'betAmount', e.target.value)}
                            className="w-full bg-slate-600 text-white px-3 py-2 rounded" />
                          {result && result.profit !== 0 && (
                            <div className={`text-sm font-bold mt-1 ${result.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${result.profit.toFixed(2)}
                            </div>
                          )}
                        </div>

                        <div className="flex items-end">
                          <button onClick={() => deleteGame(game.id)}
                            className="bg-red-600/20 hover:bg-red-600/40 text-red-400 p-3 rounded-lg transition">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SportsBettingTracker;
