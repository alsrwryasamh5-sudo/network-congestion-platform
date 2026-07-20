import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCheck, Trash2, AlertTriangle, CheckCircle,
  Info, AlertCircle, Zap, FileText, Settings as SettingsIcon,
  Radio, Activity, RefreshCw,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge, Skeleton } from '../components/Card';
import { apiGet, apiPost } from '../services/api';
import { dashboardService } from '../services/dashboardService';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'live'>('all');

  const load = () => {
    setLoading(true);
    Promise.all([
      apiGet('/admin/notifications?page=1&per_page=50'),
      dashboardService.noc(),
    ]).then(([notifRes, nocRes]) => {
      setNotifications(notifRes.data?.items || []);
      setLiveAlerts(nocRes.data?.alert_timeline || []);
    }).catch(() => {}).finally(() => setLoading(false));
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

  const filtered = filter === 'live' ? liveAlerts.map(a => ({
    id: a.id,
    type: a.severity === 'critical' ? 'alert' : 'warning',
    category: 'congestion',
    title: `${a.problem}`,
    message: `Device: ${a.device} · Interface: ${a.interface} · Confidence: ${a.confidence}%`,
    is_read: false,
    created_at: a.timestamp,
    action_url: '/noc',
    is_live: true,
  })) : notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'critical') return n.type === 'alert';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const criticalCount = notifications.filter(n => n.type === 'alert').length;

  return (
    <Layout title={t('nav.notifications')}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {[
            { label: 'All', value: 'all' as const, count: notifications.length },
            { label: 'Unread', value: 'unread' as const, count: unreadCount },
            { label: 'Critical', value: 'critical' as const, count: criticalCount },
            { label: 'Live Alerts', value: 'live' as const, count: liveAlerts.length },
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
              {f.value === 'live' && <Radio size={12} className="animate-pulse" />}
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
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary text-xs flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
          {unreadCount > 0 && filter !== 'live' && (
            <button onClick={markAllRead} className="btn-secondary text-xs flex items-center gap-2">
              <CheckCheck size={14} /> Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Live banner */}
      {filter === 'live' && liveAlerts.length > 0 && (
        <div className="glass-card p-3 mb-4 border-l-4 border-l-cyber-danger flex items-center gap-2">
          <Radio size={16} className="text-cyber-danger animate-pulse" />
          <span className="text-sm text-cyber-text">
            <strong>{liveAlerts.length}</strong> live alerts from NOC monitoring
          </span>
        </div>
      )}

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
            <h3 className="text-lg font-medium text-cyber-text mb-1">
              {filter === 'live' ? 'No live alerts' : 'No notifications'}
            </h3>
            <p className="text-cyber-muted text-sm">
              {filter === 'unread' ? "You're all caught up!" :
               filter === 'live' ? 'Network is healthy - no active alerts' :
               'Notifications will appear here when events occur.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((n, i) => (
                <motion.div
                  key={`${n.id}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.03 }}
                  className={clsx(
                    'flex items-start gap-3 p-4 rounded-xl border transition group',
                    n.is_live ? 'border-cyber-danger/30 bg-cyber-danger/5' :
                    n.is_read ? 'bg-cyber-bg/20 border-cyber-border' : 'bg-cyber-bg/40 border-cyber-primary/30'
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
                      {n.is_live && <Badge variant="danger" size="sm"><Radio size={8} className="mr-1" />LIVE</Badge>}
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
                  <div className="flex items-center gap-1">
                    {!n.is_read && !n.is_live && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1.5 rounded-lg hover:bg-cyber-card text-cyber-muted hover:text-cyber-primary opacity-0 group-hover:opacity-100 transition"
                        title="Mark as read"
                      >
                        <CheckCheck size={14} />
                      </button>
                    )}
                    {n.action_url && (
                      <a
                        href={n.action_url}
                        className="p-1.5 rounded-lg hover:bg-cyber-card text-cyber-muted hover:text-cyber-primary opacity-0 group-hover:opacity-100 transition"
                        title="View"
                      >
                        <Activity size={14} />
                      </a>
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
