import { useState, useEffect, useCallback } from 'react';
import { useFirebaseSync } from './useFirebaseSync';

export interface FinanceBanks {
  cib: number;
  ahly_main: number;
  ahly_meeza: number;
  bm: number;
}

export interface FinanceBuckets {
  tawarr2: number;
  leya: number;
  iltizamat: number;
  mustaqbal: number;
  basmala: number;
}

export interface FinanceTransaction {
  id: string;
  type: 'deposit' | 'debit';
  bank: string;
  amount: number;
  description: string;
  category?: string;
  timestamp: string;
}

export interface PendingItem {
  id: string;
  bank: string;
  amount: number;
  source: string;
  raw: string;
  receivedAt: string;
}

export interface GoldAsset {
  id: string;
  quantity: number;
  carat: 24 | 21;
  notes?: string;
  purchasePrice?: number; // price per gram at time of purchase
}

export interface Subscription {
  id: string;
  name: string;
  cost: number;
  renewalDay: number;
  bank: string;
}

export interface Debt {
  id: string;
  personName: string;
  amount: number;
  type: 'owed_to_me' | 'owed_by_me';
  notes?: string;
}

const DEFAULT_BANKS: FinanceBanks = { cib: 0, ahly_main: 0, ahly_meeza: 0, bm: 0 };
const DEFAULT_BUCKETS: FinanceBuckets = { tawarr2: 0, leya: 0, iltizamat: 0, mustaqbal: 0, basmala: 0 };

export const SALARY_SPLIT: Record<keyof Omit<FinanceBuckets, 'basmala'>, number> = {
  tawarr2: 0.10,
  leya: 0.13,
  iltizamat: 0.34,
  mustaqbal: 0.43,
};

export const FREELANCE_SPLIT: Record<string, number> = {
  tawarr2: 0.10,
  leya: 0.10,
  mustaqbal: 0.80,
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function useFinance() {
  const [banks, setBanks] = useFirebaseSync<FinanceBanks>('finance_banks', DEFAULT_BANKS);
  const [buckets, setBuckets] = useFirebaseSync<FinanceBuckets>('finance_buckets', DEFAULT_BUCKETS);
  const [transactions, setTransactions] = useFirebaseSync<FinanceTransaction[]>('finance_transactions', []);
  const [gold, setGold] = useFirebaseSync<GoldAsset[]>('finance_gold', []);
  const [subscriptions, setSubscriptionsRaw] = useFirebaseSync<Subscription[]>('finance_subscriptions', []);
  const [debts, setDebts] = useFirebaseSync<Debt[]>('finance_debts', []);

  const [pendingItems, setPendingItemsLocal] = useState<PendingItem[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/pending`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        setPendingItemsLocal(data);
        setBackendOnline(true);
      }
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  // Sync subscriptions with backend when online
  useEffect(() => {
    if (backendOnline && subscriptions && subscriptions.length >= 0) {
      fetch(`${BACKEND_URL}/api/subscriptions/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptions)
      }).catch(err => console.error('Subscription sync failed:', err));
    }
  }, [subscriptions, backendOnline]);

  const totalPhysical = (Object.values(banks) as number[]).reduce((a, b) => a + b, 0);
  const totalVirtual = (Object.values(buckets) as number[]).reduce((a, b) => a + b, 0);

  const translateArabicText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/تحويل وارد/g, 'Incoming Transfer')
      .replace(/جهة العمل/g, 'Employer')
      .replace(/غير معروف/g, 'Unknown')
      .replace(/مرتب/g, 'Salary')
      .replace(/فريلانس/g, 'Freelance')
      .replace(/تحويل عادي/g, 'Transfer')
      .replace(/خصم/g, 'Debit')
      .replace(/إيداع/g, 'Deposit')
      .replace(/جم/g, 'EGP');
  };

  const classifyDeposit = async (
    item: PendingItem,
    category: 'Salary' | 'Freelance' | 'Transfer',
    bankKey: keyof FinanceBanks
  ) => {
    const newBuckets = { ...buckets };

    // Translate English UI categories to split arrays
    const categoryMapping = {
      'Salary': 'مرتب',
      'Freelance': 'فريلانس',
      'Transfer': 'تحويل عادي'
    };
    const savedCategory = categoryMapping[category] || category;

    if (category === 'Salary') {
      for (const [key, pct] of Object.entries(SALARY_SPLIT)) {
        newBuckets[key as keyof FinanceBuckets] = Math.round(((newBuckets[key as keyof FinanceBuckets] || 0) + item.amount * pct) * 100) / 100;
      }
    } else if (category === 'Freelance') {
      for (const [key, pct] of Object.entries(FREELANCE_SPLIT)) {
        newBuckets[key as keyof FinanceBuckets] = Math.round(((newBuckets[key as keyof FinanceBuckets] || 0) + item.amount * pct) * 100) / 100;
      }
    }

    const newBanks = { ...banks, [bankKey]: Math.round(((banks[bankKey] || 0) + item.amount) * 100) / 100 };
    await setBanks(newBanks);
    await setBuckets(newBuckets);

    const translatedSource = translateArabicText(item.source);
    const tx: FinanceTransaction = {
      id: `${Date.now()}`,
      type: 'deposit',
      bank: item.bank,
      amount: item.amount,
      description: `${category} — ${translatedSource}`,
      category: savedCategory,
      timestamp: new Date().toISOString(),
    };
    await setTransactions([tx, ...transactions].slice(0, 100));

    try {
      await fetch(`${BACKEND_URL}/api/pending/${item.id}`, { method: 'DELETE' });
    } catch {}
    setPendingItemsLocal(prev => prev.filter(p => p.id !== item.id));
  };

  const ignorePending = async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/pending/${id}`, { method: 'DELETE' });
    } catch {}
    setPendingItemsLocal(prev => prev.filter(p => p.id !== id));
  };

  const updateBankBalance = async (bankKey: keyof FinanceBanks, amount: number) => {
    await setBanks({ ...banks, [bankKey]: amount });
  };

  const updateBucketBalance = async (bucketKey: keyof FinanceBuckets, amount: number) => {
    await setBuckets({ ...buckets, [bucketKey]: amount });
  };

  return {
    banks,
    buckets,
    transactions,
    pendingItems,
    backendOnline,
    totalPhysical,
    totalVirtual,
    gold,
    setGold,
    subscriptions,
    setSubscriptions: setSubscriptionsRaw,
    debts,
    setDebts,
    classifyDeposit,
    ignorePending,
    updateBankBalance,
    updateBucketBalance,
  };
}
