import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  User, Lock, LayoutDashboard, UserPlus, FileText, 
  Wallet, PieChart, LogOut, ChevronRight, CheckCircle2,
  Phone, Mail, MapPin, Search, ArrowRightLeft,
  X, Check, AlertCircle, TrendingUp, Calendar, Edit2, CreditCard,
  Trophy, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';

// ==========================================
// CONFIGURATION & API SETUP
// ==========================================
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzuZ8hJYGPZPc8oCCEEH97mlC3YCdPCCtKM8cUC88JBXGDu7fm00bRuy3OPHJs3xdHdHw/exec';
const USE_MOCK_BACKEND = false;

// ==========================================
// OMAN SECTORS & UNITS
// ==========================================
const OMAN_SECTORS = {
  'Wustha Sector': ['Town Unit', 'New Salalah Unit', 'Number 5 Unit', 'Muntaza Unit', 'Power House Unit'],
  'Garbiya Sector': ['Sannayya Unit', 'Al Wadi Unit', 'Salalah Mall Unit', 'Raysut Unit', 'Awqad Unit'],
  'Shamaliya Sector': ['Saada Unit', 'Thumrait Unit', 'Grand Mall Unit', 'University Unit', 'Sahalnoot Unit', 'Qairoon Khairati Unit'],
  'Sharqiyya Sector': ['Al Qard Unit', 'Dahariz Unit', 'Haffa Unit', 'Mirbat Unit', 'Taqah Unit']
};

