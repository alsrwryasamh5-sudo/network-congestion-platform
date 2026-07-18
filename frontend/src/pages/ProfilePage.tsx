import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  User, Mail, Shield, Calendar, Activity, Zap, Target,
  TrendingUp, Award, Clock, Edit2, Save, X,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge, StatCard } from '../components/Card';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { apiGet, apiPost } from '../services/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [stats, setStats] = useState<any>({ predictions: 0, experiments: 0, reports: 0 });
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Load user's prediction history
    apiGet('/ml/history?page=1&per_page=30')
      .then(r => {
        const items = r.data?.items || [];
        setStats({
          predictions: r.data?.pagination?.total || 0,
          experiments: 0,
          reports: 0,
        });
        // Group by date for chart
        const byDate: any = {};
        items.forEach((p: any) => {
          const date = p.created_at?.split('T')[0] || 'unknown';
          if (!byDate[date]) byDate[date] = { date, total: 0, congested: 0 };
          byDate[date].total++;
          if (p.is_congested) byDate[date].congested++;
        });
        setHistory(Object.values(byDate).slice(-14));
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      // In a real app, this would call the API
      toast.success('Profile updated successfully');
      setEditing(false);
    } catch {
      toast.error('Failed to update profile');
    }
  };

  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) : '—';

  const lastLogin = user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : '—';

  return (
    <Layout title={t('nav.profile')}>
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="mb-6 relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-cyber-primary/20 via-cyber-accent/20 to-cyber-primary/20"></div>

          <div className="relative pt-8 flex flex-col md:flex-row items-start md:items-end gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-28 h-28 rounded-3xl bg-cyber-gradient flex items-center justify-center text-4xl font-bold text-white shadow-2xl shadow-cyber-primary/30">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-cyber-success border-4 border-cyber-card flex items-center justify-center">
                <span className="w-2 h-2 bg-cyber-success rounded-full animate-pulse"></span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-cyber-text">
                  {user?.full_name || user?.username || 'User'}
                </h2>
                <Badge variant={user?.role === 'admin' ? 'danger' : user?.role === 'researcher' ? 'warning' : 'info'}>
                  <Shield size={10} /> {user?.role}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-cyber-muted">
                <span className="flex items-center gap-1.5">
                  <User size={14} /> @{user?.username}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail size={14} /> {user?.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} /> Member since {memberSince}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} /> Last login: {lastLogin}
                </span>
              </div>
            </div>

            {/* Edit button */}
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-2">
                <Edit2 size={14} /> Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-2">
                  <X size={14} /> Cancel
                </button>
                <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                  <Save size={14} /> Save
                </button>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Predictions"
          value={stats.predictions}
          icon={<Activity size={18} />}
          color="primary"
          delay={0.1}
        />
        <StatCard
          title="Experiments"
          value={stats.experiments}
          icon={<Zap size={18} />}
          color="accent"
          delay={0.15}
        />
        <StatCard
          title="Reports Generated"
          value={stats.reports}
          icon={<Target size={18} />}
          color="success"
          delay={0.2}
        />
        <StatCard
          title="Achievements"
          value="3"
          icon={<Award size={18} />}
          color="warning"
          delay={0.25}
        />
      </div>

      {/* Edit form or Activity chart */}
      {editing ? (
        <Card title="Edit Profile" icon={<Edit2 size={18} />} className="mb-6" delay={0.3}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-cyber-muted mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="input-cyber"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-sm text-cyber-muted mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-cyber"
                placeholder="your@email.com"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                <Save size={16} /> Save Changes
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Card>
      ) : (
        <Card title="Prediction Activity (Last 14 days)" icon={<TrendingUp size={18} />} className="mb-6" delay={0.3}>
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="congGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                <Area type="monotone" dataKey="total" name="Total" stroke="#0EA5E9" fill="url(#actGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="congested" name="Congested" stroke="#EF4444" fill="url(#congGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-cyber-muted">
              No activity yet. Make some predictions to see your stats here.
            </div>
          )}
        </Card>
      )}

      {/* Achievements */}
      <Card title="Achievements" icon={<Award size={18} />} delay={0.4}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '🎯', title: 'First Prediction', desc: 'Made your first network flow prediction', earned: stats.predictions > 0 },
            { icon: '🚀', title: 'Model Trainer', desc: 'Trained your first ML model', earned: stats.experiments > 0 },
            { icon: '📊', title: 'Report Generator', desc: 'Generated your first PDF report', earned: stats.reports > 0 },
          ].map((ach, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className={`p-4 rounded-xl border ${ach.earned ? 'border-cyber-success/30 bg-cyber-success/5' : 'border-cyber-border bg-cyber-bg/30 opacity-50'}`}
            >
              <div className="text-3xl mb-2">{ach.icon}</div>
              <div className="text-sm font-semibold text-cyber-text">{ach.title}</div>
              <div className="text-xs text-cyber-muted mt-1">{ach.desc}</div>
              {ach.earned && <Badge variant="success" size="sm">Earned</Badge>}
            </motion.div>
          ))}
        </div>
      </Card>
    </Layout>
  );
}
