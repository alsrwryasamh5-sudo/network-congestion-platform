import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle, Cpu, Database, Gauge,
  Network, Shield, TrendingUp, Users, Zap, HardDrive, MemoryStick,
  Server, Crown, ArrowUpRight, ArrowDownRight, Radio, Wifi,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, RadialBarChart, RadialBar, PolarAngleAxis,
  RadarChart, PolarGrid, PolarAngleAxis as RPolarAngle, PolarRadiusAxis, Radar,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, StatCard, Badge, Skeleton } from '../components/Card';
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
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

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
  }, [timeRange]);

  const severityData = overview
    ? Object.entries(overview.severity_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const protocolData = overview
    ? Object.entries(overview.protocol_distribution).map(([name, value]) => ({ name, value }))
    : [];

  // QoS restoration radar
  const qosRadar = [
    { metric: 'Latency', baseline: 90, current: health?.current_health_score || 0 },
    { metric: 'Jitter', baseline: 85, current: Math.max(0, (health?.current_health_score || 0) - 10) },
    { metric: 'Throughput', baseline: 88, current: Math.min(100, (health?.current_health_score || 0) + 5) },
    { metric: 'Packet Loss', baseline: 92, current: Math.max(0, (health?.current_health_score || 0) - 5) },
    { metric: 'QoS', baseline: 87, current: health?.current_health_score || 0 },
    { metric: 'Stability', baseline: 89, current: Math.max(0, (health?.current_health_score || 0) - 3) },
  ];

  return (
    <Layout title={t('nav.overview')}>
      {/* Time range selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {[
            { label: '24h', value: '24h' as const },
            { label: '7d', value: '7d' as const },
            { label: '30d', value: '30d' as const },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                timeRange === opt.value
                  ? 'bg-cyber-primary text-white'
                  : 'bg-cyber-card text-cyber-muted hover:text-cyber-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-cyber-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyber-success animate-pulse"></span>
            Live
          </span>
          <span>·</span>
          <span>Updated {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Seed data prompt */}
      {overview && overview.total_predictions === 0 && !loading && (
        <Card className="mb-6 border-cyber-warning/30 bg-cyber-warning/5">
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
          value={loading ? '...' : (overview?.total_predictions ?? '—')}
          icon={<Activity size={18} />}
          color="primary"
          change={overview?.predictions_24h ? `+${overview.predictions_24h} 24h` : undefined}
          changeType="up"
          delay={0}
        />
        <StatCard
          title={t('dashboard.congestedFlows')}
          value={loading ? '...' : (overview?.congested_count ?? '—')}
          icon={<AlertTriangle size={18} />}
          color="danger"
          delay={0.05}
        />
        <StatCard
          title={t('dashboard.congestionRate')}
          value={loading ? '...' : `${overview?.congestion_rate ?? 0}%`}
          icon={<TrendingUp size={18} />}
          color="warning"
          delay={0.1}
        />
        <StatCard
          title={t('dashboard.activeEvents')}
          value={loading ? '...' : (overview?.active_events ?? '—')}
          icon={<Zap size={18} />}
          color="accent"
          delay={0.15}
        />
        <StatCard
          title={t('dashboard.resolvedEvents')}
          value={loading ? '...' : (overview?.resolved_events ?? '—')}
          icon={<CheckCircle size={18} />}
          color="success"
          delay={0.2}
        />
        <StatCard
          title={t('dashboard.predictions24h')}
          value={loading ? '...' : (overview?.predictions_24h ?? '—')}
          icon={<Gauge size={18} />}
          color="info"
          delay={0.25}
        />
      </div>

      {/* Network Health Score + QoS Restoration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Health Score Gauge */}
        <Card delay={0.3}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm text-cyber-muted">Network Health Score</div>
              <div className="text-xs text-cyber-muted">Real-time status</div>
            </div>
            <div className={`badge ${health?.current_health_score >= 75 ? 'badge-success' : health?.current_health_score >= 50 ? 'badge-warning' : 'badge-danger'}`}>
              {health?.current_health_score >= 75 ? 'Healthy' : health?.current_health_score >= 50 ? 'Degraded' : 'Critical'}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              data={[{ value: health?.current_health_score || 0, fill: (health?.current_health_score || 0) >= 75 ? '#10B981' : (health?.current_health_score || 0) >= 50 ? '#F59E0B' : '#EF4444' }]}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={20} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-center -mt-32 mb-12">
            <div className="text-4xl font-bold text-cyber-text">
              {health?.current_health_score || 0}
              <span className="text-lg text-cyber-muted">/100</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-cyber-muted">Latency</div>
              <div className="text-cyber-text font-mono">
                {health?.latency_ms?.[health.latency_ms.length - 1]?.value?.toFixed(0) || 0}ms
              </div>
            </div>
            <div>
              <div className="text-cyber-muted">Jitter</div>
              <div className="text-cyber-text font-mono">
                {health?.jitter_ms?.[health.jitter_ms.length - 1]?.toFixed(0) || 0}ms
              </div>
            </div>
            <div>
              <div className="text-cyber-muted">Loss</div>
              <div className="text-cyber-text font-mono">
                {health?.packet_loss_pct?.[health.packet_loss_pct.length - 1]?.toFixed(2) || 0}%
              </div>
            </div>
          </div>
        </Card>

        {/* Network Health Timeline */}
        <Card title={t('dashboard.networkHealth')} icon={<Network size={18} />} className="lg:col-span-2" delay={0.35}>
          {loading ? (
            <Skeleton className="h-64" />
          ) : health ? (
            <ResponsiveContainer width="100%" height={260}>
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
                <Area type="monotone" dataKey="latency" name="Latency (ms)" stroke="#0EA5E9" fill="url(#lat)" strokeWidth={2} />
                <Area type="monotone" dataKey="bandwidth" name="Bandwidth (Mbps)" stroke="#8B5CF6" fill="url(#bw)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-cyber-muted text-sm">{t('common.noData')}</div>
          )}
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* QoS Restoration Radar */}
        <Card title="QoS Restoration Radar" icon={<Shield size={18} />} delay={0.4}>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={qosRadar}>
              <PolarGrid stroke="#1E2A47" />
              <PolarAngleAxis dataKey="metric" stroke="#64748B" fontSize={10} />
              <PolarRadiusAxis stroke="#64748B" fontSize={9} angle={90} domain={[0, 100]} />
              <Radar name="Baseline" dataKey="baseline" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
              <Radar name="Current" dataKey="current" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.3} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        {/* Severity Distribution */}
        <Card title={t('dashboard.severityDistribution')} icon={<AlertTriangle size={18} />} delay={0.45}>
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
                  label={(entry: any) => entry.value > 0 ? `${entry.value}` : ''}
                >
                  {severityData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-cyber-muted text-sm">{t('common.noData')}</div>
          )}
        </Card>

        {/* Daily Predictions */}
        <Card title={t('dashboard.dailyPredictions')} icon={<TrendingUp size={18} />} delay={0.5}>
          {overview?.daily_counts && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={overview.daily_counts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={9} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="total" name="Total" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                <Bar dataKey="congested" name="Congested" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* System Load + Top IPs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* System Load */}
        <Card title={t('dashboard.systemLoad')} icon={<Cpu size={18} />} delay={0.55}>
          <div className="space-y-3">
            <ResourceBar label="CPU" icon={<Cpu size={14} />} percent={34} color="#0EA5E9" />
            <ResourceBar label="Memory" icon={<MemoryStick size={14} />} percent={62} color="#8B5CF6" />
            <ResourceBar label="Disk" icon={<HardDrive size={14} />} percent={41} color="#F59E0B" />
            <ResourceBar label="GPU" icon={<Zap size={14} />} percent={18} color="#10B981" />
            <ResourceBar label="Network I/O" icon={<Network size={14} />} percent={55} color="#3B82F6" />
          </div>
          <div className="mt-4 pt-4 border-t border-cyber-border grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-cyber-muted">
              <Server size={12} /> Uptime: 3d 14h
            </div>
            <div className="flex items-center gap-2 text-cyber-muted">
              <Radio size={12} /> API: 200/h
            </div>
          </div>
        </Card>

        {/* Top Suspicious Hosts */}
        <Card title={t('dashboard.topSourceIps')} icon={<AlertTriangle size={18} />} className="lg:col-span-2" delay={0.6}>
          {overview?.top_source_ips?.length > 0 ? (
            <div className="space-y-2">
              {overview.top_source_ips.slice(0, 6).map((ip: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-cyber-bg/40 border border-cyber-border hover:border-cyber-danger/30 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyber-danger/15 text-cyber-danger flex items-center justify-center text-xs font-bold">
                      #{i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-mono text-cyber-text">{ip.ip}</div>
                      <div className="text-[10px] text-cyber-muted">Suspicious host</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right rtl:text-left">
                      <div className="text-sm font-bold text-cyber-danger">{ip.count}</div>
                      <div className="text-[10px] text-cyber-muted">events</div>
                    </div>
                    <ArrowUpRight size={16} className="text-cyber-danger group-hover:translate-x-0.5 transition" />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-cyber-muted">
              <Crown size={32} className="mb-2 opacity-40" />
              <p className="text-sm">{t('common.noData')}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Predictions Table */}
      <Card title={t('dashboard.recentPredictions')} icon={<Activity size={18} />} delay={0.65}
        action={
          <a href="/prediction" className="btn-ghost text-xs text-cyber-primary">
            View all →
          </a>
        }
      >
        {recent.length === 0 ? (
          <div className="text-center py-12">
            <Activity size={40} className="text-cyber-muted mx-auto mb-3 opacity-40" />
            <p className="text-cyber-muted text-sm">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                  <th className="text-left py-2 px-2">ID</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Confidence</th>
                  <th className="text-left py-2 px-2">Severity</th>
                  <th className="text-left py-2 px-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.slice(0, 8).map((p, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.65 + i * 0.03 }}
                    className="border-b border-cyber-border/40 hover:bg-cyber-bg/30 transition"
                  >
                    <td className="py-2.5 px-2 text-cyber-text font-mono">#{p.id}</td>
                    <td className="py-2.5 px-2">
                      <Badge variant={p.is_congested ? 'danger' : 'success'}>
                        {p.is_congested ? t('prediction.congested') : t('prediction.normal')}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(p.confidence || 0) * 100}%`,
                              background: p.is_congested ? '#EF4444' : '#10B981',
                            }}
                          />
                        </div>
                        <span className="text-cyber-muted text-xs">
                          {((p.confidence || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      {p.severity ? (
                        <Badge
                          variant={
                            p.severity === 'critical' ? 'danger' :
                            p.severity === 'high' ? 'warning' :
                            p.severity === 'medium' ? 'info' : 'success'
                          }
                          size="sm"
                        >
                          {p.severity}
                        </Badge>
                      ) : (
                        <span className="text-cyber-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-cyber-muted text-xs">
                      {p.created_at ? new Date(p.created_at).toLocaleTimeString() : '—'}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Layout>
  );
}

function ResourceBar({ label, icon, percent, color }: { label: string; icon: any; percent: number; color: string }) {
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
          transition={{ duration: 0.8, delay: 0.5 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}
