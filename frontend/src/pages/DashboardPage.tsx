import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle, Cpu, Database, Gauge,
  Network, Shield, TrendingUp, Users, Zap, HardDrive, MemoryStick, Server,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, StatCard, Badge } from '../components/Card';
import { dashboardService } from '../services/dashboardService';
import { apiPost } from '../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

export function DashboardPage() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardService.overview(),
      dashboardService.networkHealth(),
      dashboardService.recentPredictions(8),
    ])
      .then(([o, h, r]) => {
        setOverview(o.data);
        setHealth(h.data);
        setRecent(r.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const severityData = overview
    ? Object.entries(overview.severity_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const protocolData = overview
    ? Object.entries(overview.protocol_distribution).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <Layout title={t('nav.overview')}>
      {/* Seed data button (if no predictions) */}
      {overview && overview.total_predictions === 0 && (
        <Card className="mb-4 border-cyber-warning/30 bg-cyber-warning/5">
          <div className="flex items-start gap-3">
            <Zap size={20} className="text-cyber-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-cyber-warning mb-1">لا توجد بيانات في الواجهة بعد</h4>
              <p className="text-sm text-cyber-muted mb-3">
                لتعبئة الواجهات بالبيانات، اضغط الزر أدناه لتوليد تنبؤات تجريبية بناءً على النموذج المُدرَّب.
                يمكنك أيضاً تدريب النموذج من صفحة Training لتعبئة البيانات تلقائياً.
              </p>
              <button
                onClick={async () => {
                  try {
                    toast.loading('جاري تعبئة البيانات...', { id: 'seed' });
                    const r = await apiPost('/ml/seed-database', {
                      n_predictions: 200,
                      congested_ratio: 0.4,
                      hours_back: 72,
                    });
                    toast.success(`تم توليد ${r.data.predictions_created} تنبؤ بنجاح!`, { id: 'seed' });
                    setTimeout(() => window.location.reload(), 1500);
                  } catch {
                    toast.error('فشل التعبئة', { id: 'seed' });
                  }
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Zap size={16} /> تعبئة الواجهات بالبيانات
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
        <StatCard
          title={t('dashboard.totalPredictions')}
          value={overview?.total_predictions ?? '—'}
          icon={<Activity size={18} />}
          color="primary"
          delay={0}
        />
        <StatCard
          title={t('dashboard.congestedFlows')}
          value={overview?.congested_count ?? '—'}
          icon={<AlertTriangle size={18} />}
          color="danger"
          delay={0.05}
        />
        <StatCard
          title={t('dashboard.congestionRate')}
          value={`${overview?.congestion_rate ?? 0}%`}
          icon={<TrendingUp size={18} />}
          color="warning"
          delay={0.1}
        />
        <StatCard
          title={t('dashboard.activeEvents')}
          value={overview?.active_events ?? '—'}
          icon={<Zap size={18} />}
          color="accent"
          delay={0.15}
        />
        <StatCard
          title={t('dashboard.resolvedEvents')}
          value={overview?.resolved_events ?? '—'}
          icon={<CheckCircle size={18} />}
          color="success"
          delay={0.2}
        />
        <StatCard
          title={t('dashboard.predictions24h')}
          value={overview?.predictions_24h ?? '—'}
          icon={<Gauge size={18} />}
          color="info"
          delay={0.25}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Network health */}
        <Card title={t('dashboard.networkHealth')} icon={<Network size={18} />} className="lg:col-span-2" delay={0.3}>
          {health && (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={health.labels.map((label: string, i: number) => ({
                time: label,
                latency: health.latency_ms[i].value,
                bandwidth: health.bandwidth_mbps[i],
                jitter: health.jitter_ms[i],
              }))}>
                <defs>
                  <linearGradient id="lat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: '#131B30', border: '1px solid #1E2A47',
                    borderRadius: '12px', color: '#E2E8F0',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="latency" name={t('dashboard.latency')} stroke="#0EA5E9" fill="url(#lat)" strokeWidth={2} />
                <Area type="monotone" dataKey="bandwidth" name={t('dashboard.bandwidth')} stroke="#8B5CF6" fill="url(#bw)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Severity distribution */}
        <Card title={t('dashboard.severityDistribution')} icon={<Shield size={18} />} delay={0.35}>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={severityData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {severityData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#131B30', border: '1px solid #1E2A47',
                    borderRadius: '12px', color: '#E2E8F0',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-cyber-muted text-sm">
              {t('common.noData')}
            </div>
          )}
        </Card>
      </div>

      {/* Daily predictions + System load */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title={t('dashboard.dailyPredictions')} icon={<TrendingUp size={18} />} className="lg:col-span-2" delay={0.4}>
          {overview?.daily_counts && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={overview.daily_counts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: '#131B30', border: '1px solid #1E2A47',
                    borderRadius: '12px', color: '#E2E8F0',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="total" name="Total" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
                <Bar dataKey="congested" name="Congested" fill="#EF4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* System Load */}
        <Card title={t('dashboard.systemLoad')} icon={<Cpu size={18} />} delay={0.45}>
          <div className="space-y-4">
            <ResourceBar label="CPU" icon={<Cpu size={14} />} percent={34} color="primary" />
            <ResourceBar label="Memory" icon={<MemoryStick size={14} />} percent={62} color="accent" />
            <ResourceBar label="Disk" icon={<HardDrive size={14} />} percent={41} color="warning" />
            <ResourceBar label="GPU" icon={<Zap size={14} />} percent={18} color="success" />
            <ResourceBar label="Network I/O" icon={<Network size={14} />} percent={55} color="info" />
          </div>
        </Card>
      </div>

      {/* Top IPs + Recent predictions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={t('dashboard.topSourceIps')} icon={<AlertTriangle size={18} />} delay={0.5}>
          <div className="space-y-2">
            {overview?.top_source_ips?.slice(0, 6).map((ip: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-cyber-bg/40 border border-cyber-border hover:border-cyber-danger/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyber-danger/15 text-cyber-danger flex items-center justify-center text-xs font-bold">
                    #{i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-mono text-cyber-text">{ip.ip}</div>
                    <div className="text-[10px] text-cyber-muted">Suspicious host</div>
                  </div>
                </div>
                <Badge variant="danger">{ip.count} events</Badge>
              </motion.div>
            )) || <div className="text-cyber-muted text-sm">{t('common.noData')}</div>}
          </div>
        </Card>

        <Card title={t('dashboard.recentPredictions')} icon={<Activity size={18} />} delay={0.55}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                  <th className="text-left py-2 px-2">ID</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Confidence</th>
                  <th className="text-left py-2 px-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.slice(0, 6).map((p, i) => (
                  <tr key={i} className="border-b border-cyber-border/40 hover:bg-cyber-bg/30">
                    <td className="py-2 px-2 text-cyber-text font-mono">#{p.id}</td>
                    <td className="py-2 px-2">
                      <Badge variant={p.is_congested ? 'danger' : 'success'}>
                        {p.is_congested ? t('prediction.congested') : t('prediction.normal')}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-cyber-muted">
                      {((p.confidence || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-2 text-cyber-muted text-xs">
                      {p.created_at ? new Date(p.created_at).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-cyber-muted">
                      {t('common.noData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

function ResourceBar({ label, icon, percent, color }: { label: string; icon: any; percent: number; color: any }) {
  const colorMap: Record<string, string> = {
    primary: '#0EA5E9', accent: '#8B5CF6', success: '#10B981',
    warning: '#F59E0B', info: '#3B82F6', danger: '#EF4444',
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-xs text-cyber-text">
          {icon} {label}
        </div>
        <span className="text-xs text-cyber-muted">{percent}%</span>
      </div>
      <div className="h-2 bg-cyber-bg/60 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8 }}
          className="h-full rounded-full"
          style={{ background: colorMap[color] }}
        />
      </div>
    </div>
  );
}
