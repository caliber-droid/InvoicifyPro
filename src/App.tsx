import React, { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  Bell,
  BellRing,
  Bot,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from './components/BrandLogo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SponsoredBanner } from './components/SponsoredBanner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { markNotificationRead } from './lib/firestoreRepo';
import { PageTransition } from './lib/motion';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { PublicPortalPage } from './pages/PublicPortalPage';
import { AdminView } from './pages/app/AdminView';
import { AnalyticsView } from './pages/app/AnalyticsView';
import { ClientsView } from './pages/app/ClientsView';
import { DashboardView } from './pages/app/DashboardView';
import { DocumentsView } from './pages/app/DocumentsView';
import { EstimatesView } from './pages/app/EstimatesView';
import { ExpensesView } from './pages/app/ExpensesView';
import { InvoicesView } from './pages/app/InvoicesView';
import { PaymentsView } from './pages/app/PaymentsView';
import { PilotAiView } from './pages/app/PilotAiView';
import { RecurringView } from './pages/app/RecurringView';
import { RemindersView } from './pages/app/RemindersView';
import { SettingsView } from './pages/app/SettingsView';
import { SubscriptionView } from './pages/app/SubscriptionView';
import { PLAN_CONFIGS } from './types/models';

type AppTab =
  | 'dashboard'
  | 'invoices'
  | 'estimates'
  | 'clients'
  | 'payments'
  | 'reminders'
  | 'expenses'
  | 'recurring'
  | 'analytics'
  | 'pilot'
  | 'documents'
  | 'settings'
  | 'subscription'
  | 'admin';

const WorkspaceShell: React.FC<{ onOpenPortalToken: (token: string) => void }> = ({
  onOpenPortalToken,
}) => {
  const reduced = useReducedMotion();
  const { userAccount, businessProfile, isAdmin, logout } = useAuth();
  const { notifications, unreadNotificationsCount } = useData();

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Quick-action triggers
  const [invoiceTrigger, setInvoiceTrigger] = useState(0);
  const [estimateTrigger, setEstimateTrigger] = useState(0);
  const [clientTrigger, setClientTrigger] = useState(0);
  const [paymentTrigger, setPaymentTrigger] = useState(0);
  const [expenseTrigger, setExpenseTrigger] = useState(0);

  const navItems: Array<{ id: AppTab; label: string; icon: React.ReactNode; group: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" />, group: 'Core' },
    { id: 'invoices', label: 'Invoices', icon: <FileText className="w-4 h-4 shrink-0" />, group: 'Core' },
    { id: 'estimates', label: 'Estimates', icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />, group: 'Core' },
    { id: 'clients', label: 'Clients', icon: <Users className="w-4 h-4 shrink-0" />, group: 'Core' },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4 shrink-0" />, group: 'Core' },
    { id: 'reminders', label: 'Reminders', icon: <BellRing className="w-4 h-4 shrink-0" />, group: 'Automation' },
    { id: 'recurring', label: 'Recurring', icon: <CalendarClock className="w-4 h-4 shrink-0" />, group: 'Automation' },
    { id: 'expenses', label: 'Expenses', icon: <Receipt className="w-4 h-4 shrink-0" />, group: 'Operations' },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4 shrink-0" />, group: 'Operations' },
    { id: 'pilot', label: 'Pilot AI', icon: <Bot className="w-4 h-4 shrink-0" />, group: 'Operations' },
    { id: 'documents', label: 'Documents', icon: <FolderOpen className="w-4 h-4 shrink-0" />, group: 'Operations' },
    { id: 'subscription', label: 'Subscription', icon: <Sparkles className="w-4 h-4 shrink-0" />, group: 'Account' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4 shrink-0" />, group: 'Account' },
    ...(isAdmin
      ? [{ id: 'admin' as AppTab, label: 'Admin', icon: <Shield className="w-4 h-4 shrink-0" />, group: 'Account' }]
      : []),
  ];

  const navigate = (tab: string) => {
    setActiveTab(tab as AppTab);
    setMobileMenuOpen(false);
  };

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigate={navigate}
            onQuickCreateInvoice={() => {
              setActiveTab('invoices');
              setInvoiceTrigger((n) => n + 1);
            }}
            onQuickCreateEstimate={() => {
              setActiveTab('estimates');
              setEstimateTrigger((n) => n + 1);
            }}
            onQuickAddClient={() => {
              setActiveTab('clients');
              setClientTrigger((n) => n + 1);
            }}
            onQuickRecordPayment={() => {
              setActiveTab('payments');
              setPaymentTrigger((n) => n + 1);
            }}
            onQuickAddExpense={() => {
              setActiveTab('expenses');
              setExpenseTrigger((n) => n + 1);
            }}
          />
        );
      case 'invoices':
        return <InvoicesView openNewTrigger={invoiceTrigger} onOpenPortalToken={onOpenPortalToken} />;
      case 'estimates':
        return (
          <EstimatesView
            openNewTrigger={estimateTrigger}
            onOpenPortalToken={onOpenPortalToken}
            onConvertedToInvoice={() => setActiveTab('invoices')}
          />
        );
      case 'clients':
        return <ClientsView openNewTrigger={clientTrigger} />;
      case 'payments':
        return <PaymentsView openNewTrigger={paymentTrigger} onOpenPortalToken={onOpenPortalToken} />;
      case 'reminders':
        return <RemindersView />;
      case 'expenses':
        return <ExpensesView openNewTrigger={expenseTrigger} />;
      case 'recurring':
        return <RecurringView onNavigate={navigate} />;
      case 'analytics':
        return <AnalyticsView />;
      case 'pilot':
        return <PilotAiView onNavigate={navigate} />;
      case 'documents':
        return <DocumentsView />;
      case 'subscription':
        return <SubscriptionView />;
      case 'settings':
        return <SettingsView />;
      case 'admin':
        return <AdminView />;
      default:
        return null;
    }
  };

  const planName = PLAN_CONFIGS[userAccount?.plan || 'free'].name;

  const NavList: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
    <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto" aria-label="Workspace navigation">
      {navItems.map((item) => {
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            title={compact ? item.label : undefined}
            className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              active ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            {active && (
              <motion.span
                layoutId={compact ? 'sidebarActivePillCompact' : 'sidebarActivePill'}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 bg-[#2563EB] rounded-lg"
              />
            )}
            <span className="relative z-10 flex items-center gap-3 min-w-0">
              {item.icon}
              {!compact && <span className="truncate">{item.label}</span>}
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[#172B4D] text-white shrink-0 transition-[width] duration-200 border-r border-slate-800 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[244px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
          <BrandLogo lightText showText={!sidebarCollapsed} size="sm" />
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <NavList compact={sidebarCollapsed} />

        <div className="p-3 border-t border-white/10 space-y-2">
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => navigate('subscription')}
              className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <p className="text-[11px] text-slate-400 uppercase tracking-wider">Current Plan</p>
              <p className="text-xs font-semibold text-white">{planName} Tier</p>
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Slide-in Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-[#0F1D36]/50"
            />
            <motion.aside
              initial={reduced ? false : { x: '-100%' }}
              animate={{ x: 0 }}
              exit={reduced ? undefined : { x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-64 bg-[#172B4D] text-white flex flex-col h-full shadow-2xl"
            >
              <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
                <BrandLogo lightText size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <NavList />
              <div className="p-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#172033] truncate">
                {businessProfile?.businessName || userAccount?.displayName || 'Workspace'}
              </p>
              <p className="text-xs text-slate-500 hidden sm:block truncate">
                {businessProfile?.businessEmail || userAccount?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setActiveTab('pilot')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask Pilot AI</span>
            </button>

            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              aria-label="Notifications"
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <img
                src={
                  businessProfile?.logoDataUrl ||
                  '/src/assets/images/avatar_consultant_profile_1795032859936.jpg'
                }
                alt="Account avatar"
                className="w-7 h-7 rounded-full object-cover border border-slate-200"
              />
              <span className="hidden md:inline text-xs font-medium text-[#172033]">
                {userAccount?.displayName?.split(' ')[0] || 'Account'}
              </span>
            </button>

            {/* Notifications Popover */}
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: 6 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#172033]">Notifications</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 12).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={async () => {
                            if (!n.read) await markNotificationRead(n.id);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                            !n.read ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <p className="text-xs font-semibold text-[#172033]">{n.title}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <SponsoredBanner />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <PageTransition routeKey={activeTab}>{renderView()}</PageTransition>
          </AnimatePresence>
        </main>

        <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} InvoicifyPro &middot; USD Billing &amp; Cash Flow Platform</span>
          <span>Smart Invoicing. Faster Payments. Better Business.</span>
        </footer>
      </div>
    </div>
  );
};

const RootRouter: React.FC = () => {
  const { firebaseUser, userAccount, businessProfile, loading } = useAuth();
  const [authScreen, setAuthScreen] = useState<'none' | 'login' | 'register'>('none');
  const [portalToken, setPortalToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('portal');
  });

  useEffect(() => {
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      setPortalToken(params.get('portal'));
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    if (firebaseUser?.emailVerified && authScreen !== 'none') {
      setAuthScreen('none');
    }
  }, [firebaseUser?.emailVerified, authScreen]);

  const openPortalToken = (token: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('portal', token);
    window.history.pushState({}, '', url.toString());
    setPortalToken(token);
  };

  const exitPortal = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('portal');
    window.history.pushState({}, '', url.toString());
    setPortalToken(null);
  };

  if (portalToken) {
    return <PublicPortalPage shareToken={portalToken} onExitPortal={exitPortal} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center gap-4">
        <BrandLogo size="lg" />
        <div className="w-40 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-[#2563EB] rounded-full skeleton-shimmer" />
        </div>
      </div>
    );
  }

  // Signed in but email not verified -> AuthPage renders verification gate
  if (firebaseUser && !firebaseUser.emailVerified) {
    return <AuthPage initialMode="login" onBackToSite={() => setAuthScreen('none')} />;
  }

  // Verified user authenticated
  if (firebaseUser && firebaseUser.emailVerified) {
    if (!userAccount?.onboarded || !businessProfile) {
      return <OnboardingWizard onComplete={() => {}} />;
    }
    return <WorkspaceShell onOpenPortalToken={openPortalToken} />;
  }

  // Public views
  if (authScreen !== 'none') {
    return <AuthPage initialMode={authScreen} onBackToSite={() => setAuthScreen('none')} />;
  }

  return (
    <LandingPage
      isAuthenticated={false}
      onStartAuth={(mode) => setAuthScreen(mode)}
      onEnterApp={() => setAuthScreen('login')}
    />
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <DataProvider>
              <RootRouter />
            </DataProvider>
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
