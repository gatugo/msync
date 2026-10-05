'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Cloud, CloudOff, LogIn, LogOut, RefreshCw, Check, AlertTriangle, Loader2, Server } from 'lucide-react';

/**
 * Cloud Sync panel — connects this device to a PocketBase sync server.
 * All data still lives in localStorage; sync reconciles it with the server
 * (push/pull, last-write-wins per record).
 */
export default function SyncPanel() {
  const {
    syncUser,
    syncStatus,
    syncError,
    lastSyncAt,
    pbUrl,
    signIn,
    syncNow,
    signOut,
    setPbUrl,
  } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [urlDraft, setUrlDraft] = useState(pbUrl);
  const [busy, setBusy] = useState(false);

  const signedIn = !!syncUser;

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      setPassword('');
    } catch {
      // error surfaced via syncError
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    setBusy(true);
    try {
      await syncNow();
    } catch {
      // error surfaced via syncError
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 relative shrink-0 p-4 rounded-2xl bg-white/5 border border-white/5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${signedIn ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
          {signedIn ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
        </div>
        <div className="text-left">
          <div className="text-white text-sm font-bold">Cloud Sync</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest">
            {signedIn ? `Signed in · ${syncUser?.email}` : 'Not connected'}
          </div>
        </div>
      </div>

      {/* Server URL */}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1">
          <Server className="w-3 h-3" /> PocketBase URL
        </label>
        <div className="flex gap-2">
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="http://localhost:8090"
            className="flex-1 bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500/50"
          />
          <button
            onClick={() => setPbUrl(urlDraft)}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-slate-300 transition-all"
          >
            Save
          </button>
        </div>
        <p className="text-[9px] text-slate-600 leading-tight">
          Defaults to this app&apos;s own origin (/pb proxy) — no setup needed, works from
          phones on your LAN/Tailscale. Direct addresses (http://host:8090) are advanced-only.
        </p>
      </div>

      {signedIn ? (
        <>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>
              Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'never'}
            </span>
            {syncStatus === 'syncing' && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
            {syncStatus === 'idle' && lastSyncAt && <Check className="w-3.5 h-3.5 text-emerald-400" />}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSyncNow}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-200 text-xs font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
              Sync now
            </button>
            <button
              onClick={() => signOut()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500/50"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
            placeholder="Password"
            className="bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500/50"
          />
          <button
            onClick={handleSignIn}
            disabled={busy || !email.trim() || !password}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
            Sign in &amp; sync
          </button>
        </>
      )}

      {syncError && (
        <div className="flex items-start gap-2 text-[10px] text-rose-300 leading-tight">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{syncError}</span>
        </div>
      )}

      <p className="text-[9px] text-slate-600 leading-tight">
        Edits are saved locally first; sync merges changes across your devices (last write wins per record).
        The AI API key stays on this device.
      </p>
    </div>
  );
}
