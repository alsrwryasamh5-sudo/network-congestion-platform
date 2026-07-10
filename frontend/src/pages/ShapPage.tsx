import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { GitBranch, TrendingUp, BarChart3, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis, Legend,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, Skeleton } from '../components/Card';
import { mlService } from '../services/mlService';

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#14B8A6'];

export function ShapPage() {
  const { t } = useTranslation();
  const [importance, setImportance] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([mlService.featureImportance(), mlService.evaluate()])
      .then(([imp, eval_]) => {
        setImportance(imp.data);
        setMetrics(eval_.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const topFeatures = importance?.top_features || [];

  return (
    <Layout title={t('shap.title')}>
      <p className="text-cyber-muted text-sm mb-6">{t('shap.subtitle')}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* SHAP summary bar chart */}
        <Card title={t('shap.topFeatures')} icon={<TrendingUp size={18} />} className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-80" />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topFeatures} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                <XAxis type="number" stroke="#64748B" fontSize={11} unit="%" />
                <YAxis type="category" dataKey="feature" stroke="#64748B" fontSize={10} width={120} />
                <Tooltip
                  contentStyle={{
                    background: '#131B30', border: '1px solid #1E2A47',
                    borderRadius: '12px', color: '#E2E8F0', fontSize: '12px',
                  }}
                  formatter={(v: any) => [`${v.toFixed(2)}%`, 'Contribution']}
                />
                <Bar dataKey="contribution_pct" radius={[0, 8, 8, 0]}>
                  {topFeatures.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Model metrics */}
        <Card title="Model Performance" icon={<BarChart3 size={18} />}>
          {loading ? (
            <Skeleton className="h-80" />
          ) : (
            <div className="space-y-4">
              {metrics?.models && ['decision_tree', 'xgboost', 'stacking'].map((key, i) => {
                const m = metrics.models[key];
                const names = { decision_tree: 'Decision Tree', xgboost: 'XGBoost', stacking: 'Stacking' };
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-cyber-bg/40 rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-cyber-text">{names[key as keyof typeof names]}</span>
                      {key === 'stacking' && (
                        <span className="badge badge-primary text-[10px]">Best</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-cyber-muted">{t('training.accuracy')}</div>
                        <div className="text-cyber-text font-mono">{(m.accuracy * 100).toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-cyber-muted">F1</div>
                        <div className="text-cyber-text font-mono">{(m.f1 * 100).toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-cyber-muted">AUC</div>
                        <div className="text-cyber-text font-mono">{(m.auc * 100).toFixed(2)}%</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {metrics?.confusion_matrix && (
                <div className="bg-cyber-bg/40 rounded-xl p-3">
                  <div className="text-sm text-cyber-muted mb-2">Confusion Matrix</div>
                  <div className="grid grid-cols-3 gap-1 text-center text-xs">
                    <div></div>
                    <div className="text-cyber-muted">Pred Normal</div>
                    <div className="text-cyber-muted">Pred Congest</div>
                    <div className="text-cyber-muted">Actual Normal</div>
                    <div className="bg-cyber-success/15 text-cyber-success p-2 rounded">{metrics.confusion_matrix[0][0]}</div>
                    <div className="bg-cyber-warning/15 text-cyber-warning p-2 rounded">{metrics.confusion_matrix[0][1]}</div>
                    <div className="text-cyber-muted">Actual Congest</div>
                    <div className="bg-cyber-warning/15 text-cyber-warning p-2 rounded">{metrics.confusion_matrix[1][0]}</div>
                    <div className="bg-cyber-success/15 text-cyber-success p-2 rounded">{metrics.confusion_matrix[1][1]}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ROC Curve */}
      {metrics?.roc_curve && (
        <Card title="ROC Curve" icon={<Activity size={18} />}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.roc_curve.fpr.map((fpr: number, i: number) => ({ fpr, tpr: metrics.roc_curve.tpr[i] }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
              <XAxis type="number" dataKey="fpr" stroke="#64748B" fontSize={11} domain={[0, 1]} label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -5, fill: '#64748B' }} />
              <YAxis type="number" dataKey="tpr" stroke="#64748B" fontSize={11} domain={[0, 1]} label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', fill: '#64748B' }} />
              <Tooltip
                contentStyle={{
                  background: '#131B30', border: '1px solid #1E2A47',
                  borderRadius: '12px', color: '#E2E8F0',
                }}
              />
              <Bar dataKey="tpr" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Feature importance table */}
      <Card title="Full Feature Contribution Table" icon={<GitBranch size={18} />} className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                <th className="text-left py-2 px-3">#</th>
                <th className="text-left py-2 px-3">Feature</th>
                <th className="text-left py-2 px-3">Mean |SHAP|</th>
                <th className="text-left py-2 px-3">Contribution %</th>
                <th className="text-left py-2 px-3">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {topFeatures.map((f: any, i: number) => (
                <tr key={f.feature} className="border-b border-cyber-border/40 hover:bg-cyber-bg/30">
                  <td className="py-2 px-3 text-cyber-muted">{i + 1}</td>
                  <td className="py-2 px-3 font-mono text-cyber-text">{f.feature}</td>
                  <td className="py-2 px-3 text-cyber-muted">{f.mean_abs_shap?.toFixed(4) || '—'}</td>
                  <td className="py-2 px-3 text-cyber-text font-semibold">{f.contribution_pct?.toFixed(2)}%</td>
                  <td className="py-2 px-3">
                    <div className="h-2 bg-cyber-bg/60 rounded-full overflow-hidden w-full">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${f.contribution_pct}%`, background: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Layout>
  );
}
