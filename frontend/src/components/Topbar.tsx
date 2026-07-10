import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Bell, Search, Menu, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import clsx from 'clsx';

interface TopbarProps {
  title: string;
  onMenuClick?: () => void;
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-16 sticky top-0 z-20 bg-cyber-surface/80 backdrop-blur-xl border-b border-cyber-border flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button onClick={onMenuClick} className="md:hidden btn-ghost">
            <Menu size={20} />
          </button>
        )}
        <h1 className="text-xl font-bold text-cyber-text">{title}</h1>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden md:flex items-center gap-2 bg-cyber-bg/60 border border-cyber-border rounded-xl px-3 py-2 w-64">
          <Search size={16} className="text-cyber-muted" />
          <input
            type="text"
            placeholder={t('common.search')}
            className="bg-transparent outline-none text-sm text-cyber-text placeholder-cyber-muted flex-1"
          />
        </div>

        <button className="relative btn-ghost">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-cyber-danger rounded-full"></span>
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-cyber-card transition"
          >
            <div className="w-8 h-8 rounded-full bg-cyber-gradient flex items-center justify-center text-white font-bold text-sm">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-cyber-text">{user?.full_name || user?.username}</div>
              <div className="text-[10px] text-cyber-muted capitalize">{user?.role}</div>
            </div>
            <ChevronDown size={14} className="text-cyber-muted" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-0 rtl:left-auto rtl:right-0 mt-2 w-56 glass-card p-2 z-50"
              >
                <div className="px-3 py-2 border-b border-cyber-border mb-1">
                  <div className="text-sm font-medium text-cyber-text">{user?.username}</div>
                  <div className="text-xs text-cyber-muted">{user?.email}</div>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-cyber-card text-sm text-cyber-text"
                >
                  <User size={16} /> {t('nav.profile')}
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-cyber-card text-sm text-cyber-text"
                >
                  <Settings size={16} /> {t('nav.settings')}
                </Link>
                <button
                  onClick={() => {
                    dispatch(logout());
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-cyber-card text-sm text-cyber-danger"
                >
                  <LogOut size={16} /> {t('auth.logout')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
