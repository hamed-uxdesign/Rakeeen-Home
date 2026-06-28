import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Inbox, X, Banknote, Wallet, Trash2, Plus, Minus, Pencil } from 'lucide-react';
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
  tawarr2:  { en: 'Emergency', pct: '10%', accent: 'var(--rust)' },
  mustaqbal:{ en: 'Future',    pct: '90%', accent: 'var(--forest)' },
  basmala:  { en: 'Basmala',   pct: '—',   accent: 'var(--ink-faded)' },
  sadaqa:   { en: 'Sadaqa',    pct: '—',   accent: '#B89228' },
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

function getSplitRows(amount: number, category: Category | null) {
  if (!category || category === 'Transfer' || category === 'Ignore') return null;
  const split = category === 'Salary' ? SALARY_SPLIT : FREELANCE_SPLIT;
  return Object.entries(split).map(([key, pct]) => ({
    label: BUCKET_META[key as keyof FinanceBuckets]?.en ?? key,
    pct: Math.round(pct * 100),
    amount: Math.round(amount * pct),
  }));
}

function formatEGP(n: number) {
  return `${Math.round(n).toLocaleString('en-EG')} EGP`;
}



export const Finance: React.FC<FinanceProps> = ({ navigate }) => {
  const {
    banks, buckets, pendingItems,
    totalPhysical, totalVirtual,
    gold, setGold,
    subscriptions, setSubscriptions,
    debts, setDebts,
    classifyDeposit, ignorePending,
    updateBankBalance, updateBucketBalance,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<'overview' | 'buckets' | 'gold' | 'subscriptions' | 'debts'>('overview');
  const [classifyState, setClassifyState] = useState<ClassifyState | null>(null);


  const [confirming, setConfirming] = useState(false);

  // Modals Visibility
  const [showAddGoldModal, setShowAddGoldModal] = useState(false);
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [showAddDepositModal, setShowAddDepositModal] = useState(false);

  // Edit modals
  const [editingGold, setEditingGold] = useState<GoldAsset | null>(null);
  const [editingGoldQty, setEditingGoldQty] = useState('');
  const [editingGoldCarat, setEditingGoldCarat] = useState<24 | 21>(24);
  const [editingGoldNotes, setEditingGoldNotes] = useState('');
  const [editingGoldPrice, setEditingGoldPrice] = useState('');

  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editingSubName, setEditingSubName] = useState('');
  const [editingSubCost, setEditingSubCost] = useState('');
  const [editingSubDay, setEditingSubDay] = useState('');
  const [editingSubTime, setEditingSubTime] = useState('09:00');
  const [editingSubBank, setEditingSubBank] = useState<keyof FinanceBanks>('cib');

  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editingDebtName, setEditingDebtName] = useState('');
  const [editingDebtAmount, setEditingDebtAmount] = useState('');
  const [editingDebtType, setEditingDebtType] = useState<'owed_to_me' | 'owed_by_me'>('owed_to_me');
  const [editingDebtNotes, setEditingDebtNotes] = useState('');

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
  const [newSubTime, setNewSubTime] = useState('09:00');
  const [newSubBank, setNewSubBank] = useState<keyof FinanceBanks>('cib');

  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [newDebtType, setNewDebtType] = useState<'owed_to_me' | 'owed_by_me'>('owed_to_me');
  const [newDebtNotes, setNewDebtNotes] = useState('');

  const [newDepositAmount, setNewDepositAmount] = useState('');
  const [newDepositBank, setNewDepositBank] = useState<keyof FinanceBanks>('cib');
  const [newDepositCategory, setNewDepositCategory] = useState<'Salary' | 'Freelance'>('Salary');
  const [depositMode, setDepositMode] = useState<'split' | 'manual'>('split');
  const [manualTarget, setManualTarget] = useState<{ type: 'bank' | 'bucket'; key: string }>({ type: 'bucket', key: 'mustaqbal' });

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawTarget, setWithdrawTarget] = useState<{ type: 'bank' | 'bucket'; key: string }>({ type: 'bucket', key: 'mustaqbal' });

  React.useEffect(() => { document.title = 'Rakeeen — Finance'; }, []);

  useEffect(() => {
    if (showAddDepositModal || showWithdrawModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showAddDepositModal, showWithdrawModal]);

  // Fetch Gold Prices with 30s auto-refresh when tab is active
  useEffect(() => {
    let intervalId: any;

    const fetchPrices = (showLoader = false) => {
      if (showLoader) setLoadingGold(true);
      // @ts-ignore
      const apiKey = import.meta.env.VITE_GOLD_API_KEY as string | undefined;
      if (!apiKey) {
        console.warn('VITE_GOLD_API_KEY not set');
        setGoldPrices(prev => prev || { price24: 0, price21: 0 });
        if (showLoader) setLoadingGold(false);
        return;
      }
      fetch('https://www.goldapi.io/api/XAU/EGP', {
        headers: { 'x-access-token': apiKey, 'Content-Type': 'application/json' },
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('goldapi error ' + res.status);
        })
        .then(data => {
          const price24 = Math.round(data.price_gram_24k);
          const price21 = Math.round(data.price_gram_21k);
          setGoldPrices({ price24, price21 });
        })
        .catch(err => {
          console.error(err);
          setGoldPrices(prev => prev || { price24: 0, price21: 0 });
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
      ...(newGoldNotes.trim() ? { notes: newGoldNotes.trim() } : {}),
      ...(purchasePrice !== undefined ? { purchasePrice } : {}),
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

  const openEditGold = (g: GoldAsset) => {
    setEditingGold(g);
    setEditingGoldQty(String(g.quantity));
    setEditingGoldCarat(g.carat);
    setEditingGoldNotes(g.notes || '');
    setEditingGoldPrice(g.purchasePrice ? String(g.purchasePrice) : '');
  };
  const handleSaveGold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGold) return;
    const { notes: _n, purchasePrice: _p, ...base } = editingGold;
    const updated: GoldAsset = {
      ...base,
      quantity: parseFloat(editingGoldQty),
      carat: editingGoldCarat,
      ...(editingGoldNotes.trim() ? { notes: editingGoldNotes.trim() } : {}),
      ...(editingGoldPrice ? { purchasePrice: parseFloat(editingGoldPrice) } : {}),
    };
    await setGold((gold || []).map(g => g.id === editingGold.id ? updated : g));
    setEditingGold(null);
  };

  const openEditSub = (sub: Subscription) => {
    setEditingSub(sub);
    setEditingSubName(sub.name);
    setEditingSubCost(String(sub.cost));
    setEditingSubDay(String(sub.renewalDay));
    setEditingSubTime(sub.reminderTime || '09:00');
    const bankKey = (Object.keys(BANK_LABELS) as Array<keyof FinanceBanks>).find(k => BANK_LABELS[k] === sub.bank) || 'cib';
    setEditingSubBank(bankKey);
  };
  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    const updated: Subscription = { ...editingSub, name: editingSubName.trim(), cost: parseFloat(editingSubCost), renewalDay: parseInt(editingSubDay), reminderTime: editingSubTime, bank: BANK_LABELS[editingSubBank] };
    await setSubscriptions((subscriptions || []).map(s => s.id === editingSub.id ? updated : s));
    setEditingSub(null);
  };

  const openEditDebt = (d: Debt) => {
    setEditingDebt(d);
    setEditingDebtName(d.personName);
    setEditingDebtAmount(String(d.amount));
    setEditingDebtType(d.type);
    setEditingDebtNotes(d.notes || '');
  };
  const handleSaveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;
    const updated: Debt = { ...editingDebt, personName: editingDebtName.trim(), amount: parseFloat(editingDebtAmount), type: editingDebtType, notes: editingDebtNotes };
    await setDebts((debts || []).map(d => d.id === editingDebt.id ? updated : d));
    setEditingDebt(null);
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
      reminderTime: newSubTime || '09:00',
      bank: BANK_LABELS[newSubBank]
    };
    await setSubscriptions([...(subscriptions || []), sub]);
    setNewSubName('');
    setNewSubCost('');
    setNewSubDay('');
    setNewSubTime('09:00');
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

  // Deposit operations
  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newDepositAmount);
    if (!amount || amount <= 0) return;

    if (depositMode === 'split') {
      const split = newDepositCategory === 'Salary' ? SALARY_SPLIT : FREELANCE_SPLIT;
      await updateBankBalance(newDepositBank, (banks?.[newDepositBank] || 0) + amount);
      for (const [key, pct] of Object.entries(split)) {
        if (pct > 0) {
          const k = key as keyof FinanceBuckets;
          await updateBucketBalance(k, Math.round(((buckets?.[k] || 0) + amount * pct) * 100) / 100);
        }
      }
    } else {
      if (manualTarget.type === 'bank') {
        const k = manualTarget.key as keyof FinanceBanks;
        await updateBankBalance(k, (banks?.[k] || 0) + amount);
      } else {
        const k = manualTarget.key as keyof FinanceBuckets;
        await updateBucketBalance(k, Math.round(((buckets?.[k] || 0) + amount) * 100) / 100);
      }
    }

    setNewDepositAmount('');
    setNewDepositBank('cib');
    setNewDepositCategory('Salary');
    setDepositMode('split');
    setShowAddDepositModal(false);
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return;

    if (withdrawTarget.type === 'bank') {
      const k = withdrawTarget.key as keyof FinanceBanks;
      await updateBankBalance(k, Math.round(((banks?.[k] || 0) - amount) * 100) / 100);
    } else {
      const k = withdrawTarget.key as keyof FinanceBuckets;
      await updateBucketBalance(k, Math.round(((buckets?.[k] || 0) - amount) * 100) / 100);
    }

    setWithdrawAmount('');
    setShowWithdrawModal(false);
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
          {(['overview', 'buckets', 'gold', 'subscriptions', 'debts'] as const).map(tab => (
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
            {/* ADD / WITHDRAW BUTTONS */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="flex items-center gap-2 font-mono-main text-xs uppercase py-2.5 px-5 cursor-pointer border border-ink/30 text-ink/60 hover:text-ink hover:border-ink transition-colors bg-transparent"
              >
                <Minus size={13} /> Withdraw
              </button>
              <button
                onClick={() => setShowAddDepositModal(true)}
                className="btn-brutalist flex items-center gap-2 font-mono-main text-xs uppercase py-2.5 px-5 cursor-pointer"
              >
                <Plus size={13} /> Add Deposit
              </button>
            </div>

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

              {/* 2. THE OTHER 3 BUCKETS - GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(['tawarr2', 'basmala', 'sadaqa'] as Array<keyof FinanceBuckets>).map(key => {
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
                      <div className="absolute inset-y-0 right-4 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => openEditGold(g)} className="text-ink/25 hover:text-ink transition-colors cursor-pointer"><Pencil size={12} /></button>
                        <button onClick={() => handleRemoveGold(g.id)} className="text-ink/25 hover:text-rust transition-colors cursor-pointer"><Trash2 size={12} /></button>
                      </div>

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
                      <div className="absolute inset-y-0 right-4 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => openEditSub(sub)} className="text-ink/25 hover:text-ink transition-colors cursor-pointer"><Pencil size={12} /></button>
                        <button onClick={() => handleRemoveSub(sub.id)} className="text-ink/25 hover:text-rust transition-colors cursor-pointer"><Trash2 size={12} /></button>
                      </div>

                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-sans-main text-sm font-black text-ink">{sub.name}</p>
                          <p className="font-mono-main text-[10px] text-ink/35 mt-0.5">{sub.bank} · Day {sub.renewalDay}{sub.reminderTime ? ` · ${sub.reminderTime}` : ''}</p>
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
                <p className="font-mono-main text-xs text-ink/60 font-bold">↑ {formatEGP(totalDebtsOwedToMe)}</p>
                <p className="font-mono-main text-xs text-ink/40 font-bold">↓ {formatEGP(totalDebtsOwedByMe)}</p>
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
                    style={{ borderLeft: `3px solid var(--ink)`, opacity: debt.type === 'owed_by_me' ? 0.6 : 1 }}
                  >
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => openEditDebt(debt)} className="text-ink/25 hover:text-ink transition-colors cursor-pointer"><Pencil size={12} /></button>
                      <button onClick={() => handleRemoveDebt(debt.id)} className="text-ink/25 hover:text-rust transition-colors cursor-pointer"><Trash2 size={12} /></button>
                    </div>

                    <div>
                      <p className="font-sans-main text-sm font-black text-ink">{debt.personName}</p>
                      {debt.notes && <p className="font-mono-main text-[10px] text-ink/35 mt-0.5 italic">{debt.notes}</p>}
                    </div>

                    <div className="text-right pr-6">
                      <p className="font-mono-main text-base font-black text-ink">
                        {debt.type === 'owed_to_me' ? '+' : '−'}{formatEGP(debt.amount)}
                      </p>
                      <p className="font-mono-main text-[9px] text-ink/25 mt-0.5 uppercase tracking-widest">
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

      </div>

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

      {/* ADD GOLD MODAL */}
      <AnimatePresence>
        {showAddGoldModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/90" onClick={() => setShowAddGoldModal(false)} />
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm z-10"
              style={{ background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}
            >
              <div className="flex items-center justify-between px-8 pt-8 pb-7" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                <h3 className="font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 14, color: 'var(--ink)' }}>Add Gold Asset</h3>
                <button onClick={() => setShowAddGoldModal(false)} className="cursor-pointer transition-opacity" style={{ color: 'var(--ink)', opacity: 0.35 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}>
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              <form onSubmit={handleAddGold}>
                <div className="px-8 pt-7 pb-7" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Weight in Grams</label>
                    <input type="number" step="0.001" placeholder="e.g. 10.500" value={newGoldQty} onChange={e => setNewGoldQty(e.target.value)} required autoFocus
                      className="w-full font-mono-main font-bold outline-none transition-colors"
                      style={{ padding: '14px 16px', fontSize: 20, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                    />
                  </div>

                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Carat</label>
                    <div className="flex" style={{ border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
                      {([24, 21] as const).map((c, i) => (
                        <button key={c} type="button" onClick={() => setNewGoldCarat(c)}
                          className="cursor-pointer flex-1 font-sans-main font-bold uppercase tracking-wide transition-colors"
                          style={{ fontSize: 13, padding: '14px 0', borderRight: i === 0 ? '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' : 'none', background: newGoldCarat === c ? '#7A9E1A' : 'transparent', color: newGoldCarat === c ? '#000' : 'color-mix(in srgb, var(--ink) 35%, transparent)' }}
                        >{c}K</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Purchase Price / gram — EGP</label>
                    <input type="number" step="0.01"
                      placeholder={goldPrices ? `Current: ${newGoldCarat === 24 ? goldPrices.price24 : goldPrices.price21}` : 'e.g. 3800'}
                      value={newGoldPurchasePrice} onChange={e => setNewGoldPurchasePrice(e.target.value)}
                      className="w-full font-mono-main outline-none transition-colors"
                      style={{ padding: '12px 16px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                    />
                    {goldPrices && !newGoldPurchasePrice && (
                      <p className="font-mono-main mt-2" style={{ fontSize: 9, color: 'color-mix(in srgb, var(--ink) 25%, transparent)' }}>
                        Auto-saves spot price ({formatEGP(newGoldCarat === 24 ? goldPrices.price24 : goldPrices.price21)} / g)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Notes / Label <span style={{ opacity: 0.5 }}>(optional)</span></label>
                    <input type="text" placeholder="Optional" value={newGoldNotes} onChange={e => setNewGoldNotes(e.target.value)}
                      className="w-full font-mono-main outline-none transition-colors"
                      style={{ padding: '12px 16px', fontSize: 14, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                  <button type="submit" className="cursor-pointer w-full font-sans-main font-black uppercase tracking-wide transition-colors"
                    style={{ fontSize: 13, padding: '20px 0', background: '#7A9E1A', color: '#000', border: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#8BB520')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#7A9E1A')}
                  >Add Asset</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD SUBSCRIPTION MODAL */}
      <AnimatePresence>
        {showAddSubModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/90" onClick={() => setShowAddSubModal(false)} />
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm z-10"
              style={{ background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}
            >
              <div className="flex items-center justify-between px-8 pt-8 pb-7" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                <h3 className="font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 14, color: 'var(--ink)' }}>Add Subscription</h3>
                <button onClick={() => setShowAddSubModal(false)} className="cursor-pointer transition-opacity" style={{ color: 'var(--ink)', opacity: 0.35 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}>
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              <form onSubmit={handleAddSub}>
                <div className="px-8 pt-7 pb-7" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Name</label>
                    <input type="text" placeholder="e.g. Netflix, Spotify" value={newSubName} onChange={e => setNewSubName(e.target.value)} required autoFocus
                      className="w-full font-mono-main outline-none transition-colors"
                      style={{ padding: '12px 16px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                    />
                  </div>

                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Monthly Cost — EGP</label>
                    <input type="number" step="0.01" placeholder="e.g. 250" value={newSubCost} onChange={e => setNewSubCost(e.target.value)} required
                      className="w-full font-mono-main font-bold outline-none transition-colors"
                      style={{ padding: '14px 16px', fontSize: 22, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Renewal Day</label>
                      <input type="number" min="1" max="31" placeholder="e.g. 15" value={newSubDay} onChange={e => setNewSubDay(e.target.value)} required
                        className="w-full font-mono-main outline-none transition-colors"
                        style={{ padding: '12px 14px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                      />
                    </div>
                    <div>
                      <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Reminder Time</label>
                      <input type="time" value={newSubTime} onChange={e => setNewSubTime(e.target.value)} required
                        className="w-full font-mono-main outline-none transition-colors"
                        style={{ padding: '12px 14px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Payment Account</label>
                    <button type="button" onClick={() => setShowBankDropdown(!showBankDropdown)}
                      className="w-full font-mono-main font-bold text-left flex justify-between items-center cursor-pointer transition-colors"
                      style={{ padding: '12px 16px', fontSize: 13, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                    >
                      <span>{BANK_LABELS[newSubBank]}</span>
                      <span style={{ fontSize: 9, opacity: 0.4 }}>▼</span>
                    </button>
                    <AnimatePresence>
                      {showBankDropdown && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          className="absolute left-0 right-0 z-50"
                          style={{ top: '100%', marginTop: 2, background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 20%, transparent)' }}
                        >
                          {(Object.keys(BANK_LABELS) as Array<keyof FinanceBanks>).map(bk => (
                            <button key={bk} type="button" onClick={() => { setNewSubBank(bk); setShowBankDropdown(false); }}
                              className="w-full text-left font-mono-main cursor-pointer block transition-colors"
                              style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink)', borderBottom: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)', background: 'transparent' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--ink) 6%, transparent)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >{BANK_LABELS[bk]}</button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                  <button type="submit" className="cursor-pointer w-full font-sans-main font-black uppercase tracking-wide transition-colors"
                    style={{ fontSize: 13, padding: '20px 0', background: '#7A9E1A', color: '#000', border: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#8BB520')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#7A9E1A')}
                  >Add Subscription</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD DEBT ENTRY MODAL */}
      <AnimatePresence>
        {showAddDebtModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/90" onClick={() => setShowAddDebtModal(false)} />
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm z-10"
              style={{ background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}
            >
              <div className="flex items-center justify-between px-8 pt-8 pb-7" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                <h3 className="font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 14, color: 'var(--ink)' }}>Log Debt</h3>
                <button onClick={() => setShowAddDebtModal(false)} className="cursor-pointer transition-opacity" style={{ color: 'var(--ink)', opacity: 0.35 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}>
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              <form onSubmit={handleAddDebt}>
                <div className="px-8 pt-7 pb-7" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Type toggle */}
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Type</label>
                    <div className="flex" style={{ border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
                      {(['owed_to_me', 'owed_by_me'] as const).map((t, i) => (
                        <button key={t} type="button" onClick={() => setNewDebtType(t)}
                          className="cursor-pointer flex-1 font-sans-main font-bold uppercase tracking-wide transition-colors"
                          style={{ fontSize: 11, padding: '14px 0', borderRight: i === 0 ? '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' : 'none', background: newDebtType === t ? '#7A9E1A' : 'transparent', color: newDebtType === t ? '#000' : 'color-mix(in srgb, var(--ink) 35%, transparent)' }}
                        >{t === 'owed_to_me' ? 'Owed to Me' : 'I Owe Them'}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Name</label>
                    <input type="text" placeholder="e.g. Aly, Hamed" value={newDebtName} onChange={e => setNewDebtName(e.target.value)} required autoFocus
                      className="w-full font-mono-main outline-none transition-colors"
                      style={{ padding: '12px 16px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                    />
                  </div>

                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Amount — EGP</label>
                    <input type="number" step="0.01" placeholder="0.00" value={newDebtAmount} onChange={e => setNewDebtAmount(e.target.value)} required
                      className="w-full font-mono-main font-bold outline-none transition-colors"
                      style={{ padding: '14px 16px', fontSize: 22, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                    />
                  </div>

                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Notes <span style={{ opacity: 0.5 }}>(optional)</span></label>
                    <input type="text" placeholder="e.g. Dinner cash back" value={newDebtNotes} onChange={e => setNewDebtNotes(e.target.value)}
                      className="w-full font-mono-main outline-none transition-colors"
                      style={{ padding: '12px 16px', fontSize: 14, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                  <button type="submit" className="cursor-pointer w-full font-sans-main font-black uppercase tracking-wide transition-colors"
                    style={{ fontSize: 13, padding: '20px 0', background: '#7A9E1A', color: '#000', border: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#8BB520')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#7A9E1A')}
                  >Log Debt</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD DEPOSIT MODAL */}
      <AnimatePresence>
        {showAddDepositModal && (() => {
          const split = newDepositCategory === 'Salary' ? SALARY_SPLIT : FREELANCE_SPLIT;
          const amt = parseFloat(newDepositAmount) || 0;
          const totalPct = Object.values(split).reduce((a, b) => a + b, 0);
          return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5" style={{ overflow: 'hidden' }}>
              <div className="absolute inset-0 bg-black/90" onClick={() => setShowAddDepositModal(false)} />
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full max-w-sm z-10"
                style={{ background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-8 pb-7" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                  <h3 className="font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 14, color: 'var(--ink)' }}>
                    Add Deposit
                  </h3>
                  <button
                    onClick={() => setShowAddDepositModal(false)}
                    className="cursor-pointer transition-opacity"
                    style={{ color: 'var(--ink)', opacity: 0.35 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>

                <form onSubmit={handleAddDeposit}>
                  <div className="px-8 pt-7 pb-7" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                    {/* Mode toggle: Split / Manual */}
                    <div className="flex" style={{ border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
                      {(['split', 'manual'] as const).map((m, i) => (
                        <button key={m} type="button" onClick={() => setDepositMode(m)}
                          className="cursor-pointer flex-1 font-sans-main font-bold uppercase tracking-wide transition-colors"
                          style={{ fontSize: 11, padding: '12px 0', borderRight: i === 0 ? '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' : 'none', background: depositMode === m ? '#7A9E1A' : 'transparent', color: depositMode === m ? '#000' : 'color-mix(in srgb, var(--ink) 35%, transparent)' }}
                        >{m === 'split' ? 'Auto Split' : 'Manual'}</button>
                      ))}
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>
                        Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono-main select-none" style={{ fontSize: 11, color: 'color-mix(in srgb, var(--ink) 25%, transparent)' }}>EGP</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={newDepositAmount}
                          onChange={e => setNewDepositAmount(e.target.value)}
                          required
                          autoFocus
                          className="w-full font-mono-main font-bold outline-none transition-colors"
                          style={{
                            paddingLeft: 50, paddingRight: 16, paddingTop: 16, paddingBottom: 16,
                            fontSize: 28,
                            background: 'color-mix(in srgb, var(--ink) 4%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)',
                            color: 'var(--ink)',
                          }}
                          onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                        />
                      </div>
                    </div>

                    {/* Split mode: Source + Bank + preview */}
                    {depositMode === 'split' && (<>
                      <div>
                        <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Source</label>
                        <div className="flex" style={{ border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
                          {(['Salary', 'Freelance'] as const).map((cat, i) => (
                            <button key={cat} type="button" onClick={() => setNewDepositCategory(cat)}
                              className="cursor-pointer flex-1 font-sans-main font-bold uppercase tracking-wide transition-colors"
                              style={{ fontSize: 12, padding: '16px 0', borderRight: i === 0 ? '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' : 'none', background: newDepositCategory === cat ? '#7A9E1A' : 'transparent', color: newDepositCategory === cat ? '#000' : 'color-mix(in srgb, var(--ink) 35%, transparent)' }}
                            >{cat}</button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Bank Account</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(Object.keys(BANK_LABELS) as Array<keyof FinanceBanks>).map(bk => (
                            <button key={bk} type="button" onClick={() => setNewDepositBank(bk)}
                              className="cursor-pointer font-sans-main font-bold uppercase tracking-wide transition-colors"
                              style={{ fontSize: 12, padding: '14px 0', border: newDepositBank === bk ? '1px solid color-mix(in srgb, var(--ink) 60%, transparent)' : '1px solid color-mix(in srgb, var(--ink) 12%, transparent)', background: newDepositBank === bk ? 'var(--ink)' : 'transparent', color: newDepositBank === bk ? 'var(--paper)' : 'color-mix(in srgb, var(--ink) 35%, transparent)' }}
                            >{BANK_LABELS[bk]}</button>
                          ))}
                        </div>
                      </div>

                      {amt > 0 && (
                        <div style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)', padding: '18px 20px' }}>
                          <p className="font-mono-main uppercase tracking-widest mb-4" style={{ fontSize: 9, color: 'color-mix(in srgb, var(--ink) 30%, transparent)' }}>Distribution</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {Object.entries(split).filter(([, p]) => p > 0).map(([key, pct]) => {
                              const meta = BUCKET_META[key as keyof FinanceBuckets];
                              return (
                                <div key={key} className="flex justify-between items-center">
                                  <span className="font-sans-main" style={{ fontSize: 12, color: 'color-mix(in srgb, var(--ink) 50%, transparent)' }}>
                                    {meta?.en} <span style={{ opacity: 0.5 }}>· {Math.round(pct * 100)}%</span>
                                  </span>
                                  <span className="font-mono-main font-bold" style={{ fontSize: 13, color: 'var(--ink)' }}>{formatEGP(amt * pct)}</span>
                                </div>
                              );
                            })}
                            {totalPct < 1 && (
                              <div className="flex justify-between pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}>
                                <span className="font-sans-main" style={{ fontSize: 11, color: 'color-mix(in srgb, var(--ink) 20%, transparent)' }}>Not allocated</span>
                                <span className="font-mono-main" style={{ fontSize: 11, color: 'color-mix(in srgb, var(--ink) 20%, transparent)' }}>{formatEGP(amt * (1 - totalPct))}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>)}

                    {/* Manual mode: pick bucket or bank */}
                    {depositMode === 'manual' && (
                      <div>
                        <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Destination</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <p className="font-mono-main uppercase tracking-widest" style={{ fontSize: 9, color: 'color-mix(in srgb, var(--ink) 25%, transparent)', marginBottom: 4 }}>Buckets</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(BUCKET_META) as Array<keyof FinanceBuckets>).map(bk => (
                              <button key={bk} type="button"
                                onClick={() => setManualTarget({ type: 'bucket', key: bk })}
                                className="cursor-pointer font-sans-main font-bold uppercase tracking-wide transition-colors text-left"
                                style={{ fontSize: 11, padding: '12px 14px', border: manualTarget.type === 'bucket' && manualTarget.key === bk ? '1px solid color-mix(in srgb, var(--ink) 60%, transparent)' : '1px solid color-mix(in srgb, var(--ink) 12%, transparent)', background: manualTarget.type === 'bucket' && manualTarget.key === bk ? 'var(--ink)' : 'transparent', color: manualTarget.type === 'bucket' && manualTarget.key === bk ? 'var(--paper)' : 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
                              >
                                <span style={{ display: 'block', fontSize: 10 }}>{BUCKET_META[bk].en}</span>
                                {buckets?.[bk] !== undefined && <span style={{ fontSize: 9, opacity: 0.6 }}>{formatEGP(buckets[bk])}</span>}
                              </button>
                            ))}
                          </div>
                          <p className="font-mono-main uppercase tracking-widest" style={{ fontSize: 9, color: 'color-mix(in srgb, var(--ink) 25%, transparent)', marginTop: 8, marginBottom: 4 }}>Banks</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(BANK_LABELS) as Array<keyof FinanceBanks>).map(bk => (
                              <button key={bk} type="button"
                                onClick={() => setManualTarget({ type: 'bank', key: bk })}
                                className="cursor-pointer font-sans-main font-bold uppercase tracking-wide transition-colors text-left"
                                style={{ fontSize: 11, padding: '12px 14px', border: manualTarget.type === 'bank' && manualTarget.key === bk ? '1px solid color-mix(in srgb, var(--ink) 60%, transparent)' : '1px solid color-mix(in srgb, var(--ink) 12%, transparent)', background: manualTarget.type === 'bank' && manualTarget.key === bk ? 'var(--ink)' : 'transparent', color: manualTarget.type === 'bank' && manualTarget.key === bk ? 'var(--paper)' : 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
                              >
                                <span style={{ display: 'block', fontSize: 10 }}>{BANK_LABELS[bk]}</span>
                                {banks?.[bk] !== undefined && <span style={{ fontSize: 9, opacity: 0.6 }}>{formatEGP(banks[bk])}</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer — Confirm only */}
                  <div style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                    <button
                      type="submit"
                      className="cursor-pointer w-full font-sans-main font-black uppercase tracking-wide transition-colors"
                      style={{ fontSize: 13, padding: '20px 0', background: '#7A9E1A', color: '#000', border: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#8BB520')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#7A9E1A')}
                    >
                      Confirm Deposit
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* WITHDRAW MODAL */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/90" onClick={() => setShowWithdrawModal(false)} />
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm z-10"
              style={{ background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}
            >
              <div className="flex items-center justify-between px-8 pt-8 pb-7" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                <h3 className="font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 14, color: 'var(--ink)' }}>Withdraw</h3>
                <button onClick={() => setShowWithdrawModal(false)} className="cursor-pointer transition-opacity" style={{ color: 'var(--ink)', opacity: 0.35 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}>
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              <form onSubmit={handleWithdraw}>
                <div className="px-8 pt-7 pb-7" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Amount */}
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono-main select-none" style={{ fontSize: 11, color: 'color-mix(in srgb, var(--ink) 25%, transparent)' }}>EGP</span>
                      <input type="number" step="0.01" placeholder="0.00" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} required autoFocus
                        className="w-full font-mono-main font-bold outline-none transition-colors"
                        style={{ paddingLeft: 50, paddingRight: 16, paddingTop: 16, paddingBottom: 16, fontSize: 28, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')}
                      />
                    </div>
                  </div>

                  {/* From */}
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>From</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <p className="font-mono-main uppercase tracking-widest" style={{ fontSize: 9, color: 'color-mix(in srgb, var(--ink) 25%, transparent)', marginBottom: 4 }}>Buckets</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(BUCKET_META) as Array<keyof FinanceBuckets>).map(bk => (
                          <button key={bk} type="button"
                            onClick={() => setWithdrawTarget({ type: 'bucket', key: bk })}
                            className="cursor-pointer font-sans-main font-bold uppercase tracking-wide transition-colors text-left"
                            style={{ fontSize: 11, padding: '12px 14px', border: withdrawTarget.type === 'bucket' && withdrawTarget.key === bk ? '1px solid color-mix(in srgb, var(--ink) 60%, transparent)' : '1px solid color-mix(in srgb, var(--ink) 12%, transparent)', background: withdrawTarget.type === 'bucket' && withdrawTarget.key === bk ? 'var(--ink)' : 'transparent', color: withdrawTarget.type === 'bucket' && withdrawTarget.key === bk ? 'var(--paper)' : 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
                          >
                            <span style={{ display: 'block', fontSize: 10 }}>{BUCKET_META[bk].en}</span>
                            {buckets?.[bk] !== undefined && <span style={{ fontSize: 9, opacity: 0.6 }}>{formatEGP(buckets[bk])}</span>}
                          </button>
                        ))}
                      </div>
                      <p className="font-mono-main uppercase tracking-widest" style={{ fontSize: 9, color: 'color-mix(in srgb, var(--ink) 25%, transparent)', marginTop: 8, marginBottom: 4 }}>Banks</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(BANK_LABELS) as Array<keyof FinanceBanks>).map(bk => (
                          <button key={bk} type="button"
                            onClick={() => setWithdrawTarget({ type: 'bank', key: bk })}
                            className="cursor-pointer font-sans-main font-bold uppercase tracking-wide transition-colors text-left"
                            style={{ fontSize: 11, padding: '12px 14px', border: withdrawTarget.type === 'bank' && withdrawTarget.key === bk ? '1px solid color-mix(in srgb, var(--ink) 60%, transparent)' : '1px solid color-mix(in srgb, var(--ink) 12%, transparent)', background: withdrawTarget.type === 'bank' && withdrawTarget.key === bk ? 'var(--ink)' : 'transparent', color: withdrawTarget.type === 'bank' && withdrawTarget.key === bk ? 'var(--paper)' : 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
                          >
                            <span style={{ display: 'block', fontSize: 10 }}>{BANK_LABELS[bk]}</span>
                            {banks?.[bk] !== undefined && <span style={{ fontSize: 9, opacity: 0.6 }}>{formatEGP(banks[bk])}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                  <button type="submit" className="cursor-pointer w-full font-sans-main font-black uppercase tracking-wide transition-colors"
                    style={{ fontSize: 13, padding: '20px 0', background: 'var(--rust)', color: 'var(--paper)', border: 'none' }}
                  >
                    Confirm Withdrawal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT GOLD MODAL */}
      <AnimatePresence>
        {editingGold && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/90" onClick={() => setEditingGold(null)} />
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm z-10" style={{ background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
              <div className="flex items-center justify-between px-8 pt-8 pb-7" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                <h3 className="font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 14, color: 'var(--ink)' }}>Edit Gold</h3>
                <button onClick={() => setEditingGold(null)} className="cursor-pointer" style={{ color: 'var(--ink)', opacity: 0.35 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}><X size={16} strokeWidth={2} /></button>
              </div>
              <form onSubmit={handleSaveGold}>
                <div className="px-8 pt-7 pb-7" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Weight (g)</label>
                    <input type="number" step="0.001" value={editingGoldQty} onChange={e => setEditingGoldQty(e.target.value)} required autoFocus className="w-full font-mono-main font-bold outline-none transition-colors" style={{ padding: '14px 16px', fontSize: 22, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                  </div>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Carat</label>
                    <div className="flex" style={{ border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
                      {([24, 21] as const).map((c, i) => (
                        <button key={c} type="button" onClick={() => setEditingGoldCarat(c)} className="cursor-pointer flex-1 font-sans-main font-bold uppercase tracking-wide transition-colors" style={{ fontSize: 13, padding: '13px 0', borderRight: i === 0 ? '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' : 'none', background: editingGoldCarat === c ? '#7A9E1A' : 'transparent', color: editingGoldCarat === c ? '#000' : 'color-mix(in srgb, var(--ink) 35%, transparent)' }}>{c}K</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Purchase Price / g</label>
                    <input type="number" step="0.01" value={editingGoldPrice} onChange={e => setEditingGoldPrice(e.target.value)} placeholder="optional" className="w-full font-mono-main outline-none transition-colors" style={{ padding: '12px 16px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                  </div>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Notes</label>
                    <input type="text" value={editingGoldNotes} onChange={e => setEditingGoldNotes(e.target.value)} placeholder="optional" className="w-full font-mono-main outline-none transition-colors" style={{ padding: '12px 16px', fontSize: 14, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                  </div>
                </div>
                <div style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                  <button type="submit" className="cursor-pointer w-full font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 13, padding: '20px 0', background: '#7A9E1A', color: '#000', border: 'none' }} onMouseEnter={e => (e.currentTarget.style.background = '#8BB520')} onMouseLeave={e => (e.currentTarget.style.background = '#7A9E1A')}>Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT SUBSCRIPTION MODAL */}
      <AnimatePresence>
        {editingSub && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/90" onClick={() => setEditingSub(null)} />
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm z-10" style={{ background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
              <div className="flex items-center justify-between px-8 pt-8 pb-7" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                <h3 className="font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 14, color: 'var(--ink)' }}>Edit Subscription</h3>
                <button onClick={() => setEditingSub(null)} className="cursor-pointer" style={{ color: 'var(--ink)', opacity: 0.35 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}><X size={16} strokeWidth={2} /></button>
              </div>
              <form onSubmit={handleSaveSub}>
                <div className="px-8 pt-7 pb-7" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Name</label>
                    <input type="text" value={editingSubName} onChange={e => setEditingSubName(e.target.value)} required autoFocus className="w-full font-mono-main outline-none transition-colors" style={{ padding: '12px 16px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                  </div>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Monthly Cost — EGP</label>
                    <input type="number" step="0.01" value={editingSubCost} onChange={e => setEditingSubCost(e.target.value)} required className="w-full font-mono-main font-bold outline-none transition-colors" style={{ padding: '14px 16px', fontSize: 22, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Renewal Day</label>
                      <input type="number" min="1" max="31" value={editingSubDay} onChange={e => setEditingSubDay(e.target.value)} required className="w-full font-mono-main outline-none transition-colors" style={{ padding: '12px 14px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                    </div>
                    <div>
                      <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Time</label>
                      <input type="time" value={editingSubTime} onChange={e => setEditingSubTime(e.target.value)} required className="w-full font-mono-main outline-none transition-colors" style={{ padding: '12px 14px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                    </div>
                  </div>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Bank Account</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(BANK_LABELS) as Array<keyof FinanceBanks>).map(bk => (
                        <button key={bk} type="button" onClick={() => setEditingSubBank(bk)} className="cursor-pointer font-sans-main font-bold uppercase tracking-wide transition-colors" style={{ fontSize: 12, padding: '13px 0', border: editingSubBank === bk ? '1px solid color-mix(in srgb, var(--ink) 60%, transparent)' : '1px solid color-mix(in srgb, var(--ink) 12%, transparent)', background: editingSubBank === bk ? 'var(--ink)' : 'transparent', color: editingSubBank === bk ? 'var(--paper)' : 'color-mix(in srgb, var(--ink) 35%, transparent)' }}>{BANK_LABELS[bk]}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                  <button type="submit" className="cursor-pointer w-full font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 13, padding: '20px 0', background: '#7A9E1A', color: '#000', border: 'none' }} onMouseEnter={e => (e.currentTarget.style.background = '#8BB520')} onMouseLeave={e => (e.currentTarget.style.background = '#7A9E1A')}>Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT DEBT MODAL */}
      <AnimatePresence>
        {editingDebt && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
            <div className="absolute inset-0 bg-black/90" onClick={() => setEditingDebt(null)} />
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm z-10" style={{ background: 'var(--paper-dark)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
              <div className="flex items-center justify-between px-8 pt-8 pb-7" style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                <h3 className="font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 14, color: 'var(--ink)' }}>Edit Debt</h3>
                <button onClick={() => setEditingDebt(null)} className="cursor-pointer" style={{ color: 'var(--ink)', opacity: 0.35 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}><X size={16} strokeWidth={2} /></button>
              </div>
              <form onSubmit={handleSaveDebt}>
                <div className="px-8 pt-7 pb-7" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Type</label>
                    <div className="flex" style={{ border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' }}>
                      {(['owed_to_me', 'owed_by_me'] as const).map((t, i) => (
                        <button key={t} type="button" onClick={() => setEditingDebtType(t)} className="cursor-pointer flex-1 font-sans-main font-bold uppercase tracking-wide transition-colors" style={{ fontSize: 11, padding: '13px 0', borderRight: i === 0 ? '1px solid color-mix(in srgb, var(--ink) 15%, transparent)' : 'none', background: editingDebtType === t ? '#7A9E1A' : 'transparent', color: editingDebtType === t ? '#000' : 'color-mix(in srgb, var(--ink) 35%, transparent)' }}>{t === 'owed_to_me' ? 'Owed to Me' : 'I Owe Them'}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Name</label>
                    <input type="text" value={editingDebtName} onChange={e => setEditingDebtName(e.target.value)} required autoFocus className="w-full font-mono-main outline-none transition-colors" style={{ padding: '12px 16px', fontSize: 15, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                  </div>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Amount — EGP</label>
                    <input type="number" step="0.01" value={editingDebtAmount} onChange={e => setEditingDebtAmount(e.target.value)} required className="w-full font-mono-main font-bold outline-none transition-colors" style={{ padding: '14px 16px', fontSize: 22, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                  </div>
                  <div>
                    <label className="font-sans-main uppercase tracking-widest block mb-3" style={{ fontSize: 10, fontWeight: 600, color: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}>Notes <span style={{ opacity: 0.5 }}>(optional)</span></label>
                    <input type="text" value={editingDebtNotes} onChange={e => setEditingDebtNotes(e.target.value)} placeholder="e.g. Dinner cash back" className="w-full font-mono-main outline-none transition-colors" style={{ padding: '12px 16px', fontSize: 14, background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ink) 15%, transparent)', color: 'var(--ink)' }} onFocus={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 50%, transparent)')} onBlur={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--ink) 15%, transparent)')} />
                  </div>
                </div>
                <div style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                  <button type="submit" className="cursor-pointer w-full font-sans-main font-black uppercase tracking-wide" style={{ fontSize: 13, padding: '20px 0', background: '#7A9E1A', color: '#000', border: 'none' }} onMouseEnter={e => (e.currentTarget.style.background = '#8BB520')} onMouseLeave={e => (e.currentTarget.style.background = '#7A9E1A')}>Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
