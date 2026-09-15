import React, { useState } from 'react';
import { Database, Check, Copy, AlertCircle, X, ExternalLink, RefreshCw } from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  SUPABASE_SQL_SCHEMA,
} from '../lib/supabase';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
  onConnected,
}) => {
  const currentConfig = getStoredSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setTesting(true);

    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      setStatusMsg({
        type: 'error',
        text: 'Harap masukkan URL dan Anon Key dari Supabase Project Anda.',
      });
      setTesting(false);
      return;
    }

    try {
      const result = await testSupabaseConnection(cleanUrl, cleanKey);
      if (result.success) {
        saveSupabaseConfig({ url: cleanUrl, anonKey: cleanKey });
        setStatusMsg({ type: 'success', text: result.message });
        onConnected();
      } else {
        setStatusMsg({ type: 'error', text: result.message });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Gagal menguji koneksi ke Supabase.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Konfigurasi Database Supabase</h2>
              <p className="text-xs text-zinc-400">Hubungkan database Supabase untuk leaderboard & realtime rooms</p>
            </div>
          </div>

          <button
            id="btn-close-supabase-modal"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                  : 'bg-red-950/40 border-red-700/60 text-red-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Form Credentials */}
          <form onSubmit={handleTestAndSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Supabase Project URL
              </label>
              <input
                id="input-supabase-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzprojectid.supabase.co"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 font-mono"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Didapat dari Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project URL
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Supabase Anon / Public Key
              </label>
              <input
                id="input-supabase-key"
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 font-mono"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Didapat dari Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project API keys (anon / public)
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                id="btn-test-save-supabase"
                type="submit"
                disabled={testing}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menguji Koneksi...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Uji & Simpan Koneksi Supabase</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* SQL Schema Instructions */}
          <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                <span>SQL Schema untuk Supabase</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                  Siap Pakai
                </span>
              </span>
              <button
                id="btn-copy-sql-schema"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold rounded-lg transition"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin SQL Schema</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 mb-2">
              Jalankan SQL script berikut di Supabase Dashboard Anda (Menu <strong>SQL Editor</strong>) untuk membuat tabel <code>leaderboard</code> dan <code>rooms</code> dengan realtime replication:
            </p>

            <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[11px] text-zinc-300 font-mono overflow-x-auto max-h-48">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>

          {/* Supabase external link helper */}
          <div className="text-center pt-2">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition"
            >
              <span>Buka Supabase Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Modal Footer */}
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
