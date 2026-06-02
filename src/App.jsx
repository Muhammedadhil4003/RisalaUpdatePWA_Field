import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, Lock, LayoutDashboard, UserPlus, FileText, 
  Wallet, PieChart, LogOut, ChevronRight, CheckCircle2,
  Phone, Mail, MapPin, Search, ArrowRightLeft,
  X, Check, AlertCircle, TrendingUp, Calendar, Edit2, CreditCard,
  Trophy, ChevronDown, ChevronUp
} from 'lucide-react';

// ==========================================
// CONFIGURATION & API SETUP
// ==========================================
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzuZ8hJYGPZPc8oCCEEH97mlC3YCdPCCtKM8cUC88JBXGDu7fm00bRuy3OPHJs3xdHdHw/exec';
const USE_MOCK_BACKEND = false;

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function App() {
  // Use LocalStorage for Auth state to stay logged in on refresh!
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('auth') === 'true');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [recordTab, setRecordTab] = useState('subs'); // Lifted state to control sub-tabs from Dashboard
  
  // App Data State
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // Store all users for leaderboard
  
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Pull to refresh state
  const [ptrHeight, setPtrHeight] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- USER SPECIFIC FILTERING ---
  const mySubs = useMemo(() => subscriptions.filter(s => s.staffId === user?.id), [subscriptions, user]);
  const myPayments = useMemo(() => payments.filter(p => p.staffId === user?.id), [payments, user]);
  const myTransfers = useMemo(() => transfers.filter(t => t.staffId === user?.id), [transfers, user]);
  const mySponsors = useMemo(() => sponsors.filter(sp => sp.staffId === user?.id), [sponsors, user]);

  // Derived State (Calculations)
  const totalCashReceived = useMemo(() => 
    myPayments.filter(p => p.type === 'Cash').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  , [myPayments]);
  
  const totalOnlineReceived = useMemo(() => 
    myPayments.filter(p => p.type === 'Online').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  , [myPayments]);
  
  const totalTransferred = useMemo(() => 
    myTransfers.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
  , [myTransfers]);

  // Total balance now includes both Cash & Online
  const totalBalance = totalCashReceived + totalOnlineReceived - totalTransferred;
  const totalSubscriptions = mySubs.length;

  // Fetch initial data when authenticated or when app loads from cache
  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  // Normalizers to map Google Sheets headers gracefully to frontend keys
  const normalizeSub = (s) => ({
    id: s.ID || s.id,
    staffId: s['Staff ID'] || s.staffId,
    entryType: s.Type || s.entryType || 'New',
    name: s.Name || s.name,
    area: s.Area || s.area,
    mobile: s.Mobile || s.mobile,
    whatsapp: s.WhatsApp || s.whatsapp,
    email: s.Email || s.email,
    sponsorId: s['Sponsor ID'] || s.sponsorId || '',
    date: s.Date || s.date
  });

  const normalizeSponsor = (sp) => ({
    id: sp['Sponsor ID'] || sp.id,
    staffId: sp['Staff ID'] || sp.staffId,
    name: sp.Name || sp.name,
    count: parseInt(sp.Count || sp.count) || 0,
    amount: parseFloat(sp.Amount || sp.amount) || 0,
    date: sp.Date || sp.date
  });

  const normalizePay = (p) => ({
    id: p['Payment ID'] || p.id,
    staffId: p['Staff ID'] || p.staffId,
    subId: p['Subscriber ID'] || p.subId,
    amount: parseFloat(p.Amount || p.amount) || 0,
    type: p.Type || p.type,
    date: p.Date || p.date
  });

  const normalizeTransfer = (t) => ({
    id: t['Transfer ID'] || t.id,
    staffId: t['Staff ID'] || t.staffId,
    amount: parseFloat(t.Amount || t.amount) || 0,
    reference: t.Reference || t.reference,
    date: t.Date || t.date
  });

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Generic API Caller
  const apiCall = async (action, payload) => {
    setIsLoading(true);
    try {
      if (USE_MOCK_BACKEND) {
        await new Promise(r => setTimeout(r, 800)); // Simulate network
        return { success: true, data: payload };
      } else {
        const response = await fetch(GAS_WEB_APP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, ...payload })
        });
        
        const textResponse = await response.text();
        let result;
        try {
          result = JSON.parse(textResponse);
        } catch {
          console.error("Failed to parse JSON. Server returned:", textResponse);
          showNotification('Invalid server response.', 'error');
          return { success: false };
        }
        
        if (result.status === 'success') {
          return { success: true, data: result };
        } else {
          showNotification(result.message || 'Action failed', 'error');
          return { success: false };
        }
      }
    } catch (error) {
      console.error(error);
      showNotification('Connection error. Check Google Apps Script configuration.', 'error');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const loadInitialData = async () => {
    const res = await apiCall('FETCH_DATA', {});
    if (res.success && res.data && res.data.data) {
      setSubscriptions((res.data.data.subscriptions || []).map(normalizeSub));
      setPayments((res.data.data.payments || []).map(normalizePay));
      setTransfers((res.data.data.transfers || []).map(normalizeTransfer));
      setSponsors((res.data.data.sponsors || []).map(normalizeSponsor));
      setAllUsers(res.data.data.users || []); // Save user list for leaderboard
    }
  };

  const handleLogin = async (credentials) => {
    const res = await apiCall('AUTHENTICATE', credentials);
    if (res.success) {
      setUser(res.data.user);
      setIsAuthenticated(true);
      // Save to browser memory
      localStorage.setItem('auth', 'true');
      localStorage.setItem('user', JSON.stringify(res.data.user));
      // Data is automatically fetched via useEffect
    }
    return res.success;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('auth');
    localStorage.removeItem('user');
  };

  const handleAddSubscription = async (data) => {
    const newSub = { id: 'SUB-' + Date.now(), staffId: user.id, ...data, date: new Date().toISOString() };
    const res = await apiCall('ADD_SUBSCRIPTION', newSub);
    if (res.success) {
      setSubscriptions([newSub, ...subscriptions]);
      return newSub.id;
    }
    return null;
  };

  const handleEditSubscription = async (data) => {
    const res = await apiCall('EDIT_SUBSCRIPTION', data);
    if (res.success) {
      setSubscriptions(subscriptions.map(s => s.id === data.id ? data : s));
      showNotification('Record Updated Successfully');
      return true;
    }
    return false;
  };

  const handleAddPayment = async (data) => {
    const newPayment = { id: 'PAY-' + Date.now(), staffId: user.id, ...data, date: new Date().toISOString() };
    const res = await apiCall('ADD_PAYMENT', newPayment);
    if (res.success) {
      setPayments([newPayment, ...payments]);
      showNotification('Payment Recorded Successfully');
      return true;
    }
    return false;
  };

  const handleAddTransfer = async (data) => {
    const newTransfer = { id: 'TRN-' + Date.now(), staffId: user.id, ...data, date: new Date().toISOString() };
    const res = await apiCall('ADD_TRANSFER', newTransfer);
    if (res.success) {
      setTransfers([newTransfer, ...transfers]);
      showNotification('Cash Transfer Recorded');
      return true;
    }
    return false;
  };

  const handleAddSponsor = async (data) => {
    const newSponsor = { id: 'SPO-' + Date.now(), staffId: user.id, ...data, date: new Date().toISOString() };
    const res = await apiCall('ADD_SPONSOR', newSponsor);
    if (res.success) {
      setSponsors([newSponsor, ...sponsors]);
      showNotification('Sponsor Added');
      return newSponsor.id;
    }
    return null;
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    // fixed inset-0 completely locks the application strictly into the viewable window area
    <div className="fixed inset-0 bg-slate-100 flex justify-center font-sans text-slate-800" style={{ fontFamily: "'Lexend', sans-serif" }}>
      <div className="w-full max-w-md bg-white h-full shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Header bar */}
        <header className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center shadow-md z-10 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <User size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-tight">Field Entry Portal</h1>
              <p className="text-indigo-200 text-xs">Logged in as {user?.name || 'Staff'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
            <LogOut size={16} />
          </button>
        </header>

        {/* Dynamic Portal Navigation Window with Custom Pull-To-Refresh */}
        <main 
          className="flex-1 overflow-y-auto relative bg-slate-50 touch-pan-y"
          onTouchStart={(e) => {
            if (e.currentTarget.scrollTop === 0) {
              e.currentTarget.dataset.startY = e.touches[0].clientY;
            } else {
              e.currentTarget.dataset.startY = '';
            }
          }}
          onTouchMove={(e) => {
            const startY = parseFloat(e.currentTarget.dataset.startY);
            if (startY && !isRefreshing) {
              const diff = e.touches[0].clientY - startY;
              if (diff > 0) {
                setPtrHeight(Math.min(diff, 80)); // Cap the visual pull distance
              }
            }
          }}
          onTouchEnd={async (e) => {
            if (ptrHeight > 60 && !isRefreshing) {
              setIsRefreshing(true);
              setPtrHeight(50); // Hold spinner open slightly
              await loadInitialData();
              setIsRefreshing(false);
            }
            setPtrHeight(0); // Snap shut
            e.currentTarget.dataset.startY = '';
          }}
        >
          {/* Refresh Indicator */}
          <div className="w-full flex justify-center items-center overflow-hidden transition-all duration-200 ease-out" style={{ height: `${ptrHeight}px`, opacity: ptrHeight / 80 }}>
             <div className={`w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`}>
               <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             </div>
          </div>

          {notification && (
            <div className={`absolute top-4 left-4 right-4 z-50 p-3 rounded-lg shadow-lg flex items-center space-x-2 text-sm text-white animate-fade-in-down ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
              {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              <span>{notification.msg}</span>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <Dashboard 
              user={user}
              allUsers={allUsers}
              allSubscriptions={subscriptions}
              allSponsors={sponsors}
              subscriptions={mySubs}
              totalBalance={totalBalance}
              totalCashReceived={totalCashReceived}
              totalOnlineReceived={totalOnlineReceived}
              totalTransferred={totalTransferred}
              totalSubscriptions={totalSubscriptions}
              setActiveTab={setActiveTab}
              setRecordTab={setRecordTab}
            />
          )}
          {activeTab === 'new' && (
            <SubscriptionForm 
              onSubmit={handleAddSubscription} 
              onPayment={handleAddPayment} 
              onAddSponsor={handleAddSponsor}
              sponsors={sponsors} // Pass global sponsors so they can be assigned
              allSubscriptions={subscriptions} // Pass all subs to calculate global sponsor usage
              isLoading={isLoading} 
            />
          )}
          {activeTab === 'records' && (
            <Records 
              subscriptions={mySubs}
              payments={myPayments}
              transfers={myTransfers}
              onTransfer={handleAddTransfer}
              onEditSubscription={handleEditSubscription}
              onAddPayment={handleAddPayment}
              totalBalance={totalBalance}
              subTab={recordTab}
              setSubTab={setRecordTab}
            />
          )}
          {activeTab === 'reports' && (
            <Reports 
              subscriptions={mySubs}
              payments={myPayments}
              transfers={myTransfers}
              allSubscriptions={subscriptions}
              allSponsors={sponsors}
            />
          )}
        </main>

        {/* Persistent Bottom Tab Bar Navigation */}
        <nav className="shrink-0 w-full bg-white border-t border-slate-200 flex justify-around py-2 px-2 z-20 pb-safe">
          <NavItem icon={<LayoutDashboard />} label="Home" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<UserPlus />} label="New Entry" isActive={activeTab === 'new'} onClick={() => setActiveTab('new')} />
          <NavItem icon={<FileText />} label="Records" isActive={activeTab === 'records'} onClick={() => { setActiveTab('records'); setRecordTab('subs'); }} />
          <NavItem icon={<PieChart />} label="Reports" isActive={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </nav>
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const success = await onLogin({ username, password });
    if (!success) {
      setError('Invalid Username or Password.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-100 flex items-center justify-center p-4" style={{ fontFamily: "'Lexend', sans-serif" }}>
      <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Lock size={32} className="text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Welcome Back</h2>
          <p className="text-indigo-200 text-sm">User Authentication Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center">
              <AlertCircle size={16} className="mr-2 shrink-0"/>{error}
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Username</label>
            <input required type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full mt-1 border-b-2 border-slate-200 p-2 focus:outline-none focus:border-indigo-600 transition" placeholder="Enter your ID" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full mt-1 border-b-2 border-slate-200 p-2 focus:outline-none focus:border-indigo-600 transition" placeholder="••••••••" />
          </div>
          <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-indigo-200 flex justify-center mt-6">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ user, allUsers, allSubscriptions, allSponsors, subscriptions, totalBalance, totalCashReceived, totalOnlineReceived, totalTransferred, totalSubscriptions, setActiveTab, setRecordTab }) {
  const [isLeaderboardExpanded, setIsLeaderboardExpanded] = useState(false);
  const [leaderboardType, setLeaderboardType] = useState('entries'); // 'entries' | 'sponsors'

  const myTotal = subscriptions.length;
  const myTarget = user?.target || 25; 
  const targetPercent = Math.min(100, Math.round((myTotal / myTarget) * 100)) || 0;

  // Derive global leaderboard dynamically from all Users and Entries
  const entriesLeaderboardData = useMemo(() => {
    // 1. Initialize grouped with ALL users from the backend
    const grouped = {};
    allUsers.forEach(u => {
       grouped[u.id] = { id: u.id, name: u.name || u.id, count: 0, target: u.target || 25 };
    });

    // 2. Count entries for those users
    allSubscriptions.forEach(sub => {
      const id = sub.staffId;
      if (id && grouped[id]) {
         grouped[id].count++;
      } else if (id && !grouped[id]) {
         // Fallback if a user has entries but isn't in the Users sheet
         grouped[id] = { id, name: id, count: 1, target: 25 };
      }
    });

    // 3. Convert to array, calculate percentage, sort
    return Object.values(grouped)
      .map(u => ({ ...u, percent: Math.min(100, Math.round((u.count / u.target) * 100)) }))
      .sort((a, b) => {
         if(b.count !== a.count) return b.count - a.count;
         return a.name.localeCompare(b.name);
      });
  }, [allSubscriptions, allUsers]);

  // Derive global leaderboard for Sponsors
  const sponsorLeaderboardData = useMemo(() => {
    const grouped = {};
    allUsers.forEach(u => {
       grouped[u.id] = { id: u.id, name: u.name || u.id, count: 0 };
    });

    allSponsors.forEach(sp => {
      const id = sp.staffId;
      if (id && grouped[id]) {
         grouped[id].count += (parseInt(sp.count) || 0);
      } else if (id && !grouped[id]) {
         grouped[id] = { id, name: id, count: (parseInt(sp.count) || 0) };
      }
    });

    return Object.values(grouped)
      .sort((a, b) => {
         if(b.count !== a.count) return b.count - a.count;
         return a.name.localeCompare(b.name);
      });
  }, [allSponsors, allUsers]);

  const activeLeaderboard = leaderboardType === 'entries' ? entriesLeaderboardData : sponsorLeaderboardData;
  const maxSponsorCount = Math.max(...sponsorLeaderboardData.map(s => s.count), 1);

  return (
    <div className="p-5 space-y-6 animate-fade-in pb-20">
      
      {/* Horizontally Split Top Cards */}
      <div className="flex space-x-4">
        
        {/* Wallet Summary Restructured */}
        <div className="flex-1 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-2 -translate-y-2">
            <Wallet size={80} />
          </div>
          <div>
            <h3 className="text-indigo-100 text-[10px] font-bold uppercase tracking-wider mb-0.5">Total Balance</h3>
            <div className="text-2xl font-bold tracking-tight">OMR {totalBalance.toFixed(3)}</div>
          </div>
          <div className="flex space-x-3 border-t border-white/20 pt-2 mt-3">
            <div>
              <p className="text-indigo-200 text-[9px] uppercase font-bold tracking-wider">Cash</p>
              <p className="font-semibold text-[11px]">OMR {totalCashReceived.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-indigo-200 text-[9px] uppercase font-bold tracking-wider">Bank</p>
              <p className="font-semibold text-[11px]">OMR {totalOnlineReceived.toFixed(3)}</p>
            </div>
          </div>
        </div>

        {/* Personal Performance Minimal */}
        <div className="w-2/5 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col justify-center relative items-center text-center">
          <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Target</h3>
          <div className="text-3xl font-bold text-indigo-600 mb-1">{myTotal}<span className="text-sm font-normal text-slate-400">/{myTarget}</span></div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-1.5 rounded-full transition-all duration-1000 delay-300" style={{ width: `${targetPercent}%` }}></div>
          </div>
          <div className="text-[10px] font-bold text-emerald-500">{targetPercent}%</div>
        </div>

      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center">
          <Calendar size={16} className="mr-2 text-indigo-500" /> Quick Actions
        </h3>
        <div className="space-y-2">
          <button onClick={() => setActiveTab('new')} className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-sm font-medium text-slate-700">
            <span className="flex items-center"><UserPlus size={16} className="mr-3 text-indigo-600" /> Registration / Renewal</span>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
          <button onClick={() => { setActiveTab('records'); setRecordTab('transfer'); }} className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-sm font-medium text-slate-700">
            <span className="flex items-center"><ArrowRightLeft size={16} className="mr-3 text-emerald-600" /> Transfer Cash</span>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Interactive Leaderboard */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 relative overflow-hidden transition-all duration-300">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800 flex items-center text-sm">
            <Trophy size={16} className="mr-2 text-amber-500 drop-shadow-sm" /> Leaderboard
          </h3>
          <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
            <button onClick={() => setLeaderboardType('entries')} className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition ${leaderboardType === 'entries' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Entries</button>
            <button onClick={() => setLeaderboardType('sponsors')} className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition ${leaderboardType === 'sponsors' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Sponsors</button>
          </div>
        </div>

        <div className="space-y-2">
          {activeLeaderboard.slice(0, isLeaderboardExpanded ? activeLeaderboard.length : 4).map((staff, index) => {
            const isCurrentUser = staff.id === user?.id;
            const isEntries = leaderboardType === 'entries';
            
            // Map styling based on ranking
            const rankStyle = 
              index === 0 ? 'bg-amber-100 text-amber-700 border-amber-200 shadow-sm' :
              index === 1 ? 'bg-slate-100 text-slate-600 border-slate-200' :
              index === 2 ? 'bg-orange-100 text-orange-700 border-orange-200' :
              'bg-slate-50 text-slate-400 border-slate-100';
            
            const barColor = 
              index === 0 ? 'bg-gradient-to-r from-amber-400 to-amber-300' :
              index === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-300' :
              index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-300' :
              'bg-gradient-to-r from-indigo-500 to-blue-400';

            const displayValue = isEntries ? `${staff.percent}%` : `${staff.count} Risala`;
            const barWidth = isEntries ? `${staff.percent}%` : `${(staff.count / maxSponsorCount) * 100}%`;

            return (
              <div key={staff.id} className={`flex items-center justify-between p-2 rounded-xl transition-all animate-fade-in ${isCurrentUser ? 'bg-indigo-50/60 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}>
                <div className="flex items-center space-x-3 w-[55%]">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${rankStyle}`}>
                    {index + 1}
                  </div>
                  <div className="truncate">
                    <span className={`text-xs font-bold truncate ${isCurrentUser ? 'text-indigo-800' : 'text-slate-700'}`}>
                      {staff.name} {isCurrentUser && <span className="text-[9px] font-medium text-indigo-500 ml-0.5">(You)</span>}
                    </span>
                  </div>
                </div>
                
                <div className="w-[45%] flex items-center justify-end space-x-2">
                  <div className="w-16 bg-slate-100 rounded-full h-1 overflow-hidden flex items-center shrink-0">
                    <div className={`h-1 rounded-full transition-all duration-1000 ease-out ${barColor}`} style={{ width: barWidth }}></div>
                  </div>
                  <div className="text-[10px] font-bold text-slate-600 text-right min-w-[3rem] shrink-0">
                    {displayValue}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeLeaderboard.length > 4 && (
          <button
            onClick={() => setIsLeaderboardExpanded(!isLeaderboardExpanded)}
            className="w-full mt-3 py-2 flex items-center justify-center text-[10px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-all"
          >
            {isLeaderboardExpanded ? (
              <><ChevronUp size={14} className="mr-1"/> Show Less</>
            ) : (
              <><ChevronDown size={14} className="mr-1"/> View All ({activeLeaderboard.length})</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SubscriptionForm({ onSubmit, onPayment, onAddSponsor, sponsors, allSubscriptions, isLoading }) {
  const [formTab, setFormTab] = useState('subscriber'); // 'subscriber' | 'sponsor'
  const [formData, setFormData] = useState({ entryType: 'New', name: '', area: '', mobile: '', whatsapp: '', email: '', sponsorId: '' });
  const [sponsorData, setSponsorData] = useState({ name: '', count: '' });
  const [isSponsored, setIsSponsored] = useState(false);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdSubId, setCreatedSubId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(3.000);
  
  // Calculate globally available sponsors based on all subscriptions in the system
  const availableSponsors = sponsors.map(sp => {
    const used = allSubscriptions.filter(s => s.sponsorId === sp.id).length;
    return { ...sp, available: sp.count - used };
  }).filter(sp => sp.available > 0);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSponsorChange = (e) => setSponsorData({ ...sponsorData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formTab === 'subscriber') {
      const finalData = { ...formData };
      if (!isSponsored) finalData.sponsorId = '';
      
      const subId = await onSubmit(finalData);
      if (subId) {
        setFormData({ entryType: 'New', name: '', area: '', mobile: '', whatsapp: '', email: '', sponsorId: '' });
        if (!finalData.sponsorId) {
          setIsSponsored(false);
          setCreatedSubId(subId);
          setPaymentAmount(3.000);
          setShowPaymentModal(true);
        } else {
          setIsSponsored(false);
        }
      }
    } else {
      const count = parseInt(sponsorData.count);
      if (!count || count <= 0) return;
      const amount = count * 3;
      const spoId = await onAddSponsor({ name: sponsorData.name, count, amount });
      if (spoId) {
        setSponsorData({ name: '', count: '' });
        setCreatedSubId(spoId);
        setPaymentAmount(amount);
        setShowPaymentModal(true);
      }
    }
  };

  return (
    <div className="p-5 animate-fade-in pb-20">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Form Entry</h2>
          <p className="text-sm text-slate-500">Register entry or sponsor.</p>
        </div>
        <div className="flex bg-slate-200/60 p-1 rounded-xl shrink-0">
          <button onClick={() => setFormTab('subscriber')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${formTab === 'subscriber' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Subscriber</button>
          <button onClick={() => setFormTab('sponsor')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${formTab === 'sponsor' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Sponsor</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {formTab === 'subscriber' ? (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Entry Type</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button type="button" onClick={() => setFormData({...formData, entryType: 'New'})} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${formData.entryType === 'New' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>New Entry</button>
                <button type="button" onClick={() => setFormData({...formData, entryType: 'Renewal'})} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${formData.entryType === 'Renewal' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Renewal</button>
              </div>
            </div>

            <InputField icon={<User size={18}/>} label="Full Name" name="name" value={formData.name} onChange={handleChange} required />
            <InputField icon={<MapPin size={18}/>} label="Area / Location" name="area" value={formData.area} onChange={handleChange} required />
            <InputField icon={<Phone size={18}/>} label="Mobile Number" name="mobile" type="tel" value={formData.mobile} onChange={handleChange} required />
            <InputField icon={<Phone size={18}/>} label="WhatsApp Number" name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} />
            <InputField icon={<Mail size={18}/>} label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} />
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="flex items-center space-x-3 mb-3 cursor-pointer">
                <input type="checkbox" checked={isSponsored} onChange={e => setIsSponsored(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                <span className="text-sm font-semibold text-slate-700">Assign Sponsor</span>
              </label>
              
              {isSponsored && (
                <div className="mt-2 animate-fade-in">
                  <select name="sponsorId" value={formData.sponsorId} onChange={handleChange} required className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" >
                    <option value="">Select a Sponsor</option>
                    {availableSponsors.map(sp => (
                      <option key={sp.id} value={sp.id}>{sp.name} ({sp.available} remaining)</option>
                    ))}
                  </select>
                  {availableSponsors.length === 0 && <p className="text-[11px] text-red-500 mt-1">No sponsors with remaining packages available.</p>}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <InputField icon={<User size={18}/>} label="Sponsor Name" name="name" value={sponsorData.name} onChange={handleSponsorChange} required />
            <InputField icon={<FileText size={18}/>} label="No. of Risala Sponsored" name="count" type="number" min="1" value={sponsorData.count} onChange={handleSponsorChange} required />
            {sponsorData.count && (
              <div className="p-4 bg-indigo-50 rounded-xl flex justify-between items-center text-indigo-800">
                <span className="font-semibold text-sm">Total Amount:</span>
                <span className="font-bold text-lg">OMR {(sponsorData.count * 3).toFixed(3)}</span>
              </div>
            )}
          </>
        )}
        
        <button disabled={isLoading} className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-center mt-6">
          {isLoading ? <span className="animate-spin mr-2">⏳</span> : <CheckCircle2 size={18} className="mr-2" />}
          {formTab === 'subscriber' ? 'Submit Registration' : 'Register Sponsor'}
        </button>
      </form>

      {showPaymentModal && (
        <PaymentModal 
          subId={createdSubId}
          defaultAmount={paymentAmount}
          onClose={() => setShowPaymentModal(false)} 
          onPaymentSubmit={onPayment}
        />
      )}
    </div>
  );
}

function PaymentModal({ subId, defaultAmount = 3.000, onClose, onPaymentSubmit }) {
  const [amount, setAmount] = useState(defaultAmount);
  const [type, setType] = useState('Cash'); // Default Cash
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!amount || isNaN(amount)) return;
    setLoading(true);
    const success = await onPaymentSubmit({ subId, amount: Number(amount), type });
    setLoading(false);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" style={{ fontFamily: "'Lexend', sans-serif" }}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-in">
        <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Update Payment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-indigo-50 text-indigo-700 p-3 rounded-lg text-xs mb-2 flex items-start">
            <CheckCircle2 size={16} className="mr-2 mt-0.5 shrink-0" />
            Successfully recorded! Collect payment now?
          </div>
          
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Amount Received (OMR)</label>
            <input type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-3 text-lg font-bold focus:border-indigo-500 focus:outline-none" placeholder="3.000" />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Payment Method</label>
            <div className="flex space-x-2">
              {['Cash', 'Online'].map(m => (
                <button key={m} type="button" onClick={() => setType(m)} className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition ${type === m ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-slate-50 flex space-x-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-medium text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleUpdate} disabled={loading} className="flex-1 py-3 rounded-xl font-semibold text-white bg-emerald-600 shadow-lg shadow-emerald-200 hover:bg-emerald-700 flex justify-center items-center">
             {loading ? 'Processing...' : 'Collect'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Records({ subscriptions, payments, transfers, onTransfer, onEditSubscription, onAddPayment, totalBalance, subTab, setSubTab }) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [paymentSubId, setPaymentSubId] = useState(null);

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="p-4 bg-white border-b sticky top-0 z-10 shrink-0">
        <h2 className="text-xl font-bold text-slate-800 mb-3">Database Records</h2>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setSubTab('subs')} className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition ${subTab === 'subs' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Entries</button>
          <button onClick={() => setSubTab('payments')} className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition ${subTab === 'payments' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Payments</button>
          <button onClick={() => setSubTab('transfer')} className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition ${subTab === 'transfer' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Transfers</button>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto pb-24">
        {subTab === 'subs' && (
          <div className="space-y-3">
            {subscriptions.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-slate-800">{s.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.entryType === 'Renewal' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{s.entryType || 'New'}</span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center mt-1"><MapPin size={12} className="mr-1"/> {s.area}</p>
                    <p className="text-xs text-slate-500 flex items-center mt-0.5"><Phone size={12} className="mr-1"/> {s.mobile}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">ID: {s.id.substring(0,6)}</span>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(s.date).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="flex space-x-2 border-t border-slate-50 pt-3">
                  <button onClick={() => setEditingSub(s)} className="flex-1 flex items-center justify-center py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 transition">
                    <Edit2 size={14} className="mr-1.5" /> Edit Info
                  </button>
                  
                  {(() => {
                    const paidAmount = payments.filter(p => p.subId === s.id).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                    const isFullyPaid = s.sponsorId || paidAmount >= 3.0;
                    return isFullyPaid ? (
                      <div className="flex-1 flex items-center justify-center py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">
                        <CheckCircle2 size={14} className="mr-1.5 text-emerald-600" /> Fully Paid
                      </div>
                    ) : (
                      <button onClick={() => setPaymentSubId(s.id)} className="flex-1 flex items-center justify-center py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition">
                        <CreditCard size={14} className="mr-1.5" /> Add Payment
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
            {subscriptions.length === 0 && <EmptyState msg="No entries found" />}
          </div>
        )}

        {subTab === 'payments' && (
          <div className="space-y-3">
            {payments.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-emerald-600">OMR {Number(p.amount).toFixed(3)}</h4>
                  <p className="text-xs text-slate-500 mt-1">ID: {p.subId.substring(0,8)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">{p.type}</span>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(p.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {payments.length === 0 && <EmptyState msg="No payments recorded" />}
          </div>
        )}

        {subTab === 'transfer' && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex justify-between items-center animate-fade-in">
              <div>
                <p className="text-xs text-indigo-600 font-semibold uppercase mb-1">Transferable Balance</p>
                <p className="text-2xl font-bold text-indigo-900">OMR {totalBalance.toFixed(3)}</p>
              </div>
              <button onClick={() => setShowTransferModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-indigo-700 transition">
                Transfer Out
              </button>
            </div>
            
            <h3 className="font-semibold text-slate-700 text-sm pt-2">Transfer History</h3>
            <div className="space-y-3">
              {transfers.map(t => (
                <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-red-500">- OMR {Number(t.amount).toFixed(3)}</h4>
                    <p className="text-xs text-slate-500 mt-1">Ref: {t.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium">{t.staffId}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(t.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {transfers.length === 0 && <EmptyState msg="No transfers yet" />}
            </div>
          </div>
        )}
      </div>

      {showTransferModal && (
        <TransferModal 
          maxAmount={totalBalance} 
          onClose={() => setShowTransferModal(false)}
          onSubmit={async (data) => {
            const success = await onTransfer(data);
            if(success) setShowTransferModal(false);
          }}
        />
      )}

      {editingSub && (
        <EditEntryModal 
          sub={editingSub} 
          onClose={() => setEditingSub(null)}
          onSubmit={async (updatedData) => {
            const success = await onEditSubscription(updatedData);
            if(success) setEditingSub(null);
          }}
        />
      )}

      {paymentSubId && (
        <PaymentModal 
          subId={paymentSubId} 
          defaultAmount={3.000}
          onClose={() => setPaymentSubId(null)} 
          onPaymentSubmit={async (data) => {
            const success = await onAddPayment(data);
            if(success) setPaymentSubId(null);
            return success;
          }}
        />
      )}
    </div>
  );
}

function EditEntryModal({ sub, onClose, onSubmit }) {
  const [formData, setFormData] = useState({ ...sub });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center backdrop-blur-sm animate-fade-in" style={{ fontFamily: "'Lexend', sans-serif" }}>
      <div className="bg-white w-full max-w-md h-[90vh] rounded-t-2xl overflow-hidden shadow-2xl animate-slide-up flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800">Edit Record</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={20}/></button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1 bg-slate-50">
          <form id="editForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Entry Type</label>
              <div className="flex bg-slate-200 p-1 rounded-xl">
                <button type="button" onClick={() => setFormData({...formData, entryType: 'New'})} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${formData.entryType === 'New' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>New Entry</button>
                <button type="button" onClick={() => setFormData({...formData, entryType: 'Renewal'})} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${formData.entryType === 'Renewal' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Renewal</button>
              </div>
            </div>

            <InputField icon={<User size={18}/>} label="Full Name" name="name" value={formData.name} onChange={handleChange} required />
            <InputField icon={<MapPin size={18}/>} label="Area / Location" name="area" value={formData.area} onChange={handleChange} required />
            <InputField icon={<Phone size={18}/>} label="Mobile Number" name="mobile" type="tel" value={formData.mobile} onChange={handleChange} required />
            <InputField icon={<Phone size={18}/>} label="WhatsApp Number" name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} />
            <InputField icon={<Mail size={18}/>} label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} />
            
            <div className="text-xs text-slate-500 bg-slate-100 p-3 rounded-lg border border-slate-200 mt-4">
              <span className="font-semibold text-slate-700">Sponsor ID Reference:</span> {formData.sponsorId || 'Direct Payment Mode'}
            </div>
          </form>
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shrink-0 pb-safe">
          <button type="submit" form="editForm" disabled={loading} className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-center">
            {loading ? <span className="animate-spin mr-2">⏳</span> : <Check size={18} className="mr-2" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ maxAmount, onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!amount || isNaN(amount) || amount <= 0) return;
    if (amount > maxAmount) return;
    setLoading(true);
    await onSubmit({ amount: Number(amount), reference });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center backdrop-blur-sm animate-fade-in" style={{ fontFamily: "'Lexend', sans-serif" }}>
      <div className="bg-white rounded-t-2xl w-full max-w-md overflow-hidden shadow-2xl animate-slide-up">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Transfer Cash</h3>
          <button onClick={onClose} className="text-slate-400"><X size={20}/></button>
        </div>
        <div className="p-5 space-y-4 bg-slate-50">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Amount to Transfer (OMR)</label>
            <input type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-3 text-lg font-bold focus:border-indigo-500 focus:outline-none" placeholder="0.000" />
            <p className="text-xs text-slate-500 mt-1">Max available OMR {maxAmount.toFixed(3)}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Reference / Handed Over To</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm focus:border-indigo-500 focus:outline-none" placeholder="e.g. Bank Deposit, Admin Name" />
          </div>
          <button onClick={handleTransfer} disabled={loading} className="w-full py-3.5 mt-2 rounded-xl font-semibold text-white bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 flex justify-center items-center">
             {loading ? 'Processing...' : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Reports({ subscriptions, payments, transfers, allSubscriptions, allSponsors }) {
  const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const cashAmount = payments.filter(p => p.type === 'Cash').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const onlineAmount = totalAmount - cashAmount;

  // Calculate global sponsorship statistics
  const totalSponsored = allSponsors.reduce((sum, sp) => sum + (parseInt(sp.count) || 0), 0);
  const usedSponsored = allSubscriptions.filter(s => s.sponsorId).length;
  const availableSponsored = totalSponsored - usedSponsored;

  return (
    <div className="p-5 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Performance Report</h2>
      
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Sponsorship Overview</h3>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-700 text-sm">Total Risala Sponsored</span>
            <span className="font-bold text-lg text-indigo-600">{totalSponsored}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-700 text-sm">Used by Subscribers</span>
            <span className="font-bold text-lg text-amber-500">{usedSponsored}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-700 text-sm">Available Risala</span>
            <span className="font-bold text-lg text-emerald-600">{availableSponsored}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Overall Stats</h3>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-700 text-sm">Total Entries</span>
            <span className="font-bold text-lg">{subscriptions.length}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-700 text-sm">Total Revenue</span>
            <span className="font-bold text-lg text-emerald-600">OMR {totalAmount.toFixed(3)}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Collection Breakdown</h3>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">Cash</span>
              <span className="font-bold">OMR {cashAmount.toFixed(3)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: totalAmount ? `${(cashAmount/totalAmount)*100}%` : '0%' }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">Online / Bank</span>
              <span className="font-bold">OMR {onlineAmount.toFixed(3)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: totalAmount ? `${(onlineAmount/totalAmount)*100}%` : '0%' }}></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 h-12 transition-colors duration-200 ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
      <div className={`mb-1 transition-transform ${isActive ? 'scale-110' : ''}`}>{React.cloneElement(icon, { size: 22 })}</div>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

function InputField({ icon, label, ...props }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          {icon}
        </div>
        <input 
          className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition shadow-sm"
          {...props}
        />
      </div>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center text-slate-400">
      <Search size={40} className="mb-3 opacity-20" />
      <p className="text-sm font-medium">{msg}</p>
    </div>
  );
}

// Global CSS Animations & Screen Locking
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap');

  /* Hard lock the body so the browser frame does not scroll, fixing the off-screen bottom nav */
  html, body, #root {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    overscroll-behavior-y: none;
    font-family: 'Lexend', sans-serif;
  }

  .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .animate-fade-in { animation: fadeIn 0.3s ease-out; }
  .animate-fade-in-down { animation: fadeInDown 0.3s ease-out; }
  .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  .scale-in { animation: scaleIn 0.2s ease-out; }
`;
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}