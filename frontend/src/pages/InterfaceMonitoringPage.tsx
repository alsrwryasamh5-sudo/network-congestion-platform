import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Network, Activity, Gauge, TrendingUp, AlertTriangle,
  Wifi, Server, Cpu, MemoryStick, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, Badge, StatCard } from '../components/Card';
import { deviceService } from '../services/deviceService';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export function InterfaceMonitoringPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [device, setDevice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const intervalRef = useRef<any>(null);

  const fetchData = async () => {
    try {
      const r = await deviceService.metrics(parseInt(id!));
      setDevice(r.data);
      setHistory(prev => [...prev, {
        timestamp: new Date().toISOString(),
        ...r.data.interfaces.reduce((acc: any, iface: any) => {
          acc[`${iface.name}_util`] = iface.utilization;
          acc[`${iface.name}_lat`] = iface.latency_ms;
          return acc;
        }, {}),
      }].slice(-30));
      setLoading(false);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [id]);

  if (loading || !device) {
    return (
      <Layout title="Interface Monitoring">
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-cyber-primary/30 border-t-cyber-primary rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  const interfaces = device.interfaces || [];

  return (
    <Layout title={`Interface Monitoring - ${device.name}`}>
      {/* Back button + device info */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/devices')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Devices
        </button>
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            device.status === 'online' ? 'bg-cyber-success/15 text-cyber-success' : 'bg-cyber-warning/15 text-cyber-warning'
          )}>
            <Server size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-cyber-text">{device.name}</h2>
            <div className="text-xs text-cyber-muted">
              {device.ip_address} · {device.vendor} · {device.device_type} · {device.location || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Device Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard title="Status" value={device.status} icon={<Activity size={18} />} color={device.status === 'online' ? 'success' : 'warning'} />
        <StatCard title="CPU Usage" value={`${device.cpu_usage?.toFixed(1) || 0}%`} icon={<Cpu size={18} />} color="primary" />
        <StatCard title="Memory" value={`${device.memory_usage?.toFixed(1) || 0}%`} icon={<MemoryStick size={18} />} color="accent" />
        <StatCard title="Temperature" value={`${device.temperature?.toFixed(0) || 0}°C`} icon={<Gauge size={18} />} color="warning" />
        <StatCard title="Uptime" value={`${Math.floor((device.uptime_hours || 0) / 24)}d`} icon={<Clock size={18} />} color="info" />
        <StatCard title="Avg Utilization" value={`${device.avg_utilization || 0}%`} icon={<TrendingUp size={18} />} color="danger" />
      </div>

      {/* Interfaces Table */}
      <Card title="Interfaces" icon={<Network size={18} />} className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                <th className="text-left py-2 px-2">Interface</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Bandwidth</th>
                <th className="text-left py-2 px-2">Utilization</th>
                <th className="text-left py-2 px-2">↓ In</th>
                <th className="text-left py-2 px-2">↑ Out</th>
                <th className="text-left py-2 px-2">Packet Loss</th>
                <th className="text-left py-2 px-2">Latency</th>
                <th className="text-left py-2 px-2">Jitter</th>
              </tr>
            </thead>
            <tbody>
              {interfaces.map((iface: any, i: number) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={clsx(
                    'border-b border-cyber-border/40 hover:bg-cyber-bg/30',
                    iface.status === 'congested' && 'bg-cyber-danger/5'
                  )}
                >
                  <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{iface.name}</td>
                  <td className="py-2.5 px-2">
                    <Badge
                      variant={iface.status === 'congested' ? 'danger' : iface.status === 'warning' ? 'warning' : 'success'}
                      size="sm"
                    >
                      {iface.status === 'congested' ? 'CONGESTED' : iface.status === 'warning' ? 'WARNING' : iface.status === 'up' ? 'UP' : 'DOWN'}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-2 text-cyber-muted text-xs">{iface.bandwidth_capacity} Mbps</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${iface.utilization}%`,
                          background: iface.utilization >= 90 ? '#EF4444' : iface.utilization >= 75 ? '#F59E0B' : '#10B981',
                        }} />
                      </div>
                      <span className="font-mono text-xs" style={{
                        color: iface.utilization >= 90 ? '#EF4444' : iface.utilization >= 75 ? '#F59E0B' : '#10B981',
                      }}>
                        {iface.utilization}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{iface.throughput_in}</td>
                  <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{iface.throughput_out}</td>
                  <td className="py-2.5 px-2 font-mono text-xs" style={{ color: iface.packet_loss > 1 ? '#EF4444' : '#64748B' }}>
                    {iface.packet_loss}%
                  </td>
                  <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{iface.latency_ms}ms</td>
                  <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{iface.jitter_ms}ms</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Real-time charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Traffic Utilization Timeline" icon={<TrendingUp size={18} />}>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="timestamp" stroke="#64748B" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <YAxis stroke="#64748B" fontSize={10} unit="%" />
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} labelFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {interfaces.slice(0, 4).map((iface: any, i: number) => (
                  <Line key={iface.name} type="monotone" dataKey={`${iface.name}_util`} name={iface.name} stroke={COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-cyber-muted">Collecting data...</div>
          )}
        </Card>

        <Card title="Interface Latency" icon={<Gauge size={18} />}>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis dataKey="timestamp" stroke="#64748B" fontSize={9} tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <YAxis stroke="#64748B" fontSize={10} unit="ms" />
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} labelFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {interfaces.slice(0, 4).map((iface: any, i: number) => (
                  <Line key={iface.name} type="monotone" dataKey={`${iface.name}_lat`} name={iface.name} stroke={COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-cyber-muted">Collecting data...</div>
          )}
        </Card>
      </div>

      {/* Per-interface gauge cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {interfaces.slice(0, 4).map((iface: any, i: number) => (
          <Card key={i}>
            <div className="text-center">
              <div className="font-mono text-cyber-text text-sm mb-2">{iface.name}</div>
              <ResponsiveContainer width="100%" height={140}>
                <RadialBarChart
                  innerRadius="65%"
                  outerRadius="100%"
                  data={[{ value: iface.utilization, fill: iface.utilization >= 90 ? '#EF4444' : iface.utilization >= 75 ? '#F59E0B' : '#10B981' }]}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={15} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="text-center -mt-20 mb-8">
                <div className="text-2xl font-bold text-cyber-text">{iface.utilization}%</div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyber-muted">↓ {iface.throughput_in}</span>
                <Badge variant={iface.status === 'congested' ? 'danger' : iface.status === 'warning' ? 'warning' : 'success'} size="sm">
                  {iface.status}
                </Badge>
                <span className="text-cyber-muted">↑ {iface.throughput_out}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Layout>
  );
}

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];
