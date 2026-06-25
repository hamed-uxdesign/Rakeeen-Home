import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Inbox, X, Banknote, Wallet, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useFinance,
  PendingItem,
  FinanceBanks,
  FinanceBuckets,
  SALARY_SPLIT,
  FREELANCE_SPLIT,
  GoldAsset,
  Subscription,
  Debt,
} from '../../hooks/useFinance';

interface FinanceProps {
  navigate: (to: string) => void;
}

// 4 custom spinning SVG vectors for bank cards
const CIBVector: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
    <circle cx="12" cy="4" r="1.3" />
    <circle cx="12" cy="8" r="1.5" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="16" r="1.5" />
    <circle cx="12" cy="20" r="1.3" />
    <circle cx="4" cy="12" r="1.3" />
    <circle cx="8" cy="12" r="1.5" />
    <circle cx="16" cy="12" r="1.5" />
    <circle cx="20" cy="12" r="1.3" />
    <circle cx="8" cy="8" r="1" />
    <circle cx="16" cy="8" r="1" />
    <circle cx="8" cy="16" r="1" />
    <circle cx="16" cy="16" r="1" />
  </svg>
);

const AhlyMainVector: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
    <circle cx="12" cy="16" r="1.8" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="8" r="1.3" />
    <circle cx="9" cy="10" r="1.2" />
    <circle cx="6" cy="9" r="1" />
    <circle cx="3" cy="9" r="0.8" />
    <circle cx="8" cy="13" r="1.2" />
    <circle cx="5" cy="13" r="1" />
    <circle cx="15" cy="10" r="1.2" />
    <circle cx="18" cy="9" r="1" />
    <circle cx="21" cy="9" r="0.8" />
    <circle cx="16" cy="13" r="1.2" />
    <circle cx="19" cy="13" r="1" />
  </svg>
);

const AhlyMeezaVector: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="6" r="1.2" />
    <circle cx="18" cy="12" r="1.2" />
    <circle cx="12" cy="18" r="1.2" />
    <circle cx="6" cy="12" r="1.2" />
    <circle cx="12" cy="2" r="0.9" />
    <circle cx="19.07" cy="4.93" r="0.9" />
    <circle cx="22" cy="12" r="0.9" />
    <circle cx="19.07" cy="19.07" r="0.9" />
    <circle cx="12" cy="22" r="0.9" />
    <circle cx="4.93" cy="19.07" r="0.9" />
    <circle cx="2" cy="12" r="0.9" />
    <circle cx="4.93" cy="4.93" r="0.9" />
  </svg>
);

const BanqueMisrVector: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
    <circle cx="12" cy="6" r="1.8" />
    <circle cx="8" cy="11" r="1.5" />
    <circle cx="16" cy="11" r="1.5" />
    <circle cx="4" cy="16" r="1.2" />
    <circle cx="12" cy="16" r="1.5" />
    <circle cx="20" cy="16" r="1.2" />
    <circle cx="12" cy="21" r="1.2" />
    <circle cx="6" cy="6" r="1" />
    <circle cx="18" cy="6" r="1" />
    <circle cx="3" cy="11" r="1" />
    <circle cx="21" cy="11" r="1" />
  </svg>
);

// Animated price number — flashes green/red on change
const AnimatedValue: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(value > prevRef.current ? 'up' : 'down');
      prevRef.current = value;
      const t = setTimeout(() => setFlash(null), 900);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      className={`transition-colors duration-500 ${className}`}
      style={{
        color: flash === 'up' ? 'var(--forest)' : flash === 'down' ? 'var(--rust)' : 'var(--ink)',
      }}
    >
      {formatEGP(value)}
    </span>
  );
};

const BANK_LABELS: Record<keyof FinanceBanks, string> = {
  cib: 'CIB',
  ahly_main: 'Ahly Main',
  ahly_meeza: 'Ahly Meeza',
  bm: 'Banque Misr',
};

const BANK_VECTORS: Record<keyof FinanceBanks, React.ComponentType> = {
  cib: CIBVector,
  ahly_main: AhlyMainVector,
  ahly_meeza: AhlyMeezaVector,
  bm: BanqueMisrVector,
};

const BUCKET_META: Record<keyof FinanceBuckets, { en: string; pct: string; accent: string }> = {
  tawarr2:   { en: 'Emergency',   pct: '10%', accent: 'var(--rust)' },
  leya:      { en: 'Leya',        pct: '13%', accent: 'var(--sepia)' },
  iltizamat: { en: 'Commitments', pct: '34%', accent: 'var(--ink)' },
  mustaqbal: { en: 'Future',      pct: '43%', accent: 'var(--forest)' },
  basmala:   { en: 'Basmala',     pct: '—',   accent: 'var(--ink-faded)' },
};

type Category = 'Salary' | 'Freelance' | 'Transfer' | 'Ignore';

interface ClassifyState {
  item: PendingItem;
  category: Category | null;
  bankKey: keyof FinanceBanks;
}

function bankFromSMS(smsBank: string): keyof FinanceBanks {
  if (smsBank === 'CIB') return 'cib';
  if (smsBank === 'AHLY') return 'ahly_main';
  if (smsBank === 'BM') return 'bm';
  return 'cib';
}

function translateArabicText(text: string): string {
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
}

