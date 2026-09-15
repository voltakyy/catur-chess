import React, { useState, useMemo } from 'react';
import { Chess, Square } from 'chess.js';
import { BoardTheme, PieceColor, PieceType } from '../types/chess';
import { ChessPiece } from '../lib/chessPieces';

interface ChessBoardProps {
  fen: string;
  turn: PieceColor;
  playerColor: PieceColor | null;
  lastMove?: { from: string; to: string } | null;
  isMyTurn: boolean;
  gameStatus: string;
  theme?: BoardTheme;
  onMove: (from: string, to: string, promotion?: PieceType) => void;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  playerColor,
  lastMove,
  isMyTurn,
  gameStatus,
  theme = 'emerald',
  onMove,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  // Initialize chess engine for legal moves calculation
  const chess = useMemo(() => new Chess(fen), [fen]);

  // Orientation: if player is playing black, flip the board so rank 1 is top
  const isFlipped = playerColor === 'b';
  const ranks = isFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = isFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  // Calculate king position if in check
  const kingInCheckSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          return piece.square as Square;
        }
      }
    }
    return null;
  }, [chess]);

  // Legal moves for currently selected square
  const legalMovesForSelected = useMemo(() => {
    if (!selectedSquare || !isMyTurn || gameStatus !== 'playing') return [];
    try {
      return chess.moves({ square: selectedSquare, verbose: true });
    } catch {
      return [];
    }
  }, [chess, selectedSquare, isMyTurn, gameStatus]);

  const legalDestinationMap = useMemo(() => {
    const map = new Map<string, boolean>();
    legalMovesForSelected.forEach((m) => {
      map.set(m.to, !!m.captured);
    });
    return map;
  }, [legalMovesForSelected]);

  // Handle clicking a square
  const handleSquareClick = (square: Square) => {
    if (gameStatus !== 'playing' || !isMyTurn) {
      setSelectedSquare(null);
      return;
    }

    const piece = chess.get(square);

    // If square is one of legal destinations from selectedSquare
    if (selectedSquare && legalDestinationMap.has(square)) {
      const selectedPiece = chess.get(selectedSquare);
      // Check for pawn promotion
      const isPawn = selectedPiece && selectedPiece.type === 'p';
      const isPromoRank = (selectedPiece?.color === 'w' && square[1] === '8') || (selectedPiece?.color === 'b' && square[1] === '1');

      if (isPawn && isPromoRank) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      onMove(selectedSquare, square);
      setSelectedSquare(null);
      return;
    }

    // Select my piece
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  const handleSelectPromotion = (pieceType: PieceType) => {
    if (pendingPromotion) {
      onMove(pendingPromotion.from, pendingPromotion.to, pieceType);
      setPendingPromotion(null);
      setSelectedSquare(null);
    }
  };

  // Theme color styles
  const getThemeColors = () => {
    switch (theme) {
      case 'wood':
        return {
          light: 'bg-[#edd8b7] text-[#936c4b]',
          dark: 'bg-[#b88b4a] text-[#f7ecd5]',
          selected: 'bg-amber-300/80',
          lastMove: 'bg-amber-200/50',
        };
      case 'slate':
        return {
          light: 'bg-slate-200 text-slate-500',
          dark: 'bg-slate-500 text-slate-200',
          selected: 'bg-sky-400/80',
          lastMove: 'bg-sky-300/40',
        };
      case 'midnight':
        return {
          light: 'bg-zinc-700 text-zinc-400',
          dark: 'bg-zinc-900 text-zinc-500',
          selected: 'bg-indigo-500/70',
          lastMove: 'bg-indigo-400/30',
        };
      case 'emerald':
      default:
        return {
          light: 'bg-[#eeeed2] text-[#769656]',
          dark: 'bg-[#769656] text-[#eeeed2]',
          selected: 'bg-yellow-300/80',
          lastMove: 'bg-yellow-200/45',
        };
    }
  };

  const themeColors = getThemeColors();

  return (
    <div className="relative w-full max-w-[540px] aspect-square rounded-xl shadow-2xl overflow-hidden border-4 border-zinc-800 select-none bg-zinc-900">
      {/* 8x8 Grid */}
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {ranks.map((rank) =>
          files.map((file) => {
            const square = `${file}${rank}` as Square;
            const isLight = (file.charCodeAt(0) - 97 + rank) % 2 !== 0;
            const piece = chess.get(square);
            const isSelected = selectedSquare === square;
            const isLegalDest = legalDestinationMap.has(square);
            const isCapture = legalDestinationMap.get(square);
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            const isKingInCheck = kingInCheckSquare === square;

            return (
              <div
                key={square}
                id={`square-${square}`}
                onClick={() => handleSquareClick(square)}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 ${
                  isLight ? themeColors.light : themeColors.dark
                } ${isLastMove ? themeColors.lastMove : ''} ${
                  isSelected ? `${themeColors.selected} ring-2 ring-amber-400 inset-0` : ''
                } ${isKingInCheck ? 'bg-red-500/80 ring-4 ring-red-600 animate-pulse' : ''}`}
              >
                {/* Coordinates */}
                {file === files[0] && (
                  <span className="absolute top-0.5 left-1 text-[10px] font-bold opacity-60 pointer-events-none">
                    {rank}
                  </span>
                )}
                {rank === ranks[ranks.length - 1] && (
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-bold opacity-60 pointer-events-none uppercase">
                    {file}
                  </span>
                )}

                {/* Chess Piece */}
                {piece && (
                  <div className="relative w-[85%] h-[85%] flex items-center justify-center drop-shadow-md pointer-events-none transition-transform duration-100 hover:scale-105">
                    <ChessPiece type={piece.type as PieceType} color={piece.color as PieceColor} />
                  </div>
                )}

                {/* Legal Move Indicators */}
                {isLegalDest && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {isCapture || piece ? (
                      <div className="w-[88%] h-[88%] rounded-full border-4 border-red-500/80 animate-ping opacity-75" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-zinc-900/40 dark:bg-black/40 ring-2 ring-white/60" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pawn Promotion Modal */}
      {pendingPromotion && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-2xl text-center max-w-xs w-full">
            <h4 className="text-white font-bold text-sm mb-3">Pilih Promosi Bidak</h4>
            <div className="grid grid-cols-4 gap-2">
              {(['q', 'r', 'b', 'n'] as PieceType[]).map((pType) => (
                <button
                  key={pType}
                  id={`promote-${pType}`}
                  onClick={() => handleSelectPromotion(pType)}
                  className="aspect-square bg-zinc-700 hover:bg-zinc-600 rounded-lg p-2 flex items-center justify-center border border-zinc-600 hover:border-amber-400 transition"
                >
                  <ChessPiece type={pType} color={playerColor || 'w'} className="w-10 h-10" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
