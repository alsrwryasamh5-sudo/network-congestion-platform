import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  LayoutDashboard, Activity, Network, AlertTriangle, GitBranch,
  Brain, Database, FileText, Bell, Users, Settings, User,
  LogOut, ChevronLeft, ChevronRight, Globe, Zap, Server, Crown, Radio, Upload, Monitor, Router, Target, Shield,
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

  // 3 main sections - clean and focused
  const navSections = [
    {
      title: language === 'ar' ? 'المراقبة والتحليل' : 'Monitoring & Analysis',
      icon: <Activity size={12} />,
      items: [
        { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: language === 'ar' ? 'نظرة عامة' : 'Overview' },
        { to: '/noc', icon: <Monitor size={18} />, label: language === 'ar' ? 'مركز العمليات' : 'NOC Dashboard' },
        { to: '/devices', icon: <Router size={18} />, label: language === 'ar' ? 'أجهزة الشبكة' : 'Network Devices' },
        { to: '/root-cause', icon: <Target size={18} />, label: language === 'ar' ? 'تحليل السبب الجذري' : 'Root Cause' },
        { to: '/top-culprits', icon: <Crown size={18} />, label: language === 'ar' ? 'المسببون' : 'Top Culprits' },
        { to: '/shap', icon: <GitBranch size={18} />, label: language === 'ar' ? 'تفسير SHAP' : 'SHAP Explain' },
      ],
    },
    {
      title: language === 'ar' ? 'الذكاء الاصطناعي' : 'AI & Operations',
      icon: <Brain size={12} />,
      items: [
        { to: '/congestion', icon: <Network size={18} />, label: language === 'ar' ? 'كشف الازدحام' : 'Congestion Detect' },
        ...(isResearcher ? [{ to: '/training', icon: <Zap size={18} />, label: language === 'ar' ? 'تدريب النموذج' : 'Training' }] : []),
        { to: '/ingest', icon: <Upload size={18} />, label: language === 'ar' ? 'استقبال التدفقات' : 'Ingest Flows' },
        { to: '/reports', icon: <FileText size={18} />, label: language === 'ar' ? 'التقارير' : 'Reports' },
      ],
    },
    {
      title: language === 'ar' ? 'الإدارة' : 'Management',
      icon: <Settings size={12} />,
      items: [
        { to: '/notifications', icon: <Bell size={18} />, label: language === 'ar' ? 'الإشعارات' : 'Notifications' },
        ...(isAdmin ? [{ to: '/users', icon: <Users size={18} />, label: language === 'ar' ? 'المستخدمون' : 'Users' }] : []),
        { to: '/profile', icon: <User size={18} />, label: language === 'ar' ? 'الملف الشخصي' : 'Profile' },
        { to: '/settings', icon: <Settings size={18} />, label: language === 'ar' ? 'الإعدادات' : 'Settings' },
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

      {/* User info bar */}
      {!collapsed && user && (
        <div className="px-4 py-3 border-b border-cyber-border bg-cyber-bg/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyber-gradient flex items-center justify-center text-white text-xs font-bold">
              {user.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-cyber-text truncate">{user.full_name || user.username}</div>
              <div className="text-[10px] text-cyber-muted capitalize">{user.role}</div>
            </div>
            <div className="w-2 h-2 rounded-full bg-cyber-success animate-pulse" title="Online" />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 py-3 space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="flex items-center gap-2 px-3 mb-2 text-[10px] uppercase tracking-wider text-cyber-muted font-semibold">
                {section.icon}
                <span>{section.title}</span>
                <div className="flex-1 h-px bg-cyber-border/50 ml-1"></div>
              </div>
            )}
            {collapsed && (
              <div className="px-3 mb-2 mt-3">
                <div className="h-px bg-cyber-border/50"></div>
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