function formatEGP(n: number) {
  return `${Math.round(n).toLocaleString('en-EG')} EGP`;
}

function getSplitRows(amount: number, category: Category | null) {
  if (!category || category === 'Transfer' || category === 'Ignore') return null;
  const split = category === 'Salary' ? SALARY_SPLIT : FREELANCE_SPLIT;
  return Object.entries(split).map(([key, pct]) => ({
    label: BUCKET_META[key as keyof FinanceBuckets]?.en ?? key,
    pct: Math.round(pct * 100),
    amount: Math.round(amount * pct),
  }));
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const Finance: React.FC<FinanceProps> = ({ navigate }) => {
  const {
    banks, buckets, transactions, pendingItems,
    totalPhysical, totalVirtual,
    gold, setGold,
    subscriptions, setSubscriptions,
    debts, setDebts,
    classifyDeposit, ignorePending,

  } = useFinance();

  const [activeTab, setActiveTab] = useState<'overview' | 'buckets' | 'gold' | 'subscriptions' | 'debts' | 'analysis'>('overview');
  const [classifyState, setClassifyState] = useState<ClassifyState | null>(null);


  const [confirming, setConfirming] = useState(false);

  // Modals Visibility
  const [showAddGoldModal, setShowAddGoldModal] = useState(false);
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);

  // Custom Dropdowns
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  // Live gold spot prices state
  const [goldPrices, setGoldPrices] = useState<{ price24: number; price21: number } | null>(null);
  const [loadingGold, setLoadingGold] = useState(false);

  // Form Inputs
  const [newGoldQty, setNewGoldQty] = useState('');
  const [newGoldCarat, setNewGoldCarat] = useState<24 | 21>(24);
  const [newGoldNotes, setNewGoldNotes] = useState('');
  const [newGoldPurchasePrice, setNewGoldPurchasePrice] = useState('');

  const [newSubName, setNewSubName] = useState('');
  const [newSubCost, setNewSubCost] = useState('');
  const [newSubDay, setNewSubDay] = useState('');
  const [newSubBank, setNewSubBank] = useState<keyof FinanceBanks>('cib');

  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [newDebtType, setNewDebtType] = useState<'owed_to_me' | 'owed_by_me'>('owed_to_me');
  const [newDebtNotes, setNewDebtNotes] = useState('');

  React.useEffect(() => { document.title = 'Rakeeen — Finance'; }, []);

  // Fetch Gold Prices with 30s auto-refresh when tab is active
  useEffect(() => {
    let intervalId: any;

    const fetchPrices = (showLoader = false) => {
      if (showLoader) setLoadingGold(true);
      fetch(`${BACKEND_URL}/api/gold-prices`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Failed to fetch gold prices');
        })
        .then(data => {
          setGoldPrices(data);
        })
        .catch(err => {
          console.error(err);
          setGoldPrices(prev => prev || { price24: 3800, price21: 3325 });
        })
        .finally(() => {
          if (showLoader) setLoadingGold(false);
        });
    };

    if (activeTab === 'gold') {
      fetchPrices(true);
      intervalId = setInterval(() => {
        fetchPrices(false);
      }, 30000); // 30 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTab]);

  const openClassify = (item: PendingItem) => {
    setClassifyState({ item, category: null, bankKey: bankFromSMS(item.bank) });
  };

  const handleConfirm = async () => {
    if (!classifyState?.category) return;
    setConfirming(true);
    if (classifyState.category === 'Ignore') {
      await ignorePending(classifyState.item.id);
    } else {
      await classifyDeposit(
        classifyState.item,
        classifyState.category as 'Salary' | 'Freelance' | 'Transfer',
        classifyState.bankKey
      );
    }
    setConfirming(false);
    setClassifyState(null);
  };

  // Gold operations
  const handleAddGold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoldQty || parseFloat(newGoldQty) <= 0) return;
    const spotPrice = goldPrices ? (newGoldCarat === 24 ? goldPrices.price24 : goldPrices.price21) : undefined;
    const purchasePrice = newGoldPurchasePrice ? parseFloat(newGoldPurchasePrice) : spotPrice;
    const asset: GoldAsset = {
      id: `${Date.now()}`,
      quantity: parseFloat(newGoldQty),
      carat: newGoldCarat,
      notes: newGoldNotes.trim() || undefined,
      purchasePrice,
    };
    await setGold([...(gold || []), asset]);
    setNewGoldQty('');
    setNewGoldNotes('');
    setNewGoldPurchasePrice('');
    setShowAddGoldModal(false);
  };

  const handleRemoveGold = async (id: string) => {
    await setGold((gold || []).filter(g => g.id !== id));
  };

  // Subscription operations
  const handleAddSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubCost || !newSubDay) return;
    const sub: Subscription = {
      id: `${Date.now()}`,
      name: newSubName.trim(),
      cost: parseFloat(newSubCost),
      renewalDay: parseInt(newSubDay),
      bank: BANK_LABELS[newSubBank]
    };
    await setSubscriptions([...(subscriptions || []), sub]);
    setNewSubName('');
    setNewSubCost('');
    setNewSubDay('');
    setShowAddSubModal(false);
  };

  const handleRemoveSub = async (id: string) => {
    await setSubscriptions((subscriptions || []).filter(s => s.id !== id));
  };

  // Debt operations
  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDebtName.trim() || !newDebtAmount) return;
    const debt: Debt = {
      id: `${Date.now()}`,
      personName: newDebtName.trim(),
      amount: parseFloat(newDebtAmount),
      type: newDebtType,
      notes: newDebtNotes.trim() || undefined
    };
    await setDebts([...(debts || []), debt]);
    setNewDebtName('');
    setNewDebtAmount('');
    setNewDebtNotes('');
    setShowAddDebtModal(false);
  };

  const handleRemoveDebt = async (id: string) => {
    await setDebts((debts || []).filter(d => d.id !== id));
  };

  // Calculate valuations
  const getGoldValue = (asset: GoldAsset) => {
    if (!goldPrices) return 0;
    const rate = asset.carat === 24 ? goldPrices.price24 : goldPrices.price21;
    return asset.quantity * rate;
  };

  const totalGoldValuation = (gold || []).reduce((acc, curr) => acc + getGoldValue(curr), 0);
  const totalDebtsOwedToMe = (debts || []).filter(d => d.type === 'owed_to_me').reduce((acc, curr) => acc + curr.amount, 0);
  const totalDebtsOwedByMe = (debts || []).filter(d => d.type === 'owed_by_me').reduce((acc, curr) => acc + curr.amount, 0);
  const netDebts = totalDebtsOwedToMe - totalDebtsOwedByMe;

  const splitRows = classifyState ? getSplitRows(classifyState.item.amount, classifyState.category) : null;

  return (
    <div className="min-h-screen bg-bg text-ink py-12 px-6 md:px-12 lg:px-20 font-sans-main transition-colors duration-300">

      {/* HEADER */}
      <header className="w-full max-w-[1400px] mx-auto mb-8 border-b border-ink/10 pb-6 flex items-center gap-5">
        <button
          onClick={() => navigate('home')}
          className="w-10 h-10 border border-ink flex items-center justify-center text-ink hover:bg-ink/5 transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-sans-main text-3xl md:text-4xl font-black uppercase tracking-tight text-ink">
          FINANCES
        </h1>
      </header>

      {/* TABS SWITCHER (Matched with training / Fitness.tsx component style) */}
      <div className="w-full max-w-[1400px] mx-auto mb-8">
        <div className="flex border border-ink/20 overflow-hidden self-start relative bg-[var(--paper-dark)] w-fit">
          {(['overview', 'buckets', 'gold', 'subscriptions', 'debts', 'analysis'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setClassifyState(null); }}
              className="relative font-mono-main text-[10px] uppercase tracking-widest font-bold px-4 py-2 transition-colors duration-200 cursor-pointer text-center"
              style={{
                color: activeTab === tab ? 'var(--paper)' : 'var(--ink)',
              }}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="financeTabBg"
                  className="absolute inset-0 bg-[var(--ink)]"
                  transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                  style={{ zIndex: 0 }}
                />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto space-y-12">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* INLINE PENDING INBOX */}
            <AnimatePresence>
              {pendingItems.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="border-2 border-rust bg-paper p-6 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-rust animate-pulse" />
                  <div className="flex items-center gap-3 mb-4">
                    <Inbox size={16} className="text-rust" />
                    <span className="font-mono-main text-xs font-bold tracking-[0.25em] uppercase text-rust">
                      INLINE PENDING INBOX
                    </span>
                  </div>

                  <div className="space-y-6">
                    {pendingItems.map(item => {
                      const isCurrentlyClassifying = classifyState?.item.id === item.id;
                      return (
                        <div
                          key={item.id}
                          className="border border-ink/10 p-5 bg-paper-dark flex flex-col gap-5"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <p className="font-mono-main text-3xl font-black text-ink">{formatEGP(item.amount)}</p>
                              <p className="font-mono-main text-[12px] font-bold uppercase tracking-widest text-ink/65 mt-1">
                                {item.bank} — {translateArabicText(item.source)}
                              </p>
                              <p className="font-mono-main text-[11px] text-ink/45 mt-2 max-w-xl italic">
                                Raw SMS: {translateArabicText(item.raw)}
                              </p>
                            </div>
                            {!isCurrentlyClassifying && (
                              <button
                                onClick={() => openClassify(item)}
                                className="btn-brutalist self-start md:self-auto uppercase font-mono-main text-xs py-2 px-4 cursor-pointer"
                              >
                                Classify Inline
                              </button>
                            )}
                          </div>

                          {/* INLINE ACTION PANEL */}
                          {isCurrentlyClassifying && (
                            <div className="border-t border-ink/10 pt-5 space-y-5">
                              <div>
                                <p className="font-mono-main text-[10px] uppercase tracking-widest text-ink/50 mb-3">
                                  Select Category:
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  {(['Salary', 'Freelance', 'Transfer', 'Ignore'] as Category[]).map(cat => (
                                    <button
                                      key={cat}
                                      onClick={() => setClassifyState(prev => prev ? { ...prev, category: cat } : null)}
                                      className={`py-3 px-4 border font-mono-main text-xs font-bold transition-all duration-150 cursor-pointer ${
                                        classifyState.category === cat
                                          ? 'border-ink bg-ink text-paper'
                                          : 'border-ink/20 text-ink/50 hover:border-ink/60 hover:text-ink/80 bg-paper'
                                      }`}
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Split details display */}
                              {splitRows && (
                                <div className="border border-ink/10 p-4 bg-paper max-w-md">
                                  <p className="font-mono-main text-[10px] uppercase tracking-widest text-ink/40 mb-2">Salary Splitting Allocation</p>
                                  {splitRows.map(row => (
                                    <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-ink/5 last:border-0">
                                      <span className="font-mono-main text-xs font-bold text-ink/60">{row.label}</span>
                                      <div className="flex items-baseline gap-2">
                                        <span className="font-mono-main text-sm font-black text-ink">{formatEGP(row.amount)}</span>
                                        <span className="font-mono-main text-[10px] text-ink/20">{row.pct}%</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Target Bank select if not ignore */}
                              {classifyState.category && classifyState.category !== 'Ignore' && (
                                <div>
                                  <p className="font-mono-main text-[10px] uppercase tracking-widest text-ink/50 mb-2">Target Bank Account:</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {(Object.keys(BANK_LABELS) as Array<keyof FinanceBanks>).map(bk => (
                                      <button
                                        key={bk}
                                        onClick={() => setClassifyState(prev => prev ? { ...prev, bankKey: bk } : null)}
                                        className={`py-2.5 px-3 border font-mono-main text-xs font-bold transition-all duration-150 cursor-pointer ${
                                          classifyState.bankKey === bk
                                            ? 'border-ink bg-ink text-paper'
                                            : 'border-ink/15 text-ink/35 hover:border-ink/50 hover:text-ink/60 bg-paper'
                                        }`}
                                      >
                                        {BANK_LABELS[bk]}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Confirm Trigger */}
                              <div className="flex gap-3">
                                <button
                                  onClick={handleConfirm}
                                  disabled={!classifyState.category || confirming}
                                  className="btn-brutalist uppercase font-mono-main text-xs px-6 py-2.5 bg-forest/10 border-forest text-forest hover:bg-forest hover:text-paper cursor-pointer"
                                >
                                  {confirming ? 'Processing...' : 'Confirm Classification'}
                                </button>
                                <button
                                  onClick={() => setClassifyState(null)}
                                  className="btn-brutalist uppercase font-mono-main text-xs px-6 py-2.5 bg-ink/5 border-ink/40 text-ink/60 hover:bg-ink hover:text-paper cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* BANKS LIST - VISUAL CREDIT CARDS GRID */}
            <section>
              <p className="font-mono-main text-[11px] font-bold tracking-[0.25em] uppercase text-ink/40 mb-4">BANK ACCOUNTS</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(['ahly_main', 'ahly_meeza', 'bm', 'cib'] as Array<keyof FinanceBanks>).map(key => {
                  const Vector = BANK_VECTORS[key];
                  return (
                    <div
                      key={key}
                      className="brutalist-card no-lift relative overflow-hidden p-6 aspect-[1.85/1] flex flex-col justify-between group bg-paper-dark"
                    >
                      <div className="flex justify-between items-start">
                        {/* Vector on top left */}
                        <div className="w-12 h-12 flex items-center justify-center shrink-0 text-ink/75 group-hover:text-ink transition-colors">
                          <div className="animate-spin" style={{ animationDuration: '8s' }}>
                            <Vector />
                          </div>
                        </div>
                        
                        <p className="font-sans-main text-[12px] font-black uppercase tracking-widest text-ink/60 mt-1">
                          {BANK_LABELS[key]}
                        </p>
                      </div>

                      {/* Card Balance at the bottom */}
                      <div className="relative z-10 mt-auto">
                        <span className="font-mono-main text-[9px] font-bold uppercase tracking-[0.2em] text-ink/40 block mb-1">
                          Available Balance
                        </span>
                        <p className="font-mono-main text-2xl sm:text-3xl font-black text-ink tracking-tight">
                          {formatEGP(banks[key] || 0)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* BALANCE TOTALS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="brutalist-card no-lift">
                <div className="flex items-center gap-2 mb-3">
                  <Banknote size={15} className="text-ink/40" />
                  <p className="font-mono-main text-[10px] font-bold tracking-[0.2em] uppercase text-ink/40">
                    TOTAL PHYSICAL BALANCE
                  </p>
                </div>
                <p className="font-mono-main text-3xl md:text-4xl font-black text-ink">{formatEGP(totalPhysical)}</p>
              </div>
              <div className="brutalist-card no-lift">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet size={15} className="text-ink/40" />
                  <p className="font-mono-main text-[10px] font-bold tracking-[0.2em] uppercase text-ink/40">
                    TOTAL VIRTUAL BALANCE
                  </p>
                </div>
                <p className="font-mono-main text-3xl md:text-4xl font-black text-ink">{formatEGP(totalVirtual)}</p>
              </div>
            </div>
          </div>
        )}

        {/* BUCKETS TAB - DYNAMIC GRID WITH DOT-MATRIX LOADER */}
        {activeTab === 'buckets' && (
          <section className="space-y-6">
            <p className="font-mono-main text-[11px] font-bold tracking-[0.25em] uppercase text-ink/40 mb-4">VIRTUAL BUCKETS</p>
            
            <div className="flex flex-col gap-6">
              {/* 1. MUSTAQBAL (Future) - FULL WIDTH */}
              {(() => {
                const key = 'mustaqbal';
                const meta = BUCKET_META[key];
                const value = buckets[key] || 0;
                const percentOfTotal = totalVirtual > 0 ? (value / totalVirtual) * 100 : 0;
                const activeDots = Math.max(0, Math.min(10, Math.round(percentOfTotal / 10)));
                return (
                  <div className="brutalist-card no-lift group flex flex-col justify-between p-6 bg-paper-dark min-h-[140px] relative w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 shrink-0 rounded-full" style={{ backgroundColor: meta.accent }} />
                        <p className="font-sans-main text-base font-black uppercase tracking-wider text-ink/80">
                          {meta.en}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-6">
                      <div>
                        <p className="font-mono-main text-2xl sm:text-3xl font-black text-ink">
                          {formatEGP(value)}
                        </p>
                      </div>
                      
                      {/* 10-Dot Matrix Loader */}
                      <div className="flex flex-col items-start sm:items-end gap-1.5">
                        <div className="flex gap-1.5">
                          {Array.from({ length: 10 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="w-2.5 h-2.5 rounded-full transition-all duration-300 shrink-0"
                              style={{
                                backgroundColor: idx < activeDots ? meta.accent : 'var(--ink)',
                                opacity: idx < activeDots ? 1 : 0.15
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2. THE OTHER 4 BUCKETS - 2X2 GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(['tawarr2', 'iltizamat', 'leya', 'basmala'] as Array<keyof FinanceBuckets>).map(key => {
                  const meta = BUCKET_META[key];
                  const value = buckets[key] || 0;
                  const percentOfTotal = totalVirtual > 0 ? (value / totalVirtual) * 100 : 0;
                  const activeDots = Math.max(0, Math.min(10, Math.round(percentOfTotal / 10)));
                  return (
                    <div key={key} className="brutalist-card no-lift group flex flex-col justify-between p-5 bg-paper-dark min-h-[140px] relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.accent }} />
                          <p className="font-sans-main text-sm font-black uppercase tracking-wider text-ink/75">
                            {meta.en}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-end justify-between mt-6">
                        <p className="font-mono-main text-xl font-black text-ink">
                          {formatEGP(value)}
                        </p>
                        
                        {/* 10-Dot Matrix Loader */}
                        <div className="flex gap-1">
                          {Array.from({ length: 10 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="w-1.5 h-1.5 rounded-full transition-all duration-300 shrink-0"
                              style={{
                                backgroundColor: idx < activeDots ? meta.accent : 'var(--ink)',
                                opacity: idx < activeDots ? 1 : 0.15
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* GOLD TAB */}
        {activeTab === 'gold' && (
          <div className="space-y-6">
            {/* TOP ROW: spot + total */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Spot prices */}
              <div className="brutalist-card no-lift p-6">
                <p className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30 mb-4">Spot Price / gram</p>
                {loadingGold ? (
                  <div className="space-y-3">
                    {['24K', '21K'].map(k => (
                      <div key={k} className="flex justify-between items-center">
                        <span className="font-mono-main text-xs font-bold text-ink/30">{k}</span>
                        <div className="h-6 w-28 bg-ink/5 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : goldPrices ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="font-mono-main text-xs font-bold text-ink/40">24K</span>
                      <AnimatedValue value={goldPrices.price24} className="font-mono-main text-2xl font-black" />
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-mono-main text-xs font-bold text-ink/40">21K</span>
                      <AnimatedValue value={goldPrices.price21} className="font-mono-main text-2xl font-black" />
                    </div>
                  </div>
                ) : (
                  <p className="font-mono-main text-xs text-ink/25">— offline</p>
                )}
              </div>

              {/* Portfolio total */}
              <div className="brutalist-card no-lift p-6 flex flex-col justify-between">
                <p className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30 mb-4">Portfolio Value</p>
                <div>
                  {goldPrices ? (
                    <p className="font-mono-main text-3xl font-black text-ink">{formatEGP(totalGoldValuation)}</p>
                  ) : (
                    <>
                      <p className="font-mono-main text-3xl font-black text-ink/30">—</p>
                      <p className="font-mono-main text-[9px] text-ink/25 mt-1">Backend offline</p>
                    </>
                  )}
                  {goldPrices && (
                    <p className="font-mono-main text-[10px] text-ink/30 mt-1">
                      {(gold || []).reduce((s, g) => s + g.quantity, 0).toFixed(2)}g total weight
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Assets */}
            <div className="flex justify-between items-center">
              <p className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30">Assets</p>
              <button
                onClick={() => setShowAddGoldModal(true)}
                className="btn-brutalist flex items-center gap-2 font-mono-main text-xs uppercase py-2 px-4 cursor-pointer"
              >
                <Plus size={13} /> Add Asset
              </button>
            </div>

            {(!gold || gold.length === 0) ? (
              <div className="border border-dashed border-ink/15 py-12 text-center">
                <p className="font-mono-main text-xs text-ink/25">No gold assets added yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gold.map(g => {
                  const currentVal = getGoldValue(g);
                  const purchasedTotal = g.purchasePrice ? g.purchasePrice * g.quantity : null;
                  const pnl = purchasedTotal !== null ? currentVal - purchasedTotal : null;
                  return (
                    <div key={g.id} className="brutalist-card no-lift p-5 flex items-center justify-between group relative bg-paper-dark">
                      <button
                        onClick={() => handleRemoveGold(g.id)}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-ink/25 hover:text-rust transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>

                      {/* Left: weight + carat + notes */}
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono-main text-2xl font-black text-ink">{g.quantity}g</span>
                        <span className="font-mono-main text-xs font-bold text-ink/35 border border-ink/15 px-1.5 py-0.5">{g.carat}K</span>
                        {g.notes && <span className="font-mono-main text-[10px] text-ink/40 italic">{g.notes}</span>}
                      </div>

                      {/* Right: current value + optional P&L */}
                      <div className="text-right space-y-0.5 pr-6">
                        {purchasedTotal !== null && (
                          <p className="font-mono-main text-[10px] text-ink/35">
                            Paid {formatEGP(purchasedTotal)}
                          </p>
                        )}
                        <p className="font-mono-main text-sm font-black text-ink">{formatEGP(currentVal)}</p>
                        {pnl !== null && (
                          <p className="font-mono-main text-[10px] font-bold" style={{ color: pnl >= 0 ? 'var(--forest)' : 'var(--rust)' }}>
                            {pnl >= 0 ? '+' : ''}{formatEGP(pnl)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUBSCRIPTIONS TAB */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            {/* Summary bar */}
            {subscriptions && subscriptions.length > 0 && (
              <div className="brutalist-card no-lift p-5 flex items-baseline justify-between">
                <div>
                  <p className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30 mb-1">Monthly Total</p>
                  <p className="font-mono-main text-2xl font-black text-rust">
                    -{formatEGP(subscriptions.reduce((s, sub) => s + sub.cost, 0))}
                  </p>
                </div>
                <p className="font-mono-main text-xs text-ink/30">{subscriptions.length} subscriptions</p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30">Subscriptions</p>
              <button
                onClick={() => setShowAddSubModal(true)}
                className="btn-brutalist flex items-center gap-2 font-mono-main text-xs uppercase py-2 px-4 cursor-pointer"
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {(!subscriptions || subscriptions.length === 0) ? (
              <div className="border border-dashed border-ink/15 py-12 text-center">
                <p className="font-mono-main text-xs text-ink/25">No subscriptions added yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map(sub => {
                  const today = new Date().getDate();
                  const daysLeft = sub.renewalDay >= today ? sub.renewalDay - today : 30 - today + sub.renewalDay;
                  const soon = daysLeft <= 5;
                  return (
                    <div key={sub.id} className="brutalist-card no-lift p-5 flex items-center justify-between group relative bg-paper-dark">
                      <button
                        onClick={() => handleRemoveSub(sub.id)}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-ink/25 hover:text-rust transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>

                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-sans-main text-sm font-black text-ink">{sub.name}</p>
                          <p className="font-mono-main text-[10px] text-ink/35 mt-0.5">{sub.bank} · Day {sub.renewalDay}</p>
                        </div>
                      </div>

                      <div className="text-right pr-6">
                        <p className="font-mono-main text-base font-black text-rust">-{formatEGP(sub.cost)}</p>
                        <p className="font-mono-main text-[10px] mt-0.5" style={{ color: soon ? 'var(--rust)' : 'var(--ink)', opacity: soon ? 1 : 0.3 }}>
                          {daysLeft === 0 ? 'Today' : `in ${daysLeft}d`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* DEBTS TAB */}
        {activeTab === 'debts' && (
          <div className="space-y-6">
            {/* Net summary */}
            <div className="brutalist-card no-lift p-5 flex items-center justify-between">
              <div>
                <p className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30 mb-1">Net Balance</p>
                <p className="font-mono-main text-2xl font-black" style={{ color: netDebts > 0 ? 'var(--forest)' : netDebts < 0 ? 'var(--rust)' : 'var(--ink)' }}>
                  {netDebts >= 0 ? '+' : ''}{formatEGP(netDebts)}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="font-mono-main text-xs text-forest font-bold">+{formatEGP(totalDebtsOwedToMe)}</p>
                <p className="font-mono-main text-xs text-rust font-bold">-{formatEGP(totalDebtsOwedByMe)}</p>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <p className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30">Debts</p>
              <button
                onClick={() => setShowAddDebtModal(true)}
                className="btn-brutalist flex items-center gap-2 font-mono-main text-xs uppercase py-2 px-4 cursor-pointer"
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {(!debts || debts.length === 0) ? (
              <div className="border border-dashed border-ink/15 py-12 text-center">
                <p className="font-mono-main text-xs text-ink/25">No debts logged.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {debts.map(debt => (
                  <div
                    key={debt.id}
                    className="brutalist-card no-lift p-5 flex items-center justify-between group relative bg-paper-dark"
                    style={{ borderLeft: `3px solid ${debt.type === 'owed_to_me' ? 'var(--forest)' : 'var(--rust)'}` }}
                  >
                    <button
                      onClick={() => handleRemoveDebt(debt.id)}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-ink/25 hover:text-rust transition-all cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>

                    <div>
                      <p className="font-sans-main text-sm font-black text-ink">{debt.personName}</p>
                      {debt.notes && <p className="font-mono-main text-[10px] text-ink/35 mt-0.5 italic">{debt.notes}</p>}
                    </div>

                    <div className="text-right pr-6">
                      <p className="font-mono-main text-base font-black" style={{ color: debt.type === 'owed_to_me' ? 'var(--forest)' : 'var(--rust)' }}>
                        {debt.type === 'owed_to_me' ? '+' : '-'}{formatEGP(debt.amount)}
                      </p>
                      <p className="font-mono-main text-[9px] text-ink/25 mt-0.5">
                        {debt.type === 'owed_to_me' ? 'Receivable' : 'Payable'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ANALYSIS TAB */}
        {activeTab === 'analysis' && (
          <div className="space-y-6">
            {/* Split profiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'مرتب', split: SALARY_SPLIT },
                { label: 'فريلانس', split: FREELANCE_SPLIT },
              ].map(({ label, split }) => (
                <div key={label} className="brutalist-card no-lift p-5 bg-paper-dark space-y-4">
                  <p className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30">{label}</p>
                  <div className="space-y-3">
                    {Object.entries(split).map(([key, pct]) => {
                      const meta = BUCKET_META[key as keyof FinanceBuckets];
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between font-mono-main text-[11px] font-bold">
                            <span className="text-ink/60">{meta?.en || key}</span>
                            <span className="text-ink/40">{Math.round(pct * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-ink/8">
                            <div className="h-full" style={{ width: `${pct * 100}%`, backgroundColor: meta?.accent || 'var(--ink)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Transactions */}
            <p className="font-mono-main text-[9px] uppercase tracking-[0.25em] text-ink/30">Recent Transactions</p>
            {transactions.length === 0 ? (
              <div className="border border-dashed border-ink/15 py-12 text-center">
                <p className="font-mono-main text-xs text-ink/25">No transactions recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 30).map(tx => (
                  <div key={tx.id} className="brutalist-card no-lift p-4 flex items-center justify-between bg-paper-dark">
                    <div className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tx.type === 'debit' ? 'var(--rust)' : 'var(--forest)' }} />
                      <div>
                        <p className="font-mono-main text-xs font-bold text-ink">{translateArabicText(tx.description)}</p>
                        <p className="font-mono-main text-[9px] text-ink/30 mt-0.5">
                          {tx.bank} · {new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <p className="font-mono-main text-sm font-black" style={{ color: tx.type === 'debit' ? 'var(--rust)' : 'var(--forest)' }}>
                      {tx.type === 'debit' ? '−' : '+'}{formatEGP(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

      {/* ADD GOLD MODAL */}
      <AnimatePresence>
        {showAddGoldModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-paper/45 backdrop-blur-md" onClick={() => setShowAddGoldModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md border-4 border-ink bg-paper-dark shadow-[12px_12px_0px_0px_var(--ink)] p-10 z-10"
            >
              <div className="flex items-start justify-between mb-8">
                <h3 className="font-sans-main text-2xl font-black uppercase tracking-tight text-ink">
                  Add Gold Asset
                </h3>
                <button onClick={() => setShowAddGoldModal(false)} className="text-ink/35 hover:text-ink cursor-pointer transition-colors p-1">
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <form onSubmit={handleAddGold} className="space-y-5">
                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Weight in Grams
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="e.g. 10.500"
                    value={newGoldQty}
                    onChange={e => setNewGoldQty(e.target.value)}
                    className="w-full bg-paper border-2 border-ink p-3 font-mono-main text-sm outline-none focus:bg-paper-dark transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Carat Type
                  </label>
                  <div className="flex gap-4">
                    {([24, 21] as const).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewGoldCarat(c)}
                        className={`flex-1 py-3.5 border-2 font-mono-main text-sm font-black transition-all duration-150 relative cursor-pointer ${
                          newGoldCarat === c
                            ? 'border-ink bg-ink text-paper shadow-[3px_3px_0_0_var(--ink)]'
                            : 'border-ink/20 text-ink/40 hover:border-ink/50 bg-paper'
                        }`}
                      >
                        {c}K
                        {newGoldCarat === c && (
                          <span className="absolute top-1.5 right-2 text-[8px] bg-forest text-paper px-1.5 py-0.5 font-bold rounded-sm">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Purchase Price (per gram) — EGP
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={goldPrices ? `Current: ${newGoldCarat === 24 ? goldPrices.price24 : goldPrices.price21}` : 'e.g. 3800'}
                    value={newGoldPurchasePrice}
                    onChange={e => setNewGoldPurchasePrice(e.target.value)}
                    className="w-full bg-paper border-2 border-ink p-3 font-mono-main text-sm outline-none focus:bg-paper-dark transition-colors"
                  />
                  {goldPrices && !newGoldPurchasePrice && (
                    <p className="font-mono-main text-[9px] text-ink/30 mt-1">
                      Will auto-save current spot price ({formatEGP(newGoldCarat === 24 ? goldPrices.price24 : goldPrices.price21)} / g)
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Notes / Label
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={newGoldNotes}
                    onChange={e => setNewGoldNotes(e.target.value)}
                    className="w-full bg-paper border-2 border-ink p-3 font-mono-main text-sm outline-none focus:bg-paper-dark transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full btn-brutalist justify-center py-4 text-xs font-mono-main font-bold uppercase tracking-widest mt-6 cursor-pointer"
                >
                  Add Asset
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD SUBSCRIPTION MODAL */}
      <AnimatePresence>
        {showAddSubModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-paper/45 backdrop-blur-md" onClick={() => setShowAddSubModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md border-4 border-ink bg-paper-dark shadow-[12px_12px_0px_0px_var(--ink)] p-10 z-10"
            >
              <div className="flex items-start justify-between mb-8">
                <h3 className="font-sans-main text-2xl font-black uppercase tracking-tight text-ink">
                  Add Subscription
                </h3>
                <button onClick={() => setShowAddSubModal(false)} className="text-ink/35 hover:text-ink cursor-pointer transition-colors p-1">
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <form onSubmit={handleAddSub} className="space-y-5">
                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Subscription Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Netflix, Spotify"
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    className="w-full bg-paper border-2 border-ink p-3 font-mono-main text-sm outline-none focus:bg-paper-dark transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Monthly Cost (EGP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 250"
                    value={newSubCost}
                    onChange={e => setNewSubCost(e.target.value)}
                    className="w-full bg-paper border-2 border-ink p-3 font-mono-main text-sm outline-none focus:bg-paper-dark transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Renewal Day of Month (1 - 31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="e.g. 15"
                    value={newSubDay}
                    onChange={e => setNewSubDay(e.target.value)}
                    className="w-full bg-paper border-2 border-ink p-3 font-mono-main text-sm outline-none focus:bg-paper-dark transition-colors"
                    required
                  />
                </div>

                {/* Custom Branded Dropdown */}
                <div className="relative">
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Payment Account
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBankDropdown(!showBankDropdown)}
                    className="w-full bg-paper border-2 border-ink p-3 text-left font-mono-main text-xs font-bold flex justify-between items-center cursor-pointer hover:bg-paper-dark transition-colors"
                  >
                    <span>{BANK_LABELS[newSubBank]}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  <AnimatePresence>
                    {showBankDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute left-0 right-0 mt-1.5 border-2 border-ink bg-paper-dark z-50 shadow-[6px_6px_0_0_var(--ink)]"
                      >
                        {(Object.keys(BANK_LABELS) as Array<keyof FinanceBanks>).map(bk => (
                          <button
                            key={bk}
                            type="button"
                            onClick={() => { setNewSubBank(bk); setShowBankDropdown(false); }}
                            className="w-full p-3 text-left font-mono-main text-xs hover:bg-ink/5 border-b border-ink/10 last:border-0 cursor-pointer block transition-colors"
                          >
                            {BANK_LABELS[bk]}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="submit"
                  className="w-full btn-brutalist justify-center py-4 text-xs font-mono-main font-bold uppercase tracking-widest mt-6 cursor-pointer"
                >
                  Add Subscription
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD DEBT ENTRY MODAL */}
      <AnimatePresence>
        {showAddDebtModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-paper/45 backdrop-blur-md" onClick={() => setShowAddDebtModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md border-4 border-ink bg-paper-dark shadow-[12px_12px_0px_0px_var(--ink)] p-10 z-10"
            >
              <div className="flex items-start justify-between mb-8">
                <h3 className="font-sans-main text-2xl font-black uppercase tracking-tight text-ink">
                  Record Debt Entry
                </h3>
                <button onClick={() => setShowAddDebtModal(false)} className="text-ink/35 hover:text-ink cursor-pointer transition-colors p-1">
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <form onSubmit={handleAddDebt} className="space-y-5">
                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Counterparty Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aly, Hamed"
                    value={newDebtName}
                    onChange={e => setNewDebtName(e.target.value)}
                    className="w-full bg-paper border-2 border-ink p-3 font-mono-main text-sm outline-none focus:bg-paper-dark transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Amount (EGP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={newDebtAmount}
                    onChange={e => setNewDebtAmount(e.target.value)}
                    className="w-full bg-paper border-2 border-ink p-3 font-mono-main text-sm outline-none focus:bg-paper-dark transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Ledger Category
                  </label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setNewDebtType('owed_to_me')}
                      className={`flex-1 py-3 border-2 font-mono-main text-xs font-black transition-all duration-150 cursor-pointer ${
                        newDebtType === 'owed_to_me'
                          ? 'border-forest bg-forest/10 text-forest shadow-[2px_2px_0_0_var(--forest)]'
                          : 'border-ink/20 text-ink/50 bg-paper'
                      }`}
                    >
                      Owed to Me
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDebtType('owed_by_me')}
                      className={`flex-1 py-3 border-2 font-mono-main text-xs font-black transition-all duration-150 cursor-pointer ${
                        newDebtType === 'owed_by_me'
                          ? 'border-rust bg-rust/10 text-rust shadow-[2px_2px_0_0_var(--rust)]'
                          : 'border-ink/20 text-ink/50 bg-paper'
                      }`}
                    >
                      I Owe Them
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-sans-main text-[11px] font-black uppercase tracking-wider text-ink/65 mb-1.5 block">
                    Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dinner cash back"
                    value={newDebtNotes}
                    onChange={e => setNewDebtNotes(e.target.value)}
                    className="w-full bg-paper border-2 border-ink p-3 font-mono-main text-sm outline-none focus:bg-paper-dark transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full btn-brutalist justify-center py-4 text-xs font-mono-main font-bold uppercase tracking-widest mt-6 cursor-pointer"
                >
                  Log Debt
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
