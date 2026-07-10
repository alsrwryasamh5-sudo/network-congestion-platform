import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FileText, Download, Trash2, Plus, Clock, HardDrive } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge, Skeleton } from '../components/Card';
import { apiGet, apiDelete } from '../services/api';
import { API_BASE } from '../config';
import toast from 'react-hot-toast';

export function ReportsPage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet('/reports').then((r) => setReports(r.data.items || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const generate = async (type = 'executive') => {
    setGenerating(true);
    try {
      const r = await apiPost('/reports/generate', { report_type: type, title: `${type} Report - ${new Date().toLocaleString()}` });
      toast.success('Report generated!');
      load();
    } catch {
      // handled
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this report?')) return;
    await apiDelete(`/reports/${id}`);
    toast.success('Report deleted');
    load();
  };

  return (
    <Layout title={t('reports.title')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {['executive', 'technical', 'mitigation'].map((type, i) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="text-center">
              <div className="w-12 h-12 rounded-xl bg-cyber-gradient flex items-center justify-center mx-auto mb-3">
                <FileText size={24} className="text-white" />
              </div>
              <h3 className="font-semibold text-cyber-text mb-1 capitalize">{t(`reports.${type}`)}</h3>
              <p className="text-xs text-cyber-muted mb-4">
                {type === 'executive' && 'High-level overview with KPIs and recommendations'}
                {type === 'technical' && 'Detailed model metrics, confusion matrix, ROC curves'}
                {type === 'mitigation' && 'Root cause analysis and mitigation strategies'}
              </p>
              <button
                onClick={() => generate(type)}
                disabled={generating}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Plus size={16} /> {generating ? t('common.loading') : t('reports.generate')}
              </button>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card title={t('reports.title')} icon={<FileText size={18} />}>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-cyber-muted">{t('common.noData')}</div>
        ) : (
          <div className="space-y-2">
            {reports.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-cyber-bg/40 border border-cyber-border hover:border-cyber-primary/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyber-primary/15 text-cyber-primary flex items-center justify-center">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-cyber-text">{r.title}</div>
                    <div className="flex items-center gap-3 text-xs text-cyber-muted mt-0.5">
                      <span className="flex items-center gap-1"><Clock size={10} /> {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</span>
                      <span className="flex items-center gap-1"><HardDrive size={10} /> {r.file_size_kb?.toFixed(1)} KB</span>
                      <Badge variant="primary" size="sm">{r.report_type}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`${API_BASE}/reports/${r.id}/download`}
                    className="btn-ghost text-cyber-primary"
                    title={t('reports.download')}
                  >
                    <Download size={16} />
                  </a>
                  <button onClick={() => remove(r.id)} className="btn-ghost text-cyber-danger" title={t('reports.delete')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </Layout>
  );
}

import { apiPost } from '../services/api';
