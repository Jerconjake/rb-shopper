import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Minus, Play, Pause, Trash2, RefreshCw } from 'lucide-react';
import {
  getAllCampaigns, getStoreSummaries, toggleCampaignActive,
  deleteCampaignById, addEnvelopesToStore, createCampaignWithEnvelopes,
  checkAdminPin, StoreSummaryData, CampaignRecord,
} from '../db';
import { removeEnvelopesFromStore } from '../db';

interface Props {
  onBack: () => void;
  onCampaignChange: () => void;
}

type AdminView = 'pin' | 'dashboard' | 'new_campaign';

export const AdminPanel: React.FC<Props> = ({ onBack, onCampaignChange }) => {
  const [view, setView] = useState<AdminView>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [summaries, setSummaries] = useState<StoreSummaryData[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  // New campaign form
  const [newName, setNewName] = useState('Season of Surprises');
  const [newMinPurchase, setNewMinPurchase] = useState('300');

  function handlePinSubmit() {
    if (checkAdminPin(pin)) {
      setPinError('');
      setView('dashboard');
      loadData();
    } else {
      setPinError('Incorrect PIN. Try again.');
      setPin('');
    }
  }

  function loadData() {
    const camps = getAllCampaigns();
    setCampaigns(camps);
    const active = camps.find(c => c.active);
    if (active) {
      setSelectedCampaignId(active.id);
      setSummaries(getStoreSummaries(active.id));
    } else {
      setSummaries([]);
    }
  }

  function handleToggleActive(camp: CampaignRecord) {
    toggleCampaignActive(camp.id, camp.active);
    onCampaignChange();
    loadData();
  }

  function handleDelete(id: number) {
    if (!confirm('Delete this campaign and all its envelopes?')) return;
    deleteCampaignById(id);
    onCampaignChange();
    loadData();
  }

  function handleAddEnvelopes(storeId: number) {
    if (!selectedCampaignId) return;
    addEnvelopesToStore(selectedCampaignId, storeId);
    setSummaries(getStoreSummaries(selectedCampaignId));
  }

  function handleRemoveEnvelopes(storeId: number) {
    if (!selectedCampaignId) return;
    removeEnvelopesFromStore(selectedCampaignId, storeId);
    setSummaries(getStoreSummaries(selectedCampaignId));
  }

  function handleCreateCampaign() {
    if (!newName.trim()) return;
    const min = parseFloat(newMinPurchase) || 300;
    createCampaignWithEnvelopes(newName.trim(), min);
    onCampaignChange();
    setView('dashboard');
    loadData();
  }

  function handleSelectCampaign(id: number) {
    setSelectedCampaignId(id);
    setSummaries(getStoreSummaries(id));
  }

  // ── PIN screen ────────────────────────────────────────────────
  if (view === 'pin') {
    return (
      <div className="rb-screen-bg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(0,0,0,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '2rem', padding: 0 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.25rem' }}>Admin Access</h2>
          <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Enter your PIN to continue</p>
          <input
            type="password"
            inputMode="numeric"
            placeholder="PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
            style={{ width: '100%', border: '1px solid #e8e3dc', borderRadius: 0, padding: '0.75rem 1rem', fontSize: '1.1rem', letterSpacing: '0.3em', marginBottom: '0.75rem', outline: 'none', background: '#fff', color: '#1a1a1a', boxSizing: 'border-box' }}
          />
          {pinError && <p style={{ color: '#b91c1c', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{pinError}</p>}
          <button
            onClick={handlePinSubmit}
            style={{ width: '100%', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 0, padding: '0.75rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // ── New campaign form ─────────────────────────────────────────
  if (view === 'new_campaign') {
    return (
      <div className="rb-screen-bg" style={{ minHeight: '100vh', padding: '1.5rem' }}>
        <button onClick={() => setView('dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(0,0,0,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '2rem', padding: 0 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '1.5rem' }}>New Campaign</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 400 }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(0,0,0,0.4)', display: 'block', marginBottom: 6 }}>Campaign Name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ width: '100%', border: '1px solid #e8e3dc', borderRadius: 0, padding: '0.65rem 0.85rem', fontSize: '0.9rem', outline: 'none', background: '#fff', color: '#1a1a1a', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(0,0,0,0.4)', display: 'block', marginBottom: 6 }}>Min. Purchase ($)</label>
            <input
              type="number"
              value={newMinPurchase}
              onChange={e => setNewMinPurchase(e.target.value)}
              style={{ width: '100%', border: '1px solid #e8e3dc', borderRadius: 0, padding: '0.65rem 0.85rem', fontSize: '0.9rem', outline: 'none', background: '#fff', color: '#1a1a1a', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={handleCreateCampaign}
            style={{ background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 0, padding: '0.75rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '0.5rem' }}
          >
            Create Campaign
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────
  return (
    <div className="rb-screen-bg" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="rb-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(0,0,0,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1a1a1a' }}>Admin</span>
        <button
          onClick={() => setView('new_campaign')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 0, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em' }}
        >
          <Plus size={13} /> New
        </button>
      </div>

      <div style={{ padding: '1.25rem 1.5rem' }}>
        {/* Campaigns */}
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', marginBottom: '0.75rem' }}>Campaigns</p>
        {campaigns.length === 0 ? (
          <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '0.875rem' }}>No campaigns yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
            {campaigns.map(camp => (
              <div
                key={camp.id}
                onClick={() => handleSelectCampaign(camp.id)}
                style={{
                  background: '#fff',
                  border: `1px solid ${selectedCampaignId === camp.id ? '#1a1a1a' : '#e8e3dc'}`,
                  padding: '0.85rem 1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{camp.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>Min ${camp.min_purchase}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                    padding: '2px 7px', borderRadius: 2,
                    background: camp.active ? 'rgba(26,122,58,0.1)' : 'rgba(0,0,0,0.05)',
                    color: camp.active ? '#1a7a3a' : 'rgba(0,0,0,0.4)',
                    border: `1px solid ${camp.active ? 'rgba(26,122,58,0.25)' : 'rgba(0,0,0,0.12)'}`,
                  }}>
                    {camp.active ? 'Active' : 'Paused'}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleActive(camp); }}
                    title={camp.active ? 'Pause' : 'Activate'}
                    style={{ background: 'none', border: '1px solid #e8e3dc', borderRadius: 0, padding: '4px 6px', cursor: 'pointer', color: '#1a1a1a', display: 'flex', alignItems: 'center' }}
                  >
                    {camp.active ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(camp.id); }}
                    title="Delete campaign"
                    style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 0, padding: '4px 6px', cursor: 'pointer', color: '#b91c1c', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Store envelope counts */}
        {selectedCampaignId && summaries.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)' }}>Envelopes by Store</p>
              <button
                onClick={loadData}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.35)', padding: 0 }}
                title="Refresh"
              >
                <RefreshCw size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {summaries.map(s => {
                const empty = s.remaining === 0;
                return (
                  <div key={s.store_id} style={{ background: '#fff', border: '1px solid #e8e3dc', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.875rem' }}>{s.store_name}</div>
                      <div style={{ fontSize: '0.72rem', color: empty ? '#b91c1c' : 'rgba(0,0,0,0.4)', marginTop: 2 }}>
                        {s.remaining} of {s.total} remaining
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => handleRemoveEnvelopes(s.store_id)}
                        disabled={empty}
                        title="Remove 50 unused envelopes"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          background: 'none', border: '1px solid #fecaca', borderRadius: 0,
                          padding: '4px 10px', cursor: empty ? 'not-allowed' : 'pointer',
                          color: '#b91c1c', fontSize: '0.75rem', fontWeight: 600,
                          opacity: empty ? 0.4 : 1,
                        }}
                      >
                        <Minus size={12} /> 50
                      </button>
                      <button
                        onClick={() => handleAddEnvelopes(s.store_id)}
                        title="Add 50 more envelopes"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: 0,
                          padding: '4px 10px', cursor: 'pointer',
                          color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                        }}
                      >
                        <Plus size={12} /> 50
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
