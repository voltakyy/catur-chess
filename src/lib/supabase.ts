import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LeaderboardEntry, RoomState } from '../types/chess';

// Initial dummy/seed leaderboard data for instant realistic display
const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { id: '1', username: 'Grandmaster_Budi', score: 1850, wins: 48, losses: 12, draws: 8, totalGames: 68, winRate: 70.6, updatedAt: new Date().toISOString() },
  { id: '2', username: 'QueenSlayer99', score: 1720, wins: 39, losses: 15, draws: 6, totalGames: 60, winRate: 65.0, updatedAt: new Date().toISOString() },
  { id: '3', username: 'CaturKsatria', score: 1640, wins: 31, losses: 14, draws: 5, totalGames: 50, winRate: 62.0, updatedAt: new Date().toISOString() },
  { id: '4', username: 'RookMaster_ID', score: 1580, wins: 28, losses: 18, draws: 4, totalGames: 50, winRate: 56.0, updatedAt: new Date().toISOString() },
  { id: '5', username: 'PawnPusher', score: 1490, wins: 22, losses: 20, draws: 6, totalGames: 48, winRate: 45.8, updatedAt: new Date().toISOString() },
  { id: '6', username: 'TacticsWizard', score: 1430, wins: 19, losses: 17, draws: 5, totalGames: 41, winRate: 46.3, updatedAt: new Date().toISOString() },
  { id: '7', username: 'KnightRiderX', score: 1350, wins: 15, losses: 19, draws: 3, totalGames: 37, winRate: 40.5, updatedAt: new Date().toISOString() },
];

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Local storage key for persistent fallback leaderboard
const STORAGE_LEADERBOARD_KEY = 'chess_arena_leaderboard_v1';
const STORAGE_SUPABASE_KEY = 'chess_arena_supabase_config_v1';

const DEFAULT_SUPABASE_URL = 'https://wgvrsbmdflxjoirgvrds.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndndnJzYm1kZmx4am9pcmd2cmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MzEzMzIsImV4cCI6MjEwNTAwNzMzMn0.ojpiWUPNVRkqHkG4FdO4TlEC44SDxRIQRr3cux0qLbw';

export function getStoredSupabaseConfig(): SupabaseConfig {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  const envUrl = (metaEnv.VITE_SUPABASE_URL || metaEnv.SUPABASE_URL || '').trim();
  const envKey = (metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }

  try {
    const raw = localStorage.getItem(STORAGE_SUPABASE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.url && parsed.anonKey) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // Fallback to configured Supabase project
  return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY };
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  try {
    localStorage.setItem(STORAGE_SUPABASE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

let supabaseInstance: SupabaseClient | null = null;
let currentConfigUrl = '';
let currentConfigKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  if (!supabaseInstance || currentConfigUrl !== config.url || currentConfigKey !== config.anonKey) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      currentConfigUrl = config.url;
      currentConfigKey = config.anonKey;
    } catch (err) {
      console.error('Failed to create Supabase client:', err);
      supabaseInstance = null;
    }
  }

  return supabaseInstance;
}

