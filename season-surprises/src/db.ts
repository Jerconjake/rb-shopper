import { PrizeType, PRIZE_DISTRIBUTION, INITIAL_STORES } from './types';

// ─── Data types ───────────────────────────────────────────────

export interface StoreRecord { id: number; name: string; }
export interface CampaignRecord { id: number; name: string; active: boolean; min_purchase: number; }
export interface EnvelopeRecord {
  id: number; campaign_id: number; store_id: number;
  prize_type: PrizeType; used: boolean; used_at: string | null;
}

interface DBState {
  stores: StoreRecord[];
  campaigns: CampaignRecord[];
  envelopes: EnvelopeRecord[];
  adminPin: string;
  nextId: number;
}

// ─── Storage helpers ──────────────────────────────────────────

const STORAGE_KEY = 'sos_db_v2';

function loadDB(): DBState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { stores: [], campaigns: [], envelopes: [], adminPin: '5678', nextId: 1 };
}

function saveDB(db: DBState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function nextId(db: DBState): number {
  const id = db.nextId;
  db.nextId++;
  return id;
}

// ─── Public API ───────────────────────────────────────────────

export function initDB(): void {
  const db = loadDB();
  if (db.stores.length === 0) {
    // Seed stores
    for (const name of INITIAL_STORES) {
      db.stores.push({ id: nextId(db), name });
    }
    saveDB(db);
  }
  if (db.campaigns.length === 0) {
    // Seed default campaign
    const campId = nextId(db);
    db.campaigns.push({ id: campId, name: 'Season of Surprises', active: true, min_purchase: 300 });
    for (const store of db.stores) {
      for (const { type, count } of PRIZE_DISTRIBUTION) {
        for (let i = 0; i < count; i++) {
          db.envelopes.push({ id: nextId(db), campaign_id: campId, store_id: store.id, prize_type: type, used: false, used_at: null });
        }
      }
    }
    saveDB(db);
  }
}

export function getActiveCampaign(): CampaignRecord | null {
  const db = loadDB();
  return db.campaigns.find(c => c.active) ?? null;
}

export function getAllCampaigns(): CampaignRecord[] {
  const db = loadDB();
  return [...db.campaigns].reverse();
}

export interface StoreSummaryData {
  store_id: number; store_name: string; remaining: number; total: number;
}

export function getStoreSummaries(campaignId: number): StoreSummaryData[] {
  const db = loadDB();
  return db.stores.map(store => {
    const envelopes = db.envelopes.filter(e => e.campaign_id === campaignId && e.store_id === store.id);
    return {
      store_id: store.id,
      store_name: store.name,
      remaining: envelopes.filter(e => !e.used).length,
      total: envelopes.length,
    };
  }).sort((a, b) => a.store_name.localeCompare(b.store_name));
}

export function drawEnvelope(campaignId: number, storeId: number): { id: number; prize_type: PrizeType } | null {
  const db = loadDB();
  const available = db.envelopes.filter(
    e => e.campaign_id === campaignId && e.store_id === storeId && !e.used
  );
  if (available.length === 0) return null;
  const pick = available[Math.floor(Math.random() * available.length)];
  pick.used = true;
  pick.used_at = new Date().toISOString();
  saveDB(db);
  return { id: pick.id, prize_type: pick.prize_type };
}

export function toggleCampaignActive(campaignId: number, currentlyActive: boolean): void {
  const db = loadDB();
  if (currentlyActive) {
    const camp = db.campaigns.find(c => c.id === campaignId);
    if (camp) camp.active = false;
  } else {
    db.campaigns.forEach(c => { c.active = false; });
    const camp = db.campaigns.find(c => c.id === campaignId);
    if (camp) camp.active = true;
  }
  saveDB(db);
}

export function deleteCampaignById(campaignId: number): void {
  const db = loadDB();
  db.envelopes = db.envelopes.filter(e => e.campaign_id !== campaignId);
  db.campaigns = db.campaigns.filter(c => c.id !== campaignId);
  saveDB(db);
}

export function addEnvelopesToStore(campaignId: number, storeId: number): void {
  const db = loadDB();
  for (const { type, count } of PRIZE_DISTRIBUTION) {
    for (let i = 0; i < count; i++) {
      db.envelopes.push({ id: nextId(db), campaign_id: campaignId, store_id: storeId, prize_type: type, used: false, used_at: null });
    }
  }
  saveDB(db);
}

export function createCampaignWithEnvelopes(name: string, minPurchase: number): void {
  const db = loadDB();
  const campId = nextId(db);
  db.campaigns.push({ id: campId, name, active: false, min_purchase: minPurchase });
  for (const store of db.stores) {
    for (const { type, count } of PRIZE_DISTRIBUTION) {
      for (let i = 0; i < count; i++) {
        db.envelopes.push({ id: nextId(db), campaign_id: campId, store_id: store.id, prize_type: type, used: false, used_at: null });
      }
    }
  }
  saveDB(db);
}

export function checkAdminPin(pin: string): boolean {
  const db = loadDB();
  return pin === db.adminPin;
}
