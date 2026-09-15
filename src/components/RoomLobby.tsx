import React, { useState } from 'react';
import { PlusCircle, LogIn, Swords, Clock, Sparkles } from 'lucide-react';
import { roomManager } from '../lib/roomManager';

interface RoomLobbyProps {
  onRoomJoined: () => void;
  onOpenLeaderboard: () => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  onRoomJoined,
  onOpenLeaderboard,
}) => {
  const [playerName, setPlayerName] = useState(roomManager.getUserName());
  const [joinCode, setJoinCode] = useState('');
  const [timeControl, setTimeControl] = useState<number>(5); // 5 min default
  const [increment, setIncrement] = useState<number>(3); // 3 sec default
  const [preferredColor, setPreferredColor] = useState<'w' | 'b' | 'random'>('random');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPlayerName(val);
    roomManager.setUserName(val);
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setErrorMessage('Silakan masukkan nama pemain terlebih dahulu.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    try {
      roomManager.setUserName(playerName.trim());
      roomManager.createRoom({
        preferredColor,
        timeControlMinutes: timeControl,
        incrementSeconds: increment,
      });
      onRoomJoined();
    } catch {
      setErrorMessage('Gagal membuat room. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setErrorMessage('Silakan masukkan nama pemain terlebih dahulu.');
      return;
    }
    if (!joinCode.trim()) {
      setErrorMessage('Silakan masukkan kode room.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      roomManager.setUserName(playerName.trim());
      const res = await roomManager.joinRoom(joinCode.trim());
      if (res.success) {
        onRoomJoined();
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage('Gagal menghubungi server room.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      {/* Hero Welcome */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multiplayer Real-time & Supabase Cloud</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Arena Catur Online
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base mt-2 max-w-md mx-auto">
          Tantang teman dalam pertandingan catur real-time dengan kode room, kontrol timer presisi, dan papan peringkat leaderboard!
        </p>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="mb-6 p-3 rounded-xl bg-red-900/40 border border-red-700/60 text-red-200 text-xs text-center max-w-lg mx-auto animate-shake">
          {errorMessage}
        </div>
      )}

      {/* Main Grid: Name & Room Creation / Join */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Left: Create Room */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Buat Room Baru</h3>
                <p className="text-xs text-zinc-400">Dapatkan kode unik untuk dibagikan ke teman</p>
              </div>
            </div>

            {/* Player Name Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Nama Pemain Anda
              </label>
              <input
                id="input-player-name-create"
                type="text"
                value={playerName}
                onChange={handleNameChange}
                placeholder="Contoh: Budi, QueenHunter"
                maxLength={20}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            {/* Time Control Selection */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Format Waktu (Menit + Tambahan Detik)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { min: 3, inc: 2, label: '3 | 2 Blitz' },
                  { min: 5, inc: 3, label: '5 | 3 Rapid' },
                  { min: 10, inc: 5, label: '10 | 5 Santai' },
                ].map((tc) => (
                  <button
                    key={tc.label}
                    type="button"
                    onClick={() => {
                      setTimeControl(tc.min);
                      setIncrement(tc.inc);
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border transition ${
                      timeControl === tc.min && increment === tc.inc
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-xs'
                        : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Preference */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Pilihan Sisi / Bidak
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setPreferredColor('w')}
                  className={`py-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                    preferredColor === 'w'
                      ? 'bg-zinc-100 text-zinc-900 border-white font-bold'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-zinc-400" />
                  Putih
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredColor('random')}
                  className={`py-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                    preferredColor === 'random'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-bold'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  <Swords className="w-3.5 h-3.5" />
                  Acak
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredColor('b')}
                  className={`py-2 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                    preferredColor === 'b'
                      ? 'bg-zinc-800 text-zinc-100 border-zinc-500 font-bold'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 border border-zinc-700" />
                  Hitam
                </button>
              </div>
            </div>
          </div>

          <button
            id="btn-create-room"
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition cursor-pointer text-sm"
          >
            {isLoading ? 'Membuat Room...' : 'Buat Room & Mulai Lobby'}
          </button>
        </div>

        {/* Right: Join Room by Code */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <form onSubmit={handleJoinRoom} className="flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Gabung Room</h3>
                  <p className="text-xs text-zinc-400">Masukkan kode room dari teman Anda</p>
                </div>
              </div>

              {/* Player Name */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Nama Anda
                </label>
                <input
                  id="input-player-name-join"
                  type="text"
                  value={playerName}
                  onChange={handleNameChange}
                  placeholder="Nama Anda"
                  maxLength={20}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400 transition"
                />
              </div>

              {/* Room Code */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Kode Room (Contoh: CHESS-7X9B)
                </label>
                <input
                  id="input-room-code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ketik kode room di sini..."
                  maxLength={16}
                  className="w-full font-mono uppercase bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-base font-bold text-amber-400 tracking-wider focus:outline-none focus:border-blue-400 transition"
                />
              </div>

              <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 space-y-1.5">
                <p className="font-semibold text-zinc-300">Tips Bermain:</p>
                <p>1. Bagikan kode kepada teman untuk masuk ke room yang sama.</p>
                <p>2. Setelah kedua pemain bergabung, Host menekan tombol "Mulai Pertandingan".</p>
                <p>3. Papan catur akan tersinkronisasi otomatis saat giliran langkah dijalankan.</p>
              </div>
            </div>

            <button
              id="btn-join-room"
              type="submit"
              disabled={isLoading || !joinCode.trim()}
              className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-xl shadow-lg shadow-blue-950/40 transition cursor-pointer text-sm"
            >
              {isLoading ? 'Menghubungkan...' : 'Gabung ke Room Lawan'}
            </button>
          </form>
        </div>
      </div>

      {/* Quick Access to Leaderboard */}
      <div className="mt-8 text-center">
        <button
          id="btn-view-leaderboard-home"
          onClick={onOpenLeaderboard}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-amber-400 hover:text-amber-300 text-xs font-bold rounded-xl transition cursor-pointer shadow-md"
        >
          <Sparkles className="w-4 h-4" />
          Lihat Skor & Papan Peringkat Leaderboard
        </button>
      </div>
    </div>
  );
};
