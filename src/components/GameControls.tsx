import React, { useMemo } from 'react';
import { Chess } from 'chess.js';
import { Flag, Play, RotateCcw, Handshake, Copy, Check, Users } from 'lucide-react';
import { PieceColor, RoomState } from '../types/chess';
import { ChessPiece } from '../lib/chessPieces';

interface GameControlsProps {
  room: RoomState;
  isHost: boolean;
  myColor: PieceColor | null;
  onStartGame: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onRematch: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  room,
  isHost,
  myColor,
  onStartGame,
  onResign,
  onOfferDraw,
  onRematch,
}) => {
  const [copied, setCopied] = React.useState(false);

  const formatTime = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate captured pieces from FEN
  const capturedPieces = useMemo(() => {
    const defaultPieces = {
      p: 8, r: 2, n: 2, b: 2, q: 1,
    };
    const whiteRem = { ...defaultPieces };
    const blackRem = { ...defaultPieces };

    try {
      const chess = new Chess(room.fen);
      const board = chess.board();
      const whiteCounts = { p: 0, r: 0, n: 0, b: 0, q: 0 };
      const blackCounts = { p: 0, r: 0, n: 0, b: 0, q: 0 };

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.type !== 'k') {
            if (p.color === 'w') whiteCounts[p.type]++;
            if (p.color === 'b') blackCounts[p.type]++;
          }
        }
      }

      const whiteCaptured: { type: string; color: PieceColor }[] = [];
      const blackCaptured: { type: string; color: PieceColor }[] = [];

      (Object.keys(defaultPieces) as (keyof typeof defaultPieces)[]).forEach((type) => {
        const whiteLost = Math.max(0, whiteRem[type] - whiteCounts[type]);
        const blackLost = Math.max(0, blackRem[type] - blackCounts[type]);

        for (let i = 0; i < whiteLost; i++) whiteCaptured.push({ type, color: 'w' });
        for (let i = 0; i < blackLost; i++) blackCaptured.push({ type, color: 'b' });
      });

      return { whiteCaptured, blackCaptured };
    } catch {
      return { whiteCaptured: [], blackCaptured: [] };
    }
  }, [room.fen]);

  const isWhiteTurn = room.turn === 'w';
  const isGameOver = ['checkmate', 'draw', 'stalemate', 'resigned', 'timeout'].includes(room.status);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Bar: Room Code & Status */}
      <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700/80 px-4 py-2.5 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400">KODE ROOM:</span>
          <span className="text-sm font-mono font-bold tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded border border-amber-400/30">
            {room.code}
          </span>
          <button
            id="btn-copy-code"
            onClick={copyRoomCode}
            className="p-1 text-zinc-400 hover:text-white transition rounded hover:bg-zinc-700"
            title="Salin Kode Room"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              room.status === 'playing'
                ? 'bg-emerald-400 animate-pulse'
                : room.status === 'ready'
                ? 'bg-blue-400'
                : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-medium text-zinc-300 capitalize">
            {room.status === 'playing'
              ? 'Sedang Bermain'
              : room.status === 'ready'
              ? 'Siap Mulai'
              : room.status === 'waiting'
              ? 'Menunggu Lawan'
              : 'Selesai'}
          </span>
        </div>
      </div>

      {/* Opponent Card (Black or White) */}
      <div
        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
          !isWhiteTurn && room.status === 'playing'
            ? 'bg-zinc-800/90 border-amber-500/80 shadow-lg ring-1 ring-amber-500/50'
            : 'bg-zinc-800/40 border-zinc-700/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300">
            {room.blackPlayer ? (
              <span className="text-sm uppercase">{room.blackPlayer.name.substring(0, 2)}</span>
            ) : (
              <Users className="w-5 h-5 text-zinc-500 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-100">
                {room.blackPlayer ? room.blackPlayer.name : 'Menunggu Pemain 2...'}
              </span>
              <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded font-mono">
                Hitam
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {capturedPieces.whiteCaptured.map((p, idx) => (
                <div key={idx} className="w-3.5 h-3.5 opacity-80">
                  <ChessPiece type={p.type as any} color="w" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Black Timer */}
        <div
          className={`font-mono text-xl font-bold px-3 py-1 rounded-lg border ${
            !isWhiteTurn && room.status === 'playing'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 animate-pulse'
              : 'bg-zinc-900/80 text-zinc-400 border-zinc-800'
          }`}
        >
          {formatTime(room.blackTimeMs)}
        </div>
      </div>

      {/* Your Card (White or Black) */}
      <div
        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
          isWhiteTurn && room.status === 'playing'
            ? 'bg-zinc-800/90 border-amber-500/80 shadow-lg ring-1 ring-amber-500/50'
            : 'bg-zinc-800/40 border-zinc-700/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-300 flex items-center justify-center font-bold text-zinc-900">
            {room.whitePlayer ? (
              <span className="text-sm uppercase">{room.whitePlayer.name.substring(0, 2)}</span>
            ) : (
              <Users className="w-5 h-5 text-zinc-500 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-100">
                {room.whitePlayer ? room.whitePlayer.name : 'Pemain Putih'}
              </span>
              <span className="text-[10px] bg-zinc-200 text-zinc-800 px-1.5 py-0.5 rounded font-mono font-medium">
                Putih
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {capturedPieces.blackCaptured.map((p, idx) => (
                <div key={idx} className="w-3.5 h-3.5 opacity-80">
                  <ChessPiece type={p.type as any} color="b" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* White Timer */}
        <div
          className={`font-mono text-xl font-bold px-3 py-1 rounded-lg border ${
            isWhiteTurn && room.status === 'playing'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 animate-pulse'
              : 'bg-zinc-900/80 text-zinc-400 border-zinc-800'
          }`}
        >
          {formatTime(room.whiteTimeMs)}
        </div>
      </div>

      {/* Game Action Buttons */}
      <div className="flex flex-col gap-2">
        {/* START BUTTON (When Waiting or Ready) */}
        {room.status !== 'playing' && !isGameOver && (
          <div className="flex flex-col gap-2">
            {isHost ? (
              <button
                id="btn-start-game"
                onClick={onStartGame}
                disabled={!room.whitePlayer || !room.blackPlayer}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all cursor-pointer text-sm"
              >
                <Play className="w-5 h-5 fill-current" />
                {!room.whitePlayer || !room.blackPlayer
                  ? 'Menunggu Lawan Bergabung...'
                  : 'Mulai Pertandingan Sekarang'}
              </button>
            ) : (
              <div className="text-center p-3 bg-zinc-800/60 rounded-xl border border-zinc-700 text-xs text-zinc-300">
                Menunggu Host ({room.whitePlayer?.id === room.hostId ? room.whitePlayer.name : room.blackPlayer?.name}) untuk menekan tombol Start...
              </div>
            )}
          </div>
        )}

        {/* ACTIVE GAME CONTROLS (Resign / Draw) */}
        {room.status === 'playing' && myColor && (
          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-offer-draw"
              onClick={onOfferDraw}
              className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <Handshake className="w-4 h-4 text-blue-400" />
              Tawar Remis
            </button>
            <button
              id="btn-resign"
              onClick={onResign}
              className="py-2.5 px-3 bg-zinc-800 hover:bg-red-950/60 border border-zinc-700 hover:border-red-600/50 text-red-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <Flag className="w-4 h-4" />
              Menyerah
            </button>
          </div>
        )}

        {/* GAME OVER ACTIONS (Rematch) */}
        {isGameOver && (
          <button
            id="btn-rematch"
            onClick={onRematch}
            className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 transition cursor-pointer text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            {room.rematchOfferBy ? 'Terima Tantangan Rematch' : 'Tantang Rematch (Tukar Sisi)'}
          </button>
        )}
      </div>
    </div>
  );
};
