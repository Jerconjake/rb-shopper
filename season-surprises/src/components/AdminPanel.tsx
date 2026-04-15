import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Minus, Play, Pause, Trash2, RefreshCw } from 'lucide-react';
import { Campaign, StoreSummary, PRIZE_DISTRIBUTION, INITIAL_STORES } from '../types';

interface Props {
  onBack: () => void;
  onCampaignChange: () => void;
}

type AdminView = 'pin' | 'dashboard' | 'new_campaign';

export const AdminPanel: React.FC<Props> = ({ onBack, onCampaignChange }) => {
  const [view, setView] = useState<AdminView>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summaries, setSummaries] = useState<StoreSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // New campaign form
  const [newName, setNewName] = useState('Season of Surprises');
  const [newMinPurchase, setNewMinPurchase] = useState('300');
  const [creating, setCreating] = useState(false);

  const handlePinSubmit = async () => {
    const rows = await window.tasklet.sqlQuery(`SELECT value FROM config WHERE key = 'admin_pin'`);
    const storedPin = rows.length > 0 ? (rows[0] as any).value : '5678';
    if (pin === storedPin) {
      setPinError('');
      setView('dashboard');
      loadData();
    } else {
      setPinError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  async function loadData() {
    setLoading(true);
    try {
      const rows = await window.tasklet.sqlQuery(
        `SELECT id, name, active, min_purchase FROM campaigns ORDER BY id DESC`
      );
      const camps: Campaign[] = rows.map((r: any) => ({
        id: r.id, name: r.name, active: !!r.active, min_purchase: r.min_purchase
      }));
      setCampaigns(camps);

      // Load summaries for active campaign
      const active = camps.find(c => c.active);
      if (active) {
        setSelectedCampaignId(active.id);
        await loadSummaries(active.id);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    }
    setLoading(false);
  }

  async function loadSummaries(campaignId: number) {
    const rows = await window.tasklet.sqlQuery(
      `SELECT s.id as store_id, s.name as store_name,
         COUNT(e.id) as total,
         SUM(CASE WHEN e.used = 0 THEN 1 ELSE 0 END) as remaining
       FROM stores s
       LEFT JOIN envelopes e ON e.store_id = s.id AND e.campaign_id = ${campaignId}
       GROUP BY s.id, s.name ORDER BY s.name`
    );
    setSummaries(rows.map((r: any) => ({
      store_id: r.store_id, store_name: r.store_name,
      remaining: r.remaining ?? 0, total: r.total ?? 0,
    })));
  }

  async function toggleActive(camp: Campaign) {
    if (camp.active) {
      await window.tasklet.sqlExec(`UPDATE campaigns SET active = 0 WHERE id = ${camp.id}`);
    } else {
      await window.tasklet.sqlExec(`UPDATE campaigns SET active = 0 WHERE 1=1`);
      await window.tasklet.sqlExec(`UPDATE campaigns SET active = 1 WHERE id = ${camp.id}`);
    }
    onCampaignChange();
    loadData();
  }

  async function deleteCampaign(id: number) {
    await window.tasklet.sqlExec(`DELETE FROM envelopes WHERE campaign_id = ${id}`);
    await window.tasklet.sqlExec(`DELETE FROM campaigns WHERE id = ${id}`);
    onCampaignChange();
    loadData();
  }

  async function removeEnvelopes(storeId: number, campaignId: number) {
    // Delete up to 50 unused envelopes, respecting prize distribution ratios
    const unused = await window.tasklet.sqlQuery(
      `SELECT id FROM envelopes WHERE campaign_id = ${campaignId} AND store_id = ${storeId} AND used = 0 ORDER BY id DESC LIMIT 50`
    );
    if (unused.length === 0) return;
    const ids = (unused as any[]).map((r: any) => r.id).join(',');
    await window.tasklet.sqlExec(`DELETE FROM envelopes WHERE id IN (${ids})`);
    if (selectedCampaignId) loadSummaries(selectedCampaignId);
  }

  async function addEnvelopes(storeId: number, campaignId: number) {
    const rows: string[] = [];
    for (const { type, count } of PRIZE_DISTRIBUTION) {
      for (let i = 0; i < count; i++) {
        rows.push(`(${campaignId}, ${storeId}, '${type}')`);
      }
    }
    await window.tasklet.sqlExec(
      `INSERT INTO envelopes (campaign_id, store_id, prize_type) VALUES ${rows.join(', ')}`
    );
    if (selectedCampaignId) loadSummaries(selectedCampaignId);
  }

  async function createCampaign() {
    if (!newName.trim()) return;
    const minPurchase = parseFloat(newMinPurchase) || 300;
    setCreating(true);
    try {
      await window.tasklet.sqlExec(
        `INSERT INTO campaigns (name, active, min_purchase) VALUES ('${newName.replace(/'/g, "''")}', 0, ${minPurchase})`
      );
      const result = await window.tasklet.sqlQuery('SELECT id FROM campaigns ORDER BY id DESC LIMIT 1');
      const campaignId = (result[0] as any).id;

      const stores = await window.tasklet.sqlQuery('SELECT id FROM stores ORDER BY id');
      const rows: string[] = [];
      for (const store of stores as any[]) {
        for (const { type, count } of PRIZE_DISTRIBUTION) {
          for (let i = 0; i < count; i++) {
            rows.push(`(${campaignId}, ${store.id}, '${type}')`);
          }
        }
      }
      const chunkSize = 50;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await window.tasklet.sqlExec(
          `INSERT INTO envelopes (campaign_id, store_id, prize_type) VALUES ${rows.slice(i, i + chunkSize).join(', ')}`
        );
      }
      setView('dashboard');
      loadData();
    } catch (err) {
      console.error('Failed to create campaign', err);
    }
    setCreating(false);
  }

  // PIN screen
  if (view === 'pin') {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-8 gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-base-content mb-1">Admin Access</h2>
          <p className="text-base-content/50 text-sm">Enter your PIN to continue</p>
        </div>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <input
            type="password"
            className="input input-bordered text-center text-2xl tracking-widest w-full"
            placeholder="••••"
            value={pin}
            onChange={e => { setPin(e.target.value); setPinError(''); }}
            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
            maxLength={6}
            autoFocus
          />
          {pinError && <div className="alert alert-error py-2 text-sm">{pinError}</div>}
          <button onClick={handlePinSubmit} className="btn btn-primary">Unlock</button>
          <button onClick={onBack} className="btn btn-ghost btn-sm">← Back</button>
        </div>
        <p className="text-base-content/20 text-xs">Default PIN: 5678</p>
      </div>
    );
  }

  // New campaign form
  if (view === 'new_campaign') {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col">
        <div className="bg-base-200 border-b border-base-300 px-4 py-4 flex items-center gap-3">
          <button onClick={() => setView('dashboard')} className="btn btn-ghost btn-sm btn-square">
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-bold text-base-content">New Campaign</h2>
        </div>
        <div className="p-6 flex flex-col gap-5 max-w-md">
          <div>
            <label className="label"><span className="label-text">Campaign Name</span></label>
            <input
              className="input input-bordered w-full"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Season of Surprises"
            />
          </div>
          <div>
            <label className="label"><span className="label-text">Minimum Purchase ($)</span></label>
            <input
              className="input input-bordered w-full"
              type="number"
              value={newMinPurchase}
              onChange={e => setNewMinPurchase(e.target.value)}
              min="0" step="50"
            />
          </div>
          <div className="card bg-base-200 border border-base-300">
            <div className="card-body py-4">
              <h4 className="font-semibold text-sm text-base-content mb-2">Envelope Distribution (per store)</h4>
              <div className="space-y-1 text-sm text-base-content/70">
                <div className="flex justify-between"><span>50% Off</span><span className="font-bold">1</span></div>
                <div className="flex justify-between"><span>20% Off</span><span className="font-bold">5</span></div>
                <div className="flex justify-between"><span>10% Off</span><span className="font-bold">30</span></div>
                <div className="flex justify-between"><span>Free Gift</span><span className="font-bold">14</span></div>
                <div className="divider my-1" />
                <div className="flex justify-between font-bold text-base-content"><span>Total per store</span><span>50</span></div>
                <div className="flex justify-between text-base-content/50"><span>4 stores × 50</span><span>200 envelopes</span></div>
              </div>
            </div>
          </div>
          <button
            onClick={createCampaign}
            disabled={creating || !newName.trim()}
            className="btn btn-primary"
          >
            {creating ? <span className="loading loading-spinner loading-sm" /> : <Plus size={18} />}
            Create Campaign
          </button>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <div className="bg-base-200 border-b border-base-300 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn btn-ghost btn-sm btn-square">
            <ArrowLeft size={18} />
          </button>
          <h2 className="font-bold text-base-content">Admin</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn btn-ghost btn-sm btn-square">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setView('new_campaign')} className="btn btn-primary btn-sm">
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></div>
      ) : (
        <div className="p-4 flex flex-col gap-4">
          {/* Campaigns */}
          <div>
            <h3 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">Campaigns</h3>
            {campaigns.length === 0 ? (
              <div className="text-center py-8 text-base-content/40">No campaigns yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {campaigns.map(camp => (
                  <div key={camp.id} className="card bg-base-200 border border-base-300">
                    <div className="card-body py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base-content">{camp.name}</span>
                            {camp.active && <span className="badge badge-success badge-xs">Active</span>}
                          </div>
                          <span className="text-xs text-base-content/50">Min ${camp.min_purchase.toFixed(0)}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleActive(camp)}
                            className={`btn btn-xs ${camp.active ? 'btn-warning' : 'btn-success'}`}
                            title={camp.active ? 'Pause' : 'Activate'}
                          >
                            {camp.active ? <Pause size={12} /> : <Play size={12} />}
                          </button>
                          <button
                            onClick={() => deleteCampaign(camp.id)}
                            className="btn btn-xs btn-error btn-outline"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Envelope status for active campaign */}
          {summaries.length > 0 && selectedCampaignId && (
            <div>
              <h3 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
                Envelopes — Active Campaign
              </h3>
              <div className="flex flex-col gap-2">
                {summaries.map(s => (
                  <div key={s.store_id} className="card bg-base-200 border border-base-300">
                    <div className="card-body py-3 px-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-base-content text-sm">{s.store_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-base-content/50">{s.remaining}/{s.total}</span>
                          <button
                            onClick={() => removeEnvelopes(s.store_id, selectedCampaignId!)}
                            className="btn btn-xs btn-outline btn-error"
                            title="Remove 50 unused envelopes"
                            disabled={s.remaining === 0}
                          >
                            <Minus size={12} /> −50
                          </button>
                          <button
                            onClick={() => addEnvelopes(s.store_id, selectedCampaignId!)}
                            className="btn btn-xs btn-outline"
                            title="Add 50 more envelopes"
                          >
                            <Plus size={12} /> +50
                          </button>
                        </div>
                      </div>
                      <progress
                        className="progress progress-primary w-full h-1.5"
                        value={s.remaining}
                        max={s.total}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
