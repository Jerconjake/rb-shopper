import React, { useEffect, useState } from 'react';
import { Settings, RefreshCw, Package, ChevronRight } from 'lucide-react';
import { Campaign, Store, StoreSummary } from '../types';

interface Props {
  campaign: Campaign | null;
  onStartReveal: (store: Store) => void;
  onAdmin: () => void;
  onRefresh: () => void;
}

export const HomeScreen: React.FC<Props> = ({ campaign, onStartReveal, onAdmin, onRefresh }) => {
  const [summaries, setSummaries] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummaries();
  }, [campaign]);

  async function loadSummaries() {
    setLoading(true);
    try {
      if (!campaign) { setSummaries([]); setLoading(false); return; }
      const rows = await window.tasklet.sqlQuery(
        `SELECT s.id as store_id, s.name as store_name,
           COUNT(e.id) as total,
           SUM(CASE WHEN e.used = 0 THEN 1 ELSE 0 END) as remaining
         FROM stores s
         LEFT JOIN envelopes e ON e.store_id = s.id AND e.campaign_id = ${campaign.id}
         GROUP BY s.id, s.name
         ORDER BY s.name`
      );
      setSummaries(rows.map((r: any) => ({
        store_id: r.store_id,
        store_name: r.store_name,
        remaining: r.remaining ?? 0,
        total: r.total ?? 0,
      })));
    } catch (err) {
      console.error('Failed to load summaries', err);
    }
    setLoading(false);
  }

  const totalRemaining = summaries.reduce((s, r) => s + r.remaining, 0);
  const totalTotal = summaries.reduce((s, r) => s + r.total, 0);

  return (
    <div className="rb-screen-bg" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* RB Header */}
      <div className="rb-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="./logo.png" alt="Revolution Boutique" className="rb-logo" />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => { onRefresh(); loadSummaries(); }}
              className="btn btn-ghost btn-sm btn-square"
              style={{ color: 'rgba(0,0,0,0.4)' }}
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={onAdmin}
              className="btn btn-ghost btn-sm btn-square"
              style={{ color: 'rgba(0,0,0,0.4)' }}
            >
              <Settings size={15} />
            </button>
          </div>
        </div>

        {/* Campaign status */}
        <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {campaign ? (
            <>
              <span className="rb-badge-active">Campaign Active</span>
              <span style={{ color: 'rgba(0,0,0,0.4)', fontSize: '0.75rem' }}>
                {campaign.name} · Min ${campaign.min_purchase.toFixed(0)} purchase
              </span>
            </>
          ) : (
            <span className="rb-badge-inactive">No Active Campaign</span>
          )}
        </div>

        {/* Total progress bar */}
        {campaign && totalTotal > 0 && (
          <div style={{ marginTop: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ color: 'rgba(0,0,0,0.4)', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Envelopes Remaining
              </span>
              <span style={{ color: '#1a1a1a', fontSize: '0.75rem', fontWeight: 700 }}>
                {totalRemaining} / {totalTotal}
              </span>
            </div>
            <div className="rb-progress-bar">
              <div className="rb-progress-fill" style={{ width: `${totalTotal > 0 ? (totalRemaining / totalTotal) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Campaign title */}
      <div style={{ padding: '1.25rem 1.5rem 0.75rem', borderBottom: '1px solid #e8e3dc' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', marginBottom: '2px' }}>
          Season of Surprises
        </h1>
        <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '0.8rem' }}>
          Select a store location to begin a customer reveal
        </p>
      </div>

      {/* Store list */}
      <div style={{ flex: 1, padding: '1rem 1.5rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
            <span className="loading loading-spinner loading-md" style={{ color: '#1a1a1a' }} />
          </div>
        ) : !campaign ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '3rem', gap: '1rem' }}>
            <Package size={40} style={{ color: 'rgba(0,0,0,0.15)' }} />
            <p style={{ color: 'rgba(0,0,0,0.4)', textAlign: 'center', fontSize: '0.875rem' }}>
              No active campaign.<br />Go to Admin to create one.
            </p>
            <button onClick={onAdmin} className="btn btn-sm" style={{ background: '#1a1a1a', border: 'none', color: '#fff', borderRadius: 0 }}>
              Open Admin Panel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {summaries.map((s) => {
              const pct = s.total > 0 ? (s.remaining / s.total) * 100 : 0;
              const empty = s.remaining === 0;
              return (
                <div
                  key={s.store_id}
                  className={`rb-store-card ${empty ? 'disabled' : ''}`}
                  onClick={() => !empty && onStartReveal({ id: s.store_id, name: s.store_name })}
                  style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.95rem' }}>{s.store_name}</span>
                      <span style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: empty ? '#b91c1c' : '#1a1a1a',
                        lineHeight: 1,
                      }}>
                        {s.remaining}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: empty ? '#b91c1c' : 'rgba(0,0,0,0.4)' }}>
                        {empty ? 'No envelopes remaining' : `${s.remaining} of ${s.total} remaining`}
                      </span>
                      {!empty && <ChevronRight size={14} style={{ color: 'rgba(0,0,0,0.3)' }} />}
                    </div>
                    <div style={{ marginTop: '8px', height: '2px', background: 'rgba(0,0,0,0.06)', width: '100%' }}>
                      <div style={{
                        height: '2px',
                        background: pct < 20 ? '#b91c1c' : '#1a1a1a',
                        width: `${pct}%`,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '1rem 1.5rem', textAlign: 'center', borderTop: '1px solid #e8e3dc' }}>
        <p style={{ color: 'rgba(0,0,0,0.2)', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Revolution Boutique · Staff Use Only
        </p>
      </div>
    </div>
  );
};
