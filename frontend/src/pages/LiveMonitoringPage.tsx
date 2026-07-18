import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Activity, AlertTriangle, Server, Zap, Wifi, Ban,
  Shield, Eye, Crown, Clock, TrendingUp, TrendingDown,
  Network, Cpu, Gauge, Flame, CheckCircle, ArrowRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, Badge } from '../components/Card';
import { dashboardService } from '../services/dashboardService';
import clsx from 'clsx';

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

export function LiveMonitoringPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<any>(null);

  const fetchData = async () => {
    try {
      const r = await dashboardService.live();
      setData(r.data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (e) {
      // ignore errors during polling
    }
  };

  useEffect(() => {
    fetchData();
    if (isLive) {
      intervalRef.current = setInterval(fetchData, 3000); // Update every 3 seconds
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive]);

  const fmtUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
  };

  const summary = data?.summary;
  const history = data?.history || [];
  const flows = data?.recent_flows || [];
  const alerts = data?.active_alerts || [];
  const hosts = data?.hosts_status || [];

  // Host status distribution
  const hostStatusDist = [
    { name: 'Online', value: summary?.online_hosts || 0, color: '#10B981' },
    { name: 'Monitored', value: summary?.monitored_hosts || 0, color: '#F59E0B' },
    { name: 'Blocked', value: summary?.blocked_hosts || 0, color: '#EF4444' },
  ];

  return (
    <Layout title="مراقبة مباشرة للشبكة">
      {/* Live status banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 mb-6 border-l-4 border-l-cyber-success"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-cyber-success/15 flex items-center justify-center">
                <Radio size={24} className="text-cyber-success" />
              </div>
              {isLive && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyber-success rounded-full border-2 border-cyber-card animate-ping" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-cyber-text flex items-center gap-2">
                Live Network Monitoring
                {isLive ? (
                  <span className="badge badge-success text-[10px]">● LIVE</span>
                ) : (
                  <span className="badge badge-warning text-[10px]">⏸ PAUSED</span>
                )}
              </h2>
              <p className="text-xs text-cyber-muted">
                Uptime: {summary ? fmtUptime(summary.uptime_seconds) : '—'} ·
                Last update: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLive(!isLive)}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2',
                isLive ? 'btn-secondary' : 'btn-primary'
              )}
            >
              {isLive ? '⏸ إيقاف' : '▶ تشغيل'}
            </button>
            <button onClick={fetchData} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshIcon /> تحديث
            </button>
          </div>
        </div>

        {/* Risk level indicator */}
        {summary && (
          <div className="mt-4 pt-4 border-t border-cyber-border flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyber-muted">Network Risk:</span>
              <Badge variant={
                summary.network_risk_level === 'High' ? 'danger' :
                summary.network_risk_level === 'Medium' ? 'warning' : 'success'
              }>
                {summary.network_risk_level}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Activity size={14} className="text-cyber-primary" />
              <span className="text-cyber-muted">Active Flows:</span>
              <span className="text-cyber-text font-bold">{summary.active_flows}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Zap size={14} className="text-cyber-warning" />
              <span className="text-cyber-muted">Alerts:</span>
              <span className="text-cyber-text font-bold">{summary.active_alerts}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Gauge size={14} className="text-cyber-accent" />
              <span className="text-cyber-muted">Avg Latency:</span>
              <span className="text-cyber-text font-bold">{summary.avg_latency_ms}ms</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Wifi size={14} className="text-cyber-info" />
              <span className="text-cyber-muted">Throughput:</span>
              <span className="text-cyber-text font-bold">{summary.total_throughput_mbps} Mbps</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <LiveStatCard icon={<Server size={18} />} label="Online Hosts" value={summary?.online_hosts ?? '—'} color="success" />
        <LiveStatCard icon={<Eye size={18} />} label="Monitored" value={summary?.monitored_hosts ?? '—'} color="warning" />
        <LiveStatCard icon={<Ban size={18} />} label="Blocked" value={summary?.blocked_hosts ?? '—'} color="danger" />
        <LiveStatCard icon={<Activity size={18} />} label="Active Flows" value={summary?.active_flows ?? '—'} color="primary" />
        <LiveStatCard icon={<Zap size={18} />} label="Active Alerts" value={summary?.active_alerts ?? '—'} color="accent" />
        <LiveStatCard icon={<Network size={18} />} label="Total Flows" value={summary?.total_flows_simulated?.toLocaleString() ?? '—'} color="info" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Live throughput history */}
        <Card title="Network Throughput (Live)" icon={<Wifi size={18} />} className="lg:col-span-2">
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="timestamp" stroke="#64748B" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <YAxis stroke="#64748B" fontSize={10} unit=" Mbps" />
                <Tooltip
                  contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }}
                  labelFormatter={(v) => new Date(v).toLocaleTimeString()}
                />
                <Area type="monotone" dataKey="total_throughput_mbps" name="Throughput (Mbps)" stroke="#0EA5E9" fill="url(#throughputGrad)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-cyber-muted">Collecting data...</div>
          )}
        </Card>

        {/* Host Status Distribution */}
        <Card title="Host Status" icon={<Server size={18} />}>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={hostStatusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {hostStatusDist.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Latency & Packet Loss history */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Average Latency (Live)" icon={<Gauge size={18} />}>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="timestamp" stroke="#64748B" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <YAxis stroke="#64748B" fontSize={10} unit="ms" />
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} labelFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <Line type="monotone" dataKey="avg_latency" name="Latency (ms)" stroke="#8B5CF6" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-cyber-muted">Collecting data...</div>
          )}
        </Card>

        <Card title="Packet Loss (Live)" icon={<TrendingDown size={18} />}>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="timestamp" stroke="#64748B" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <YAxis stroke="#64748B" fontSize={10} unit="%" />
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} labelFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <Line type="monotone" dataKey="avg_packet_loss" name="Packet Loss (%)" stroke="#EF4444" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-cyber-muted">Collecting data...</div>
          )}
        </Card>
      </div>

      {/* Live alerts feed */}
      <Card title="Live Alerts Feed" icon={<AlertTriangle size={18} />} className="mb-6"
        action={alerts.length > 0 && <Badge variant="danger">{alerts.length} active</Badge>}
      >
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle size={40} className="text-cyber-success mx-auto mb-2" />
            <p className="text-cyber-muted text-sm">No active alerts - network is healthy</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            <AnimatePresence>
              {alerts.map((alert: any, i: number) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(239,68,68,0.1)' }}
                  animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(19,27,48,0.4)' }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className={clsx(
                    'flex items-start gap-3 p-3 rounded-xl border',
                    alert.type === 'critical' ? 'border-cyber-danger/30' : 'border-cyber-warning/30'
                  )}
                >
                  <div className={clsx(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    alert.type === 'critical' ? 'bg-cyber-danger/15 text-cyber-danger' : 'bg-cyber-warning/15 text-cyber-warning'
                  )}>
                    {alert.type === 'critical' ? <Flame size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-cyber-text">{alert.source_ip}</span>
                      <Badge variant={alert.type === 'critical' ? 'danger' : 'warning'} size="sm">
                        {alert.threat_type}
                      </Badge>
                      <span className="text-xs text-cyber-muted ml-auto">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-cyber-muted mt-0.5">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="text-cyber-muted">Risk Score:</span>
                      <span className="font-mono font-bold text-cyber-danger">{alert.risk_score}</span>
                      <span className="text-cyber-muted">·</span>
                      <span className="text-cyber-muted">Action:</span>
                      <Badge variant={alert.action_taken === 'blocked' ? 'danger' : alert.action_taken === 'throttled' ? 'warning' : 'success'} size="sm">
                        {alert.action_taken}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* Live flows table */}
      <Card title="Live Network Flows" icon={<Activity size={18} />} className="mb-6"
        action={<span className="text-xs text-cyber-muted">Updated every 3s</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                <th className="text-left py-2 px-2">Time</th>
                <th className="text-left py-2 px-2">Source</th>
                <th className="text-left py-2 px-2">Destination</th>
                <th className="text-left py-2 px-2">Protocol</th>
                <th className="text-left py-2 px-2">Latency</th>
                <th className="text-left py-2 px-2">Risk</th>
                <th className="text-left py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {flows.map((flow: any) => (
                  <motion.tr
                    key={flow.id}
                    initial={{ opacity: 0, backgroundColor: 'rgba(14,165,233,0.1)' }}
                    animate={{ opacity: 1, backgroundColor: 'transparent' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="border-b border-cyber-border/40 hover:bg-cyber-bg/30"
                  >
                    <td className="py-2 px-2 text-cyber-muted text-xs">
                      {new Date(flow.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-2">
                      <div className="font-mono text-cyber-text text-xs">{flow.src_ip}</div>
                      <div className="text-[10px] text-cyber-muted">{flow.src_name}</div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="font-mono text-cyber-text text-xs">{flow.dst_ip}</div>
                      <div className="text-[10px] text-cyber-muted">{flow.dst_name}</div>
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="info" size="sm">{flow.protocol}:{flow.port}</Badge>
                    </td>
                    <td className="py-2 px-2 text-cyber-text font-mono text-xs">
                      {flow.latency_ms}ms
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold" style={{
                          color: flow.risk_score >= 80 ? '#EF4444' : flow.risk_score >= 50 ? '#F59E0B' : '#10B981'
                        }}>
                          {flow.risk_score}
                        </span>
                        <div className="w-12 h-1 bg-cyber-bg/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${flow.risk_score}%`,
                            background: flow.risk_score >= 80 ? '#EF4444' : flow.risk_score >= 50 ? '#F59E0B' : '#10B981',
                          }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <Badge
                        variant={flow.status === 'blocked' ? 'danger' : flow.status === 'throttled' ? 'warning' : 'success'}
                        size="sm"
                      >
                        {flow.status}
                      </Badge>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Hosts status grid */}
      <Card title="Monitored Hosts" icon={<Server size={18} />}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {hosts.map((host: any, i: number) => (
            <motion.div
              key={host.ip}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className={clsx(
                'p-3 rounded-xl border transition',
                host.status === 'blocked' ? 'border-cyber-danger/30 bg-cyber-danger/5' :
                host.status === 'monitored' ? 'border-cyber-warning/30 bg-cyber-warning/5' :
                'border-cyber-border bg-cyber-bg/30'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-mono text-xs text-cyber-text">{host.ip}</div>
                  <div className="text-[10px] text-cyber-muted">{host.name}</div>
                </div>
                <span className={clsx(
                  'w-2 h-2 rounded-full',
                  host.status === 'online' ? 'bg-cyber-success animate-pulse' :
                  host.status === 'blocked' ? 'bg-cyber-danger' :
                  host.status === 'monitored' ? 'bg-cyber-warning' :
                  host.status === 'throttled' ? 'bg-cyber-warning' : 'bg-cyber-muted'
                )} />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-cyber-muted">
                <Badge variant={
                  host.threat_level === 'critical' ? 'danger' :
                  host.threat_level === 'high' ? 'warning' :
                  host.threat_level === 'medium' ? 'info' : 'success'
                } size="sm">
                  {host.threat_level}
                </Badge>
                <span>·</span>
                <span>{host.type}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                <div>
                  <span className="text-cyber-muted">Latency:</span>
                  <span className="text-cyber-text font-mono ml-1">{host.latency_ms.toFixed(0)}ms</span>
                </div>
                <div>
                  <span className="text-cyber-muted">Flows/s:</span>
                  <span className="text-cyber-text font-mono ml-1">{host.flows_per_sec.toFixed(0)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </Layout>
  );
}

function LiveStatCard({ icon, label, value, color }: any) {
  const colorMap: Record<string, string> = {
    primary: 'text-cyber-primary bg-cyber-primary/10',
    accent: 'text-cyber-accent bg-cyber-accent/10',
    success: 'text-cyber-success bg-cyber-success/10',
    warning: 'text-cyber-warning bg-cyber-warning/10',
    danger: 'text-cyber-danger bg-cyber-danger/10',
    info: 'text-cyber-info bg-cyber-info/10',
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-4 hover:border-cyber-primary/40 transition"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={clsx('p-2 rounded-xl', colorMap[color])}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-cyber-text">{value}</div>
      <div className="text-xs text-cyber-muted">{label}</div>
    </motion.div>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}
