// Peer-to-peer multiplayer over WebRTC via PeerJS (loaded from CDN in index.html).
// Signalling uses the public PeerJS broker; once connected, all game traffic is direct
// peer-to-peer between the players' machines — there is no game server anywhere.
import type { PlanetId } from './data';

export type MPMode = 'coop' | 'arena';
export interface MPStartCfg { mode: MPMode; planet: PlanetId; level: number }
export interface MPPeer { id: string; name: string; color: number; isHost: boolean }
export interface MPGameCfg { session: MPSession; mode: MPMode; planet: PlanetId; level: number }

const PREFIX = 'ethics-of-war-sic-';
export const PEER_COLORS = [0x38bdf8, 0xff5a4a, 0x51ff62, 0xffd24a, 0xe060ff, 0xff8c42, 0x7fe3e8, 0xf2f2f2];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeCode = (n = 5) => Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyPeer = any; type AnyConn = any;

declare global { interface Window { Peer?: AnyPeer } }

export class MPSession {
  role: 'host' | 'guest';
  code = '';
  name: string;
  localId = '';
  color = PEER_COLORS[0];
  peer: AnyPeer = null;
  private conns = new Map<string, AnyConn>();
  private hostConn: AnyConn = null;
  peers: MPPeer[] = [];
  onPeers: ((peers: MPPeer[]) => void) | null = null;
  onStart: ((cfg: MPStartCfg) => void) | null = null;
  onStatus: ((s: string) => void) | null = null;
  onPacket: ((from: string, packet: any) => void) | null = null;
  onPeerLeft: ((id: string) => void) | null = null;
  private joinSeq = 0;
  destroyed = false;

  private constructor(role: 'host' | 'guest', name: string) { this.role = role; this.name = name; }
  static available() { return typeof window !== 'undefined' && typeof window.Peer === 'function'; }
  private status(s: string) { this.onStatus?.(s); }
  private emitPeers() { this.onPeers?.([...this.peers]); }

  static async host(name: string): Promise<MPSession> {
    if (!MPSession.available()) throw new Error('PeerJS failed to load (needs an internet connection for the first handshake).');
    const s = new MPSession('host', name);
    for (let attempt = 0; attempt < 6; attempt++) {
      s.code = makeCode();
      try { await s.openPeer(PREFIX + s.code.toLowerCase()); break; }
      catch (e) { if (attempt === 5) throw e; }
    }
    s.localId = s.peer.id; s.color = PEER_COLORS[0];
    s.peers = [{ id: s.localId, name, color: s.color, isHost: true }];
    s.peer.on('connection', (c: AnyConn) => s.accept(c));
    s.status('Hosting — share your room code.');
    return s;
  }

  static async join(name: string, code: string): Promise<MPSession> {
    if (!MPSession.available()) throw new Error('PeerJS failed to load (needs an internet connection for the first handshake).');
    const s = new MPSession('guest', name);
    s.code = code.trim().toUpperCase();
    await s.openPeer(undefined);
    s.localId = s.peer.id;
    const conn = s.peer.connect(PREFIX + s.code.toLowerCase(), { reliable: true });
    s.hostConn = conn;
    await new Promise<void>((res, rej) => {
      const to = window.setTimeout(() => rej(new Error('Could not reach that room. Check the code and that the host is waiting in the lobby.')), 14000);
      conn.on('open', () => { window.clearTimeout(to); res(); });
      conn.on('error', (e: unknown) => { window.clearTimeout(to); rej(e instanceof Error ? e : new Error('Connection failed')); });
    });
    s.wire(conn, true);
    conn.send({ t: '__hello', name });
    s.status('Connected — waiting for the host to start…');
    return s;
  }

  private openPeer(id?: string): Promise<void> {
    return new Promise((res, rej) => {
      const P = window.Peer as AnyPeer;
      this.peer = id ? new P(id) : new P();
      const to = window.setTimeout(() => rej(new Error('Signalling timed out.')), 14000);
      this.peer.on('open', () => { window.clearTimeout(to); res(); });
      this.peer.on('error', (e: { type?: string }) => { window.clearTimeout(to); rej(new Error(e?.type === 'unavailable-id' ? 'code taken' : `PeerJS: ${e?.type || 'error'}`)); });
    });
  }

  private accept(c: AnyConn) {
    c.on('open', () => this.wire(c, false));
  }
  private wire(c: AnyConn, isHostConn: boolean) {
    if (!isHostConn) this.conns.set(c.peer, c);
    c.on('data', (raw: unknown) => {
      const p = raw as { t?: string };
      if (!p || typeof p !== 'object') return;
      if (p.t === '__hello' && this.role === 'host') {
        const idx = ++this.joinSeq; const color = PEER_COLORS[idx % PEER_COLORS.length];
        const name = (p as { name?: string }).name || `Player ${idx + 1}`;
        this.peers = [...this.peers.filter(q => q.id !== c.peer), { id: c.peer, name, color, isHost: false }];
        c.send({ t: '__welcome', id: c.peer, color, peers: this.peers });
        this.broadcast({ t: '__peers', peers: this.peers }, c.peer);
        this.emitPeers(); this.status(`${name} joined.`);
        return;
      }
      if (p.t === '__welcome') { const w = p as { color: number; peers: MPPeer[] }; this.color = w.color; this.peers = w.peers; this.emitPeers(); return; }
      if (p.t === '__peers') { this.peers = (p as { peers: MPPeer[] }).peers; this.emitPeers(); return; }
      if (p.t === '__start') { this.onStart?.((p as { cfg: MPStartCfg }).cfg); return; }
      if (p.t === '__to' && this.role === 'host') { const w = p as { target: string; packet: unknown }; this.sendTo(w.target, w.packet); return; }
      this.onPacket?.(isHostConn ? 'host' : c.peer, p);
    });
    c.on('close', () => this.drop(isHostConn ? 'host' : c.peer));
    c.on('error', () => this.drop(isHostConn ? 'host' : c.peer));
  }
  private drop(id: string) {
    if (this.destroyed) return;
    this.conns.delete(id);
    this.peers = this.peers.filter(q => q.id !== id);
    if (this.role === 'host') this.broadcast({ t: '__peers', peers: this.peers });
    this.emitPeers(); this.onPeerLeft?.(id);
  }

  startGame(cfg: MPStartCfg) { if (this.role === 'host') this.broadcast({ t: '__start', cfg }); }
  /** guest → host, or host → everyone */
  send(packet: unknown) {
    if (this.role === 'host') this.broadcast(packet);
    else if (this.hostConn?.open) this.hostConn.send(packet);
  }
  broadcast(packet: unknown, exceptId?: string) { this.conns.forEach((c, id) => { if (id !== exceptId && c.open) c.send(packet); }); }
  sendTo(id: string, packet: unknown) {
    if (id === this.localId) { this.onPacket?.(this.localId, packet); return; }
    if (this.role === 'host') { const c = this.conns.get(id); if (c?.open) c.send(packet); }
    else if (this.hostConn?.open) this.hostConn.send({ t: '__to', target: id, packet });
  }
  /** host-side helper: deliver a guest packet onwards */
  relay(from: string, packet: unknown, except = true) { if (this.role === 'host') this.broadcast(packet, except ? from : undefined); }

  destroy() {
    this.destroyed = true;
    try { this.conns.forEach(c => c.close()); this.hostConn?.close(); this.peer?.destroy(); } catch { /* ignore */ }
    this.conns.clear();
  }
}
