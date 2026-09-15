import { Chess } from 'chess.js';
import { GameStatus, PieceColor, PieceType, PlayerInfo, RoomState } from '../types/chess';
import { sounds } from './sound';
import { getSupabaseClient, syncRoomToSupabase, updatePlayerMatchResult } from './supabase';

const ROOM_BROADCAST_CHANNEL = 'chess_room_channel_v1';
const ACTIVE_ROOM_KEY = 'chess_active_room_code';

export interface RoomNotification {
  id: string;
  message: string;
  type: 'info' | 'join' | 'leave' | 'move' | 'game';
  timestamp: number;
}

class RoomManager {
  private currentRoom: RoomState | null = null;
  private currentUserId: string = '';
  private currentUserName: string = '';
  private listeners: Set<(room: RoomState | null) => void> = new Set();
  private notificationListeners: Set<(notif: RoomNotification) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private activeConnectedCode: string | null = null;
  private pollInterval: number | null = null;
  private timerInterval: number | null = null;
  private isConnectingSSE: boolean = false;

  constructor() {
    this.initUser();
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(ROOM_BROADCAST_CHANNEL);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'ROOM_UPDATE' && event.data?.room) {
          const incoming = event.data.room as RoomState;
          if (this.currentRoom && this.currentRoom.code === incoming.code) {
            this.handleIncomingRoomUpdate(incoming, event.data?.meta);
          }
        }
      };
    }

    // Start clock tick timer
    if (typeof window !== 'undefined') {
      this.timerInterval = window.setInterval(() => {
        this.tickTimer();
      }, 500);
    }
  }

  private initUser() {
    if (typeof window === 'undefined') return;

    // Use sessionStorage first so two tabs in the same browser have DISTINCT player IDs!
    // This allows testing Player 1 vs Player 2 seamlessly in two tabs or windows.
    let tabUid = sessionStorage.getItem('chess_player_tab_id');
    if (!tabUid) {
      tabUid = 'p_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('chess_player_tab_id', tabUid);
    }

    let uname = localStorage.getItem('chess_user_name');
    if (!uname) {
      uname = 'Player_' + Math.floor(100 + Math.random() * 900);
      localStorage.setItem('chess_user_name', uname);
    }

    this.currentUserId = tabUid;
    this.currentUserName = uname;
  }

  public getUserId(): string {
    return this.currentUserId;
  }

  public getUserName(): string {
    return this.currentUserName;
  }

  public setUserName(name: string) {
    const trimmed = name.trim();
    if (trimmed) {
      this.currentUserName = trimmed;
      if (typeof window !== 'undefined') {
        localStorage.setItem('chess_user_name', trimmed);
      }
    }
  }

  public subscribe(listener: (room: RoomState | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentRoom);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onNotification(listener: (notif: RoomNotification) => void): () => void {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  private emitNotification(message: string, type: RoomNotification['type'] = 'info') {
    const notif: RoomNotification = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      timestamp: Date.now(),
    };
    this.notificationListeners.forEach((fn) => fn(notif));
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.currentRoom ? { ...this.currentRoom } : null));
  }

  private updateUrl(code: string | null) {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (code) {
        url.searchParams.set('room', code);
      } else {
        url.searchParams.delete('room');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }

  private broadcast(room: RoomState, meta?: { notification?: string; type?: string }) {
    // Cache locally so state survives page reloads even if network or server restarts
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('chess_room_cache_' + room.code, JSON.stringify(room));
      } catch {
        // ignore
      }
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'ROOM_UPDATE', room, meta });
    }
    // Also sync to Supabase in background
    syncRoomToSupabase(room);

    // Sync to backend API for Server-Sent Events push to other connected players
    try {
      fetch('/api/rooms/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, meta }),
      })
        .then(() => {
          console.log('[Real-time Sync] State pushed to server for broadcast:', room.code, meta?.type);
        })
        .catch((err) => {
          console.warn('[Real-time Sync] Failed to post room sync:', err);
        });
    } catch {
      // ignore
    }
  }

  // Connect to real-time Server-Sent Events (SSE) channel for this room
  public connectRealtime(code: string) {
    if (typeof window === 'undefined') return;
    const cleanCode = code.trim().toUpperCase();

    // Already connected to this room and active?
    if (
      this.eventSource &&
      this.eventSource.readyState !== EventSource.CLOSED &&
      this.activeConnectedCode === cleanCode
    ) {
      return;
    }

    this.disconnectRealtime();
    this.activeConnectedCode = cleanCode;
    this.isConnectingSSE = true;

    try {
      console.log(`[Real-time SSE] Connecting to /api/rooms/${cleanCode}/events`);
      const es = new EventSource(`/api/rooms/${cleanCode}/events`);
      this.eventSource = es;

      es.onopen = () => {
        this.isConnectingSSE = false;
        console.log(`[Real-time SSE] Stream connection established for Room ${cleanCode}`);
        // Stop fallback polling when SSE is active and healthy
        this.stopPolling();
      };

      es.onmessage = (event) => {
        try {
          if (!event.data) return;
          const payload = JSON.parse(event.data);
          if (payload && payload.room) {
            const incoming = payload.room as RoomState;
            if (incoming.code === cleanCode) {
              console.log(`[Real-time SSE] Inbound update received:`, payload.type, payload.meta?.notification);
              this.handleIncomingRoomUpdate(incoming, payload.meta);
            }
          }
        } catch (err) {
          console.warn('[Real-time SSE] Failed to parse event data:', err);
        }
      };

      es.onerror = (err) => {
        console.warn(`[Real-time SSE] Connection error on room ${cleanCode}. Browser will auto-reconnect; starting resilient polling backup.`);
        this.startPolling(cleanCode);
      };
    } catch (err) {
      console.error('[Real-time SSE] Failed to initialize EventSource:', err);
      this.startPolling(cleanCode);
    }
  }

  public disconnectRealtime() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.activeConnectedCode = null;
    this.stopPolling();
  }

  private tickTimer() {
    if (!this.currentRoom || this.currentRoom.status !== 'playing') return;

    const now = Date.now();
    const lastMove = this.currentRoom.lastMoveTime || now;
    const elapsed = now - lastMove;

    let whiteTime = this.currentRoom.whiteTimeMs;
    let blackTime = this.currentRoom.blackTimeMs;

    if (this.currentRoom.turn === 'w') {
      whiteTime = Math.max(0, whiteTime - elapsed);
    } else {
      blackTime = Math.max(0, blackTime - elapsed);
    }

    // Check timeout
    if (whiteTime <= 0) {
      this.finishGame('b', 'Waktu Putih Habis (Timeout)');
      return;
    } else if (blackTime <= 0) {
      this.finishGame('w', 'Waktu Hitam Habis (Timeout)');
      return;
    }

    this.currentRoom.whiteTimeMs = whiteTime;
    this.currentRoom.blackTimeMs = blackTime;
    this.currentRoom.lastMoveTime = now;
    this.notify();
  }

  private handleIncomingRoomUpdate(incoming: RoomState, meta?: any) {
    if (meta?.notification) {
      this.emitNotification(meta.notification, meta.type || 'info');
    }

    // Detect events between previous and new incoming state
    if (this.currentRoom) {
      // Opponent joined
      const justJoinedBlack = !this.currentRoom.blackPlayer && incoming.blackPlayer;
      const justJoinedWhite = !this.currentRoom.whitePlayer && incoming.whitePlayer;
      if (justJoinedBlack || justJoinedWhite) {
        const joinedPlayer = justJoinedBlack ? incoming.blackPlayer : incoming.whitePlayer;
        if (joinedPlayer?.id !== this.currentUserId) {
          this.emitNotification(`${joinedPlayer?.name || 'Lawan'} telah bergabung ke Room!`, 'join');
          sounds.playGameStart();
        }
      }

      // Game started
      if (this.currentRoom.status !== 'playing' && incoming.status === 'playing') {
        this.emitNotification('Pertandingan catur telah dimulai!', 'game');
        sounds.playGameStart();
      }

      // New move detected
      if (incoming.history.length > this.currentRoom.history.length) {
        const lastMove = incoming.history[incoming.history.length - 1];
        if (lastMove.captured) {
          sounds.playCapture();
        } else {
          sounds.playMove();
        }
      }

      // Game finished
      if (incoming.status === 'checkmate' && this.currentRoom.status === 'playing') {
        const amWinner = (incoming.winner === 'w' && this.isWhitePlayer()) || (incoming.winner === 'b' && this.isBlackPlayer());
        sounds.playGameOver(amWinner);
        this.emitNotification(incoming.winReason || 'Skakmat! Permainan selesai.', 'game');
      } else if (incoming.status === 'draw' && this.currentRoom.status === 'playing') {
        sounds.playGameOver(false);
        this.emitNotification(incoming.winReason || 'Permainan berakhir remis.', 'game');
      }
    }

    this.currentRoom = incoming;
    this.notify();
  }

  // Restore room state on page refresh or reconnection
  public async restoreActiveRoom(forceCode?: string): Promise<{ success: boolean; room?: RoomState }> {
    if (typeof window === 'undefined') return { success: false };

    let codeToRestore = forceCode;
    if (!codeToRestore) {
      const urlParams = new URLSearchParams(window.location.search);
      codeToRestore = urlParams.get('room') || localStorage.getItem(ACTIVE_ROOM_KEY) || undefined;
    }

    if (!codeToRestore) {
      return { success: false };
    }

    const cleanCode = codeToRestore.trim().toUpperCase();

    // Fetch from server API
    let room: RoomState | null = null;
    try {
      const res = await fetch(`/api/rooms/${cleanCode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          room = data.room;
        }
      }
    } catch {
      // ignore
    }

    // Fallback to Supabase if not found
    if (!room) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('rooms').select('*').eq('code', cleanCode).single();
          if (data) {
            room = {
              code: data.code,
              createdAt: new Date(data.created_at || Date.now()).getTime(),
              updatedAt: new Date(data.updated_at || Date.now()).getTime(),
              status: data.status,
              fen: data.fen,
              history: data.history || [],
              whitePlayer: data.white_player,
              blackPlayer: data.black_player,
              hostId: data.white_player?.id || '',
              turn: data.turn || 'w',
              timeControl: data.time_control || { baseMinutes: 5, incrementSeconds: 3 },
              whiteTimeMs: data.white_time_ms ?? 300000,
              blackTimeMs: data.black_time_ms ?? 300000,
              lastMoveTime: data.last_move_time,
              winner: data.winner,
              winReason: data.win_reason,
            };
          }
        } catch {
          // ignore
        }
      }
    }

    // Fallback to local storage cache if server or network temporarily unavailable
    if (!room) {
      try {
        const cached = localStorage.getItem('chess_room_cache_' + cleanCode);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.code === cleanCode) {
            room = parsed;
            console.log('[Real-time Restore] Room recovered from local storage cache:', cleanCode);
            // Re-seed server with this cached room state
            fetch('/api/rooms/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room }),
            }).catch(() => {});
          }
        }
      } catch {
        // ignore
      }
    }

    if (!room) {
      // Clean up stale key ONLY if room truly does not exist in any storage
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      this.updateUrl(null);
      return { success: false };
    }

    // Mark current user as reconnected if they are one of the players
    if (room.whitePlayer && room.whitePlayer.id === this.currentUserId) {
      room.whitePlayer.connected = true;
    }
    if (room.blackPlayer && room.blackPlayer.id === this.currentUserId) {
      room.blackPlayer.connected = true;
    }

    this.currentRoom = room;
    localStorage.setItem(ACTIVE_ROOM_KEY, room.code);
    this.updateUrl(room.code);
    this.connectRealtime(room.code);
    this.notify();

    // Broadcast reconnection notice
    this.broadcast(room, {
      notification: `${this.currentUserName} kembali terhubung ke Room.`,
      type: 'info',
    });

    return { success: true, room };
  }

  // Generate 6-digit room code like "CHESS-7X9B"
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CHESS-${code}`;
  }

  // Create a brand new room
  public createRoom(
    options: {
      preferredColor?: 'w' | 'b' | 'random';
      timeControlMinutes?: number;
      incrementSeconds?: number;
    } = {}
  ): RoomState {
    const code = this.generateRoomCode();
    const chess = new Chess();
    const pref = options.preferredColor || 'w';
    const chosenColor = pref === 'random' ? (Math.random() > 0.5 ? 'w' : 'b') : pref;

    const hostPlayer: PlayerInfo = {
      id: this.currentUserId,
      name: this.currentUserName || 'Host',
      rating: 1200,
      connected: true,
      ready: true,
    };

    const baseMin = options.timeControlMinutes ?? 5;
    const incSec = options.incrementSeconds ?? 3;
    const timeMs = baseMin * 60 * 1000;

    const newRoom: RoomState = {
      code,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'waiting',
      fen: chess.fen(),
      history: [],
      whitePlayer: chosenColor === 'w' ? hostPlayer : null,
      blackPlayer: chosenColor === 'b' ? hostPlayer : null,
      hostId: this.currentUserId,
      turn: 'w',
      timeControl: {
        baseMinutes: baseMin,
        incrementSeconds: incSec,
      },
      whiteTimeMs: timeMs,
      blackTimeMs: timeMs,
      lastMoveTime: null,
      winner: null,
    };

    this.currentRoom = newRoom;
    localStorage.setItem(ACTIVE_ROOM_KEY, code);
    this.updateUrl(code);
    this.connectRealtime(code);
    this.broadcast(newRoom, {
      notification: `Room ${code} berhasil dibuat. Bagikan kode untuk mulai bermain.`,
      type: 'info',
    });
    this.notify();
    return newRoom;
  }

  // Join existing room by code
  public async joinRoom(code: string): Promise<{ success: boolean; message: string; room?: RoomState }> {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Kode room tidak boleh kosong.' };
    }

    // Try fetching from API or Supabase
    let room: RoomState | null = null;

    // Check backend API
    try {
      const res = await fetch(`/api/rooms/${cleanCode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          room = data.room;
        }
      }
    } catch {
      // ignore
    }

    // Check Supabase if not found
    if (!room) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data } = await supabase.from('rooms').select('*').eq('code', cleanCode).single();
          if (data) {
            room = {
              code: data.code,
              createdAt: new Date(data.created_at || Date.now()).getTime(),
              updatedAt: new Date(data.updated_at || Date.now()).getTime(),
              status: data.status,
              fen: data.fen,
              history: data.history || [],
              whitePlayer: data.white_player,
              blackPlayer: data.black_player,
              hostId: data.white_player?.id || '',
              turn: data.turn || 'w',
              timeControl: data.time_control || { baseMinutes: 5, incrementSeconds: 3 },
              whiteTimeMs: data.white_time_ms ?? 300000,
              blackTimeMs: data.black_time_ms ?? 300000,
              lastMoveTime: data.last_move_time,
              winner: data.winner,
              winReason: data.win_reason,
            };
          }
        } catch {
          // ignore
        }
      }
    }

    // If still null, check if user is re-joining existing local room
    if (!room) {
      if (this.currentRoom && this.currentRoom.code === cleanCode) {
        room = this.currentRoom;
      } else {
        return { success: false, message: `Room dengan kode "${cleanCode}" tidak ditemukan.` };
      }
    }

    const playerInfo: PlayerInfo = {
      id: this.currentUserId,
      name: this.currentUserName,
      rating: 1200,
      connected: true,
      ready: true,
    };

    // Check if user is already one of the players
    const isWhite = room.whitePlayer?.id === this.currentUserId;
    const isBlack = room.blackPlayer?.id === this.currentUserId;

    if (!isWhite && !isBlack) {
      if (!room.whitePlayer) {
        room.whitePlayer = playerInfo;
      } else if (!room.blackPlayer) {
        room.blackPlayer = playerInfo;
      } else {
        return { success: false, message: 'Room ini sudah penuh (2 pemain).' };
      }
    } else {
      // Reconnecting existing player
      if (isWhite && room.whitePlayer) {
        room.whitePlayer.connected = true;
        room.whitePlayer.name = this.currentUserName;
      }
      if (isBlack && room.blackPlayer) {
        room.blackPlayer.connected = true;
        room.blackPlayer.name = this.currentUserName;
      }
    }

    // If both players are in, update status to ready if was waiting
    if (room.whitePlayer && room.blackPlayer && room.status === 'waiting') {
      room.status = 'ready';
    }

    room.updatedAt = Date.now();
    this.currentRoom = room;

    localStorage.setItem(ACTIVE_ROOM_KEY, room.code);
    this.updateUrl(room.code);
    this.connectRealtime(room.code);

    this.broadcast(room, {
      notification: `${playerInfo.name} telah bergabung ke room!`,
      type: 'join',
    });
    this.notify();

    return { success: true, message: 'Berhasil bergabung ke room!', room };
  }

  // Start the game (Host clicks "Mulai Pertandingan")
  public startGame(): { success: boolean; message: string } {
    if (!this.currentRoom) {
      return { success: false, message: 'Tidak ada room aktif.' };
    }

    if (this.currentRoom.hostId !== this.currentUserId) {
      return { success: false, message: 'Hanya host yang dapat memulai pertandingan.' };
    }

    if (!this.currentRoom.whitePlayer || !this.currentRoom.blackPlayer) {
      return { success: false, message: 'Menunggu pemain lawan untuk bergabung.' };
    }

    const chess = new Chess();
    this.currentRoom.status = 'playing';
    this.currentRoom.fen = chess.fen();
    this.currentRoom.history = [];
    this.currentRoom.turn = 'w';
    this.currentRoom.lastMoveTime = Date.now();
    this.currentRoom.winner = null;
    this.currentRoom.winReason = undefined;
    this.currentRoom.updatedAt = Date.now();

    sounds.playGameStart();
    this.broadcast(this.currentRoom, {
      notification: 'Pertandingan catur telah dimulai!',
      type: 'game',
    });
    this.notify();

    return { success: true, message: 'Pertandingan dimulai!' };
  }

  // Make a chess move
  public makeMove(from: string, to: string, promotion: PieceType = 'q'): { success: boolean; message: string } {
    if (!this.currentRoom || this.currentRoom.status !== 'playing') {
      return { success: false, message: 'Permainan belum dimulai.' };
    }

    const isWhiteTurn = this.currentRoom.turn === 'w';
    const isMyTurn = (isWhiteTurn && this.isWhitePlayer()) || (!isWhiteTurn && this.isBlackPlayer());

    if (!isMyTurn) {
      return { success: false, message: 'Bukan giliran Anda!' };
    }

    const chess = new Chess(this.currentRoom.fen);

    try {
      const move = chess.move({
        from,
        to,
        promotion,
      });

      if (!move) {
        return { success: false, message: 'Langkah tidak sah (illegal move).' };
      }

      // Add increment
      const incMs = (this.currentRoom.timeControl.incrementSeconds || 0) * 1000;
      if (isWhiteTurn) {
        this.currentRoom.whiteTimeMs += incMs;
      } else {
        this.currentRoom.blackTimeMs += incMs;
      }

      const now = Date.now();
      const moveRecord = {
        from: move.from,
        to: move.to,
        san: move.san,
        color: move.color as PieceColor,
        piece: move.piece as PieceType,
        captured: move.captured as PieceType | undefined,
        promotion: move.promotion as PieceType | undefined,
        fenAfter: chess.fen(),
        timestamp: now,
      };

      this.currentRoom.history.push(moveRecord);
      this.currentRoom.fen = chess.fen();
      this.currentRoom.turn = chess.turn() as PieceColor;
      this.currentRoom.lastMoveTime = now;
      this.currentRoom.updatedAt = now;

      // Play sound
      if (move.captured) {
        sounds.playCapture();
      } else {
        sounds.playMove();
      }

      // Check game over conditions
      if (chess.isCheckmate()) {
        const winnerColor: PieceColor = move.color as PieceColor;
        this.finishGame(winnerColor, `Skakmat! ${winnerColor === 'w' ? 'Putih' : 'Hitam'} menang.`);
      } else if (chess.isStalemate()) {
        this.finishGame('draw', 'Remis karena Stalemate (Paten).');
      } else if (chess.isThreefoldRepetition()) {
        this.finishGame('draw', 'Remis karena Pengulangan Tiga Kali (Threefold Repetition).');
      } else if (chess.isInsufficientMaterial()) {
        this.finishGame('draw', 'Remis karena materi tidak mencukupi (Insufficient Material).');
      } else if (chess.isDraw()) {
        this.finishGame('draw', 'Permainan berakhir remis (50-move rule).');
      } else if (chess.inCheck()) {
        sounds.playCheck();
      }

      this.broadcast(this.currentRoom, {
        notification: `${move.color === 'w' ? 'Putih' : 'Hitam'} melangkah: ${move.san}`,
        type: 'move',
      });
      this.notify();
      return { success: true, message: 'Langkah berhasil.' };
    } catch {
      return { success: false, message: 'Langkah catur tidak valid.' };
    }
  }

  // Resign / Surrender
  public resign(): void {
    if (!this.currentRoom || this.currentRoom.status !== 'playing') return;

    if (this.isWhitePlayer()) {
      this.finishGame('b', `${this.currentRoom.whitePlayer?.name || 'Putih'} menyerah.`);
    } else if (this.isBlackPlayer()) {
      this.finishGame('w', `${this.currentRoom.blackPlayer?.name || 'Hitam'} menyerah.`);
    }
  }

  // Offer or accept draw
  public offerOrAcceptDraw(): { message: string } {
    if (!this.currentRoom || this.currentRoom.status !== 'playing') {
      return { message: 'Permainan tidak sedang berlangsung.' };
    }

    const myColor: PieceColor = this.isWhitePlayer() ? 'w' : 'b';
    const opponentColor: PieceColor = myColor === 'w' ? 'b' : 'w';

    if (this.currentRoom.drawOfferBy === opponentColor) {
      // Opponent offered, so accept!
      this.finishGame('draw', 'Permainan berakhir remis dengan kesepakatan bersama.');
      return { message: 'Tawaran remis diterima!' };
    } else {
      this.currentRoom.drawOfferBy = myColor;
      this.broadcast(this.currentRoom, {
        notification: `${this.currentUserName} menawarkan remis (draw).`,
        type: 'info',
      });
      this.notify();
      return { message: 'Menawarkan remis kepada lawan...' };
    }
  }

  // Rematch request
  public requestRematch(): void {
    if (!this.currentRoom) return;

    if (this.currentRoom.rematchOfferBy && this.currentRoom.rematchOfferBy !== this.currentUserId) {
      // Accept rematch! Swap colors and restart
      const prevWhite = this.currentRoom.whitePlayer;
      const prevBlack = this.currentRoom.blackPlayer;

      const chess = new Chess();
      const timeMs = this.currentRoom.timeControl.baseMinutes * 60 * 1000;

      this.currentRoom.whitePlayer = prevBlack;
      this.currentRoom.blackPlayer = prevWhite;
      this.currentRoom.fen = chess.fen();
      this.currentRoom.history = [];
      this.currentRoom.turn = 'w';
      this.currentRoom.status = 'playing';
      this.currentRoom.whiteTimeMs = timeMs;
      this.currentRoom.blackTimeMs = timeMs;
      this.currentRoom.lastMoveTime = Date.now();
      this.currentRoom.winner = null;
      this.currentRoom.winReason = undefined;
      this.currentRoom.drawOfferBy = null;
      this.currentRoom.rematchOfferBy = null;
      this.currentRoom.updatedAt = Date.now();

      sounds.playGameStart();
      this.broadcast(this.currentRoom, {
        notification: 'Tawaran tanding ulang diterima! Pertandingan baru dimulai.',
        type: 'game',
      });
      this.notify();
    } else {
      this.currentRoom.rematchOfferBy = this.currentUserId;
      this.broadcast(this.currentRoom, {
        notification: `${this.currentUserName} mengajak tanding ulang (rematch).`,
        type: 'info',
      });
      this.notify();
    }
  }

  private finishGame(winner: PieceColor | 'draw', reason: string) {
    if (!this.currentRoom) return;

    this.currentRoom.status = winner === 'draw' ? 'draw' : 'checkmate';
    this.currentRoom.winner = winner;
    this.currentRoom.winReason = reason;
    this.currentRoom.updatedAt = Date.now();

    const amWinner = (winner === 'w' && this.isWhitePlayer()) || (winner === 'b' && this.isBlackPlayer());
    sounds.playGameOver(amWinner);

    // Save to Leaderboard
    const whiteName = this.currentRoom.whitePlayer?.name || 'Pemain Putih';
    const blackName = this.currentRoom.blackPlayer?.name || 'Pemain Hitam';

    if (winner === 'draw') {
      updatePlayerMatchResult(whiteName, blackName, true);
    } else if (winner === 'w') {
      updatePlayerMatchResult(whiteName, blackName, false);
    } else if (winner === 'b') {
      updatePlayerMatchResult(blackName, whiteName, false);
    }

    this.broadcast(this.currentRoom, {
      notification: reason,
      type: 'game',
    });
    this.notify();
  }

  // Helper check methods
  public isWhitePlayer(): boolean {
    return this.currentRoom?.whitePlayer?.id === this.currentUserId;
  }

  public isBlackPlayer(): boolean {
    return this.currentRoom?.blackPlayer?.id === this.currentUserId;
  }

  public isHost(): boolean {
    return this.currentRoom?.hostId === this.currentUserId;
  }

  public getMyColor(): PieceColor | null {
    if (this.isWhitePlayer()) return 'w';
    if (this.isBlackPlayer()) return 'b';
    return null;
  }

  public leaveRoom() {
    if (this.currentRoom) {
      if (this.isWhitePlayer() && this.currentRoom.whitePlayer) {
        this.currentRoom.whitePlayer.connected = false;
      }
      if (this.isBlackPlayer() && this.currentRoom.blackPlayer) {
        this.currentRoom.blackPlayer.connected = false;
      }
      this.broadcast(this.currentRoom, {
        notification: `${this.currentUserName} telah keluar dari room.`,
        type: 'leave',
      });
    }

    this.disconnectRealtime();
    this.stopPolling();
    localStorage.removeItem(ACTIVE_ROOM_KEY);
    this.updateUrl(null);
    this.currentRoom = null;
    this.notify();
  }

  // Periodic polling for room state when in room (for cross-browser sync)
  private startPolling(code: string) {
    this.stopPolling();
    this.pollInterval = window.setInterval(async () => {
      if (!this.currentRoom || this.currentRoom.code !== code) return;

      // Check API
      try {
        const res = await fetch(`/api/rooms/${code}`);
        if (res.ok) {
          const data = await res.json();
          if (data.room && data.room.updatedAt > (this.currentRoom?.updatedAt || 0)) {
            this.handleIncomingRoomUpdate(data.room);
          }
        }
      } catch {
        // ignore
      }
    }, 1200);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export const roomManager = new RoomManager();
