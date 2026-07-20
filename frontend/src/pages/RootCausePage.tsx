import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Target, Server, Network, Shield, Ban, Eye,
  Crown, Flame, Clock, TrendingUp, ArrowRight, Activity, Zap,
  CheckCircle, Cpu, GitBranch, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, Badge, StatCard } from '../components/Card';
import { dashboardService } from '../services/dashboardService';
import { apiGet } from '../services/api';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

const COLORS = ['#EF4444', '#F59E0B', '#0EA5E9', '#8B5CF6', '#10B981', '#3B82F6'];

export function RootCausePage() {
  const { t } = useTranslation();
  const [noc, setNoc] = useState<any>(null);
  const [dbCulprits, setDbCulprits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const intervalRef = useRef<any>(null);

  const fetchData = async () => {
    try {
      const [nocRes, culpritsRes] = await Promise.all([
        dashboardService.noc(),
        apiGet('/ml/top-culprit-hosts?limit=20&hours=168'),
      ]);
      setNoc(nocRes.data);
      setDbCulprits(culpritsRes.data?.hosts || []);
      setLoading(false);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    if (isLive) {
      intervalRef.current = setInterval(fetchData, 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isLive]);

  if (loading || !noc) {
    return (
      <Layout title="Root Cause Analysis">
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-cyber-primary/30 border-t-cyber-primary rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  const topContributors = noc.top_contributors || [];
  const recommendations = noc.recommendations || [];
  const shapFeatures = noc.shap_features || [];
  const congestionEvents = noc.congestion_events || [];

  // Merge NOC contributors with DB culprits
  const allCulprits = [...topContributors];
  const existingIPs = new Set(allCulprits.map(c => c.ip));
  dbCulprits.forEach(c => {
    if (!existingIPs.has(c.source_ip)) {
      allCulprits.push({
        ip: c.source_ip,
        hostname: c.host_type || 'Network Host',
        traffic_contribution: c.avg_culprit_score,
        culprit_score: c.avg_culprit_score,
        reason: 'Detected in historical data',
        is_real: false,
        severity: c.severity,
      });
    }
  });

  const criticalCount = allCulprits.filter(c => c.culprit_score >= 85).length;
  const highCount = allCulprits.filter(c => c.culprit_score >= 70 && c.culprit_score < 85).length;
  const avgCulpritScore = allCulprits.length > 0
    ? allCulprits.reduce((s, c) => s + c.culprit_score, 0) / allCulprits.length
    : 0;

  return (
    <Layout title="Root Cause Analysis">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 mb-6 border-l-4 border-l-cyber-danger"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyber-danger/15 flex items-center justify-center">
              <Target size={24} className="text-cyber-danger" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-cyber-text flex items-center gap-2">
                Root Cause Analysis Engine
                {isLive && <span className="badge badge-success text-[10px]">● LIVE</span>}
              </h2>
              <p className="text-xs text-cyber-muted">
                تحديد مصدر المشكلة · يرتبط بالأجهزة الحقيقية · يتحدث كل 5 ثوانٍ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsLive(!isLive)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium', isLive ? 'btn-secondary' : 'btn-primary')}>
              {isLive ? '⏸ Pause' : '▶ Resume'}
            </button>
            <Link to="/shap" className="btn-secondary text-xs flex items-center gap-1">SHAP →</Link>
            <Link to="/noc" className="btn-secondary text-xs flex items-center gap-1">NOC →</Link>
          </div>
        </div>
      </motion.div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total Culprits Identified" value={allCulprits.length} icon={<Crown size={18} />} color="primary" />
        <StatCard title="Critical (≥85)" value={criticalCount} icon={<Flame size={18} />} color="danger" />
        <StatCard title="High (70-84)" value={highCount} icon={<AlertTriangle size={18} />} color="warning" />
        <StatCard title="Avg Culprit Score" value={avgCulpritScore.toFixed(1)} icon={<Target size={18} />} color="accent" />
      </div>

      {/* ===== AFFECTED DEVICES & INTERFACES ===== */}
      <SectionTitle icon={<Server size={18} />} title="Affected Devices & Interfaces" subtitle="الأجهزة والواجهات المتأثرة بالازدحام" />
      <Card className="mb-6">
        {congestionEvents.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle size={40} className="text-cyber-success mx-auto mb-2" />
            <p className="text-cyber-muted text-sm">No affected devices - network is healthy</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                  <th className="text-left py-2 px-2">Device</th>
                  <th className="text-left py-2 px-2">Interface</th>
                  <th className="text-left py-2 px-2">Congestion Level</th>
                  <th className="text-left py-2 px-2">AI Confidence</th>
                  <th className="text-left py-2 px-2">Probability</th>
                  <th className="text-left py-2 px-2">Source IP</th>
                  <th className="text-left py-2 px-2">Detected</th>
                </tr>
              </thead>
              <tbody>
                {congestionEvents.map((event: any, i: number) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className={clsx('border-b border-cyber-border/40', event.severity === 'critical' && 'bg-cyber-danger/5')}>
                    <td className="py-2.5 px-2 text-cyber-text text-xs font-medium">{event.device}</td>
                    <td className="py-2.5 px-2"><Badge variant="info" size="sm">{event.interface}</Badge></td>
                    <td className="py-2.5 px-2">
                      <Badge variant={event.severity === 'critical' ? 'danger' : 'warning'} size="sm">
                        {event.severity === 'critical' ? 'High' : 'Medium'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{event.confidence}%</td>
                    <td className="py-2.5 px-2 font-mono text-cyber-danger text-xs">{(event.congestion_probability * 100).toFixed(1)}%</td>
                    <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{event.source_ip || '—'}</td>
                    <td className="py-2.5 px-2 text-cyber-muted text-xs">{event.detected_at ? new Date(event.detected_at).toLocaleTimeString() : '—'}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===== TOP CONTRIBUTING HOSTS ===== */}
      <SectionTitle icon={<Crown size={18} />} title="Top Contributing Hosts" subtitle="المضيفون الأكثر إسهاماً في الازدحام" />
      <Card className="mb-6">
        {allCulprits.length === 0 ? (
          <div className="text-center py-12">
            <Target size={40} className="text-cyber-muted mx-auto mb-2 opacity-40" />
            <p className="text-cyber-muted text-sm">No contributing hosts identified</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                  <th className="text-left py-2 px-2">Rank</th>
                  <th className="text-left py-2 px-2">Source IP</th>
                  <th className="text-left py-2 px-2">Hostname / Device</th>
                  <th className="text-left py-2 px-2">Traffic Contribution</th>
                  <th className="text-left py-2 px-2">Culprit Score</th>
                  <th className="text-left py-2 px-2">Reason</th>
                  <th className="text-left py-2 px-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {allCulprits.map((host: any, i: number) => (
                  <motion.tr key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className={clsx('border-b border-cyber-border/40 hover:bg-cyber-bg/30', host.culprit_score >= 85 && 'bg-cyber-danger/5')}>
                    <td className="py-2.5 px-2">
                      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold', i < 3 ? 'bg-cyber-danger/20 text-cyber-danger' : 'bg-cyber-card text-cyber-muted')}>#{i + 1}</div>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-cyber-text text-xs">{host.ip}</td>
                    <td className="py-2.5 px-2 text-cyber-muted text-xs">{host.hostname}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <span className="text-cyber-text font-bold text-xs">{host.traffic_contribution?.toFixed(1) || 0}%</span>
                        <div className="w-20 h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-cyber-primary" style={{ width: `${Math.min(host.traffic_contribution || 0, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="font-mono font-bold" style={{ color: host.culprit_score >= 85 ? '#EF4444' : host.culprit_score >= 70 ? '#F59E0B' : '#10B981' }}>
                        {host.culprit_score?.toFixed(1) || 0}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-cyber-muted text-xs">{host.reason}</td>
                    <td className="py-2.5 px-2">
                      {host.is_real ? <Badge variant="success" size="sm">REAL</Badge> : <Badge variant="info" size="sm">SIM</Badge>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===== SHAP EXPLANATION FOR TOP CULPRIT ===== */}
      <SectionTitle icon={<GitBranch size={18} />} title="SHAP Explainability" subtitle="تفسير قرار النموذج - أي الميزات ساهمت في الاكتشاف" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Feature Importance (SHAP)" icon={<GitBranch size={18} />} className="lg:col-span-2">
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

        <Card title="Top 4 Features" icon={<Target size={18} />}>
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
                  <div className="h-full rounded-full" style={{ width: `${Math.min(f.importance, 100)}%`, background: f.direction === 'positive' ? '#EF4444' : '#10B981' }} />
                </div>
              </div>
            ))}
          </div>
          <Link to="/shap" className="text-xs text-cyber-primary hover:underline mt-3 inline-block">
            View Full SHAP Analysis →
          </Link>
        </Card>
      </div>

      {/* ===== RECOMMENDED ACTIONS ===== */}
      <SectionTitle icon={<Shield size={18} />} title="Recommended Actions" subtitle="توصيات النظام للتعامل مع المسببين" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {recommendations.length === 0 ? (
          <Card className="md:col-span-3 text-center py-12">
            <CheckCircle size={40} className="text-cyber-success mx-auto mb-2" />
            <p className="text-cyber-muted text-sm">No actions needed - all hosts within normal range</p>
          </Card>
        ) : (
          recommendations.map((rec: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
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
                  <Badge variant={rec.priority === 'critical' ? 'danger' : rec.priority === 'high' ? 'warning' : rec.priority === 'medium' ? 'info' : 'success'} size="sm">{rec.priority}</Badge>
                </div>
                <div className="mb-3">
                  <div className="text-xs text-cyber-muted mb-1">Recommended Action:</div>
                  <div className="flex gap-2 flex-wrap">
                    {rec.action === 'Block' && (
                      <>
                        <button className="badge badge-danger text-xs cursor-pointer"><Ban size={10} className="mr-1" /> Block</button>
                        <button className="badge badge-warning text-xs cursor-pointer">Throttle</button>
                        <button className="badge badge-info text-xs cursor-pointer">Monitor</button>
                      </>
                    )}
                    {rec.action === 'Throttle Bandwidth' && (
                      <>
                        <button className="badge badge-warning text-xs cursor-pointer">Throttle</button>
                        <button className="badge badge-danger text-xs cursor-pointer"><Ban size={10} className="mr-1" /> Block</button>
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
                    {rec.action === 'Allow' && <button className="badge badge-success text-xs cursor-pointer">Allow Connection</button>}
                  </div>
                </div>
                <div className="pt-2 border-t border-cyber-border text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-cyber-muted">Culprit Score:</span><span className="font-bold" style={{ color: rec.color }}>{rec.culprit_score?.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-cyber-muted">Traffic:</span><span className="text-cyber-text">{rec.traffic_contribution?.toFixed(1)}%</span></div>
                  <div className="text-cyber-muted text-[10px] mt-1">Reason: {rec.reason}</div>
                  {rec.mitigation && <div className="text-cyber-warning text-[10px] mt-1">💡 {rec.mitigation}</div>}
                  {rec.is_real && <Badge variant="success" size="sm">REAL DEVICE</Badge>}
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* ===== CULPRIT SCORE DISTRIBUTION ===== */}
      <SectionTitle icon={<Activity size={18} />} title="Culprit Score Distribution" subtitle="توزيع درجات المسببين" />
      <Card className="mb-6">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={[
                { name: 'Critical (≥85)', value: criticalCount, color: '#EF4444' },
                { name: 'High (70-84)', value: highCount, color: '#F59E0B' },
                { name: 'Medium (50-69)', value: allCulprits.filter(c => c.culprit_score >= 50 && c.culprit_score < 70).length, color: '#0EA5E9' },
                { name: 'Low (<50)', value: allCulprits.filter(c => c.culprit_score < 50).length, color: '#10B981' },
              ].filter(d => d.value > 0)}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(entry: any) => `${entry.name}: ${entry.value}`}
            >
              {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#131B30', border: '1px solid #1E2A47', borderRadius: '12px', color: '#E2E8F0' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      {/* ===== NAVIGATION LINKS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/noc" className="block">
          <Card className="hover:border-cyber-primary/40 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyber-primary/15 text-cyber-primary flex items-center justify-center">
                <Activity size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-cyber-text">NOC Dashboard</div>
                <div className="text-xs text-cyber-muted">Real-time network monitoring</div>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/top-culprits" className="block">
          <Card className="hover:border-cyber-accent/40 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyber-accent/15 text-cyber-accent flex items-center justify-center">
                <Crown size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-cyber-text">Top Culprits</div>
                <div className="text-xs text-cyber-muted">Detailed culprit hosts ranking</div>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/shap" className="block">
          <Card className="hover:border-cyber-success/40 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyber-success/15 text-cyber-success flex items-center justify-center">
                <GitBranch size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-cyber-text">SHAP Explainability</div>
                <div className="text-xs text-cyber-muted">Feature importance analysis</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </Layout>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 mb-4 mt-6">
      <div className="w-9 h-9 rounded-xl bg-cyber-gradient flex items-center justify-center text-white">{icon}</div>
      <div>
        <h2 className="text-lg font-bold text-cyber-text">{title}</h2>
        <p className="text-xs text-cyber-muted">{subtitle}</p>
      </div>
    </motion.div>
  );
}
