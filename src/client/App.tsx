import { LayoutDashboard, Receipt, RefreshCw, UserCircle2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, setAuthToken } from './api';
import { AuthScreen, type AuthUser } from './components/AuthScreen';
import { ChatDrawer } from './components/ChatDrawer';
import { type AnalyticsData, Dashboard } from './components/Dashboard';
import { DebtBoard, type DebtContact } from './components/DebtBoard';
import { ProfileModal } from './components/ProfileModal';
import { type TransactionItem, TransactionList } from './components/TransactionList';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'debts' | 'transactions'>('dashboard');

  // Month state (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Date filter state (default to today's date: YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date())
  );

  // Data states
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [debts, setDebts] = useState<DebtContact[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  // Verify session on startup
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.api.auth.me.$get();
        if (res.ok) {
          const json = await res.json();
          if (mounted && json.success) {
            setCurrentUser(json.data as AuthUser);
          }
        } else if (res.status === 401) {
          setAuthToken(null);
        }
      } catch {
        // Not authenticated
      } finally {
        if (mounted) {
          setAuthChecking(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch all data for the authenticated user
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const [analyticsRes, debtsRes, txRes, budgetsRes] = await Promise.all([
        api.api.analytics.$get({ query: { month: selectedMonth } }),
        api.api.debts.$get(),
        api.api.transactions.$get({
          query: {
            month: selectedMonth,
            date: selectedDate !== 'all' ? selectedDate : undefined,
            category: selectedCategory !== 'Semua' ? selectedCategory : undefined,
            search: searchQuery.trim() || undefined
          }
        }),
        api.api.budgets.$get()
      ]);

      if (analyticsRes.status === 401) {
        setAuthToken(null);
        setCurrentUser(null);
        return;
      }

      const analyticsJson = await analyticsRes.json();
      if (analyticsJson.success) {
        setAnalyticsData(analyticsJson.data as AnalyticsData);
      }

      const debtsJson = await debtsRes.json();
      if (debtsJson.success) {
        setDebts(debtsJson.data as DebtContact[]);
      }

      const txJson = await txRes.json();
      if (txJson.success) {
        setTransactions(txJson.data as TransactionItem[]);
      }

      const budgetsJson = await budgetsRes.json();
      if (budgetsJson.success && Array.isArray(budgetsJson.data)) {
        const bMap: Record<string, number> = {};
        for (const b of budgetsJson.data) {
          bMap[b.category] = b.monthlyLimit;
        }
        setBudgets(bMap);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, selectedMonth, selectedDate, selectedCategory, searchQuery]);

  const handleSaveBudgets = async (
    newBudgets: Array<{ category: string; monthlyLimit: number }>
  ) => {
    await api.api.budgets.$put({
      json: { budgets: newBudgets }
    });
    const bMap: Record<string, number> = {};
    for (const b of newBudgets) {
      bMap[b.category] = b.monthlyLimit;
    }
    setBudgets(bMap);
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  const handleLogout = async () => {
    try {
      await api.api.auth.logout.$post();
    } catch {
      // ignore logout network error
    }
    setAuthToken(null);
    setCurrentUser(null);
    setShowProfileModal(false);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-md animate-pulse">
            Rp
          </div>
          <span className="text-xs font-bold text-slate-500">Memverifikasi sesi akun...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthenticated={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 lg:pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md shadow-emerald-200">
              Rp
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none flex items-center gap-1.5">
                Akuntan AI
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 tracking-wide">
                  Edge D1
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Buku Kas: <strong className="text-slate-600">{currentUser.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200/80 transition-all text-xs font-bold"
              title="Pengaturan Profil, API Key & Webhook QRIS"
            >
              <UserCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="max-w-[110px] truncate">{currentUser.name}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs Header */}
      <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-6 pb-2">
        <div className="flex bg-slate-200/70 p-1 rounded-2xl max-w-md">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'transactions'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Transaksi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('debts')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'debts'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Hutang</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 lg:px-8 pt-4">
        {activeTab === 'dashboard' && (
          <Dashboard
            data={analyticsData}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            isLoading={isLoading}
            budgets={budgets}
            onSaveBudgets={handleSaveBudgets}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionList
            transactions={transactions}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={fetchData}
          />
        )}

        {activeTab === 'debts' && <DebtBoard debts={debts} onRefresh={fetchData} />}
      </main>

      {/* Floating AI Chat Assistant Drawer */}
      <ChatDrawer onTransactionAdded={fetchData} />

      {/* User Profile, BYOK Gemini Key & QRIS Webhook Settings Modal */}
      {showProfileModal && (
        <ProfileModal
          user={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUserUpdated={(updated) => setCurrentUser(updated)}
          onLogout={handleLogout}
          onTransactionSimulated={fetchData}
        />
      )}
    </div>
  );
}
