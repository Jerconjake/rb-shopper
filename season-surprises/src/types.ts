export type PrizeType = '50_off' | '20_off' | '10_off' | 'free_gift';
export type AppScreen = 'home' | 'qualify' | 'reveal' | 'prize' | 'admin';

export interface Store {
  id: number;
  name: string;
}

export interface Campaign {
  id: number;
  name: string;
  active: boolean;
  min_purchase: number;
}

export interface StoreSummary {
  store_id: number;
  store_name: string;
  remaining: number;
  total: number;
}

export interface Prize {
  id: number;
  type: PrizeType;
}

export interface PrizeInfo {
  label: string;
  sublabel: string;
  emoji: string;
  cssClass: string;
}

export const PRIZE_INFO: Record<PrizeType, PrizeInfo> = {
  '50_off':    { label: '50% OFF',   sublabel: 'your entire purchase!',  emoji: '🎉', cssClass: 'prize-50'   },
  '20_off':    { label: '20% OFF',   sublabel: 'your entire purchase!',  emoji: '✨', cssClass: 'prize-20'   },
  '10_off':    { label: '10% OFF',   sublabel: 'your entire purchase!',  emoji: '🎁', cssClass: 'prize-10'   },
  'free_gift': { label: 'FREE GIFT', sublabel: 'with your purchase today!', emoji: '🎀', cssClass: 'prize-gift' },
};

export const PRIZE_DISTRIBUTION = [
  { type: '50_off'    as PrizeType, count: 1  },
  { type: '20_off'    as PrizeType, count: 5  },
  { type: '10_off'    as PrizeType, count: 30 },
  { type: 'free_gift' as PrizeType, count: 14 },
];

export const INITIAL_STORES = ['Sherwood Park', 'Riverbend', 'Stony Plain', 'St. Albert'];
