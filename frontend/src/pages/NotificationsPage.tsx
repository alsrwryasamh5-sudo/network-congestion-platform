import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCheck, Trash2, AlertTriangle, CheckCircle,
  Info, AlertCircle, Zap, FileText, Settings as SettingsIcon,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge, Skeleton } from '../components/Card';
import { apiGet, apiPost, apiDelete } from '../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  const load = () => {
    setLoading(true);
    apiGet('/admin/notifications?page=1&per_page=50')
      .then(r => setNotifications(r.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: number) => {
    try {
      await apiPost(`/admin/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiPost('/admin/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle size={18} className="text-cyber-danger" />;
      case 'success': return <CheckCircle size={18} className="text-cyber-success" />;
      case 'warning': return <AlertCircle size={18} className="text-cyber-warning" />;
      case 'info': return <Info size={18} className="text-cyber-info" />;
      default: return <Bell size={18} className="text-cyber-primary" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'alert': return 'bg-cyber-danger/15';
      case 'success': return 'bg-cyber-success/15';
      case 'warning': return 'bg-cyber-warning/15';
      case 'info': return 'bg-cyber-info/15';
      default: return 'bg-cyber-primary/15';
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'critical') return n.type === 'alert';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const criticalCount = notifications.filter(n => n.type === 'alert').length;

  return (
    <Layout title={t('nav.notifications')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {[
              { label: 'All', value: 'all' as const, count: notifications.length },
              { label: 'Unread', value: 'unread' as const, count: unreadCount },
              { label: 'Critical', value: 'critical' as const, count: criticalCount },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5',
                  filter === f.value
                    ? 'bg-cyber-primary text-white'
                    : 'bg-cyber-card text-cyber-muted hover:text-cyber-text'
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded-full text-[10px]',
                    filter === f.value ? 'bg-white/20' : 'bg-cyber-bg/60'
                  )}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            <CheckCheck size={14} /> Mark all as read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <Card>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-cyber-card flex items-center justify-center mx-auto mb-4">
              <Bell size={28} className="text-cyber-muted" />
            </div>
            <h3 className="text-lg font-medium text-cyber-text mb-1">No notifications</h3>
            <p className="text-cyber-muted text-sm">
              {filter === 'unread' ? 'You\'re all caught up!' : 'Notifications will appear here when events occur.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.03 }}
                  className={clsx(
                    'flex items-start gap-3 p-4 rounded-xl border transition group',
                    n.is_read
                      ? 'bg-cyber-bg/20 border-cyber-border'
                      : 'bg-cyber-bg/40 border-cyber-primary/30'
                  )}
                >
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', getIconBg(n.type))}>
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className={clsx('text-sm', n.is_read ? 'text-cyber-muted font-normal' : 'text-cyber-text font-semibold')}>
                        {n.title}
                      </h4>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-cyber-primary animate-pulse"></span>}
                    </div>
                    <p className="text-xs text-cyber-muted mb-1.5">{n.message}</p>
                    <div className="flex items-center gap-3 text-[10px] text-cyber-muted">
                      <span className="flex items-center gap-1">
                        {n.category === 'congestion' && <Zap size={10} />}
                        {n.category === 'report' && <FileText size={10} />}
                        {n.category === 'system' && <SettingsIcon size={10} />}
                        {n.category || 'general'}
                      </span>
                      <span>·</span>
                      <span>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    {!n.is_read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1.5 rounded-lg hover:bg-cyber-card text-cyber-muted hover:text-cyber-primary"
                        title="Mark as read"
                      >
                        <CheckCheck size={14} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>
    </Layout>
  );
}
