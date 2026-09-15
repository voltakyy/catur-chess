import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, ArrowLeft, Award, Flame } from 'lucide-react';
import { PieceColor, RoomState } from '../types/chess';

interface GameOverModalProps {
  room: RoomState;
  myColor: PieceColor | null;
  onRematch: () => void;
  onLeaveRoom: () => void;
  onOpenLeaderboard: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  room,
  myColor,
  onRematch,
  onLeaveRoom,
  onOpenLeaderboard,
}) => {
  const isGameOver = ['checkmate', 'draw', 'stalemate', 'resigned', 'timeout'].includes(room.status);

  const isDraw = room.winner === 'draw';
  const isWinner = !isDraw && room.winner === myColor;
  const isLoser = !isDraw && myColor && room.winner !== myColor;

  useEffect(() => {
    if (isGameOver && isWinner) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    }
  }, [isGameOver, isWinner]);

  if (!isGameOver) return null;

  const winnerName =
    room.winner === 'w'
      ? room.whitePlayer?.name || 'Pemain Putih'
      : room.winner === 'b'
      ? room.blackPlayer?.name || 'Pemain Hitam'
      : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 text-center shadow-2xl animate-fade-in">
        {/* Visual Icon */}
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg ring-4">
          {isWinner ? (
            <div className="w-full h-full rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 ring-amber-500/10 flex items-center justify-center">
              <Trophy className="w-8 h-8 animate-bounce" />
            </div>
          ) : isDraw ? (
            <div className="w-full h-full rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 ring-blue-500/10 flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-full h-full rounded-2xl bg-zinc-800 text-zinc-400 border border-zinc-700 ring-zinc-800 flex items-center justify-center">
              <Flame className="w-8 h-8 text-zinc-500" />
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-2xl font-black text-white tracking-tight mb-1">
          {isWinner ? 'Kemenangan Gemilang!' : isDraw ? 'Permainan Remis (Seri)' : 'Pertandingan Selesai'}
        </h3>

        <p className="text-sm font-semibold text-amber-400 mb-2">
          {isDraw ? 'Kedua pemain berbagi poin.' : `${winnerName} memenangkan pertandingan!`}
        </p>

        {/* Reason */}
        {room.winReason && (
          <div className="inline-block bg-zinc-800/80 border border-zinc-700/80 rounded-lg px-3 py-1 text-xs text-zinc-300 font-medium mb-4">
            {room.winReason}
          </div>
        )}

        {/* Rating adjustments */}
        <div className="bg-zinc-800/40 border border-zinc-800 rounded-xl p-3 mb-6">
          <div className="text-xs text-zinc-400 mb-1">Pembaruan Skor Leaderboard</div>
          <div className="flex items-center justify-around font-mono font-bold text-sm">
            <div className="flex flex-col items-center">
              <span className="text-xs text-zinc-300 font-sans font-medium">
                {room.whitePlayer?.name || 'Putih'}
              </span>
              <span
                className={
                  room.winner === 'w'
                    ? 'text-emerald-400'
                    : room.winner === 'b'
                    ? 'text-red-400'
                    : 'text-amber-400'
                }
              >
                {room.winner === 'w' ? '+25 ELO' : room.winner === 'b' ? '-20 ELO' : '+5 ELO'}
              </span>
            </div>

            <div className="text-zinc-600">vs</div>

            <div className="flex flex-col items-center">
              <span className="text-xs text-zinc-300 font-sans font-medium">
                {room.blackPlayer?.name || 'Hitam'}
              </span>
              <span
                className={
                  room.winner === 'b'
                    ? 'text-emerald-400'
                    : room.winner === 'w'
                    ? 'text-red-400'
                    : 'text-amber-400'
                }
              >
                {room.winner === 'b' ? '+25 ELO' : room.winner === 'w' ? '-20 ELO' : '+5 ELO'}
              </span>
            </div>
          </div>
        </div>

        {/* Rematch & Navigation Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            id="btn-gameover-rematch"
            onClick={onRematch}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-950/40 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {room.rematchOfferBy && room.rematchOfferBy !== room.hostId
                ? 'Terima Rematch Lawan'
                : 'Tantang Rematch (Tukar Posisi)'}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-gameover-leaderboard"
              onClick={onOpenLeaderboard}
              className="py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Leaderboard</span>
            </button>

            <button
              id="btn-gameover-lobby"
              onClick={onLeaveRoom}
              className="py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali Lobby</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
