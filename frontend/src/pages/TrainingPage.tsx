import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Zap, Brain, CheckCircle, XCircle, Loader, Clock, Target } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge, Skeleton } from '../components/Card';
import { mlService } from '../services/mlService';
import { apiGet } from '../services/api';
import toast from 'react-hot-toast';

export function TrainingPage() {
  const { t } = useTranslation();
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [samples, setSamples] = useState(5000);
  const [expName, setExpName] = useState(`exp_${Date.now()}`);

  const load = () => {
    setLoading(true);
    apiGet('/admin/experiments').then((r) => setExperiments(r.data.items || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startTraining = async () => {
    setTraining(true);
    try {
      const r = await mlService.train({
        synthetic: true,
        n_samples: samples,
        experiment_name: expName,
      });
      toast.success(`Training complete! Accuracy: ${(r.data.metrics.models.stacking.accuracy * 100).toFixed(2)}%`);
      load();
    } catch {
      // handled
    } finally {
      setTraining(false);
    }
  };

  return (
    <Layout title={t('training.title')}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title={t('training.title')} icon={<Zap size={18} />} className="lg:col-span-1">
          <p className="text-sm text-cyber-muted mb-4">{t('training.subtitle')}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-cyber-muted mb-1.5">{t('training.experimentName')}</label>
              <input
                type="text"
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                className="input-cyber"
              />
            </div>

            <div>
              <label className="block text-sm text-cyber-muted mb-1.5">{t('training.samples')}</label>
              <input
                type="number"
                min="1000"
                max="100000"
                step="1000"
                value={samples}
                onChange={(e) => setSamples(parseInt(e.target.value) || 5000)}
                className="input-cyber"
              />
              <p className="text-xs text-cyber-muted mt-1">
                Using synthetic data (NF-UNSW-NB15-like). Connect real dataset via Kaggle for production.
              </p>
            </div>

            <button onClick={startTraining} disabled={training} className="btn-primary w-full flex items-center justify-center gap-2">
              {training ? (
                <>
                  <Loader size={16} className="animate-spin" /> {t('training.running')}...
                </>
              ) : (
                <>
                  <Zap size={16} /> {t('training.start')}
                </>
              )}
            </button>
          </div>
        </Card>

        <Card title="Model Architecture" icon={<Brain size={18} />} className="lg:col-span-2">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ModelCard
                name="Decision Tree"
                role="Base Learner"
                params="max_depth=3, min_samples_leaf=60"
                color="primary"
              />
              <ModelCard
                name="XGBoost"
                role="Base Learner"
                params="n_estimators=35, max_depth=3, lr=0.06"
                color="accent"
              />
              <ModelCard
                name="Logistic Regression"
                role="Meta Learner"
                params="C=0.08, cv=5"
                color="success"
              />
            </div>

            <div className="bg-cyber-bg/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-cyber-primary" />
                <span className="text-sm font-medium text-cyber-text">Stacking Pipeline</span>
              </div>
              <div className="flex items-center justify-between text-xs text-cyber-muted">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-xl bg-cyber-primary/15 flex items-center justify-center mb-1 mx-auto">
                    <Brain size={20} className="text-cyber-primary" />
                  </div>
                  Decision Tree
                </div>
                <div className="flex-1 h-0.5 bg-cyber-border mx-2"></div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-xl bg-cyber-accent/15 flex items-center justify-center mb-1 mx-auto">
                    <Zap size={20} className="text-cyber-accent" />
                  </div>
                  XGBoost
                </div>
                <div className="flex-1 h-0.5 bg-cyber-border mx-2"></div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-xl bg-cyber-success/15 flex items-center justify-center mb-1 mx-auto">
                    <Target size={20} className="text-cyber-success" />
                  </div>
                  LogReg Meta
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Experiment History" icon={<Clock size={18} />}>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : experiments.length === 0 ? (
          <div className="text-center py-12 text-cyber-muted">{t('common.noData')}</div>
        ) : (
          <div className="space-y-2">
            {experiments.map((exp, i) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-cyber-bg/40 border border-cyber-border"
              >
                <div className="flex items-center gap-3">
                  {exp.status === 'completed' ? <CheckCircle size={18} className="text-cyber-success" /> :
                   exp.status === 'failed' ? <XCircle size={18} className="text-cyber-danger" /> :
                   <Loader size={18} className="text-cyber-warning animate-spin" />}
                  <div>
                    <div className="text-sm font-medium text-cyber-text">{exp.name}</div>
                    <div className="text-xs text-cyber-muted">
                      {exp.model_type} · {exp.duration_seconds?.toFixed(1) || '—'}s
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {exp.metrics && (
                    <div className="flex gap-3 text-xs">
                      <Metric label={t('training.accuracy')} value={exp.metrics.accuracy} />
                      <Metric label="F1" value={exp.metrics.f1} />
                      <Metric label="AUC" value={exp.metrics.auc} />
                    </div>
                  )}
                  <Badge variant={exp.status === 'completed' ? 'success' : exp.status === 'failed' ? 'danger' : 'warning'}>
                    {exp.status}
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

function ModelCard({ name, role, params, color }: any) {
  const colorMap: Record<string, string> = {
    primary: 'bg-cyber-primary/15 text-cyber-primary border-cyber-primary/30',
    accent: 'bg-cyber-accent/15 text-cyber-accent border-cyber-accent/30',
    success: 'bg-cyber-success/15 text-cyber-success border-cyber-success/30',
  };
  return (
    <div className={`rounded-xl p-3 border ${colorMap[color]}`}>
      <div className="text-xs opacity-80">{role}</div>
      <div className="text-sm font-bold mt-0.5">{name}</div>
      <div className="text-[10px] opacity-70 mt-1 font-mono">{params}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-cyber-muted">{label}</div>
      <div className="font-mono text-cyber-text">
        {value ? (value * 100).toFixed(2) : '—'}{value && '%'}
      </div>
    </div>
  );
}
