import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Network, Target, TrendingUp, Shield, Server,
  Activity, Zap, Globe, Crown, Flame,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, RadialBarChart, RadialBar, Legend,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, Badge, StatCard, Skeleton } from '../components/Card';
import { apiGet } from '../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const COLORS = ['#EF4444', '#F59E0B', '#0EA5E9', '#8B5CF6', '#10B981', '#3B82F6', '#EC4899', '#14B8A6'];

export function TopCulpritHostsPage() {
  const { t } = useTranslation();
  const [hosts, setHosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(168); // 7 days
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    apiGet(`/ml/top-culprit-hosts?limit=50&hours=${hours}`)
      .then((r) => {
        setHosts(r.data.hosts || []);
        setSummary({
          total_hosts: r.data.total_hosts,
          hours_back: r.data.hours_back,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hours]);

  // Compute summary stats
  const criticalCount = hosts.filter(h => h.severity === 'critical').length;
  const highCount = hosts.filter(h => h.severity === 'high').length;
  const avgCulpritScore = hosts.length > 0
    ? hosts.reduce((s, h) => s + h.avg_culprit_score, 0) / hosts.length
    : 0;
  const totalEvents = hosts.reduce((s, h) => s + h.event_count, 0);

  // Top 10 for bar chart
  const top10Chart = hosts.slice(0, 10).map(h => ({
    name: h.source_ip,
    score: h.avg_culprit_score,
    events: h.event_count,
    type: h.host_type,
  }));

  // Host type distribution
  const typeDistribution = hosts.reduce((acc: any, h) => {
    const type = h.host_type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const typeChartData = Object.entries(typeDistribution).map(([name, value]) => ({ name, value: value as number }));

  // Severity distribution
  const severityDistribution = hosts.reduce((acc: any, h) => {
    const sev = h.severity || 'unknown';
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {});

  return (
    <Layout title="أكثر الأجهزة إسهاماً في الازدحام">
      <p className="text-cyber-muted text-sm mb-6">
        Top Culprit Hosts — تحليل المضيفين الأكثر تسبباً في ازدحام الشبكة
      </p>

      {/* Time range selector */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-cyber-muted">الفترة الزمنية:</span>
        {[
          { label: '24 ساعة', value: 24 },
          { label: '3 أيام', value: 72 },
          { label: '7 أيام', value: 168 },
          { label: '30 يوم', value: 720 },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setHours(opt.value)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs transition',
              hours === opt.value
                ? 'bg-cyber-primary text-white'
                : 'bg-cyber-card text-cyber-muted hover:text-cyber-text'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="إجمالي المضيفين المشبوهين"
          value={summary?.total_hosts ?? '—'}
          icon={<Server size={18} />}
          color="primary"
          delay={0}
        />
        <StatCard
          title="مضيفون حرجون"
          value={criticalCount}
          icon={<Flame size={18} />}
          color="danger"
          delay={0.05}
        />
        <StatCard
          title="مضيفون عاليو الخطورة"
          value={highCount}
          icon={<AlertTriangle size={18} />}
          color="warning"
          delay={0.1}
        />
        <StatCard
          title="متوسط درجة المذنب"
          value={`${avgCulpritScore.toFixed(1)}`}
          icon={<Target size={18} />}
          color="accent"
          delay={0.15}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Top 10 culprits bar chart */}
        <Card title="أعلى 10 مضيفين مذنبين" icon={<Crown size={18} />} className="lg:col-span-2" delay={0.2}>
          {loading ? (
            <Skeleton className="h-80" />
          ) : top10Chart.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-cyber-muted text-sm">
              {t('common.noData')} — درّب النموذج أولاً لرؤية البيانات
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={top10Chart} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis type="number" stroke="#64748B" fontSize={11} domain={[0, 100]} />
                <YAxis type="category" dataKey="name" stroke="#64748B" fontSize={10} width={120} />
                <Tooltip
                  contentStyle={{
                    background: '#131B30',
                    border: '1px solid #1E2A47',
                    borderRadius: '12px',
                    color: '#E2E8F0',
                    fontSize: '12px',
                  }}
                  formatter={(v: any) => [`${v.toFixed(2)}`, 'درجة المذنب']}
                  labelFormatter={(label: any) => `IP: ${label}`}
                />
                <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                  {top10Chart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Host type distribution */}
        <Card title="توزيع أنواع المضيفين" icon={<Server size={18} />} delay={0.25}>
          {loading ? (
            <Skeleton className="h-80" />
          ) : typeChartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-cyber-muted text-sm">
              {t('common.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={typeChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  label={(entry: any) => `${entry.value}`}
                >
                  {typeChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#131B30',
                    border: '1px solid #1E2A47',
                    borderRadius: '12px',
                    color: '#E2E8F0',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Detailed hosts table */}
      <Card title="قائمة المضيفين التفصيلية" icon={<Network size={18} />} delay={0.3}>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : hosts.length === 0 ? (
          <div className="text-center py-12">
            <Network size={48} className="text-cyber-muted mx-auto mb-4" />
            <p className="text-cyber-muted mb-2">{t('common.noData')}</p>
            <p className="text-cyber-muted text-sm">
              لم يتم العثور على مضيفين مذنبين. درّب النموذج على بيانات حقيقية لرؤية النتائج.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                  <th className="text-left py-3 px-2">الترتيب</th>
                  <th className="text-left py-3 px-2">عنوان IP</th>
                  <th className="text-left py-3 px-2">نوع الجهاز</th>
                  <th className="text-left py-3 px-2">عدد الأحداث</th>
                  <th className="text-left py-3 px-2">متوسط الدرجة</th>
                  <th className="text-left py-3 px-2">أعلى درجة</th>
                  <th className="text-left py-3 px-2">البروتوكول</th>
                  <th className="text-left py-3 px-2">المنفذ</th>
                  <th className="text-left py-3 px-2">الخطورة</th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((host, i) => (
                  <motion.tr
                    key={`${host.source_ip}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={clsx(
                      'border-b border-cyber-border/40 hover:bg-cyber-bg/30 transition',
                      host.severity === 'critical' && 'bg-cyber-danger/5'
                    )}
                  >
                    <td className="py-3 px-2">
                      <div className={clsx(
                        'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                        i < 3 ? 'bg-cyber-danger/20 text-cyber-danger' : 'bg-cyber-card text-cyber-muted'
                      )}>
                        {i + 1}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-mono text-cyber-text">{host.source_ip}</div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1.5">
                        <Server size={12} className="text-cyber-muted" />
                        <span className="text-xs text-cyber-muted">{host.host_type}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-cyber-text font-medium">{host.event_count}</span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyber-text font-semibold">
                          {host.avg_culprit_score.toFixed(1)}
                        </span>
                        <div className="w-16 h-1.5 bg-cyber-bg/60 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${host.avg_culprit_score}%`,
                              background: host.avg_culprit_score >= 75 ? '#EF4444' : host.avg_culprit_score >= 50 ? '#F59E0B' : '#10B981',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 font-mono text-cyber-muted">
                      {host.max_culprit_score.toFixed(1)}
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant="info" size="sm">{host.protocol || '—'}</Badge>
                    </td>
                    <td className="py-3 px-2 font-mono text-cyber-muted text-xs">
                      {host.l4_dst_port || '—'}
                    </td>
                    <td className="py-3 px-2">
                      <Badge
                        variant={
                          host.severity === 'critical' ? 'danger' :
                          host.severity === 'high' ? 'warning' :
                          host.severity === 'medium' ? 'info' : 'success'
                        }
                        size="sm"
                      >
                        {t(`severity.${host.severity}`)}
                      </Badge>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Auto-seed prompt if no data */}
      {!loading && hosts.length === 0 && (
        <Card className="mt-4 border-cyber-warning/30 bg-cyber-warning/5" delay={0.4}>
          <div className="flex items-start gap-3">
            <Zap size={20} className="text-cyber-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-cyber-warning mb-1">لا توجد بيانات بعد</h4>
              <p className="text-sm text-cyber-muted mb-3">
                لتعبئة هذه الصفحة بالبيانات، يمكنك:
              </p>
              <ul className="text-sm text-cyber-muted space-y-1 list-disc list-inside mb-3">
                <li>تدريب النموذج من صفحة <strong>Training</strong> (سيملأ DB تلقائياً)</li>
                <li>أو استخدام زر "تعبئة البيانات" أدناه لتوليد تنبؤات تجريبية</li>
              </ul>
              <button
                onClick={async () => {
                  try {
                    const r = await apiPost('/ml/seed-database', {
                      n_predictions: 200,
                      congested_ratio: 0.4,
                      hours_back: 168,
                    });
                    toast.success(`تم توليد ${r.data.predictions_created} تنبؤ بنجاح!`);
                    window.location.reload();
                  } catch {
                    // handled
                  }
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Zap size={16} /> تعبئة البيانات الآن
              </button>
            </div>
          </div>
        </Card>
      )}
    </Layout>
  );
}

import { apiPost } from '../services/api';
