import React, { useEffect, useRef } from 'react';
import { ChessMoveRecord, BoardTheme } from '../types/chess';
import { Palette, ScrollText } from 'lucide-react';

interface MoveHistoryProps {
  history: ChessMoveRecord[];
  currentTheme: BoardTheme;
  onThemeChange: (theme: BoardTheme) => void;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  history,
  currentTheme,
  onThemeChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Group moves into pairs (White move, Black move)
  const pairedMoves: { moveNumber: number; white: ChessMoveRecord; black?: ChessMoveRecord }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairedMoves.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    });
  }

  return (
    <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3 flex flex-col h-full max-h-[340px]">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-700/60">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
          <ScrollText className="w-3.5 h-3.5 text-amber-400" />
          <span>Notasi Pertandingan</span>
        </div>

        {/* Theme Picker */}
        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
          <Palette className="w-3 h-3 text-zinc-500" />
          <select
            id="select-board-theme"
            value={currentTheme}
            onChange={(e) => onThemeChange(e.target.value as BoardTheme)}
            className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-amber-400"
          >
            <option value="emerald">Emerald</option>
            <option value="wood">Wood</option>
            <option value="slate">Slate</option>
            <option value="midnight">Midnight</option>
          </select>
        </div>
      </div>

      {/* Moves Table */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 text-xs space-y-1 font-mono">
        {pairedMoves.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-center italic py-6">
            Belum ada langkah yang dijalankan.
          </div>
        ) : (
          pairedMoves.map((pair) => (
            <div
              key={pair.moveNumber}
              className="flex items-center py-1 px-2 rounded hover:bg-zinc-700/40 transition"
            >
              <span className="w-8 text-zinc-500 font-semibold">{pair.moveNumber}.</span>
              <span className="w-20 text-zinc-200 font-medium">{pair.white.san}</span>
              <span className="flex-1 text-zinc-400 font-medium">
                {pair.black ? pair.black.san : ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
