import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Play, Pause, Trash2, RefreshCw } from 'lucide-react';
import { Campaign, StoreSummary } from '../types';
import {
  checkAdminPin,
  getAllCampaigns,
  getStoreSummaries,
  toggleCampaignActive,
  deleteCampaignById,
  addEnvelopesToStore,
  createCampaignWithEnvelopes,
} from '../db';

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

  const handlePinSubmit = () => {
    if (checkAdminPin(pin)) {
      setPinError('');
      setView('dashboard');
      loadData();
    } else {
      setPinError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  function loadData() {
    setLoading(true);
    try {
      const camps: Campaign[] = getAllCampaigns().map(r => ({
        id: r.id, name: r.name, active: r.active, min_purchase: r.min_purchase
      }));
      setCampaigns(camps);

      // Load summaries for active campaign
      const active = camps.find(c => c.active);
      if (active) {
        setSelectedCampaignId(active.id);
        loadSummaries(active.id);
      } else {
        setSummaries([]);
        setSelectedCampaignId(null);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    }
    setLoading(false);
  }

  function loadSummaries(campaignId: number) {
    const rows = getStoreSummaries(campaignId);
    setSummaries(rows.map(r => ({
      store_id: r.store_id, store_name: r.store_name,
      remaining: r.remaining ?? 0, total: r.total ?? 0,
    })));
  }

  function toggleActive(camp: Campaign) {
    toggleCampaignActive(camp.id, camp.active);
    onCampaignChange();
    loadData();
  }

  function deleteCampaign(id: number) {
    deleteCampaignById(id);
    onCampaignChange();
    loadData();
  }

  function addEnvelopes(storeId: number, campaignId: number) {
    addEnvelopesToStore(campaignId, storeId);
    if (selectedCampaignId) loadSummaries(selectedCampaignId);
  }

  function createCampaign() {
    if (!newName.trim()) return;
    const minPurchase = parseFloat(newMinPurchase) || 300;
    setCreating(true);
    try {
      createCampaignWithEnvelopes(newName.trim(), minPurchase);
      setView('dashboard');
      loadData();
    } catch (err) {
      console.error('Failed to create campaign', err);
    }
    setCreating(false);
  }

  // Shared styles
  const screenStyle: React.CSSProperties = {
    minHeight: '100vh', background: '#0e0d0c', color: '#f5eee4', display: 'flex', flexDirection: 'column',
  };
  const headerStyle: React.CSSProperties = {
    background: '#141210', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.25rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };
  const cardStyle: React.CSSProperties = {
    background: '#1c1917', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '0.75rem 1rem',
  };
  const inputStyle: React.CSSProperties = {
    background: '#1c1917', border: '1px solid rgba(255,255,255,0.12)', color: '#f5eee4',
    padding: '0.6rem 0.75rem', fontSize: '1rem', width: '100%', outline: 'none', borderRadius: 2,
  };
  const btnPrimary: React.CSSProperties = {
    background: '#c9835a', border: 'none', color: '#fff', fontWeight: 700,
    padding: '0.65rem 1.25rem', cursor: 'pointer', fontSize: '0.9rem', borderRadius: 2,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };
  const btnGhost: React.CSSProperties = {
    background: 'transparent', border: 'none', color: 'rgba(245,238,228,0.5)',
    padding: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
  };
  const btnSmSuccess: React.CSSProperties = {
    background: '#22c55e', border: 'none', color: '#fff',
    padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', borderRadius: 2,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };
  const btnSmWarning: React.CSSProperties = {
    background: '#f59e0b', border: 'none', color: '#fff',
    padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', borderRadius: 2,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };
  const btnSmDanger: React.CSSProperties = {
    background: 'transparent', border: '1px solid #ef4444', color: '#ef4444',
    padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', borderRadius: 2,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };

  // PIN screen
  if (view === 'pin') {
    return (
      <div style={{ ...screenStyle, alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Admin Access</h2>
          <p style={{ color: 'rgba(245,238,228,0.5)', fontSize: '0.875rem' }}>Enter your PIN to continue</p>
        </div>
        <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="password"
            style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.3em' }}
            placeholder="••••"
            value={pin}
            onChange={e => { setPin(e.target.value); setPinError(''); }}
            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
            maxLength={6}
            autoFocus
          />
          {pinError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: 2 }}>
              {pinError}
            </div>
          )}
          <button onClick={handlePinSubmit} style={{ ...btnPrimary, justifyContent: 'center', padding: '0.75rem' }}>Unlock</button>
          <button onClick={onBack} style={{ ...btnGhost, justifyContent: 'center', color: 'rgba(245,238,228,0.4)', fontSize: '0.875rem' }}>← Back</button>
        </div>
        <p style={{ color: 'rgba(245,238,228,0.2)', fontSize: '0.75rem' }}>Default PIN: 5678</p>
      </div>
    );
  }

  // New campaign form
  if (view === 'new_campaign') {
    return (
      <div style={screenStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setView('dashboard')} style={btnGhost}>
              <ArrowLeft size={18} />
            </button>
            <h2 style={{ fontWeight: 700 }}>New Campaign</h2>
          </div>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 480 }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'rgba(245,238,228,0.5)', display: 'block', marginBottom: '6px' }}>Campaign Name</label>
            <input
              style={inputStyle}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Season of Surprises"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'rgba(245,238,228,0.5)', display: 'block', marginBottom: '6px' }}>Minimum Purchase ($)</label>
            <input
              style={inputStyle}
              type="number"
              value={newMinPurchase}
              onChange={e => setNewMinPurchase(e.target.value)}
              min="0" step="50"
            />
          </div>
          <div style={{ ...cardStyle, fontSize: '0.875rem' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: 'rgba(245,238,228,0.7)' }}>Envelope Distribution (per store)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'rgba(245,238,228,0.6)' }}>
              {[['50% Off', '1'], ['20% Off', '5'], ['10% Off', '30'], ['Free Gift', '14']].map(([label, count]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{label}</span><span style={{ fontWeight: 700 }}>{count}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#f5eee4' }}>
                <span>Total per store</span><span>50</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(245,238,228,0.4)', fontSize: '0.8rem' }}>
                <span>4 stores × 50</span><span>200 envelopes</span>
              </div>
            </div>
          </div>
          <button
            onClick={createCampaign}
            disabled={creating || !newName.trim()}
            style={{ ...btnPrimary, justifyContent: 'center', padding: '0.75rem', opacity: (creating || !newName.trim()) ? 0.4 : 1 }}
          >
            {creating ? <span className="loading" style={{ width: 16, height: 16 }} /> : <Plus size={18} />}
            Create Campaign
          </button>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div style={screenStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={onBack} style={btnGhost}>
            <ArrowLeft size={18} />
          </button>
          <h2 style={{ fontWeight: 700 }}>Admin</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={loadData} style={btnGhost}>
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setView('new_campaign')} style={btnPrimary}>
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
          <span className="loading" />
        </div>
      ) : (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Campaigns */}
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(245,238,228,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
              Campaigns
            </h3>
            {campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(245,238,228,0.3)' }}>No campaigns yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {campaigns.map(camp => (
                  <div key={camp.id} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600 }}>{camp.name}</span>
                          {camp.active && (
                            <span style={{ background: '#22c55e', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 2 }}>
                              Active
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(245,238,228,0.4)' }}>Min ${camp.min_purchase.toFixed(0)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => toggleActive(camp)}
                          style={camp.active ? btnSmWarning : btnSmSuccess}
                          title={camp.active ? 'Pause' : 'Activate'}
                        >
                          {camp.active ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button
                          onClick={() => deleteCampaign(camp.id)}
                          style={btnSmDanger}
                        >
                          <Trash2 size={12} />
                        </button>
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
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(245,238,228,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Envelopes — Active Campaign
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summaries.map(s => (
                  <div key={s.store_id} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{s.store_name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(245,238,228,0.4)' }}>{s.remaining}/{s.total}</span>
                        <button
                          onClick={() => addEnvelopes(s.store_id, selectedCampaignId!)}
                          style={{ ...btnSmDanger, borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(245,238,228,0.6)' }}
                          title="Add 50 more envelopes"
                        >
                          <Plus size={12} /> +50
                        </button>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{
                        height: '4px', borderRadius: 2,
                        background: '#c9835a',
                        width: `${s.total > 0 ? (s.remaining / s.total) * 100 : 0}%`,
                        transition: 'width 0.4s ease',
                      }} />
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
