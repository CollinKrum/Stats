import {
  Upload,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Minus,
} from 'lucide-react';
const SportsBettingTracker = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    try {
      const result = await window.storage.get('betting-games-v2', true);
      if (result && result.value) {
        setGames(JSON.parse(result.value));
      }
    } catch (error) {
      console.log('No existing data found');
    }
    setLoading(false);
  };
  const saveData = async (newGames) => {
    try {
      await window.storage.set('betting-games-v2', JSON.stringify(newGames), true);
      setGames(newGames);
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Failed to save data. Please try again.');
    }
  };
  const moneylineToProb = (moneyline) => {
    const ml = parseFloat(moneyline);
    if (!isFinite(ml)) return 50;
    if (ml > 0) {
      return (100 / (ml + 100) * 100).toFixed(1);
    } else {
      return (Math.abs(ml) / (Math.abs(ml) + 100) * 100).toFixed(1);
    }
  };
  const checkSpreadWinner = (game) => {
    if (!game.homeScore || !game.awayScore || !game.spread) return null;
   
    const homeScore = parseFloat(game.homeScore);
    const awayScore = parseFloat(game.awayScore);
    const spread = parseFloat(game.spread);
   
    if (!isFinite(homeScore) || !isFinite(awayScore) || !isFinite(spread)) return null;
   
    // Spread from home team's perspective: negative means home favored
    const adjustedHomeScore = homeScore + spread;
   
    if (adjustedHomeScore > awayScore) return 'home';
    if (adjustedHomeScore < awayScore) return 'away';
    return 'push';
  };
  const checkMoneylineWinner = (game) => {
    if (!game.homeScore || !game.awayScore) return null;
   
    const homeScore = parseFloat(game.homeScore);
    const awayScore = parseFloat(game.awayScore);
   
    if (!isFinite(homeScore) || !isFinite(awayScore)) return null;
   
    if (homeScore > awayScore) return 'home';
    if (awayScore > homeScore) return 'away';
    return 'tie';
  };
  const calculateWinLoss = (game) => {
    if (!game.bet || !game.homeScore || !game.awayScore) return null;
   
    const betAmount = parseFloat(game.betAmount) || 0;
    const betLower = game.bet.toLowerCase();
   
    let won = false;
   
    // Check if it's a spread bet
    if (game.spread) {
      const spreadResult = checkSpreadWinner(game);
      if (spreadResult === 'push') return { result: 'push', profit: 0 };
     
      won = (betLower.includes('home') && spreadResult === 'home') ||
            (betLower.includes('away') && spreadResult === 'away');
    } else {
      // Moneyline bet
      const mlResult = checkMoneylineWinner(game);
      if (mlResult === 'tie') return { result: 'push', profit: 0 };
     
      won = (betLower.includes('home') && mlResult === 'home') ||
            (betLower.includes('away') && mlResult === 'away');
    }
   
    if (won) {
      const ml = betLower.includes('home') ?
        parseFloat(game.homeMoneyline) : parseFloat(game.awayMoneyline);
     
      if (!isFinite(ml)) return { result: 'win', profit: betAmount };
     
      let profit;
      if (ml > 0) {
        profit = betAmount * (ml / 100);
      } else {
        profit = betAmount * (100 / Math.abs(ml));
      }
      return { result: 'win', profit };
    } else {
      return { result: 'loss', profit: -betAmount };
    }
  };
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
       
        if (lines.length < 2) {
          alert('CSV file must have a header and at least one data row');
          return;
        }
       
        const newGames = lines.slice(1).map((line, index) => {
          const parts = line.split(',').map(p => p.trim());
         
          return {
            id: Date.now() + index,
            date: parts[0] || '',
            homeTeam: parts[1] || '',
            awayTeam: parts[2] || '',
            homeMoneyline: parts[3] || '',
            awayMoneyline: parts[4] || '',
            spread: parts[5] || '',
            homeScore: parts[6] || '',
            awayScore: parts[7] || '',
            bet: parts[8] || '',
            betAmount: parts[9] || ''
          };
        }).filter(game => game.homeTeam && game.awayTeam);
        // Auto-calculate last 5 for each team
        const sortedGames = newGames.sort((a, b) => new Date(a.date) - new Date(b.date));
        const teamHistory = {};
       
        sortedGames.forEach(game => {
          if (game.homeScore && game.awayScore) {
            const homeWon = parseFloat(game.homeScore) > parseFloat(game.awayScore);
            const awayWon = parseFloat(game.awayScore) > parseFloat(game.homeScore);
           
            if (!teamHistory[game.homeTeam]) teamHistory[game.homeTeam] = [];
            if (!teamHistory[game.awayTeam]) teamHistory[game.awayTeam] = [];
           
            teamHistory[game.homeTeam].push(homeWon ? 1 : 0);
            teamHistory[game.awayTeam].push(awayWon ? 1 : 0);
          }
         
          // Calculate last 5 for each team
          const homeLast5 = teamHistory[game.homeTeam]?.slice(-5) || [];
          const awayLast5 = teamHistory[game.awayTeam]?.slice(-5) || [];
         
          game.homeLast5Record = ${homeLast5.filter(w => w === 1).length}-${homeLast5.filter(w => w === 0).length};
          game.awayLast5Record = ${awayLast5.filter(w => w === 1).length}-${awayLast5.filter(w => w === 0).length};
        });
        saveData(sortedGames);
        alert(Successfully uploaded ${newGames.length} games!\nLast 5 records calculated automatically.);
      } catch (error) {
        console.error('Parse error:', error);
        alert('Error parsing CSV. Please ensure format is correct.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  const addGame = () => {
    const newGame = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      homeTeam: '',
      awayTeam: '',
      homeMoneyline: '',
      awayMoneyline: '',
      spread: '',
      homeScore: '',
      awayScore: '',
      bet: '',
      betAmount: '',
      homeLast5Record: '',
      awayLast5Record: ''
    };
    saveData([...games, newGame]);
  };
  const updateGame = (id, field, value) => {
    const updated = games.map(game =>
      game.id === id ? { ...game, [field]: value } : game
    );
    saveData(updated);
  };
  const deleteGame = (id) => {
    if (confirm('Delete this game?')) {
      saveData(games.filter(game => game.id !== id));
    }
  };
  const clearAllData = async () => {
    if (confirm('This will delete ALL games. Are you sure?')) {
      try {
        await window.storage.delete('betting-games-v2', true);
        setGames([]);
        alert('All data cleared!');
      } catch (error) {
        console.error('Error clearing data:', error);
      }
    }
  };
  const getLast5Stats = () => {
    const completedGames = games
      .filter(g => g.homeScore && g.awayScore && g.bet)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let totalProfit = 0;
    completedGames.forEach(game => {
      const result = calculateWinLoss(game);
      if (!result) return;
     
      if (result.result === 'win') wins++;
      else if (result.result === 'loss') losses++;
      else if (result.result === 'push') pushes++;
     
      totalProfit += result.profit;
    });
    return { wins, losses, pushes, total: completedGames.length, profit: totalProfit };
  };
  const getAllTimeStats = () => {
    const completedGames = games.filter(g => g.homeScore && g.awayScore && g.bet);
   
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let totalProfit = 0;
    completedGames.forEach(game => {
      const result = calculateWinLoss(game);
      if (!result) return;
     
      if (result.result === 'win') wins++;
      else if (result.result === 'loss') losses++;
      else if (result.result === 'push') pushes++;
     
      totalProfit += result.profit;
    });
    return { wins, losses, pushes, total: completedGames.length, profit: totalProfit };
  };
  const downloadTemplate = () => {
    const csv = 'Date,Home Team,Away Team,Home ML,Away ML,Spread,Home Score,Away Score,Bet On,Bet Amount\n' +
                '2024-01-15,Lakers,Celtics,-150,+130,-3.5,110,105,Lakers,100\n' +
                '2024-01-16,Warriors,Heat,+120,-140,2.5,98,102,Heat,50\n' +
                '2024-01-17,Nuggets,Bucks,-200,+170,-5.5,112,108,Nuggets,75';
   
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'betting-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };
  const downloadData = () => {
    const headers = ['Date', 'Home Team', 'Away Team', 'Home ML', 'Away ML', 'Spread',
                     'Home Score', 'Away Score', 'Bet On', 'Bet Amount', 'Home L5', 'Away L5'];
    const rows = games.map(g => [
      g.date, g.homeTeam, g.awayTeam, g.homeMoneyline, g.awayMoneyline, g.spread,
      g.homeScore, g.awayScore, g.bet, g.betAmount, g.homeLast5Record, g.awayLast5Record
    ]);
   
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = betting-data-${new Date().toISOString().split('T')[0]}.csv;
    a.click();
    window.URL.revokeObjectURL(url);
  };
  const last5 = getLast5Stats();
  const allTime = getAllTimeStats();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-white text-xl">Loading your data...</div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 shadow-2xl border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
            <TrendingUp className="text-green-400" />
            Sports Betting Tracker Pro
          </h1>
          {/* Stats Dashboard */}
          {allTime.total > 0 && (
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="text-slate-400 text-xs uppercase">Last 5</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {last5.wins}-{last5.losses}-{last5.pushes}
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="text-slate-400 text-xs uppercase">Last 5 Win%</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {last5.total > 0 ? ((last5.wins / (last5.total - last5.pushes)) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className={bg-slate-700/50 rounded-lg p-4 border border-slate-600}>
                  <div className="text-slate-400 text-xs uppercase">Last 5 P/L</div>
                  <div className={text-xl font-bold mt-1 ${last5.profit >= 0 ? 'text-green-400' : 'text-red-400'}}>
                    ${last5.profit.toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="text-slate-400 text-xs uppercase">All Time</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {allTime.wins}-{allTime.losses}-{allTime.pushes}
                  </div>
                </div>
                <div className={bg-slate-700/50 rounded-lg p-4 border border-slate-600}>
                  <div className="text-slate-400 text-xs uppercase">Total P/L</div>
                  <div className={text-xl font-bold mt-1 ${allTime.profit >= 0 ? 'text-green-400' : 'text-red-400'}}>
                    ${allTime.profit.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Controls */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={addGame}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              Add Game
            </button>
           
            <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg cursor-pointer transition flex items-center gap-2">
              <Upload size={18} />
              Upload Season CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={downloadTemplate}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <Download size={18} />
              Template
            </button>
            {games.length > 0 && (
              <>
                <button
                  onClick={downloadData}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                  <Download size={18} />
                  Export Data
                </button>
                <button
                  onClick={clearAllData}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Clear All
                </button>
              </>
            )}
          </div>
          {/* Info Box */}
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-200">
              <strong>✨ NEW: Data syncs across ALL your devices!</strong> Upload on desktop, view on mobile.
              <br />
              <strong>🎯 Spread Auto-Detection:</strong> Automatically calculates spread winners based on final scores.
              <br />
              <strong>📊 Last 5 Tracking:</strong> Upload a season's data and last 5 records are calculated automatically.
              <br />
              <strong>📋 Format:</strong> Negative spread = home favored (e.g., -3.5 means home gives 3.5 points)
            </div>
          </div>
          {/* Games List */}
          <div className="space-y-4">
            {games.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-xl mb-2">No games yet</p>
                <p>Add a game manually or upload a full season CSV to get started</p>
              </div>
            ) : (
              games.sort((a, b) => new Date(b.date) - new Date(a.date)).map(game => {
                const spreadResult = checkSpreadWinner(game);
                const mlResult = checkMoneylineWinner(game);
                const winLoss = calculateWinLoss(game);
                const homeProb = moneylineToProb(game.homeMoneyline);
                const awayProb = moneylineToProb(game.awayMoneyline);
               
                return (
                  <div key={game.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Date */}
                      <div className="md:col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">Date</label>
                        <input
                          type="date"
                          value={game.date}
                          onChange={(e) => updateGame(game.id, 'date', e.target.value)}
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                      </div>
                      {/* Teams */}
                      <div className="md:col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">Home Team</label>
                        <input
                          type="text"
                          value={game.homeTeam}
                          onChange={(e) => updateGame(game.id, 'homeTeam', e.target.value)}
                          placeholder="Home"
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                        {game.homeLast5Record && (
                          <div className="text-xs text-slate-400 mt-1">L5: {game.homeLast5Record}</div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">Away Team</label>
                        <input
                          type="text"
                          value={game.awayTeam}
                          onChange={(e) => updateGame(game.id, 'awayTeam', e.target.value)}
                          placeholder="Away"
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                        {game.awayLast5Record && (
                          <div className="text-xs text-slate-400 mt-1">L5: {game.awayLast5Record}</div>
                        )}
                      </div>
                      {/* Moneylines & Probabilities */}
                      <div className="md:col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">Home ML</label>
                        <input
                          type="text"
                          value={game.homeMoneyline}
                          onChange={(e) => updateGame(game.id, 'homeMoneyline', e.target.value)}
                          placeholder="-150"
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                        <div className="text-xs text-green-400 mt-1">{homeProb}%</div>
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">Away ML</label>
                        <input
                          type="text"
                          value={game.awayMoneyline}
                          onChange={(e) => updateGame(game.id, 'awayMoneyline', e.target.value)}
                          placeholder="+130"
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                        <div className="text-xs text-green-400 mt-1">{awayProb}%</div>
                      </div>
                      {/* Spread */}
                      <div className="md:col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">Spread</label>
                        <input
                          type="text"
                          value={game.spread}
                          onChange={(e) => updateGame(game.id, 'spread', e.target.value)}
                          placeholder="-3.5"
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                        {spreadResult && (
                          <div className="flex items-center gap-1 mt-1">
                            {spreadResult === 'home' && <CheckCircle size={12} className="text-green-400" />}
                            {spreadResult === 'away' && <XCircle size={12} className="text-red-400" />}
                            {spreadResult === 'push' && <Minus size={12} className="text-yellow-400" />}
                            <span className="text-xs text-slate-300">
                              {spreadResult === 'home' ? 'Home' : spreadResult === 'away' ? 'Away' : 'Push'}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Scores */}
                      <div className="md:col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">Home Score</label>
                        <input
                          type="text"
                          value={game.homeScore}
                          onChange={(e) => updateGame(game.id, 'homeScore', e.target.value)}
                          placeholder="0"
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">Away Score</label>
                        <input
                          type="text"
                          value={game.awayScore}
                          onChange={(e) => updateGame(game.id, 'awayScore', e.target.value)}
                          placeholder="0"
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                      </div>
                      {/* Bet Info */}
                      <div className="md:col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">Bet On</label>
                        <input
                          type="text"
                          value={game.bet}
                          onChange={(e) => updateGame(game.id, 'bet', e.target.value)}
                          placeholder="Home/Away"
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                        {winLoss && (
                          <div className={text-xs mt-1 font-bold ${ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;winLoss.result === 'win' ? 'text-green-400' : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;winLoss.result === 'loss' ? 'text-red-400' : 'text-yellow-400' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}}>
                            {winLoss.result === 'win' ? '✓ WIN' : winLoss.result === 'loss' ? '✗ LOSS' : '− PUSH'}
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">Amount</label>
                        <input
                          type="text"
                          value={game.betAmount}
                          onChange={(e) => updateGame(game.id, 'betAmount', e.target.value)}
                          placeholder="100"
                          className="w-full bg-slate-600 text-white text-sm px-2 py-1 rounded"
                        />
                        {winLoss && winLoss.profit !== 0 && (
                          <div className={text-xs mt-1 font-bold ${winLoss.profit > 0 ? 'text-green-400' : 'text-red-400'}}>
                            ${winLoss.profit.toFixed(2)}
                          </div>
                        )}
                      </div>
                      {/* Delete */}
                      <div className="md:col-span-1 flex items-end">
                        <button
                          onClick={() => deleteGame(game.id)}
                          className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 px-2 py-1 rounded transition"
                        >
                          <Trash2 size={16} className="mx-auto" />
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
