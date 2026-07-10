import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertTriangle, Target, Shield, Activity, CheckCircle, Clock } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge, Skeleton } from '../components/Card';
import { apiGet } from '../services/api';

export function RootCausePage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/dashboard/congestion-timeline?hours=168')
      .then((r) => setEvents(r.data.events || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout title={t('rca.title')}>
      <p className="text-cyber-muted text-sm mb-6">{t('rca.subtitle')}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Critical', value: events.filter(e => e.severity === 'critical').length, color: 'danger', icon: <AlertTriangle size={18} /> },
          { label: 'High', value: events.filter(e => e.severity === 'high').length, color: 'warning', icon: <AlertTriangle size={18} /> },
          { label: 'Medium', value: events.filter(e => e.severity === 'medium').length, color: 'info', icon: <Target size={18} /> },
          { label: 'Total', value: events.length, color: 'primary', icon: <Activity size={18} /> },
        ].map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="text-center">
              <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center bg-cyber-${card.color}/15 text-cyber-${card.color}`}>
                {card.icon}
              </div>
              <div className="text-2xl font-bold text-cyber-text">{card.value}</div>
              <div className="text-xs text-cyber-muted">{card.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card title="Congestion Events Log" icon={<Target size={18} />}>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-cyber-muted">{t('common.noData')}</div>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 20).map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-3 rounded-xl bg-cyber-bg/40 border border-cyber-border"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-12 rounded-full bg-cyber-${e.severity === 'critical' ? 'danger' : e.severity === 'high' ? 'warning' : 'info'}`} />
                  <div>
                    <div className="text-sm font-mono text-cyber-text">{e.source_ip || 'unknown'}</div>
                    <div className="text-xs text-cyber-muted flex items-center gap-2">
                      <Clock size={10} /> {e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right rtl:text-left">
                    <div className="text-sm font-bold text-cyber-text">{e.culprit_score?.toFixed(1)}</div>
                    <div className="text-[10px] text-cyber-muted">Culprit Score</div>
                  </div>
                  <Badge variant={e.severity === 'critical' ? 'danger' : e.severity === 'high' ? 'warning' : 'info'}>
                    {t(`severity.${e.severity}`)}
                  </Badge>
                  <Badge variant={e.status === 'active' ? 'warning' : 'success'}>
                    {e.status}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </Layout>
  );
}