// Check if Supabase connection is currently active and verified
export async function testSupabaseConnection(url?: string, key?: string): Promise<{ success: boolean; message: string }> {
  try {
    const targetUrl = url || getStoredSupabaseConfig().url;
    const targetKey = key || getStoredSupabaseConfig().anonKey;

    if (!targetUrl || !targetKey) {
      return { success: false, message: 'Supabase URL dan Anon Key belum diisi.' };
    }

    const client = createClient(targetUrl, targetKey);
    // Simple ping to leaderboard table
    const { error } = await client.from('leaderboard').select('count', { count: 'exact', head: true });
    
    if (error) {
      // Table might not exist yet, but client connected
      if (error.code === '42P01') {
        return { success: true, message: 'Koneksi berhasil! Namun tabel "leaderboard" belum dibuat. Jalankan SQL schema di Supabase.' };
      }
      return { success: false, message: `Error Supabase: ${error.message}` };
    }

    return { success: true, message: 'Koneksi ke Supabase berhasil dan tabel terdeteksi!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Koneksi gagal: ${msg}` };
  }
}

// SQL Schema script for user to copy-paste into Supabase SQL editor
export const SUPABASE_SQL_SCHEMA = `-- ==========================================
-- SKEMA SUPABASE: CATUR MULTIPLAYER ONLINE
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor
-- ==========================================

-- 1. TABEL LEADERBOARD
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  score INTEGER NOT NULL DEFAULT 1200,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index untuk sorting leaderboard cepat
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON public.leaderboard (score DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Policy agar semua orang bisa membaca leaderboard
CREATE POLICY "Public Read Leaderboard" ON public.leaderboard
  FOR SELECT USING (true);

-- Policy agar user anon/public bisa update leaderboard
CREATE POLICY "Public Insert/Update Leaderboard" ON public.leaderboard
  FOR ALL USING (true);

-- 2. TABEL ROOMS (REALTIME CATUR)
CREATE TABLE IF NOT EXISTS public.rooms (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'waiting',
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn TEXT NOT NULL DEFAULT 'w',
  white_player JSONB,
  black_player JSONB,
  history JSONB DEFAULT '[]'::jsonb,
  time_control JSONB DEFAULT '{"baseMinutes": 5, "incrementSeconds": 3}'::jsonb,
  white_time_ms INTEGER DEFAULT 300000,
  black_time_ms INTEGER DEFAULT 300000,
  last_move_time BIGINT,
  winner TEXT,
  win_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Rooms" ON public.rooms
  FOR SELECT USING (true);

CREATE POLICY "Public Manage Rooms" ON public.rooms
  FOR ALL USING (true);

-- Aktifkan Realtime replication pada tabel rooms & leaderboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;

-- Seed data awal leaderboard
INSERT INTO public.leaderboard (username, score, wins, losses, draws, total_games, win_rate)
VALUES 
  ('Grandmaster_Budi', 1850, 48, 12, 8, 68, 70.6),
  ('QueenSlayer99', 1720, 39, 15, 6, 60, 65.0),
  ('CaturKsatria', 1640, 31, 14, 5, 50, 62.0),
  ('RookMaster_ID', 1580, 28, 18, 4, 50, 56.0),
  ('PawnPusher', 1490, 22, 20, 6, 48, 45.8)
ON CONFLICT (username) DO NOTHING;
`;

// Helper: load local fallback leaderboard
function getLocalLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_LEADERBOARD_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return INITIAL_LEADERBOARD;
}

