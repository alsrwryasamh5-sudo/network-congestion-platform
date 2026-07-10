import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  LayoutDashboard, Activity, Network, AlertTriangle, Search, GitBranch,
  BarChart3, Brain, Database, FileText, Bell, Users, Settings, User,
  Heart, LogOut, ChevronLeft, ChevronRight, Globe, Zap, Server, Crown,
} from 'lucide-react';
import clsx from 'clsx';
import { RootState, AppDispatch } from '../store';
import { toggleSidebar, toggleLanguage } from '../store/slices/uiSlice';
import { logout } from '../store/slices/authSlice';

export function Sidebar() {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
  const language = useSelector((s: RootState) => s.ui.language);
  const user = useSelector((s: RootState) => s.auth.user);

  const isAdmin = user?.role === 'admin';
  const isResearcher = user?.role === 'admin' || user?.role === 'researcher';

  const navSections = [
    {
      title: t('nav.dashboard'),
      items: [
        { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: t('nav.overview') },
        { to: '/analytics', icon: <Activity size={18} />, label: t('nav.analytics') },
        { to: '/congestion', icon: <Network size={18} />, label: t('nav.congestion') },
        { to: '/root-cause', icon: <AlertTriangle size={18} />, label: t('nav.rootCause') },
        { to: '/top-culprits', icon: <Crown size={18} />, label: 'أكثر الأجهزة إسهاماً' },
        { to: '/shap', icon: <GitBranch size={18} />, label: t('nav.shap') },
        { to: '/performance', icon: <BarChart3 size={18} />, label: t('nav.performance') },
      ],
    },
    {
      title: t('nav.prediction'),
      items: [
        { to: '/prediction', icon: <Brain size={18} />, label: t('nav.prediction') },
        ...(isResearcher ? [{ to: '/training', icon: <Zap size={18} />, label: t('nav.training') }] : []),
        { to: '/datasets', icon: <Database size={18} />, label: t('nav.datasets') },
        { to: '/reports', icon: <FileText size={18} />, label: t('nav.reports') },
      ],
    },
    {
      title: t('nav.system'),
      items: [
        { to: '/alerts', icon: <AlertTriangle size={18} />, label: t('nav.alerts') },
        { to: '/notifications', icon: <Bell size={18} />, label: t('nav.notifications') },
        ...(isAdmin ? [{ to: '/users', icon: <Users size={18} />, label: t('nav.users') }] : []),
        { to: '/system', icon: <Heart size={18} />, label: t('nav.system') },
        ...(isAdmin ? [{ to: '/logs', icon: <Search size={18} />, label: t('nav.logs') }] : []),
      ],
    },
    {
      title: t('nav.profile'),
      items: [
        { to: '/profile', icon: <User size={18} />, label: t('nav.profile') },
        { to: '/settings', icon: <Settings size={18} />, label: t('nav.settings') },
        { to: '/about', icon: <FileText size={18} />, label: t('nav.about') },
        { to: '/help', icon: <Search size={18} />, label: t('nav.help') },
        { to: '/feedback', icon: <FileText size={18} />, label: t('nav.feedback') },
      ],
    },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.25 }}
      className="h-screen sticky top-0 bg-cyber-surface/80 backdrop-blur-xl border-r border-cyber-border flex flex-col z-30"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-cyber-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-cyber-gradient flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyber-primary/30">
            <Network size={20} className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-cyber-text whitespace-nowrap">NetCongestion</div>
              <div className="text-[10px] text-cyber-muted whitespace-nowrap">AI Detection Platform</div>
            </div>
          )}
        </div>
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="text-cyber-muted hover:text-cyber-text p-1 rounded-lg hover:bg-cyber-card"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 py-4 space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="px-4 mb-1 text-[10px] uppercase tracking-wider text-cyber-muted font-semibold">
                {section.title}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx('nav-link', isActive && 'nav-link-active', collapsed && 'justify-center px-2')
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!collapsed && <span className="text-sm">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-cyber-border p-3 space-y-2">
        <button
          onClick={() => dispatch(toggleLanguage())}
          className={clsx('nav-link w-full', collapsed && 'justify-center px-2')}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          <Globe size={18} />
          {!collapsed && <span className="text-sm">{language === 'en' ? 'العربية' : 'English'}</span>}
        </button>
        <button
          onClick={() => {
            dispatch(logout());
            navigate('/login');
          }}
          className={clsx('nav-link w-full hover:text-cyber-danger', collapsed && 'justify-center px-2')}
          title={t('auth.logout')}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-sm">{t('auth.logout')}</span>}
        </button>
      </div>
    </motion.aside>
  );
}