// ==========================================
// MOCK DATA (Fallback for testing or offline)
// ==========================================
const mockUsers = [
  { id: 'admin', name: 'Admin Mock', target: 25 },
  { id: 'user1', name: 'Zaid', target: 25 },
  { id: 'user2', name: 'Omar', target: 30 }
];
const mockSubscriptions = [
  { id: 'S1', staffId: 'admin', entryType: 'New', name: 'Ahmed Khan', area: 'Wustha Sector - Town Unit', mobile: '1234567890', whatsapp: '1234567890', email: 'ahmed@example.com', sponsorId: '', date: new Date().toISOString() },
  { id: 'S2', staffId: 'admin', entryType: 'Renewal', name: 'Sarah Ali', area: 'Shamaliya Sector - Saada Unit', mobile: '0987654321', whatsapp: '0987654321', email: 'sarah@example.com', sponsorId: 'SPO-1', date: new Date().toISOString() },
];
const mockPayments = [
  { id: 'P1', staffId: 'admin', subId: 'S1', amount: 3.000, type: 'Cash', date: new Date().toISOString() },
];
const mockTransfers = [
  { id: 'T1', staffId: 'admin', amount: 1.500, reference: 'Bank Deposit', date: new Date().toISOString() }
];
const mockSponsors = [
  { id: 'SPO-1', staffId: 'admin', name: 'Ali Ahmed', count: 10, amount: 30.000, date: new Date().toISOString() }
];

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // App Data State
  const [globalUsers, setGlobalUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Auto-login from Local Storage
  useEffect(() => {
    const savedUser = localStorage.getItem('field_staff_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
      loadInitialData();
    }
  }, []);

  // --- DATA FILTERING ---
  const mySubs = useMemo(() => subscriptions.filter(s => s.staffId === user?.id), [subscriptions, user]);
  const myPayments = useMemo(() => payments.filter(p => p.staffId === user?.id), [payments, user]);
  const myTransfers = useMemo(() => transfers.filter(t => t.staffId === user?.id), [transfers, user]);
  
  // Balance calculations (Cash + Online combined for total in hand)
  const totalCashReceived = useMemo(() => myPayments.filter(p => p.type === 'Cash').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0), [myPayments]);
  const totalOnlineReceived = useMemo(() => myPayments.filter(p => p.type === 'Online').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0), [myPayments]);
  const totalReceived = totalCashReceived + totalOnlineReceived;
  
  const totalTransferred = useMemo(() => myTransfers.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0), [myTransfers]);
  const totalBalance = totalReceived - totalTransferred;
  
  const totalSubscriptions = mySubs.length;

  // Normalizers
  const normalizeSub = (s) => ({
    id: s.ID || s.id, staffId: s['Staff ID'] || s.staffId, entryType: s.Type || s.entryType || 'New',
    name: s.Name || s.name, area: s.Area || s.area, mobile: s.Mobile || s.mobile,
    whatsapp: s.WhatsApp || s.whatsapp, email: s.Email || s.email, sponsorId: s['Sponsor ID'] || s.sponsorId || '',
    date: s.Date || s.date
  });
  const normalizeSponsor = (sp) => ({
    id: sp['Sponsor ID'] || sp.id, staffId: sp['Staff ID'] || sp.staffId, name: sp.Name || sp.name,
    count: parseInt(sp.Count || sp.count) || 0, amount: parseFloat(sp.Amount || sp.amount) || 0,
    date: sp.Date || sp.date
  });
  const normalizePay = (p) => ({
    id: p['Payment ID'] || p.id, staffId: p['Staff ID'] || p.staffId, subId: p['Subscriber ID'] || p.subId,
    amount: parseFloat(p.Amount || p.amount) || 0, type: p.Type || p.type, date: p.Date || p.date
  });
  const normalizeTransfer = (t) => ({
    id: t['Transfer ID'] || t.id, staffId: t['Staff ID'] || t.staffId, amount: parseFloat(t.Amount || t.amount) || 0,
    reference: t.Reference || t.reference, date: t.Date || t.date
  });

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // API Caller
  const apiCall = async (action, payload) => {
    try {
      if (USE_MOCK_BACKEND) {
        await new Promise(r => setTimeout(r, 800));
        if (action === 'AUTHENTICATE') return { success: true, data: { user: mockUsers.find(u=>u.id===payload.username) || mockUsers[0] } };
        if (action === 'FETCH_DATA') return { success: true, data: { users: mockUsers, subscriptions: mockSubscriptions, payments: mockPayments, transfers: mockTransfers, sponsors: mockSponsors } };
        return { success: true, data: payload };
      } else {
        const response = await fetch(GAS_WEB_APP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, ...payload })
        });
        const textResponse = await response.text();
        const result = JSON.parse(textResponse);
        return result.status === 'success' ? { success: true, data: result } : { success: false, msg: result.message };
      }
    } catch (error) {
      console.error(error);
      return { success: false, msg: 'Connection error' };
    }
  };

  const loadInitialData = async () => {
    const res = await apiCall('FETCH_DATA', {});
    if (res.success && res.data && res.data.data) {
      setGlobalUsers(res.data.data.users || []);
      setSubscriptions((res.data.data.subscriptions || []).map(normalizeSub));
      setPayments((res.data.data.payments || []).map(normalizePay));
      setTransfers((res.data.data.transfers || []).map(normalizeTransfer));
      setSponsors((res.data.data.sponsors || []).map(normalizeSponsor));
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadInitialData();
    setIsRefreshing(false);
  };

  const handleLogin = async (credentials) => {
    setIsLoading(true);
    const res = await apiCall('AUTHENTICATE', credentials);
    setIsLoading(false);
    if (res.success) {
      const u = res.data.user;
      setUser(u);
      setIsAuthenticated(true);
      localStorage.setItem('field_staff_user', JSON.stringify(u));
      loadInitialData();
    }
    return res.success;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('field_staff_user');
  };

  const handleAddSubscription = async (data) => {
    const newSub = { id: 'SUB-' + Date.now(), staffId: user.id, ...data, date: new Date().toISOString() };
    const res = await apiCall('ADD_SUBSCRIPTION', newSub);
    if (res.success) { setSubscriptions([newSub, ...subscriptions]); return newSub.id; }
    return null;
  };

  const handleEditSubscription = async (data) => {
    const res = await apiCall('EDIT_SUBSCRIPTION', data);
    if (res.success) { setSubscriptions(subscriptions.map(s => s.id === data.id ? data : s)); showNotification('Record Updated Successfully'); return true; }
    return false;
  };

  const handleAddPayment = async (data) => {
    const newPayment = { id: 'PAY-' + Date.now(), staffId: user.id, ...data, date: new Date().toISOString() };
    const res = await apiCall('ADD_PAYMENT', newPayment);
    if (res.success) { setPayments([newPayment, ...payments]); showNotification('Payment Recorded'); return true; }
    return false;
  };

  const handleAddTransfer = async (data) => {
    const newTransfer = { id: 'TRN-' + Date.now(), staffId: user.id, ...data, date: new Date().toISOString() };
    const res = await apiCall('ADD_TRANSFER', newTransfer);
    if (res.success) { setTransfers([newTransfer, ...transfers]); showNotification('Cash Transferred'); return true; }
    return false;
  };

  const handleAddSponsor = async (data) => {
    const newSponsor = { id: 'SPO-' + Date.now(), staffId: user.id, ...data, date: new Date().toISOString() };
    const res = await apiCall('ADD_SPONSOR', newSponsor);
    if (res.success) { setSponsors([newSponsor, ...sponsors]); showNotification('Sponsor Added'); return newSponsor.id; }
    return null;
  };

  // Custom Pull-to-Refresh Gesture Logic
  const pullRef = useRef(0);
  const handleTouchStart = (e) => { pullRef.current = e.touches[0].clientY; };
  const handleTouchEnd = (e) => {
    if (activeTab === 'dashboard' && window.scrollY === 0) {
      const distance = e.changedTouches[0].clientY - pullRef.current;
      if (distance > 150) handleRefresh();
    }
  };

  if (!isAuthenticated) return <Login onLogin={handleLogin} isLoading={isLoading} />;

  return (
    <div className="fixed inset-0 bg-slate-100 flex justify-center font-lex text-slate-800" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="w-full max-w-md bg-white h-full shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center shadow-md z-10 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">{user?.name?.charAt(0) || <User size={18} />}</div>
            <div>
              <h1 className="font-semibold text-sm leading-tight">Field Entry Portal</h1>
              <p className="text-indigo-200 text-xs">Logged in as {user?.name || 'Staff'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"><LogOut size={16} /></button>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto relative bg-slate-50 scroll-smooth">
          {notification && (
            <div className={`absolute top-4 left-4 right-4 z-50 p-3 rounded-lg shadow-lg flex items-center space-x-2 text-sm text-white animate-fade-in-down ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
              {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              <span>{notification.msg}</span>
            </div>
          )}

          {isRefreshing && (
            <div className="w-full py-4 flex justify-center items-center bg-indigo-50/50 text-indigo-500 border-b border-indigo-100 text-xs font-semibold animate-pulse">
              <RefreshCw size={14} className="animate-spin mr-2"/> Refreshing data...
            </div>
          )}

          {activeTab === 'dashboard' && (
            <Dashboard 
              user={user} globalUsers={globalUsers} allSubscriptions={subscriptions} allSponsors={sponsors}
              myTotalSubs={totalSubscriptions} totalBalance={totalBalance} cashAmount={totalCashReceived} onlineAmount={totalOnlineReceived}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'new' && (
            <SubscriptionForm 
              onSubmit={handleAddSubscription} onPayment={handleAddPayment} onAddSponsor={handleAddSponsor}
              sponsors={sponsors} subscriptions={subscriptions} isLoading={isLoading} 
            />
          )}
          {activeTab === 'records' && (
            <Records 
              subscriptions={mySubs} payments={myPayments} transfers={myTransfers}
              onTransfer={handleAddTransfer} onEditSubscription={handleEditSubscription} onAddPayment={handleAddPayment}
              totalBalance={totalBalance}
            />
          )}
          {activeTab === 'reports' && (
            <Reports subscriptions={mySubs} payments={myPayments} sponsors={sponsors} allSubscriptions={subscriptions} />
          )}
        </main>

        {/* Bottom Nav */}
        <nav className="shrink-0 w-full bg-white border-t border-slate-200 flex justify-around py-2 px-2 z-20 pb-safe shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.1)]">
          <NavItem icon={<LayoutDashboard />} label="Home" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<UserPlus />} label="New Entry" isActive={activeTab === 'new'} onClick={() => setActiveTab('new')} />
          <NavItem icon={<FileText />} label="Records" isActive={activeTab === 'records'} onClick={() => setActiveTab('records')} />
          <NavItem icon={<PieChart />} label="Reports" isActive={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </nav>
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function Login({ onLogin, isLoading }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const success = await onLogin({ username, password });
    if (!success) setError('Invalid Username or Password.');
  };

  return (
    <div className="fixed inset-0 bg-slate-100 flex items-center justify-center p-4 font-lex">
      <div className="bg-white max-w-sm w-full rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 text-center relative overflow-hidden">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <Lock size={30} className="text-indigo-600 ml-0.5" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">Welcome Back</h2>
          <p className="text-indigo-200 text-sm">Staff Authentication Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center font-medium"><AlertCircle size={16} className="mr-2 shrink-0"/>{error}</div>}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block ml-1">Username</label>
            <input required type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition shadow-sm" placeholder="Enter your ID" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block ml-1 mt-2">Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition shadow-sm" placeholder="••••••••" />
          </div>
          <button disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] flex justify-center mt-6">
            {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ user, globalUsers, allSubscriptions, allSponsors, myTotalSubs, totalBalance, cashAmount, onlineAmount, setActiveTab }) {
  const [boardType, setBoardType] = useState('entries'); // 'entries' or 'sponsors'
  const [isLeaderboardExpanded, setIsLeaderboardExpanded] = useState(false);

  const myTarget = user?.target || 25; 
  const targetPercent = Math.min(100, Math.round((myTotalSubs / myTarget) * 100)) || 0;

  // Build robust leaderboard merging users with databases
  const leaderboardData = useMemo(() => {
    let grouped = {};
    
    // Seed with ALL global users so no one is missing
    globalUsers.forEach(u => {
      grouped[u.id] = { id: u.id, name: u.name || u.id, count: 0, target: parseInt(u.target) || 25 };
    });

    if (boardType === 'entries') {
      allSubscriptions.forEach(sub => {
        const id = sub.staffId;
        if (!id) return;
        if (!grouped[id]) grouped[id] = { id, name: id, count: 0, target: 25 };
        grouped[id].count++;
      });
      return Object.values(grouped).map(u => ({ ...u, percent: Math.min(100, Math.round((u.count / u.target) * 100)) })).sort((a, b) => b.count - a.count);
    
    } else {
      allSponsors.forEach(sp => {
        const id = sp.staffId;
        if (!id) return;
        if (!grouped[id]) grouped[id] = { id, name: id, count: 0, target: 25 }; // Target is arbitrary here
        grouped[id].count += sp.count;
      });
      return Object.values(grouped).map(u => ({ ...u, percent: u.count > 0 ? 100 : 0 })).sort((a, b) => b.count - a.count);
    }
  }, [allSubscriptions, allSponsors, globalUsers, boardType]);

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-20">
      <div className="flex items-center justify-between px-1 mb-2">
         <h2 className="text-xl font-bold text-slate-800 tracking-tight">Overview</h2>
         <span className="text-[10px] font-semibold bg-slate-200 text-slate-500 px-2 py-1 rounded-full flex items-center"><RefreshCw size={10} className="mr-1"/> Pull down to refresh</span>
      </div>
      
      {/* Horizontally Split Top Cards */}
      <div className="flex space-x-3 h-32">
        {/* In Hand Cash */}
        <div className="flex-1 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -bottom-4 -right-4 opacity-10">
            <Wallet size={80} />
          </div>
          <div>
            <h3 className="text-indigo-100 text-[10px] font-bold uppercase tracking-wider mb-0.5">Total Balance</h3>
            <div className="text-2xl font-bold tracking-tight">OMR {totalBalance.toFixed(3)}</div>
          </div>
          <div className="flex justify-between border-t border-white/20 pt-2 z-10">
            <div>
              <p className="text-[9px] text-indigo-200 uppercase tracking-wide">Cash</p>
              <p className="font-bold text-xs">OMR {cashAmount.toFixed(3)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-indigo-200 uppercase tracking-wide">Online</p>
              <p className="font-bold text-xs">OMR {onlineAmount.toFixed(3)}</p>
            </div>
          </div>
        </div>

        {/* My Performance */}
        <div className="flex-[0.8] bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-0"></div>
          <div className="z-10">
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">My Progress</h3>
            <div className="flex items-baseline space-x-1">
               <div className="text-2xl font-bold text-slate-800">{myTotalSubs}</div>
               <div className="text-xs font-semibold text-slate-400">/ {myTarget}</div>
            </div>
          </div>
          <div className="z-10 w-full mt-2">
            <div className="flex justify-between text-[10px] font-bold mb-1">
              <span className="text-slate-400">Achieved</span>
              <span className="text-emerald-500">{targetPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${targetPercent}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex space-x-2">
        <button onClick={() => setActiveTab('new')} className="flex-1 flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-slate-700 active:bg-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-1.5"><UserPlus size={16} /></div>
          <span className="text-xs font-semibold">New Entry</span>
        </button>
        <button onClick={() => { setActiveTab('records'); setTimeout(() => window.dispatchEvent(new CustomEvent('OPEN_TRANSFERS')), 50); }} className="flex-1 flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition text-slate-700 active:bg-slate-200">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1.5"><ArrowRightLeft size={16} /></div>
          <span className="text-xs font-semibold">Transfer</span>
        </button>
      </div>

      {/* Interactive Leaderboard */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative overflow-hidden transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 flex items-center">
            <Trophy size={18} className="mr-2 text-amber-500 drop-shadow-sm" /> Rankings
          </h3>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setBoardType('entries')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition uppercase ${boardType === 'entries' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Entries</button>
            <button onClick={() => setBoardType('sponsors')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition uppercase ${boardType === 'sponsors' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Sponsors</button>
          </div>
        </div>

        <div className="space-y-2.5">
          {leaderboardData.slice(0, isLeaderboardExpanded ? leaderboardData.length : 3).map((staff, index) => {
            const isCurrentUser = staff.id === user?.id;
            const rankStyle = 
              index === 0 && staff.count > 0 ? 'bg-gradient-to-br from-amber-200 to-amber-300 text-amber-800 border-amber-300 shadow-sm' :
              index === 1 && staff.count > 0 ? 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 border-slate-300' :
              index === 2 && staff.count > 0 ? 'bg-gradient-to-br from-orange-200 to-orange-300 text-orange-800 border-orange-300' :
              'bg-slate-100 text-slate-400 border-slate-200';
            
            const barColor = 
              index === 0 ? 'bg-amber-400' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-orange-400' : 'bg-indigo-400';

            return (
              <div key={staff.id} className={`flex items-center p-3 rounded-xl border transition-all animate-fade-in ${isCurrentUser ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${rankStyle}`}>
                  {staff.count === 0 ? '-' : index + 1}
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className={`text-sm font-bold truncate ${isCurrentUser ? 'text-indigo-800' : 'text-slate-700'}`}>
                      {staff.name} {isCurrentUser && <span className="text-[10px] font-bold text-indigo-500 uppercase ml-1">(You)</span>}
                    </span>
                    <span className="text-sm font-bold text-slate-800 ml-2">{staff.count} <span className="text-[10px] font-semibold text-slate-400">{boardType === 'entries' ? `/ ${staff.target}` : 'Risala'}</span></span>
                  </div>
                  {boardType === 'entries' && (
                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden flex items-center">
                      <div className={`h-1 rounded-full transition-all duration-1000 ease-out ${barColor}`} style={{ width: `${staff.percent}%` }}></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {leaderboardData.length > 3 && (
          <button onClick={() => setIsLeaderboardExpanded(!isLeaderboardExpanded)} className="w-full mt-4 py-2 flex items-center justify-center text-[10px] uppercase font-bold text-slate-400 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all active:scale-95">
            {isLeaderboardExpanded ? <><ChevronUp size={14} className="mr-1"/> Show Less</> : <><ChevronDown size={14} className="mr-1"/> View All Members</>}
          </button>
        )}
      </div>
    </div>
  );
}

function SubscriptionForm({ onSubmit, onPayment, onAddSponsor, sponsors, subscriptions, isLoading }) {
  const [formTab, setFormTab] = useState('subscriber'); 
  const [formData, setFormData] = useState({ entryType: 'New', name: '', sector: '', unit: '', mobile: '', whatsapp: '', email: '', sponsorId: '' });
  const [sponsorData, setSponsorData] = useState({ name: '', count: '' });
  const [isSponsored, setIsSponsored] = useState(false);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdSubId, setCreatedSubId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(3.000);
  
  // Calculate availability for ALL sponsors dynamically
  const availableSponsors = useMemo(() => {
    return sponsors.map(sp => {
      const usedCount = subscriptions.filter(s => s.sponsorId === sp.id).length;
      return { ...sp, available: sp.count - usedCount };
    }).filter(sp => sp.available > 0);
  }, [sponsors, subscriptions]);

  const handleChange = (e) => {
    if (e.target.name === 'sector') {
      setFormData({ ...formData, sector: e.target.value, unit: '' }); // Reset unit when sector changes
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };
  const handleSponsorChange = (e) => setSponsorData({ ...sponsorData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formTab === 'subscriber') {
      const finalData = { ...formData };
      if (!isSponsored) finalData.sponsorId = '';
      
      // Merge Sector & Unit before sending to backend
      finalData.area = `${formData.sector} - ${formData.unit}`;
      delete finalData.sector;
      delete finalData.unit;
      
      const subId = await onSubmit(finalData);
      if (subId) {
        setFormData({ entryType: 'New', name: '', sector: '', unit: '', mobile: '', whatsapp: '', email: '', sponsorId: '' });
        if (!finalData.sponsorId) {
          setIsSponsored(false); setCreatedSubId(subId); setPaymentAmount(3.000); setShowPaymentModal(true);
        } else setIsSponsored(false);
      }
    } else {
      const count = parseInt(sponsorData.count);
      if (!count || count <= 0) return;
      const amount = count * 3;
      const spoId = await onAddSponsor({ name: sponsorData.name, count, amount });
      if (spoId) {
        setSponsorData({ name: '', count: '' }); setCreatedSubId(spoId); setPaymentAmount(amount); setShowPaymentModal(true);
      }
    }
  };

  return (
    <div className="p-4 animate-fade-in pb-24">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Data Entry</h2>
          <p className="text-xs text-slate-500">Register entry or new sponsor</p>
        </div>
        <div className="flex bg-slate-200/70 p-1 rounded-xl shrink-0 border border-slate-200 shadow-inner">
          <button onClick={() => setFormTab('subscriber')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${formTab === 'subscriber' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Subscriber</button>
          <button onClick={() => setFormTab('sponsor')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${formTab === 'sponsor' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Sponsor</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {formTab === 'subscriber' ? (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Entry Type</label>
              <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <button type="button" onClick={() => setFormData({...formData, entryType: 'New'})} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition ${formData.entryType === 'New' ? 'bg-white shadow text-indigo-600 border border-slate-100' : 'text-slate-500'}`}>New Entry</button>
                <button type="button" onClick={() => setFormData({...formData, entryType: 'Renewal'})} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition ${formData.entryType === 'Renewal' ? 'bg-white shadow text-indigo-600 border border-slate-100' : 'text-slate-500'}`}>Renewal</button>
              </div>
            </div>

            <InputField icon={<User size={18}/>} label="Full Name" name="name" value={formData.name} onChange={handleChange} required />
            
            {/* Cascading Dropdowns for Sector & Unit */}
            <div className="flex space-x-3">
              <div className="flex-[1.2]">
                <SelectField icon={<MapPin size={18}/>} label="Sector" name="sector" value={formData.sector} onChange={handleChange} options={Object.keys(OMAN_SECTORS)} required />
              </div>
              <div className="flex-1">
                <SelectField icon={<MapPin size={18}/>} label="Unit" name="unit" value={formData.unit} onChange={handleChange} options={formData.sector ? OMAN_SECTORS[formData.sector] : []} disabled={!formData.sector} required />
              </div>
            </div>

            <InputField icon={<Phone size={18}/>} label="Mobile Number" name="mobile" type="tel" value={formData.mobile} onChange={handleChange} required />
            <InputField icon={<Phone size={18}/>} label="WhatsApp (Optional)" name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} />
            <InputField icon={<Mail size={18}/>} label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} />
            
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mt-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={isSponsored} onChange={e => setIsSponsored(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                <span className="text-sm font-bold text-indigo-900">Assign Global Sponsor</span>
              </label>
              
              {isSponsored && (
                <div className="mt-3 animate-fade-in">
                  <select name="sponsorId" value={formData.sponsorId} onChange={handleChange} required className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" >
                    <option value="">-- Select a Sponsor --</option>
                    {availableSponsors.map(sp => (
                      <option key={sp.id} value={sp.id}>{sp.name} - ({sp.available} remaining)</option>
                    ))}
                  </select>
                  {availableSponsors.length === 0 && <p className="text-[10px] font-bold text-red-500 mt-1.5 flex items-center"><AlertCircle size={12} className="mr-1"/> No sponsors with packages available globally.</p>}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <InputField icon={<User size={18}/>} label="Sponsor Name" name="name" value={sponsorData.name} onChange={handleSponsorChange} required />
            <InputField icon={<FileText size={18}/>} label="No. of Risala Sponsored" name="count" type="number" min="1" value={sponsorData.count} onChange={handleSponsorChange} required />
            {sponsorData.count && (
              <div className="p-4 bg-emerald-50 rounded-xl flex justify-between items-center text-emerald-800 border border-emerald-100">
                <span className="font-bold text-sm">Total Expected Amount:</span>
                <span className="font-bold text-xl tracking-tight">OMR {(sponsorData.count * 3).toFixed(3)}</span>
              </div>
            )}
          </>
        )}
        
        <button disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:bg-indigo-700 transition flex items-center justify-center mt-8 active:scale-95">
          {isLoading ? <span className="animate-spin mr-2"><RefreshCw size={18}/></span> : <CheckCircle2 size={18} className="mr-2" />}
          {formTab === 'subscriber' ? 'Submit Registration' : 'Register Sponsor'}
        </button>
      </form>

      {showPaymentModal && <PaymentModal subId={createdSubId} defaultAmount={paymentAmount} onClose={() => setShowPaymentModal(false)} onPaymentSubmit={onPayment} />}
    </div>
  );
}

function Records({ subscriptions, payments, transfers, onTransfer, onEditSubscription, onAddPayment, totalBalance }) {
  const [subTab, setSubTab] = useState('subs'); // subs, payments, transfer
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [paymentSubId, setPaymentSubId] = useState(null);

  useEffect(() => {
    const handleOpenTransfer = () => { setSubTab('transfer'); };
    window.addEventListener('OPEN_TRANSFERS', handleOpenTransfer);
    return () => window.removeEventListener('OPEN_TRANSFERS', handleOpenTransfer);
  }, []);

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="p-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">Database Records</h2>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setSubTab('subs')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${subTab === 'subs' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Entries</button>
          <button onClick={() => setSubTab('payments')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${subTab === 'payments' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Payments</button>
          <button onClick={() => setSubTab('transfer')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${subTab === 'transfer' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Transfers</button>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto pb-24 space-y-3 bg-slate-50">
        {subTab === 'subs' && (
          <>
            {subscriptions.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-100 transition">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-slate-800">{s.name}</h4>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${s.entryType === 'Renewal' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{s.entryType || 'New'}</span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 flex items-center mt-1"><MapPin size={10} className="mr-1"/> {s.area}</p>
                    <p className="text-[11px] font-medium text-slate-500 flex items-center mt-0.5"><Phone size={10} className="mr-1"/> {s.mobile}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">ID: {s.id.substring(0,6)}</span>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">{new Date(s.date).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="flex space-x-2 border-t border-slate-100 pt-3">
                  <button onClick={() => setEditingSub(s)} className="flex-1 flex items-center justify-center py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition border border-slate-200 active:scale-95">
                    <Edit2 size={14} className="mr-1.5" /> Edit Info
                  </button>
                  {(() => {
                    const paidAmount = payments.filter(p => p.subId === s.id).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                    const isFullyPaid = s.sponsorId || paidAmount >= 3.0;
                    return isFullyPaid ? (
                      <div className="flex-1 flex items-center justify-center py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200">
                        <CheckCircle2 size={14} className="mr-1.5 text-emerald-600" /> Fully Paid
                      </div>
                    ) : (
                      <button onClick={() => setPaymentSubId(s.id)} className="flex-1 flex items-center justify-center py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition border border-indigo-100 active:scale-95">
                        <CreditCard size={14} className="mr-1.5" /> Add Payment
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
            {subscriptions.length === 0 && <EmptyState msg="No entries found" />}
          </>
        )}

        {subTab === 'payments' && (
          <>
            {payments.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-emerald-600 text-lg">OMR {Number(p.amount).toFixed(3)}</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">ID: {p.subId.substring(0,8)}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${p.type === 'Cash' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'}`}>{p.type}</span>
                  <p className="text-[10px] font-medium text-slate-400 mt-1">{new Date(p.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {payments.length === 0 && <EmptyState msg="No payments recorded" />}
          </>
        )}

        {subTab === 'transfer' && (
          <div className="space-y-4">
            <div className="bg-indigo-600 rounded-2xl p-5 flex justify-between items-center animate-fade-in shadow-lg text-white">
              <div>
                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mb-1">Total Available to Transfer</p>
                <p className="text-2xl font-bold tracking-tight">OMR {totalBalance.toFixed(3)}</p>
              </div>
              <button onClick={() => setShowTransferModal(true)} className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-slate-50 transition active:scale-95">
                Transfer Out
              </button>
            </div>
            
            <h3 className="font-bold text-slate-800 text-sm pt-2">Transfer History</h3>
            <div className="space-y-3">
              {transfers.map(t => (
                <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-red-500 text-lg">- OMR {Number(t.amount).toFixed(3)}</h4>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">Ref: {t.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium text-slate-400 mt-1">{new Date(t.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {transfers.length === 0 && <EmptyState msg="No transfers yet" />}
            </div>
          </div>
        )}
      </div>

      {showTransferModal && <TransferModal maxAmount={totalBalance} onClose={() => setShowTransferModal(false)} onSubmit={async (data) => { const success = await onTransfer(data); if(success) setShowTransferModal(false); }} />}
      {editingSub && <EditEntryModal sub={editingSub} onClose={() => setEditingSub(null)} onSubmit={async (updatedData) => { const success = await onEditSubscription(updatedData); if(success) setEditingSub(null); }} />}
      {paymentSubId && <PaymentModal subId={paymentSubId} defaultAmount={3.000} onClose={() => setPaymentSubId(null)} onPaymentSubmit={async (data) => { const success = await onAddPayment(data); if(success) setPaymentSubId(null); return success; }} />}
    </div>
  );
}

function PaymentModal({ subId, defaultAmount = 3.000, onClose, onPaymentSubmit }) {
  const [amount, setAmount] = useState(defaultAmount);
  const [type, setType] = useState('Cash'); // Removed Cheque
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!amount || isNaN(amount)) return;
    setLoading(true);
    const success = await onPaymentSubmit({ subId, amount: Number(amount), type });
    setLoading(false);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in font-lex">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl scale-in">
        <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-lg tracking-tight">Collect Payment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Amount Received (OMR)</label>
            <input type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-2xl font-bold focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800" placeholder="3.000" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Payment Method</label>
            <div className="flex space-x-2">
              {['Cash', 'Online'].map(m => (
                <button key={m} type="button" onClick={() => setType(m)} className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition ${type === m ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-50 flex space-x-3 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:scale-95 transition">Cancel</button>
          <button onClick={handleUpdate} disabled={loading} className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-500 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:bg-emerald-600 flex justify-center items-center active:scale-95 transition">
             {loading ? <RefreshCw size={16} className="animate-spin"/> : 'Confirm'}
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
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center backdrop-blur-sm animate-fade-in font-lex">
      <div className="bg-white rounded-t-3xl w-full max-w-md overflow-hidden shadow-2xl animate-slide-up">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 text-lg tracking-tight">Transfer Cash</h3>
          <button onClick={onClose} className="text-slate-400 bg-white rounded-full p-1 shadow-sm"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-5 bg-white pb-safe">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Amount to Transfer (OMR)</label>
            <input type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-2xl font-bold focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="0.000" />
            <p className="text-[10px] font-bold text-indigo-500 mt-2">Max available: OMR {maxAmount.toFixed(3)}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Reference / Given To</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="e.g. Bank Deposit, Admin Name" />
          </div>
          <button onClick={handleTransfer} disabled={loading} className="w-full py-4 mt-2 rounded-xl font-bold text-white bg-indigo-600 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:bg-indigo-700 flex justify-center items-center active:scale-95 transition">
             {loading ? <RefreshCw size={16} className="animate-spin"/> : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditEntryModal({ sub, onClose, onSubmit }) {
  // Gracefully parse existing area string back to Sector/Unit
  const initialSector = Object.keys(OMAN_SECTORS).find(sec => sub.area?.startsWith(sec)) || '';
  const initialUnit = initialSector ? sub.area.replace(`${initialSector} - `, '') : '';

  const [formData, setFormData] = useState({ ...sub, sector: initialSector, unit: initialUnit });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    if (e.target.name === 'sector') setFormData({ ...formData, sector: e.target.value, unit: '' });
    else setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const finalData = { ...formData };
    finalData.area = finalData.sector ? `${finalData.sector} - ${finalData.unit}` : finalData.unit;
    delete finalData.sector;
    delete finalData.unit;
    await onSubmit(finalData);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center backdrop-blur-sm animate-fade-in font-lex">
      <div className="bg-white w-full max-w-md h-[90vh] rounded-t-3xl overflow-hidden shadow-2xl animate-slide-up flex flex-col">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800 text-lg">Edit Record</h3>
          <button onClick={onClose} className="text-slate-400 bg-white rounded-full p-1 shadow-sm"><X size={18}/></button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1 bg-white">
          <form id="editForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Entry Type</label>
              <div className="flex bg-slate-100 p-1.5 rounded-xl">
                <button type="button" onClick={() => setFormData({...formData, entryType: 'New'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${formData.entryType === 'New' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>New Entry</button>
                <button type="button" onClick={() => setFormData({...formData, entryType: 'Renewal'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${formData.entryType === 'Renewal' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Renewal</button>
              </div>
            </div>

            <InputField icon={<User size={18}/>} label="Full Name" name="name" value={formData.name} onChange={handleChange} required />
            
            <div className="flex space-x-3">
              <div className="flex-[1.2]"><SelectField icon={<MapPin size={18}/>} label="Sector" name="sector" value={formData.sector} onChange={handleChange} options={Object.keys(OMAN_SECTORS)} required /></div>
              <div className="flex-1"><SelectField icon={<MapPin size={18}/>} label="Unit" name="unit" value={formData.unit} onChange={handleChange} options={formData.sector ? OMAN_SECTORS[formData.sector] : []} disabled={!formData.sector} required /></div>
            </div>

            <InputField icon={<Phone size={18}/>} label="Mobile Number" name="mobile" type="tel" value={formData.mobile} onChange={handleChange} required />
            <InputField icon={<Phone size={18}/>} label="WhatsApp Number" name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleChange} />
            <InputField icon={<Mail size={18}/>} label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} />
            
            <div className="text-[11px] text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
              <span className="font-bold text-slate-700 uppercase tracking-wider block mb-1">Global Sponsor Link:</span> 
              {formData.sponsorId ? <span className="font-mono bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{formData.sponsorId}</span> : 'Direct Payment Mode'}
            </div>
          </form>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 shrink-0 pb-safe">
          <button type="submit" form="editForm" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:bg-indigo-700 transition flex items-center justify-center active:scale-95">
            {loading ? <RefreshCw size={18} className="animate-spin mr-2"/> : <Check size={18} className="mr-2" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Reports({ subscriptions, payments, sponsors, allSubscriptions }) {
  const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const cashAmount = payments.filter(p => p.type === 'Cash').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const onlineAmount = totalAmount - cashAmount;

  // Sponsorship logic
  const totalRisalaSponsored = sponsors.reduce((sum, sp) => sum + (sp.count || 0), 0);
  // Total Used is calculated by checking how many global subs used MY sponsors
  const mySponsorIds = sponsors.map(sp => sp.id);
  const usedRisala = allSubscriptions.filter(s => mySponsorIds.includes(s.sponsorId)).length;
  const availableRisala = Math.max(0, totalRisalaSponsored - usedRisala);

  // Sector logic
  const sectorCounts = subscriptions.reduce((acc, sub) => {
    const sector = sub.area ? sub.area.split(' - ')[0] : 'Unknown Sector';
    acc[sector] = (acc[sector] || 0) + 1;
    return acc;
  }, {});
  const sectorData = Object.entries(sectorCounts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);

  return (
    <div className="p-5 animate-fade-in pb-20 space-y-5">
      <h2 className="text-xl font-bold text-slate-800 tracking-tight">Performance Report</h2>
      
      {/* Sponsorship Overview Card */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
        <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center"><FileText size={14} className="mr-1.5"/> Sponsorship Overview</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
           <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-sm">
             <p className="text-xl font-bold text-indigo-900">{totalRisalaSponsored}</p>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total</p>
           </div>
           <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-sm">
             <p className="text-xl font-bold text-orange-500">{usedRisala}</p>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Used</p>
           </div>
           <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-sm">
             <p className="text-xl font-bold text-emerald-500">{availableRisala}</p>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Available</p>
           </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Overall Stats</h3>
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <span className="text-slate-600 text-sm font-semibold">Total Entries</span>
          <span className="font-bold text-lg text-slate-800">{subscriptions.length}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-slate-600 text-sm font-semibold">Total Revenue</span>
          <span className="font-bold text-lg text-emerald-600">OMR {totalAmount.toFixed(3)}</span>
        </div>
      </div>

      {/* Sector Breakdown Chart */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Sector Distribution</h3>
        <div className="space-y-4">
          {sectorData.map((s, i) => {
            const max = Math.max(...sectorData.map(d => d.count), 1);
            const pct = (s.count / max) * 100;
            return (
              <div key={s.name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-700">{s.name}</span>
                  <span className="font-bold text-indigo-600">{s.count}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
          {sectorData.length === 0 && <p className="text-xs text-slate-400 text-center py-2 font-medium">No entries yet</p>}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Collection Breakdown</h3>
        <div className="mb-5">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-bold text-slate-700">Cash</span>
            <span className="font-bold text-slate-800">OMR {cashAmount.toFixed(3)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: totalAmount ? `${(cashAmount/totalAmount)*100}%` : '0%' }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-bold text-slate-700">Online</span>
            <span className="font-bold text-slate-800">OMR {onlineAmount.toFixed(3)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: totalAmount ? `${(onlineAmount/totalAmount)*100}%` : '0%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 h-12 transition-all duration-200 ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
      <div className={`mb-1 transition-transform ${isActive ? 'scale-110 -translate-y-1' : ''}`}>{React.cloneElement(icon, { size: isActive ? 22 : 20, strokeWidth: isActive ? 2.5 : 2 })}</div>
      <span className="text-[10px] font-bold tracking-wide">{label}</span>
    </button>
  );
}

function InputField({ icon, label, ...props }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          {icon}
        </div>
        <input className="w-full pl-10 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition shadow-sm placeholder:font-normal" {...props} />
      </div>
    </div>
  );
}

function SelectField({ icon, label, options, ...props }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1 truncate">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          {icon}
        </div>
        <select className="w-full pl-9 pr-8 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition shadow-sm appearance-none disabled:bg-slate-50 disabled:text-slate-400 truncate" {...props}>
          <option value="" disabled>Select</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
          <ChevronDown size={16} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-slate-400">
      <Search size={40} className="mb-3 opacity-20" />
      <p className="text-sm font-bold tracking-wide">{msg}</p>
    </div>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&display=swap');
  
  html, body, #root { margin: 0; padding: 0; height: 100%; overflow: hidden; overscroll-behavior-y: none; }
  .font-lex { font-family: 'Lexend', sans-serif; }
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