function saveLocalLeaderboard(data: LeaderboardEntry[]) {
  try {
    localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// Fetch Leaderboard from Supabase with graceful fallback
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        return data.map((row, idx) => ({
          id: row.id || String(idx + 1),
          username: row.username,
          score: Number(row.score) || 1200,
          wins: Number(row.wins) || 0,
          losses: Number(row.losses) || 0,
          draws: Number(row.draws) || 0,
          totalGames: Number(row.total_games) || 0,
          winRate: Number(row.win_rate) || 0,
          rank: idx + 1,
          updatedAt: row.updated_at || new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.warn('Supabase fetch failed, using local storage fallback:', err);
    }
  }

  // Fallback to local storage
  const local = getLocalLeaderboard();
  return local
    .sort((a, b) => b.score - a.score)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

// Update player stats on match finish
export async function updatePlayerMatchResult(
  winnerName: string | null,
  loserName: string | null,
  isDraw: boolean = false
): Promise<void> {
  const supabase = getSupabaseClient();

  // Helper to calculate rating change
  const calcNewRating = (oldRating: number, change: number) => Math.max(100, oldRating + change);

  if (supabase) {
    try {
      if (isDraw && winnerName && loserName) {
        await updateOrCreatePlayerInDb(supabase, winnerName, 'draw');
        await updateOrCreatePlayerInDb(supabase, loserName, 'draw');
      } else if (winnerName && loserName) {
        await updateOrCreatePlayerInDb(supabase, winnerName, 'win');
        await updateOrCreatePlayerInDb(supabase, loserName, 'loss');
      }
    } catch (err) {
      console.warn('Could not update Supabase leaderboard:', err);
    }
  }

  // Always update local storage too so current device reflects immediately
  const local = getLocalLeaderboard();
  const updateLocal = (name: string, result: 'win' | 'loss' | 'draw') => {
    let player = local.find(p => p.username.toLowerCase() === name.toLowerCase());
    if (!player) {
      player = {
        id: 'user_' + Date.now() + Math.random().toString(36).substring(2, 6),
        username: name,
        score: 1200,
        wins: 0,
        losses: 0,
        draws: 0,
        totalGames: 0,
        winRate: 0,
        updatedAt: new Date().toISOString(),
      };
      local.push(player);
    }

    if (result === 'win') {
      player.wins += 1;
      player.score = calcNewRating(player.score, 25);
    } else if (result === 'loss') {
      player.losses += 1;
      player.score = calcNewRating(player.score, -20);
    } else {
      player.draws += 1;
      player.score = calcNewRating(player.score, 5);
    }

    player.totalGames = player.wins + player.losses + player.draws;
    player.winRate = Number(((player.wins / Math.max(1, player.totalGames)) * 100).toFixed(1));
    player.updatedAt = new Date().toISOString();
  };

  if (isDraw && winnerName && loserName) {
    updateLocal(winnerName, 'draw');
    updateLocal(loserName, 'draw');
  } else if (winnerName && loserName) {
    updateLocal(winnerName, 'win');
    updateLocal(loserName, 'loss');
  }

  saveLocalLeaderboard(local);
}

async function updateOrCreatePlayerInDb(
  supabase: SupabaseClient,
  username: string,
  result: 'win' | 'loss' | 'draw'
) {
  const { data: existing } = await supabase
    .from('leaderboard')
    .select('*')
    .ilike('username', username)
    .single();

  let score = existing?.score ?? 1200;
  let wins = existing?.wins ?? 0;
  let losses = existing?.losses ?? 0;
  let draws = existing?.draws ?? 0;

  if (result === 'win') {
    wins += 1;
    score = Math.max(100, score + 25);
  } else if (result === 'loss') {
    losses += 1;
    score = Math.max(100, score - 20);
  } else {
    draws += 1;
    score = Math.max(100, score + 5);
  }

  const totalGames = wins + losses + draws;
  const winRate = Number(((wins / Math.max(1, totalGames)) * 100).toFixed(1));

  await supabase.from('leaderboard').upsert(
    {
      username,
      score,
      wins,
      losses,
      draws,
      total_games: totalGames,
      win_rate: winRate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'username' }
  );
}

// Save room state to Supabase if connected
export async function syncRoomToSupabase(room: RoomState): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    await supabase.from('rooms').upsert({
      code: room.code,
      status: room.status,
      fen: room.fen,
      turn: room.turn,
      white_player: room.whitePlayer,
      black_player: room.blackPlayer,
      history: room.history,
      time_control: room.timeControl,
      white_time_ms: room.whiteTimeMs,
      black_time_ms: room.blackTimeMs,
      last_move_time: room.lastMoveTime,
      winner: room.winner,
      win_reason: room.winReason,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'code' });
  } catch (err) {
    console.warn('Failed to sync room to Supabase:', err);
  }
}

// Fetch room state from Supabase
export async function fetchRoomFromSupabase(code: string): Promise<RoomState | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) return null;

    return {
      code: data.code,
      createdAt: new Date(data.created_at || Date.now()).getTime(),
      updatedAt: new Date(data.updated_at || Date.now()).getTime(),
      status: data.status,
      fen: data.fen,
      history: data.history || [],
      whitePlayer: data.white_player || null,
      blackPlayer: data.black_player || null,
      hostId: data.white_player?.id || '',
      turn: data.turn || 'w',
      timeControl: data.time_control || { baseMinutes: 5, incrementSeconds: 3 },
      whiteTimeMs: data.white_time_ms ?? 300000,
      blackTimeMs: data.black_time_ms ?? 300000,
      lastMoveTime: data.last_move_time || null,
      winner: data.winner || null,
      winReason: data.win_reason || undefined,
    };
  } catch {
    return null;
  }
}
