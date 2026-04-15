import React, { useState, useEffect } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { QualifyScreen } from './components/QualifyScreen';
import { EnvelopeReveal } from './components/EnvelopeReveal';
import { PrizeScreen } from './components/PrizeScreen';
import { AdminPanel } from './components/AdminPanel';
import { AppScreen, Campaign, Store, Prize } from './types';
import { initDB, getActiveCampaign, drawEnvelope } from './db';

const App: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [dbReady, setDbReady] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [currentPrize, setCurrentPrize] = useState<Prize | null>(null);

  useEffect(() => {
    initDB();
    loadActiveCampaign();
    setDbReady(true);
  }, []);

  function loadActiveCampaign() {
    const camp = getActiveCampaign();
    setActiveCampaign(camp ? { id: camp.id, name: camp.name, active: camp.active, min_purchase: camp.min_purchase } : null);
  }

  function handleQualified(store: Store) {
    if (!activeCampaign) return;
    const result = drawEnvelope(activeCampaign.id, store.id);
    if (!result) {
      alert('No envelopes remaining for this store!');
      return;
    }
    setCurrentPrize({ id: result.id, type: result.prize_type });
    setScreen('reveal');
  }

  function handleStartReveal(store: Store) {
    setSelectedStore(store);
    setScreen('qualify');
  }

  function handleDone() {
    setSelectedStore(null);
    setCurrentPrize(null);
    loadActiveCampaign();
    setScreen('home');
  }

  if (!dbReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0e0d0c' }}>
        <div style={{ color: '#c9835a', fontSize: '1rem' }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      {screen === 'home' && (
        <HomeScreen campaign={activeCampaign} onStartReveal={handleStartReveal} onAdmin={() => setScreen('admin')} onRefresh={loadActiveCampaign} />
      )}
      {screen === 'qualify' && selectedStore && activeCampaign && (
        <QualifyScreen store={selectedStore} campaign={activeCampaign} onQualified={() => handleQualified(selectedStore)} onBack={() => setScreen('home')} />
      )}
      {screen === 'reveal' && currentPrize && (
        <EnvelopeReveal prize={currentPrize} onComplete={() => setScreen('prize')} />
      )}
      {screen === 'prize' && currentPrize && (
        <PrizeScreen prize={currentPrize} onDone={handleDone} />
      )}
      {screen === 'admin' && (
        <AdminPanel onBack={() => { loadActiveCampaign(); setScreen('home'); }} onCampaignChange={loadActiveCampaign} />
      )}
    </>
  );
};

export default App;
