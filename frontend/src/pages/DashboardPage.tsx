import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle, Cpu, Gauge, Network,
  Shield, TrendingUp, Zap, Server, Crown, Radio, Wifi, Ban,
  Flame, Target, Clock, ArrowRight, Eye, Monitor,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, StatCard, Badge } from '../components/Card';
import { dashboardService } from '../services/dashboardService';
import { deviceService } from '../services/deviceService';
import { apiGet, apiPost } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

export function DashboardPage() {
  const { t } = useTranslation();
  const [noc, setNoc] = useState<any>(null);
  const [deviceOverview, setDeviceOverview] = useState<any>(null);
  const [ingestStatus, setIngestStatus] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    Promise.all([
      dashboardService.noc(),
      deviceService.overview(),
      apiGet('/ingest/status'),
      dashboardService.overview(),
    ])
      .then(([n, d, ing, o]) => {
        setNoc(n.data);
        setDeviceOverview(d.data);
        setIngestStatus(ing.data);
        setOverview(o.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const nh = noc?.network_health;
  const trafficHistory = noc?.traffic_history || [];
  const congestionEvents = noc?.congestion_events || [];
  const topContributors = noc?.top_contributors || [];
  const stats = noc?.stats || {};

  return (
    <Layout title={t('nav.overview')}>
      {/* ===== LIVE STATUS BANNER ===== */}
      {nh && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 mb-6 border-l-4"
          style={{ borderLeftColor: nh.status_color }}
        >
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <GlobalIndicator icon={<AlertTriangle size={16} />} label="Risk Level" value={nh.status} color={nh.status === 'Critical' ? 'danger' : nh.status === 'Warning' ? 'warning' : 'success'} />
            <GlobalIndicator icon={<Zap size={16} />} label="Active Events" value={nh.congestion_events} color="warning" />
            <GlobalIndicator icon={<Target size={16} />} label="Avg Utilization" value={`${nh.avg_utilization}%`} color="accent" />
            <GlobalIndicator icon={<Crown size={16} />} label="Top Contributor" value={topContributors[0]?.ip || '—'} color="primary" mono />
            <GlobalIndicator icon={<Clock size={16} />} label="Avg Latency" value={`${nh.avg_latency_ms}ms`} color="info" />
            <GlobalIndicator icon={<Activity size={16} />} label="Devices Online" value={`${nh.online_devices}/${nh.total_devices}`} color="success" />
          </div>
          {stats.real_devices_connected > 0 && (
            <div className="mt-3 pt-3 border-t border-cyber-border flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-cyber-success">
                <span className="w-2 h-2 rounded-full bg-cyber-success animate-pulse"></span>
                {stats.real_devices_connected} Real Device(s) Connected
              </span>
              <span className="text-cyber-muted">·</span>
              <span className="text-cyber-muted">{stats.real_flows_ingested} flows ingested</span>
            </div>
          )}
        </motion.div>
      )}

      {/* ===== QUICK NAVIGATION ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <QuickNav to="/noc" icon={<Monitor size={20} />} label="NOC Dashboard" desc="Live monitoring" color="primary" />
        <QuickNav to="/devices" icon={<Server size={20} />} label="Network Devices" desc="Manage devices" color="success" />
        <QuickNav to="/root-cause" icon={<Target size={20} />} label="Root Cause" desc="RCA analysis" color="danger" />
        <QuickNav to="/shap" icon={<Eye size={20} />} label="SHAP" desc="Explainability" color="accent" />
      </div>

      {/* ===== LIVE STAT CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard title="Connected Devices" value={deviceOverview?.total_devices ?? 0} icon={<Server size={18} />} color="primary" delay={0} />
        <StatCard title="Online Devices" value={deviceOverview?.online_devices ?? 0} icon={<CheckCircle size={18} />} color="success" delay={0.05} />
        <StatCard title="Active Interfaces" value={deviceOverview?.up_interfaces ?? 0} icon={<Wifi size={18} />} color="info" delay={0.1} />
        <StatCard title="Congested" value={deviceOverview?.congested_interfaces ?? 0} icon={<AlertTriangle size={18} />} color="danger" delay={0.15} />
        <StatCard title="Avg Latency" value={nh ? `${nh.avg_latency_ms}ms` : '—'} icon={<Clock size={18} />} color="warning" delay={0.2} />
        <StatCard title="Throughput" value={nh ? `${nh.total_throughput_mbps}` : '—'} icon={<TrendingUp size={18} />} color="accent" delay={0.25} />
      </div>

      {/* ===== LIVE TRAFFIC + INTERFACE STATUS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Live Throughput (Real-Time)" icon={<TrendingUp size={18} />} className="lg:col-span-2">
          {trafficHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trafficHistory}>
                <defs>
                  <linearGradient id="liveTIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="liveTOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="timestamp" stroke="#64748B" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <YAxis stroke="#64748B" fontSize={10} unit=" Mbps" />
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} labelFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="throughput_in" name="Incoming (Mbps)" stroke="#0EA5E9" fill="url(#liveTIn)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="throughput_out" name="Outgoing (Mbps)" stroke="#8B5CF6" fill="url(#liveTOut)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-cyber-muted text-sm">
              في انتظار بيانات المراقبة... أضف أجهزة من صفحة Network Devices
            </div>
          )}
        </Card>

        <Card title="Interface Status (Live)" icon={<Wifi size={18} />}>
          {deviceOverview && deviceOverview.total_interfaces > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Up', value: deviceOverview.up_interfaces, color: '#10B981' },
                    { name: 'Warning', value: deviceOverview.warning_interfaces, color: '#F59E0B' },
                    { name: 'Congested', value: deviceOverview.congested_interfaces, color: '#EF4444' },
                  ].filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  label={(entry: any) => `${entry.name}: ${entry.value}`}
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#F59E0B" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-cyber-muted text-sm">لا توجد واجهات مُراقَبة</div>
          )}
        </Card>
      </div>

      {/* ===== LIVE CONGESTION EVENTS ===== */}
      {congestionEvents.length > 0 && (
        <Card title="Live Congestion Events" icon={<AlertTriangle size={18} />} className="mb-6"
          action={<Link to="/root-cause" className="btn-ghost text-xs text-cyber-primary">View RCA →</Link>}
        >
          <div className="space-y-2">
            {congestionEvents.slice(0, 5).map((event: any, idx: number) => (
              <div key={idx} className={clsx('flex items-center gap-3 p-3 rounded-xl border', event.severity === 'critical' ? 'border-cyber-danger/30 bg-cyber-danger/5' : 'border-cyber-warning/30 bg-cyber-warning/5')}>
                <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', event.severity === 'critical' ? 'bg-cyber-danger/15 text-cyber-danger' : 'bg-cyber-warning/15 text-cyber-warning')}>
                  <Flame size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-cyber-text">{event.device}</span>
                    <Badge variant="info" size="sm">{event.interface}</Badge>
                    {event.is_real && <Badge variant="success" size="sm">REAL</Badge>}
                  </div>
                  <div className="text-xs text-cyber-muted mt-0.5">
                    Confidence: {event.confidence}% · Probability: {(event.congestion_probability * 100).toFixed(1)}%
                    {event.source_ip && ` · Source: ${event.source_ip}`}
                  </div>
                </div>
                <Badge variant={event.severity === 'critical' ? 'danger' : 'warning'} size="sm">{event.severity}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ===== LIVE INGESTION STATUS ===== */}
      {ingestStatus && ingestStatus.total_ingested > 0 && (
        <Card title="Live Data Ingestion" icon={<Activity size={18} />} className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-cyber-bg/40 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-cyber-primary">{ingestStatus.total_ingested}</div>
              <div className="text-xs text-cyber-muted">Flows Ingested</div>
            </div>
            <div className="bg-cyber-bg/40 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-cyber-success">{ingestStatus.total_processed}</div>
              <div className="text-xs text-cyber-muted">Processed</div>
            </div>
            <div className="bg-cyber-bg/40 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-cyber-danger">{ingestStatus.total_congested}</div>
              <div className="text-xs text-cyber-muted">Congested</div>
            </div>
            <div className="bg-cyber-bg/40 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-cyber-warning">{ingestStatus.congestion_rate}%</div>
              <div className="text-xs text-cyber-muted">Congestion Rate</div>
            </div>
            <div className="bg-cyber-bg/40 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-cyber-accent">{ingestStatus.device_count}</div>
              <div className="text-xs text-cyber-muted">Connected Devices</div>
            </div>
          </div>
        </Card>
      )}

      {/* ===== TOP CONTRIBUTORS PREVIEW ===== */}
      {topContributors.length > 0 && (
        <Card title="Top Culprit Hosts" icon={<Crown size={18} />} className="mb-6"
          action={<Link to="/top-culprits" className="btn-ghost text-xs text-cyber-primary">View All →</Link>}
        >
          <div className="space-y-2">
            {topContributors.slice(0, 5).map((host: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-cyber-bg/40 border border-cyber-border">
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold', i < 3 ? 'bg-cyber-danger/20 text-cyber-danger' : 'bg-cyber-card text-cyber-muted')}>#{i + 1}</div>
                <div className="flex-1">
                  <div className="font-mono text-sm text-cyber-text">{host.ip}</div>
                  <div className="text-[10px] text-cyber-muted">{host.hostname} · {host.reason}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm" style={{ color: host.culprit_score >= 85 ? '#EF4444' : host.culprit_score >= 70 ? '#F59E0B' : '#10B981' }}>
                    {host.culprit_score?.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-cyber-muted">Culprit Score</div>
                </div>
                {host.is_real && <Badge variant="success" size="sm">REAL</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </Layout>
  );
}

function QuickNav({ to, icon, label, desc, color }: any) {
  const colorMap: Record<string, string> = {
    primary: 'bg-cyber-primary/15 text-cyber-primary',
    success: 'bg-cyber-success/15 text-cyber-success',
    danger: 'bg-cyber-danger/15 text-cyber-danger',
    accent: 'bg-cyber-accent/15 text-cyber-accent',
  };
  return (
    <Link to={to} className="block">
      <Card className="hover:border-cyber-primary/40 transition cursor-pointer">
        <div className="flex items-center gap-3">
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', colorMap[color])}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-cyber-text">{label}</div>
            <div className="text-xs text-cyber-muted">{desc}</div>
          </div>
          <ArrowRight size={16} className="text-cyber-muted" />
        </div>
      </Card>
    </Link>
  );
}

function GlobalIndicator({ icon, label, value, color, mono }: any) {
  const colorMap: Record<string, string> = {
    primary: 'text-cyber-primary', accent: 'text-cyber-accent',
    success: 'text-cyber-success', warning: 'text-cyber-warning',
    danger: 'text-cyber-danger', info: 'text-cyber-info',
  };
  return (
    <div className="flex items-center gap-2">
      <div className={colorMap[color]}>{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-cyber-muted">{label}</div>
        <div className={clsx('text-sm font-bold', colorMap[color], mono && 'font-mono')}>{value}</div>
      </div>
    </div>
  );
}
