import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle, Cpu, Database, Gauge, Network,
  Shield, TrendingUp, Zap, Server, Crown, Radio, Wifi, Ban, Eye,
  Flame, Target, Clock, ArrowRight, ArrowUp, ArrowDown, Settings,
  AlertCircle, Bell, Layers, GitBranch, Box, HardDrive, Thermometer,
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

export function NOCDashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<any>(null);

  const fetchData = async () => {
    try {
      const r = await dashboardService.noc();
      setData(r.data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchData();
    if (isLive) {
      intervalRef.current = setInterval(fetchData, 5000); // Update every 5 seconds
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive]);

  if (loading || !data) {
    return (
      <Layout title="NOC Dashboard">
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-cyber-primary/30 border-t-cyber-primary rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  const nh = data.network_health;
  const trafficHistory = data.traffic_history || [];
  const devices = data.devices || [];
  const topology = data.topology || { nodes: [], links: [] };
  const congestionEvents = data.congestion_events || [];
  const topContributors = data.top_contributors || [];
  const shapFeatures = data.shap_features || [];
  const recommendations = data.recommendations || [];
  const alertTimeline = data.alert_timeline || [];
  const stats = data.stats || {};

  return (
    <Layout title="NOC Dashboard - Network Operations Center">
      {/* ===== HEADER: System Flow + Live Status ===== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 mb-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-cyber-gradient flex items-center justify-center">
                <Radio size={24} className="text-white" />
              </div>
              {isLive && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyber-success rounded-full border-2 border-cyber-card animate-ping" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-cyber-text flex items-center gap-2">
                NOC Operations Center
                {isLive ? (
                  <span className="badge badge-success text-[10px]">● LIVE</span>
                ) : (
                  <span className="badge badge-warning text-[10px]">⏸ PAUSED</span>
                )}
              </h2>
              <p className="text-xs text-cyber-muted">
                AI-Based Network Congestion Detection & Root Cause Analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-cyber-muted">Last update: {lastUpdate.toLocaleTimeString()}</span>
            <button
              onClick={() => setIsLive(!isLive)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium', isLive ? 'btn-secondary' : 'btn-primary')}
            >
              {isLive ? '⏸ Pause' : '▶ Resume'}
            </button>
          </div>
        </div>

        {/* System Flow Diagram */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <FlowNode icon={<Server size={14} />} label="Routers / Switches" color="primary" />
          <FlowArrow />
          <FlowNode icon={<Wifi size={14} />} label="NetFlow / IPFIX Collector + SNMP" color="accent" />
          <FlowArrow />
          <FlowNode icon={<Brain size={14} />} label="AI Model (Stacking + SHAP)" color="info" />
          <FlowArrow />
          <FlowNode icon={<Target size={14} />} label="RCA Engine" color="warning" />
          <FlowArrow />
          <FlowNode icon={<Gauge size={14} />} label="Live Dashboard" color="success" />
        </div>
      </motion.div>

      {/* ===== 1. NETWORK HEALTH OVERVIEW ===== */}
      <SectionTitle icon={<Activity size={18} />} title="1. Network Health Overview" subtitle="Real-time network status summary" />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <HealthCard
          label="Network Status"
          value={nh.status}
          color={nh.status_color}
          icon={nh.status === 'Healthy' ? <CheckCircle size={18} /> : nh.status === 'Warning' ? <AlertTriangle size={18} /> : <Ban size={18} />}
          big
        />
        <HealthCard label="Active Interfaces" value={nh.active_interfaces} subtext={`/ ${nh.total_interfaces} total`} icon={<Wifi size={18} />} color="#10B981" />
        <HealthCard label="Congestion Events" value={nh.congestion_events} icon={<AlertTriangle size={18} />} color="#EF4444" />
        <HealthCard label="Avg Latency" value={`${nh.avg_latency_ms}ms`} icon={<Clock size={18} />} color="#0EA5E9" />
        <HealthCard label="Avg Jitter" value={`${nh.avg_jitter_ms}ms`} icon={<Activity size={18} />} color="#8B5CF6" />
        <HealthCard label="Packet Loss" value={`${nh.packet_loss_rate}%`} icon={<ArrowDown size={18} />} color="#F59E0B" />
        <HealthCard label="Total Throughput" value={`${nh.total_throughput_mbps}`} subtext="Mbps" icon={<TrendingUp size={18} />} color="#3B82F6" />
      </div>

      {/* ===== 2. REAL-TIME TRAFFIC MONITORING ===== */}
      <SectionTitle icon={<TrendingUp size={18} />} title="2. Real-Time Traffic Monitoring" subtitle="Live interface traffic utilization" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Throughput Timeline */}
        <Card title="Throughput Timeline (Live)" icon={<TrendingUp size={18} />} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trafficHistory}>
              <defs>
                <linearGradient id="tIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
              <XAxis dataKey="timestamp" stroke="#64748B" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
              <YAxis stroke="#64748B" fontSize={10} unit=" Mbps" />
              <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} labelFormatter={(v) => new Date(v).toLocaleTimeString()} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="throughput_in" name="Incoming (Mbps)" stroke="#0EA5E9" fill="url(#tIn)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="throughput_out" name="Outgoing (Mbps)" stroke="#8B5CF6" fill="url(#tOut)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Network Utilization Gauge */}
        <Card title="Network Utilization" icon={<Gauge size={18} />}>
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart
              innerRadius="60%"
              outerRadius="100%"
              data={[{ value: nh.avg_utilization, fill: nh.avg_utilization >= 80 ? '#EF4444' : nh.avg_utilization >= 60 ? '#F59E0B' : '#10B981' }]}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={20} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-center -mt-32 mb-8">
            <div className="text-3xl font-bold text-cyber-text">{nh.avg_utilization}%</div>
            <div className="text-xs text-cyber-muted">Avg Utilization</div>
          </div>
        </Card>
      </div>

      {/* Interface Traffic Load per Router */}
      <Card title="Traffic Load per Router Interface" icon={<Server size={18} />} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {devices.map((device: any, i: number) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 rounded-xl bg-cyber-bg/40 border border-cyber-border"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-cyber-text text-sm">{device.id} - {device.name}</div>
                <Badge variant={device.status === 'online' ? 'success' : 'warning'} size="sm">{device.status}</Badge>
              </div>
              {device.interfaces.map((iface: any, idx: number) => (
                <div key={idx} className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-cyber-text">{iface.name}</span>
                    <span className={clsx(
                      'font-bold',
                      iface.utilization >= 90 ? 'text-cyber-danger' :
                      iface.utilization >= 75 ? 'text-cyber-warning' : 'text-cyber-success'
                    )}>
                      {iface.utilization}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${iface.utilization}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{
                        background: iface.utilization >= 90 ? '#EF4444' : iface.utilization >= 75 ? '#F59E0B' : '#10B981',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-cyber-muted mt-0.5">
                    <span>↓ {iface.throughput_in} Mbps</span>
                    <Badge
                      variant={iface.status === 'congested' ? 'danger' : iface.status === 'warning' ? 'warning' : 'success'}
                      size="sm"
                    >
                      {iface.status === 'congested' ? 'CONGESTED' : iface.status === 'warning' ? 'WARNING' : 'ACTIVE'}
                    </Badge>
                  </div>
                </div>
              ))}
            </motion.div>
          ))}
        </div>
      </Card>

      {/* ===== 3. CONGESTION DETECTION PANEL ===== */}
      <SectionTitle icon={<AlertTriangle size={18} />} title="3. Congestion Detection Panel" subtitle="AI model results - real-time congestion detection" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {congestionEvents.length === 0 ? (
          <Card className="lg:col-span-3 text-center py-12">
            <CheckCircle size={48} className="text-cyber-success mx-auto mb-3" />
            <p className="text-cyber-text font-medium">No Congestion Detected</p>
            <p className="text-cyber-muted text-sm">Network is operating normally</p>
          </Card>
        ) : (
          <>
            {congestionEvents.slice(0, 3).map((event: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className={clsx(event.severity === 'critical' && 'border-cyber-danger/40 bg-cyber-danger/5')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        event.severity === 'critical' ? 'bg-cyber-danger/15 text-cyber-danger' : 'bg-cyber-warning/15 text-cyber-warning'
                      )}>
                        <Flame size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-cyber-text">High Congestion Detected</div>
                        <div className="text-xs text-cyber-muted">{event.device} - {event.interface}</div>
                      </div>
                    </div>
                    <Badge variant={event.severity === 'critical' ? 'danger' : 'warning'}>{event.severity}</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cyber-muted">Confidence</span>
                      <span className="font-bold text-cyber-text">{event.confidence}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cyber-muted">Congestion Probability</span>
                      <span className="font-bold text-cyber-danger">{(event.congestion_probability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cyber-muted">Utilization</span>
                      <span className="font-bold text-cyber-warning">{event.utilization}%</span>
                    </div>
                    <div className="pt-2 border-t border-cyber-border">
                      <div className="text-xs text-cyber-muted mb-1">Detected at: {new Date(event.detected_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* ===== 4. ROOT CAUSE ANALYSIS PANEL ===== */}
      <SectionTitle icon={<Target size={18} />} title="4. Root Cause Analysis Panel" subtitle="Top contributing hosts identified by RCA engine" />
      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                <th className="text-left py-2 px-2">Rank</th>
                <th className="text-left py-2 px-2">Source IP</th>
                <th className="text-left py-2 px-2">Hostname</th>
                <th className="text-left py-2 px-2">Traffic Contribution</th>
                <th className="text-left py-2 px-2">Culprit Score</th>
                <th className="text-left py-2 px-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {topContributors.map((host: any, i: number) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={clsx('border-b border-cyber-border/40', host.culprit_score >= 85 && 'bg-cyber-danger/5')}
                >
                  <td className="py-2.5 px-2">
                    <div className={clsx(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                      i === 0 ? 'bg-cyber-danger/20 text-cyber-danger' : 'bg-cyber-card text-cyber-muted'
                    )}>
                      #{i + 1}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{host.ip}</td>
                  <td className="py-2.5 px-2 text-cyber-muted text-xs">{host.hostname}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-cyber-text font-bold text-xs">{host.traffic_contribution}%</span>
                      <div className="w-20 h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-cyber-primary" style={{ width: `${host.traffic_contribution}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="font-mono font-bold" style={{ color: host.culprit_score >= 85 ? '#EF4444' : host.culprit_score >= 70 ? '#F59E0B' : '#10B981' }}>
                      {host.culprit_score}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-cyber-muted text-xs">{host.reason}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===== 5. SHAP EXPLAINABILITY PANEL ===== */}
      <SectionTitle icon={<GitBranch size={18} />} title="5. SHAP Explainability Panel" subtitle="Feature importance - AI model decision interpretation" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="SHAP Feature Importance" icon={<GitBranch size={18} />} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={shapFeatures} layout="vertical" margin={{ left: 150 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
              <XAxis type="number" stroke="#64748B" fontSize={11} unit="%" />
              <YAxis type="category" dataKey="feature" stroke="#64748B" fontSize={10} width={150} />
              <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} formatter={(v: any) => [`${v}%`, 'Importance']} />
              <Bar dataKey="importance" radius={[0, 8, 8, 0]}>
                {shapFeatures.map((f: any, i: number) => (
                  <Cell key={i} fill={f.direction === 'positive' ? '#EF4444' : '#10B981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Top 4 Features */}
        <Card title="Top 4 Contributing Features" icon={<Target size={18} />}>
          <div className="space-y-3">
            {shapFeatures.slice(0, 4).map((f: any, i: number) => (
              <div key={i} className="p-3 rounded-xl bg-cyber-bg/40 border border-cyber-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-cyber-text">{f.feature}</span>
                  <span className="text-sm font-bold" style={{ color: f.direction === 'positive' ? '#EF4444' : '#10B981' }}>
                    {f.direction === 'positive' ? '+' : '-'}{f.importance}%
                  </span>
                </div>
                <div className="h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(f.importance, 100)}%`,
                      background: f.direction === 'positive' ? '#EF4444' : '#10B981',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ===== 6. DEVICE MONITORING PANEL ===== */}
      <SectionTitle icon={<Server size={18} />} title="6. Device Monitoring Panel" subtitle="Network device status and resource usage" />
      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                <th className="text-left py-2 px-2">Device</th>
                <th className="text-left py-2 px-2">IP Address</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-left py-2 px-2">CPU</th>
                <th className="text-left py-2 px-2">Memory</th>
                <th className="text-left py-2 px-2">Temp</th>
                <th className="text-left py-2 px-2">Uptime</th>
                <th className="text-left py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device: any, i: number) => (
                <motion.tr
                  key={device.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-cyber-border/40 hover:bg-cyber-bg/30"
                >
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        'w-2 h-2 rounded-full',
                        device.status === 'online' ? 'bg-cyber-success animate-pulse' : 'bg-cyber-warning'
                      )} />
                      <div>
                        <div className="text-cyber-text font-medium text-xs">{device.id} - {device.name}</div>
                        <div className="text-[10px] text-cyber-muted">{device.model}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{device.ip}</td>
                  <td className="py-2.5 px-2">
                    <Badge variant="info" size="sm">{device.type}</Badge>
                  </td>
                  <td className="py-2.5 px-2">
                    <ResourceUsage value={device.cpu_usage} label="CPU" color={device.cpu_usage >= 80 ? '#EF4444' : device.cpu_usage >= 60 ? '#F59E0B' : '#10B981'} />
                  </td>
                  <td className="py-2.5 px-2">
                    <ResourceUsage value={device.memory_usage} label="Mem" color={device.memory_usage >= 80 ? '#EF4444' : device.memory_usage >= 60 ? '#F59E0B' : '#0EA5E9'} />
                  </td>
                  <td className="py-2.5 px-2 text-cyber-muted text-xs">{device.temperature}°C</td>
                  <td className="py-2.5 px-2 text-cyber-muted text-xs">{Math.floor(device.uptime_hours / 24)}d {device.uptime_hours % 24}h</td>
                  <td className="py-2.5 px-2">
                    <Badge variant={device.status === 'online' ? 'success' : 'warning'} size="sm">{device.status}</Badge>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===== 7. RECOMMENDED ACTION PANEL ===== */}
      <SectionTitle icon={<Shield size={18} />} title="7. Recommended Action Panel" subtitle="AI-driven decision support for mitigation" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {recommendations.map((rec: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className={clsx(rec.priority === 'critical' && 'border-cyber-danger/40 bg-cyber-danger/5')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${rec.color}25`, color: rec.color }}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <div className="font-mono text-sm text-cyber-text">{rec.host}</div>
                    <div className="text-[10px] text-cyber-muted">{rec.hostname}</div>
                  </div>
                </div>
                <Badge
                  variant={rec.priority === 'critical' ? 'danger' : rec.priority === 'high' ? 'warning' : rec.priority === 'medium' ? 'info' : 'success'}
                  size="sm"
                >
                  {rec.priority}
                </Badge>
              </div>
              <div className="mb-3">
                <div className="text-xs text-cyber-muted mb-1">Recommended Action:</div>
                <div className="flex gap-2 flex-wrap">
                  {rec.action === 'Block' && (
                    <>
                      <button className="badge badge-danger text-xs cursor-pointer"><Ban size={10} /> Block</button>
                      <button className="badge badge-warning text-xs cursor-pointer">Throttle</button>
                      <button className="badge badge-info text-xs cursor-pointer">Monitor</button>
                    </>
                  )}
                  {rec.action === 'Throttle Bandwidth' && (
                    <>
                      <button className="badge badge-warning text-xs cursor-pointer">Throttle</button>
                      <button className="badge badge-danger text-xs cursor-pointer"><Ban size={10} /> Block</button>
                      <button className="badge badge-info text-xs cursor-pointer">Monitor</button>
                    </>
                  )}
                  {rec.action === 'Monitor' && (
                    <>
                      <button className="badge badge-info text-xs cursor-pointer">Monitor</button>
                      <button className="badge badge-warning text-xs cursor-pointer">Throttle</button>
                      <button className="badge badge-success text-xs cursor-pointer">Allow</button>
                    </>
                  )}
                  {rec.action === 'Allow' && (
                    <button className="badge badge-success text-xs cursor-pointer">Allow Connection</button>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-cyber-border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-cyber-muted">Culprit Score:</span>
                  <span className="font-bold" style={{ color: rec.color }}>{rec.culprit_score}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-muted">Traffic:</span>
                  <span className="text-cyber-text">{rec.traffic_contribution}%</span>
                </div>
                <div className="text-cyber-muted text-[10px] mt-1">Reason: {rec.reason}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ===== 8. ALERT TIMELINE ===== */}
      <SectionTitle icon={<Bell size={18} />} title="8. Alert Timeline" subtitle="Chronological log of network events" />
      <Card className="mb-6">
        {alertTimeline.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle size={40} className="text-cyber-success mx-auto mb-2" />
            <p className="text-cyber-muted text-sm">No alerts - network is healthy</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <AnimatePresence>
              {alertTimeline.map((alert: any, i: number) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(239,68,68,0.1)' }}
                  animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border',
                    alert.severity === 'critical' ? 'border-cyber-danger/30' : 'border-cyber-warning/30'
                  )}
                >
                  <div className={clsx(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    alert.severity === 'critical' ? 'bg-cyber-danger/15 text-cyber-danger' : 'bg-cyber-warning/15 text-cyber-warning'
                  )}>
                    <AlertTriangle size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-cyber-muted text-xs font-mono">{alert.time}</span>
                      <span className="text-cyber-text text-sm">{alert.device}</span>
                      <Badge variant="info" size="sm">{alert.interface}</Badge>
                      <Badge variant={alert.severity === 'critical' ? 'danger' : 'warning'} size="sm">{alert.problem}</Badge>
                    </div>
                    <div className="text-xs text-cyber-muted mt-0.5">
                      Confidence: {alert.confidence}% · Utilization: {alert.utilization}% · Action: {alert.action}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* ===== NETWORK TOPOLOGY MAP ===== */}
      <SectionTitle icon={<Network size={18} />} title="Network Topology" subtitle="Visual map of devices and links" />
      <Card className="mb-6">
        <TopologyMap nodes={topology.nodes} links={topology.links} />
      </Card>

      {/* ===== FOOTER STATS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <div className="text-2xl font-bold text-cyber-primary">{(stats.total_packets_processed / 1_000_000).toFixed(2)}M</div>
          <div className="text-xs text-cyber-muted">Packets Processed</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-cyber-accent">{(stats.total_flows_analyzed / 1000).toFixed(1)}K</div>
          <div className="text-xs text-cyber-muted">Flows Analyzed</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-cyber-warning">{stats.total_alerts}</div>
          <div className="text-xs text-cyber-muted">Total Alerts</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-cyber-success">{Math.floor(data.uptime_seconds / 60)}m</div>
          <div className="text-xs text-cyber-muted">Uptime</div>
        </Card>
      </div>
    </Layout>
  );
}

// ===== Helper Components =====

function SectionTitle({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 mb-4 mt-6"
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

function FlowNode({ icon, label, color }: any) {
  const colorMap: Record<string, string> = {
    primary: 'bg-cyber-primary/15 text-cyber-primary border-cyber-primary/30',
    accent: 'bg-cyber-accent/15 text-cyber-accent border-cyber-accent/30',
    success: 'bg-cyber-success/15 text-cyber-success border-cyber-success/30',
    warning: 'bg-cyber-warning/15 text-cyber-warning border-cyber-warning/30',
    info: 'bg-cyber-info/15 text-cyber-info border-cyber-info/30',
    danger: 'bg-cyber-danger/15 text-cyber-danger border-cyber-danger/30',
  };
  return (
    <div className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium', colorMap[color])}>
      {icon}
      {label}
    </div>
  );
}

function FlowArrow() {
  return <ArrowRight size={16} className="text-cyber-muted" />;
}

function HealthCard({ label, value, subtext, color, icon, big }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-cyber-muted">{label}</div>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className={clsx('font-bold text-cyber-text', big ? 'text-xl' : 'text-2xl')} style={big ? { color } : undefined}>
        {value}
      </div>
      {subtext && <div className="text-[10px] text-cyber-muted">{subtext}</div>}
    </motion.div>
  );
}

function ResourceUsage({ value, label, color }: any) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-cyber-text">{value}%</span>
    </div>
  );
}

function Brain({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  );
}

function TopologyMap({ nodes, links }: { nodes: any[]; links: any[] }) {
  // Simple topology visualization using SVG
  const width = 800;
  const height = 400;

  // Position nodes in a layout
  const positions: Record<string, { x: number; y: number }> = {
    R1: { x: 400, y: 100 },
    R2: { x: 200, y: 250 },
    SW1: { x: 600, y: 250 },
    SW2: { x: 700, y: 350 },
    FW1: { x: 150, y: 100 },
  };

  const nodeColors: Record<string, string> = {
    Router: '#0EA5E9',
    Switch: '#8B5CF6',
    Firewall: '#EF4444',
  };

  const linkColors: Record<string, string> = {
    active: '#10B981',
    warning: '#F59E0B',
    congested: '#EF4444',
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="mx-auto" style={{ maxWidth: '100%' }}>
        {/* Links */}
        {links.map((link: any, i: number) => {
          const from = positions[link.from];
          const to = positions[link.to];
          if (!from || !to) return null;
          const color = linkColors[link.status] || '#10B981';
          return (
            <g key={i}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={color}
                strokeWidth={link.utilization >= 90 ? 4 : link.utilization >= 75 ? 3 : 2}
                strokeDasharray={link.status === 'congested' ? '5,5' : 'none'}
                opacity={0.8}
              />
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 5}
                fill={color}
                fontSize={10}
                textAnchor="middle"
              >
                {link.utilization}%
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node: any) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const color = nodeColors[node.type] || '#0EA5E9';
          return (
            <g key={node.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={28}
                fill={`${color}25`}
                stroke={color}
                strokeWidth={2}
              />
              <text
                x={pos.x}
                y={pos.y - 2}
                fill="white"
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
              >
                {node.id}
              </text>
              <text
                x={pos.x}
                y={pos.y + 12}
                fill="#94A3B8"
                fontSize={8}
                textAnchor="middle"
              >
                {node.type}
              </text>
              <text
                x={pos.x}
                y={pos.y + 45}
                fill="#CBD5E1"
                fontSize={9}
                textAnchor="middle"
              >
                {node.name.split(' ').slice(-1)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ background: '#10B981' }}></div>
          <span className="text-cyber-muted">Active</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ background: '#F59E0B' }}></div>
          <span className="text-cyber-muted">Warning</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ background: '#EF4444' }}></div>
          <span className="text-cyber-muted">Congested</span>
        </div>
      </div>
    </div>
  );
}
