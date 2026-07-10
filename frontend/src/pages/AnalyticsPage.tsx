import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Activity, Network, Gauge, TrendingDown, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, StatCard } from '../components/Card';
import { dashboardService } from '../services/dashboardService';

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    Promise.all([dashboardService.networkHealth(), dashboardService.overview()])
      .then(([h, o]) => { setHealth(h.data); setOverview(o.data); })
      .catch(() => {});
  }, []);

  const qosData = health ? health.labels.map((label: string, i: number) => ({
    time: label,
    latency: health.latency_ms[i].value,
    packetLoss: health.packet_loss_pct[i],
    bandwidth: health.bandwidth_mbps[i],
    jitter: health.jitter_ms[i],
  })) : [];

  const radarData = [
    { metric: 'Latency', normal: 85, current: 72 },
    { metric: 'Jitter', normal: 90, current: 65 },
    { metric: 'Throughput', normal: 80, current: 88 },
    { metric: 'Packet Loss', normal: 95, current: 78 },
    { metric: 'QoS', normal: 88, current: 70 },
    { metric: 'Stability', normal: 92, current: 75 },
  ];

  return (
    <Layout title={t('nav.analytics')}>
      {/* QoS stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title={t('dashboard.latency')} value={health?.latency_ms?.[health.latency_ms.length - 1]?.value?.toFixed(1) + ' ms' || '—'} icon={<Activity size={18} />} color="primary" />
        <StatCard title={t('dashboard.jitter')} value={health?.jitter_ms?.[health.jitter_ms.length - 1]?.toFixed(1) + ' ms' || '—'} icon={<TrendingUp size={18} />} color="accent" />
        <StatCard title={t('dashboard.bandwidth')} value={health?.bandwidth_mbps?.[health.bandwidth_mbps.length - 1]?.toFixed(1) + ' Mbps' || '—'} icon={<Network size={18} />} color="success" />
        <StatCard title={t('dashboard.packetLoss')} value={health?.packet_loss_pct?.[health.packet_loss_pct.length - 1]?.toFixed(2) + '%' || '—'} icon={<TrendingDown size={18} />} color="warning" />
      </div>

      {/* Line chart - latency & jitter over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Latency & Jitter (24h)" icon={<Activity size={18} />}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={qosData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
              <XAxis dataKey="time" stroke="#64748B" fontSize={10} />
              <YAxis stroke="#64748B" fontSize={10} />
              <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="latency" name="Latency (ms)" stroke="#0EA5E9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="jitter" name="Jitter (ms)" stroke="#8B5CF6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Bandwidth & Packet Loss (24h)" icon={<Gauge size={18} />}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={qosData}>
              <defs>
                <linearGradient id="bwA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
              <XAxis dataKey="time" stroke="#64748B" fontSize={10} />
              <YAxis yAxisId="left" stroke="#64748B" fontSize={10} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748B" fontSize={10} />
              <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area yAxisId="left" type="monotone" dataKey="bandwidth" name="Bandwidth (Mbps)" stroke="#10B981" fill="url(#bwA)" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="packetLoss" name="Packet Loss (%)" stroke="#EF4444" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* QoS Restoration Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="QoS Restoration Radar" icon={<Gauge size={18} />}>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1E2A47" />
              <PolarAngleAxis dataKey="metric" stroke="#64748B" fontSize={11} />
              <PolarRadiusAxis stroke="#64748B" fontSize={9} angle={90} />
              <Radar name="Baseline" dataKey="normal" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
              <Radar name="Current" dataKey="current" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.4} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Protocol Distribution" icon={<Network size={18} />}>
          {overview?.protocol_distribution && (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={Object.entries(overview.protocol_distribution).map(([k, v]) => ({ name: k, value: v }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={(entry: any) => `${entry.name}: ${entry.value}`}
                  labelLine={false}
                >
                  {Object.entries(overview.protocol_distribution).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </Layout>
  );
}
