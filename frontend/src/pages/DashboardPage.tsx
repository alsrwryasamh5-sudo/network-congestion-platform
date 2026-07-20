import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle, Cpu, Database, Gauge,
  Network, Shield, TrendingUp, Users, Zap, HardDrive, MemoryStick,
  Server, Crown, ArrowUpRight, ArrowDownRight, Radio, Wifi,
  Flame, Target, Lock, Eye, Ban, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, RadialBarChart, RadialBar, PolarAngleAxis,
  RadarChart, PolarGrid, PolarAngleAxis as RPolarAngle, PolarRadiusAxis, Radar,
  ComposedChart,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, StatCard, Badge, Skeleton } from '../components/Card';
import { dashboardService } from '../services/dashboardService';
import { apiPost } from '../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

export function DashboardPage() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [intel, setIntel] = useState<any>(null);
  const [noc, setNoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardService.overview(),
      dashboardService.networkHealth(),
      dashboardService.recentPredictions(8),
      dashboardService.intelligence(),
      dashboardService.noc(),
    ])
      .then(([o, h, r, i, n]) => {
        setOverview(o.data);
        setHealth(h.data);
        setRecent(r.data);
        setIntel(i.data);
        setNoc(n.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-refresh every 10 seconds for live data
  useEffect(() => {
    const interval = setInterval(() => {
      dashboardService.noc().then((r) => setNoc(r.data)).catch(() => {});
      dashboardService.overview().then((r) => setOverview(r.data)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const i = intel; // shorthand
  const severityData = overview
    ? Object.entries(overview.severity_distribution).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <Layout title={t('nav.overview')}>
      {/* ===== GLOBAL INDICATORS BANNER (LIVE - from NOC) ===== */}
      {noc && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 mb-6 border-l-4 border-l-cyber-danger"
        >
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <GlobalIndicator
              icon={<AlertTriangle size={16} />}
              label="Risk Level"
              value={noc.network_health.status}
              color={noc.network_health.status === 'Critical' ? 'danger' : noc.network_health.status === 'Warning' ? 'warning' : 'success'}
            />
            <GlobalIndicator
              icon={<Zap size={16} />}
              label="Active Events"
              value={noc.network_health.congestion_events}
              color="warning"
            />
            <GlobalIndicator
              icon={<Target size={16} />}
              label="Avg Utilization"
              value={`${noc.network_health.avg_utilization}%`}
              color="accent"
            />
            <GlobalIndicator
              icon={<Crown size={16} />}
              label="Top Contributor"
              value={noc.top_contributors?.[0]?.ip || '—'}
              color="primary"
              mono
            />
            <GlobalIndicator
              icon={<Clock size={16} />}
              label="Avg Latency"
              value={`${noc.network_health.avg_latency_ms}ms`}
              color="info"
            />
            <GlobalIndicator
              icon={<Activity size={16} />}
              label="Devices Online"
              value={`${noc.network_health.online_devices}/${noc.network_health.total_devices}`}
              color="success"
            />
          </div>
          {noc.stats.real_devices_connected > 0 && (
            <div className="mt-3 pt-3 border-t border-cyber-border flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-cyber-success">
                <span className="w-2 h-2 rounded-full bg-cyber-success animate-pulse"></span>
                {noc.stats.real_devices_connected} Real Device(s) Connected
              </span>
              <span className="text-cyber-muted">·</span>
              <span className="text-cyber-muted">{noc.stats.real_flows_ingested} flows ingested</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Seed data prompt */}
      {overview && overview.total_predictions === 0 && !loading && (
        <Card className="mb-6 border-cyber-warning/30 bg-cyber-warning/5">
          <div className="flex items-start gap-3">
            <Zap size={20} className="text-cyber-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-cyber-warning mb-1">لا توجد بيانات حية بعد</h4>
              <p className="text-sm text-cyber-muted mb-3">
                البيانات المعروضة هي من التحليل المرجعي للـ notebook الأصلي. لتعبئة الواجهات ببيانات حية من النموذج المُدرَّب، اضغط الزر أدناه.
              </p>
              <button
                onClick={async () => {
                  try {
                    toast.loading('جاري تعبئة البيانات...', { id: 'seed' });
                    const r = await apiPost('/ml/seed-database', {
                      n_predictions: 200, congested_ratio: 0.4, hours_back: 72,
                    });
                    toast.success(`تم توليد ${r.data.predictions_created} تنبؤ بنجاح!`, { id: 'seed' });
                    setTimeout(() => window.location.reload(), 1500);
                  } catch { toast.error('فشل التعبئة', { id: 'seed' }); }
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Zap size={16} /> تعبئة الواجهات بالبيانات الحية
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ===== NETWORK OVERVIEW ===== */}
      {i && (
        <>
          <SectionTitle icon={<Network size={18} />} title="Network Overview" subtitle="Real-time network flow analysis summary" />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <StatCard title="Total Flows (25 Windows)" value={i.network_overview.summary_cards.total_flows_25_windows.toLocaleString()} icon={<Activity size={18} />} color="primary" delay={0} />
            <StatCard title="Total Hosts" value={i.network_overview.summary_cards.total_hosts} icon={<Server size={18} />} color="info" delay={0.05} />
            <StatCard title="Culprit Hosts" value={i.network_overview.summary_cards.culprit_hosts} icon={<AlertTriangle size={18} />} color="danger" delay={0.1} />
            <StatCard title="Normal Hosts" value={i.network_overview.summary_cards.normal_hosts} icon={<CheckCircle size={18} />} color="success" delay={0.15} />
            <StatCard title="High Risk Ratio" value={`${i.network_overview.summary_cards.high_risk_ratio}%`} icon={<TrendingUp size={18} />} color="warning" delay={0.2} />
            <StatCard title="Model Accuracy" value={`${i.network_overview.summary_cards.model_accuracy}%`} icon={<Target size={18} />} color="accent" delay={0.25} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Host Distribution Pie */}
            <Card title="Host Distribution" icon={<Server size={18} />} delay={0.3}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={i.network_overview.host_distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    label={(entry: any) => `${entry.value}`}
                  >
                    {i.network_overview.host_distribution.map((d: any, idx: number) => (
                      <Cell key={idx} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Network Quality Improvement */}
            <Card title="Network Quality Improvement" icon={<Gauge size={18} />} className="lg:col-span-2" delay={0.35}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={i.network_overview.quality_improvement}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                  <XAxis dataKey="metric" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={10} unit="%" />
                  <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} formatter={(v: any) => [`${v}%`, 'Improvement']} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {i.network_overview.quality_improvement.map((d: any, idx: number) => (
                      <Cell key={idx} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {/* ===== CULPRIT MONITORING ===== */}
      {i && (
        <>
          <SectionTitle icon={<AlertTriangle size={18} />} title="Culprit Monitoring" subtitle="Identified network congestion sources" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard title="Critical Nodes" value={i.culprit_monitoring.summary_cards.critical_nodes} icon={<Flame size={18} />} color="danger" delay={0.4} />
            <StatCard title="Attack Nodes" value={i.culprit_monitoring.summary_cards.attack_nodes} icon={<Ban size={18} />} color="warning" delay={0.45} />
            <StatCard title="Heavy Users" value={i.culprit_monitoring.summary_cards.heavy_users} icon={<Server size={18} />} color="accent" delay={0.5} />
            <StatCard title="Highest RCA Score" value={i.culprit_monitoring.summary_cards.highest_rca} icon={<Crown size={18} />} color="primary" delay={0.55} />
          </div>

          <Card title="Top Culprit Hosts" icon={<Crown size={18} />} className="mb-6" delay={0.6}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">IP Address</th>
                    <th className="text-left py-2 px-2">RCA Score</th>
                    <th className="text-left py-2 px-2">Device Type</th>
                    <th className="text-left py-2 px-2">Behavior</th>
                    <th className="text-left py-2 px-2">Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {i.culprit_monitoring.culprit_table.map((host: any, idx: number) => (
                    <motion.tr
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + idx * 0.03 }}
                      className={clsx(
                        'border-b border-cyber-border/40 hover:bg-cyber-bg/30 transition',
                        host.rca_score >= 90 && 'bg-cyber-danger/5'
                      )}
                    >
                      <td className="py-2.5 px-2">
                        <div className={clsx(
                          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                          idx < 3 ? 'bg-cyber-danger/20 text-cyber-danger' : 'bg-cyber-card text-cyber-muted'
                        )}>
                          {idx + 1}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-cyber-text">{host.ip}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold" style={{ color: host.rca_score >= 90 ? '#EF4444' : host.rca_score >= 50 ? '#F59E0B' : '#10B981' }}>
                            {host.rca_score.toFixed(1)}
                          </span>
                          <div className="w-16 h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${host.rca_score}%`,
                              background: host.rca_score >= 90 ? '#EF4444' : host.rca_score >= 50 ? '#F59E0B' : '#10B981',
                            }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <Badge variant={host.device_type.includes('Culprit') ? 'danger' : 'success'} size="sm">
                          {host.device_type.includes('Culprit') ? '⚠️ Culprit' : '✅ Normal'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-cyber-muted text-xs">{host.behavior}</td>
                      <td className="py-2.5 px-2">
                        <Badge variant={host.action.includes('Block') ? 'danger' : host.action.includes('Throttle') ? 'warning' : 'success'} size="sm">
                          {host.action}
                        </Badge>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ===== THREAT DISTRIBUTION ===== */}
      {i && (
        <>
          <SectionTitle icon={<Shield size={18} />} title="Threat Distribution" subtitle="Classification of detected threats" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Threat Source Distribution */}
            <Card title="Threat Source Distribution" icon={<AlertTriangle size={18} />} delay={0.65}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={i.threat_distribution.threat_sources}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                  >
                    {i.threat_distribution.threat_sources.map((d: any, idx: number) => (
                      <Cell key={idx} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Attack Categories */}
            <Card title="Attack Categories" icon={<Ban size={18} />} delay={0.7}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={i.threat_distribution.attack_categories} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                  <XAxis type="number" stroke="#64748B" fontSize={11} />
                  <YAxis type="category" dataKey="type" stroke="#64748B" fontSize={11} width={80} />
                  <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {i.threat_distribution.attack_categories.map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {/* ===== TRAFFIC INTELLIGENCE (SHAP) ===== */}
      {i && (
        <>
          <SectionTitle icon={<Eye size={18} />} title="Traffic Intelligence" subtitle="Top features contributing to congestion (SHAP)" />

          <Card title="SHAP Feature Importance" icon={<Target size={18} />} className="mb-6" delay={0.75}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={i.traffic_intelligence.top_features} layout="vertical" margin={{ left: 150 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis type="number" stroke="#64748B" fontSize={11} unit="%" />
                <YAxis type="category" dataKey="feature" stroke="#64748B" fontSize={10} width={150} />
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} formatter={(v: any) => [`${v}%`, 'Importance']} />
                <Bar dataKey="importance" radius={[0, 8, 8, 0]}>
                  {i.traffic_intelligence.top_features.map((_: any, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* ===== MITIGATION EFFECTIVENESS ===== */}
      {i && (
        <>
          <SectionTitle icon={<CheckCircle size={18} />} title="Mitigation Effectiveness" subtitle="Impact of applied mitigation strategies" />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <StatCard title="Bandwidth Saved" value={i.mitigation_effectiveness.summary_cards.bandwidth_saved} icon={<HardDrive size={18} />} color="success" delay={0.8} />
            <StatCard title="Latency Reduction" value={`${i.mitigation_effectiveness.summary_cards.latency_reduction}%`} icon={<ArrowDownRight size={18} />} color="primary" delay={0.82} />
            <StatCard title="Jitter Reduction" value={`${i.mitigation_effectiveness.summary_cards.jitter_reduction}%`} icon={<ArrowDownRight size={18} />} color="accent" delay={0.84} />
            <StatCard title="Packet Loss Reduction" value={`${i.mitigation_effectiveness.summary_cards.packet_loss_reduction}%`} icon={<ArrowDownRight size={18} />} color="warning" delay={0.86} />
            <StatCard title="QoS Restoration" value={`${i.mitigation_effectiveness.summary_cards.qos_restoration}%`} icon={<Shield size={18} />} color="info" delay={0.88} />
          </div>

          <Card title="Normal vs Culprit Network Behaviour" icon={<Activity size={18} />} className="mb-6" delay={0.9}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={i.mitigation_effectiveness.behavior_comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="metric" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="normal" name="Normal Hosts" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="culprit" name="Culprit Hosts" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* ===== AI MODEL STATUS ===== */}
      {i && (
        <>
          <SectionTitle icon={<Cpu size={18} />} title="AI Model Status" subtitle="Machine learning model performance" />

          <Card className="mb-6" delay={0.95}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-cyber-bg/40">
                <div className="w-12 h-12 rounded-xl bg-cyber-accent/15 text-cyber-accent flex items-center justify-center mx-auto mb-2">
                  <Cpu size={20} />
                </div>
                <div className="text-xs text-cyber-muted">Model</div>
                <div className="text-sm font-bold text-cyber-text">{i.ai_model_status.model}</div>
                <div className="text-[10px] text-cyber-muted mt-1">{i.ai_model_status.architecture}</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-cyber-bg/40">
                <div className="w-12 h-12 rounded-xl bg-cyber-success/15 text-cyber-success flex items-center justify-center mx-auto mb-2">
                  <Target size={20} />
                </div>
                <div className="text-xs text-cyber-muted">Accuracy</div>
                <div className="text-2xl font-bold text-cyber-success">{i.ai_model_status.accuracy}%</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-cyber-bg/40">
                <div className="w-12 h-12 rounded-xl bg-cyber-primary/15 text-cyber-primary flex items-center justify-center mx-auto mb-2">
                  <Gauge size={20} />
                </div>
                <div className="text-xs text-cyber-muted">F1-Score</div>
                <div className="text-2xl font-bold text-cyber-primary">{(i.ai_model_status.f1_score * 100).toFixed(2)}%</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-cyber-bg/40">
                <div className="w-12 h-12 rounded-xl bg-cyber-warning/15 text-cyber-warning flex items-center justify-center mx-auto mb-2">
                  <TrendingUp size={20} />
                </div>
                <div className="text-xs text-cyber-muted">ROC-AUC</div>
                <div className="text-2xl font-bold text-cyber-warning">{(i.ai_model_status.roc_auc * 100).toFixed(2)}%</div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ===== LIVE DATA SECTION (if available) ===== */}
      {overview && overview.total_predictions > 0 && (
        <>
          <SectionTitle icon={<Radio size={18} />} title="Live Monitoring" subtitle="Real-time data from trained model" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Network Health */}
            <Card title="Network Health (Live)" icon={<Network size={18} />} delay={1.0}>
              {health && health.source !== 'no_data' ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={health.labels?.map((label: string, idx: number) => ({
                    time: label,
                    latency: health.latency_ms?.[idx]?.value || 0,
                    jitter: health.jitter_ms?.[idx] || 0,
                  }))}>
                    <defs>
                      <linearGradient id="liveLat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                    <XAxis dataKey="time" stroke="#64748B" fontSize={10} />
                    <YAxis stroke="#64748B" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="latency" name="Latency (ms)" stroke="#0EA5E9" fill="url(#liveLat)" strokeWidth={2} />
                    <Area type="monotone" dataKey="jitter" name="Jitter (ms)" stroke="#8B5CF6" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-cyber-muted text-sm">{t('common.noData')}</div>
              )}
            </Card>

            {/* Severity Distribution (Live) */}
            <Card title="Severity Distribution (Live)" icon={<AlertTriangle size={18} />} delay={1.05}>
              {severityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}>
                      {severityData.map((_: any, idx: number) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-cyber-muted text-sm">{t('common.noData')}</div>
              )}
            </Card>
          </div>

          {/* Recent Predictions */}
          <Card title={t('dashboard.recentPredictions')} icon={<Activity size={18} />} delay={1.1}
            action={<a href="/prediction" className="btn-ghost text-xs text-cyber-primary">View all →</a>}
          >
            {recent.length === 0 ? (
              <div className="text-center py-12 text-cyber-muted text-sm">{t('common.noData')}</div>
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
                    {recent.slice(0, 6).map((p, idx) => (
                      <tr key={idx} className="border-b border-cyber-border/40 hover:bg-cyber-bg/30">
                        <td className="py-2.5 px-2 text-cyber-text font-mono">#{p.id}</td>
                        <td className="py-2.5 px-2">
                          <Badge variant={p.is_congested ? 'danger' : 'success'}>
                            {p.is_congested ? t('prediction.congested') : t('prediction.normal')}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(p.confidence || 0) * 100}%`, background: p.is_congested ? '#EF4444' : '#10B981' }} />
                            </div>
                            <span className="text-cyber-muted text-xs">{((p.confidence || 0) * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          {p.severity ? <Badge variant={p.severity === 'critical' ? 'danger' : p.severity === 'high' ? 'warning' : p.severity === 'medium' ? 'info' : 'success'} size="sm">{p.severity}</Badge> : <span className="text-cyber-muted text-xs">—</span>}
                        </td>
                        <td className="py-2.5 px-2 text-cyber-muted text-xs">{p.created_at ? new Date(p.created_at).toLocaleTimeString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </Layout>
  );
}

// ===== Helper Components =====

function SectionTitle({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 mb-4 mt-2"
    >
      <div className="w-9 h-9 rounded-xl bg-cyber-gradient flex items-center justify-center text-white">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold text-cyber-text">{title}</h2>
        <p className="text-xs text-cyber-muted">{subtitle}</p>
      </div>
    </motion.div>
  );
}

function GlobalIndicator({ icon, label, value, color, mono }: any) {
  const colorMap: Record<string, string> = {
    primary: 'text-cyber-primary',
    accent: 'text-cyber-accent',
    success: 'text-cyber-success',
    warning: 'text-cyber-warning',
    danger: 'text-cyber-danger',
    info: 'text-cyber-info',
  };
  return (
    <div className="flex items-center gap-2">
      <div className={`${colorMap[color]}`}>{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-cyber-muted">{label}</div>
        <div className={`text-sm font-bold ${colorMap[color]} ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    </div>
  );
}
