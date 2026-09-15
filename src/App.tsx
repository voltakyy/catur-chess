import { useState, useEffect } from 'react';
import {
  Trophy,
  Volume2,
  VolumeX,
  Database,
  ArrowLeft,
  Share2,
  Check,
  Crown,
} from 'lucide-react';
import { BoardTheme, PieceColor, PieceType, RoomState } from './types/chess';
import { roomManager } from './lib/roomManager';
import { sounds } from './lib/sound';
import { getStoredSupabaseConfig } from './lib/supabase';
import { RoomLobby } from './components/RoomLobby';
import { ChessBoard } from './components/ChessBoard';
import { GameControls } from './components/GameControls';
import { MoveHistory } from './components/MoveHistory';
import { LeaderboardModal } from './components/LeaderboardModal';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { GameOverModal } from './components/GameOverModal';

export default function App() {
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('emerald');
  const [isMuted, setIsMuted] = useState(sounds.isMuted());
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Initialize room listener, notification listener, and session recovery
  useEffect(() => {
    const unsub = roomManager.subscribe((room) => {
      setCurrentRoom(room);
    });

    const unsubNotif = roomManager.onNotification((notif) => {
      showToast(notif.message);
    });

    const config = getStoredSupabaseConfig();
    setIsSupabaseConnected(!!(config.url && config.anonKey));

    // Reconnection and session restoration (persists across refresh or temporary disconnect)
    roomManager.restoreActiveRoom().then((res) => {
      if (res.success && res.room) {
        showToast(`Terhubung kembali ke Room ${res.room.code}`);
      }
    });

    return () => {
      unsub();
      unsubNotif();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const toggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
    showToast(muted ? 'Suara dinonaktifkan' : 'Suara diaktifkan');
  };

  const handleStartGame = () => {
    const res = roomManager.startGame();
    showToast(res.message);
  };

  const handleMove = (from: string, to: string, promotion: PieceType = 'q') => {
    const res = roomManager.makeMove(from, to, promotion);
    if (!res.success) {
      showToast(res.message);
    }
  };

  const handleResign = () => {
    if (window.confirm('Apakah Anda yakin ingin menyerah pada pertandingan ini?')) {
      roomManager.resign();
      showToast('Anda telah menyerah.');
    }
  };

  const handleOfferDraw = () => {
    const res = roomManager.offerOrAcceptDraw();
    showToast(res.message);
  };

  const handleRematch = () => {
    roomManager.requestRematch();
    showToast('Tantangan rematch dikirim!');
  };

  const handleLeaveRoom = () => {
    if (currentRoom?.status === 'playing') {
      if (!window.confirm('Pertandingan sedang berjalan. Yakin ingin keluar?')) {
        return;
      }
    }
    roomManager.leaveRoom();
    showToast('Kembali ke menu utama.');
  };

  const handleCopyShareLink = () => {
    if (!currentRoom) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoom.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Tautan room disalin ke clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const myColor: PieceColor | null = roomManager.getMyColor();
  const isWhiteTurn = currentRoom?.turn === 'w';
  const isMyTurn =
    currentRoom?.status === 'playing' &&
    ((isWhiteTurn && myColor === 'w') || (!isWhiteTurn && myColor === 'b'));

  const lastMove =
    currentRoom && currentRoom.history.length > 0
      ? currentRoom.history[currentRoom.history.length - 1]
      : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased selection:bg-amber-500 selection:text-black">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 text-white border border-zinc-700 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/10">
              <Crown className="w-6 h-6 fill-current" />
            </div>
            <div>
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white block leading-tight">
                Catur Arena
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">Multiplayer Online & Supabase</span>
            </div>
          </div>

          {/* Action buttons on Header */}
          <div className="flex items-center gap-2">
            {/* Supabase Database Button */}
            <button
              id="btn-header-supabase"
              onClick={() => setShowSupabaseModal(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Konfigurasi Database Supabase"
            >
              <Database className={`w-3.5 h-3.5 ${isSupabaseConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="hidden sm:inline text-zinc-300">
                {isSupabaseConnected ? 'Supabase Aktif' : 'Database Supabase'}
              </span>
            </button>

            {/* Leaderboard Button */}
            <button
              id="btn-header-leaderboard"
              onClick={() => setShowLeaderboard(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-amber-400 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leaderboard</span>
            </button>

            {/* Sound Toggle */}
            <button
              id="btn-header-sound"
              onClick={toggleSound}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
              title={isMuted ? 'Aktifkan Suara' : 'Bisukan Suara'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {!currentRoom ? (
          /* Lobby View */
          <RoomLobby
            onRoomJoined={() => showToast('Selamat datang di Room!')}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
          />
        ) : (
          /* Active Chess Match Arena */
          <div className="max-w-6xl mx-auto w-full py-6 px-4 flex flex-col gap-5">
            {/* Sub-header inside active room */}
            <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
              <button
                id="btn-leave-room"
                onClick={handleLeaveRoom}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Tinggalkan Room</span>
              </button>

              {/* Turn indicator badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Status Giliran:</span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    isMyTurn
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}
                >
                  {isMyTurn
                    ? 'Giliran Anda!'
                    : currentRoom.status === 'playing'
                    ? `Giliran ${currentRoom.turn === 'w' ? 'Putih' : 'Hitam'}`
                    : 'Menunggu Permainan'}
                </span>
              </div>

              {/* Share Room Button */}
              <button
                id="btn-share-link"
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-xl border border-zinc-700 transition cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copiedLink ? 'Tersalin!' : 'Bagikan Link'}</span>
              </button>
            </div>

            {/* Arena Grid: Left Chessboard, Right Controls & Notation */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Chessboard Column */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center">
                <ChessBoard
                  fen={currentRoom.fen}
                  turn={currentRoom.turn}
                  playerColor={myColor}
                  lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
                  isMyTurn={isMyTurn}
                  gameStatus={currentRoom.status}
                  theme={boardTheme}
                  onMove={handleMove}
                />

                {/* Quick Hint below board */}
                <p className="text-[11px] text-zinc-500 text-center mt-3">
                  {myColor
                    ? `Anda bermain sebagai bidak ${myColor === 'w' ? 'Putih (Bawah)' : 'Hitam (Bawah)'}`
                    : 'Anda sedang menonton pertandingan (Penonton)'}
                  {currentRoom.status === 'playing' && isMyTurn ? ' — Klik bidak lalu klik kotak tujuan untuk melangkah' : ''}
                </p>
              </div>

              {/* Sidebar Column: Controls & Moves History */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <GameControls
                  room={currentRoom}
                  isHost={roomManager.isHost()}
                  myColor={myColor}
                  onStartGame={handleStartGame}
                  onResign={handleResign}
                  onOfferDraw={handleOfferDraw}
                  onRematch={handleRematch}
                />

                <MoveHistory
                  history={currentRoom.history}
                  currentTheme={boardTheme}
                  onThemeChange={(t) => setBoardTheme(t)}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        onOpenSupabaseSetup={() => {
          setShowLeaderboard(false);
          setShowSupabaseModal(true);
        }}
      />

      <SupabaseSetupModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        onConnected={() => {
          setIsSupabaseConnected(true);
          showToast('Terhubung ke database Supabase!');
        }}
      />

      {currentRoom && (
        <GameOverModal
          room={currentRoom}
          myColor={myColor}
          onRematch={handleRematch}
          onLeaveRoom={handleLeaveRoom}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}
    </div>
  );
}
