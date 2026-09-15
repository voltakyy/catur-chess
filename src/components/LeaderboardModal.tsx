import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Search, RefreshCw, X, Database } from 'lucide-react';
import { LeaderboardEntry } from '../types/chess';
import { fetchLeaderboard, getStoredSupabaseConfig } from '../lib/supabase';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupabaseSetup: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  onOpenSupabaseSetup,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const config = getStoredSupabaseConfig();
      setIsSupabaseConfigured(!!(config.url && config.anonKey));
      const data = await fetchLeaderboard();
      setEntries(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = entries.filter((e) =>
    e.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const top3 = entries.slice(0, 3);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Score Leaderboard</h2>
              <p className="text-xs text-zinc-400">Peringkat & Skor ELO Pemain Catur Online</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-refresh-leaderboard"
              onClick={loadData}
              disabled={loading}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="btn-close-leaderboard"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Database Status Pill */}
        <div className="px-5 py-2.5 bg-zinc-800/40 border-b border-zinc-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-400">Database:</span>
            {isSupabaseConfigured ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Supabase Terhubung
              </span>
            ) : (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Lokal / Demo Sync
              </span>
            )}
          </div>

          <button
            id="btn-config-supabase-link"
            onClick={onOpenSupabaseSetup}
            className="text-amber-400 hover:underline font-medium text-[11px]"
          >
            {isSupabaseConfigured ? 'Kelola Supabase' : 'Hubungkan Supabase & SQL Schema →'}
          </button>
        </div>

        {/* Podium for Top 3 */}
        {entries.length >= 3 && !searchQuery && (
          <div className="px-5 py-4 bg-gradient-to-b from-zinc-800/30 to-transparent border-b border-zinc-800/60">
            <div className="grid grid-cols-3 gap-3 items-end text-center max-w-md mx-auto">
              {/* Rank 2 - Silver */}
              <div className="flex flex-col items-center">
                <div className="text-slate-300 font-bold text-xs flex items-center gap-1 mb-1">
                  <Medal className="w-4 h-4 text-slate-300" /> #2
                </div>
                <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-400 flex items-center justify-center font-bold text-slate-200 text-sm shadow-md">
                  {top3[1]?.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-zinc-200 mt-1 truncate max-w-[90px]">
                  {top3[1]?.username}
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  {top3[1]?.score} ELO
                </span>
              </div>

              {/* Rank 1 - Gold */}
              <div className="flex flex-col items-center pb-2">
                <div className="text-amber-400 font-extrabold text-sm flex items-center gap-1 mb-1">
                  <Trophy className="w-5 h-5 text-amber-400" /> #1
                </div>
                <div className="w-18 h-18 rounded-full bg-amber-950/60 border-2 border-amber-400 flex items-center justify-center font-bold text-amber-300 text-base shadow-xl ring-4 ring-amber-500/20">
                  {top3[0]?.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-bold text-white mt-1.5 truncate max-w-[100px]">
                  {top3[0]?.username}
                </span>
                <span className="text-xs font-mono font-extrabold text-amber-400">
                  {top3[0]?.score} ELO
                </span>
              </div>

              {/* Rank 3 - Bronze */}
              <div className="flex flex-col items-center">
                <div className="text-amber-700 font-bold text-xs flex items-center gap-1 mb-1">
                  <Medal className="w-4 h-4 text-amber-700" /> #3
                </div>
                <div className="w-14 h-14 rounded-full bg-amber-950/30 border-2 border-amber-700 flex items-center justify-center font-bold text-amber-600 text-sm shadow-md">
                  {top3[2]?.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-zinc-200 mt-1 truncate max-w-[90px]">
                  {top3[2]?.username}
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  {top3[2]?.score} ELO
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-4 border-b border-zinc-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              id="input-search-leaderboard"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama pemain..."
              className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>
        </div>

        {/* Table List */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-800 font-semibold pb-2">
                <th className="py-2 pl-3 w-12">#</th>
                <th className="py-2">Pemain</th>
                <th className="py-2 text-right">Skor ELO</th>
                <th className="py-2 text-center">M / K / S</th>
                <th className="py-2 text-right pr-3">Winrate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((item, idx) => {
                const rank = item.rank || idx + 1;
                return (
                  <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                    <td className="py-2.5 pl-3 font-mono font-bold">
                      {rank === 1 ? (
                        <span className="text-amber-400 font-extrabold">🥇 1</span>
                      ) : rank === 2 ? (
                        <span className="text-slate-300 font-bold">🥈 2</span>
                      ) : rank === 3 ? (
                        <span className="text-amber-700 font-bold">🥉 3</span>
                      ) : (
                        <span className="text-zinc-400">{rank}</span>
                      )}
                    </td>
                    <td className="py-2.5 font-medium text-zinc-200">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{item.username}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-amber-400">
                      {item.score}
                    </td>
                    <td className="py-2.5 text-center font-mono text-zinc-400">
                      <span className="text-emerald-400">{item.wins}</span> /{' '}
                      <span className="text-red-400">{item.losses}</span> /{' '}
                      <span className="text-zinc-400">{item.draws}</span>
                    </td>
                    <td className="py-2.5 text-right pr-3 font-mono text-zinc-300">
                      {item.winRate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-zinc-500 text-xs italic">
              Tidak ada data pemain yang cocok.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
