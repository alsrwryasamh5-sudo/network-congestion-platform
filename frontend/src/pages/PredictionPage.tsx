import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Activity, AlertTriangle, Zap, Shield, Target, TrendingUp, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, Badge } from '../components/Card';
import { mlService } from '../services/mlService';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const DEFAULT_FEATURES: Record<string, any> = {
  DST_TO_SRC_IAT_STDDEV: 45.2,
  SRC_TO_DST_IAT_AVG: 38.7,
  SRC_TO_DST_IAT_STDDEV: 52.1,
  DST_TO_SRC_IAT_AVG: 41.3,
  DST_TO_SRC_SECOND_BYTES: 1240,
  FLOW_DURATION_MILLISECONDS: 32000,
  SRC_TO_DST_IAT_MAX: 180,
  L4_DST_PORT: 443,
  DURATION_OUT: 4.2,
  NUM_PKTS_UP_TO_128_BYTES: 18,
  SRC_TO_DST_SECOND_BYTES: 980,
  RETRANSMITTED_OUT_PKTS: 2,
  DST_TO_SRC_AVG_THROUGHPUT: 25000,
  SRC_TO_DST_AVG_THROUGHPUT: 31000,
  MIN_IP_PKT_LEN: 52,
  DURATION_IN: 2.8,
  TCP_WIN_MAX_OUT: 64240,
  PROTOCOL: 6,
  DST_TO_SRC_IAT_MAX: 210,
  DST_TO_SRC_IAT_MIN: 8,
  L7_PROTO: 91,
  TCP_FLAGS: 24,
  CLIENT_TCP_FLAGS: 24,
  SRC_TO_DST_IAT_MIN: 4,
  FTP_COMMAND_RET_CODE: 0,
  DNS_TTL_ANSWER: 0,
  DNS_QUERY_TYPE: 0,
  ICMP_IPV4_TYPE: 0,
  ICMP_TYPE: 0,
  TCP_WIN_MAX_IN: 64240,
  MAX_IP_PKT_LEN: 1400,
  NUM_PKTS_1024_TO_1514_BYTES: 12,
  NUM_PKTS_512_TO_1024_BYTES: 5,
  NUM_PKTS_256_TO_512_BYTES: 3,
  NUM_PKTS_128_TO_256_BYTES: 2,
  SERVER_TCP_FLAGS: 24,
  MIN_TTL: 52,
  MAX_TTL: 64,
  RETRANSMITTED_OUT_BYTES: 1200,
  RETRANSMITTED_IN_PKTS: 1,
  RETRANSMITTED_IN_BYTES: 600,
  LONGEST_FLOW_PKT: 1400,
  SHORTEST_FLOW_PKT: 52,
  L4_SRC_PORT: 54321,
  IPV4_SRC_ADDR: '10.0.1.45',
  IPV4_DST_ADDR: '192.168.1.100',
};

export function PredictionPage() {
  const { t } = useTranslation();
  const [features, setFeatures] = useState<Record<string, any>>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handlePredict = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await mlService.fullInference(features);
      setResult(response.data);
      toast.success('Analysis complete!');
    } catch (err) {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = (type: 'congested' | 'normal' | 'random') => {
    if (type === 'congested') {
      setFeatures({
        ...DEFAULT_FEATURES,
        DST_TO_SRC_IAT_STDDEV: 280,
        SRC_TO_DST_IAT_AVG: 195,
        SRC_TO_DST_IAT_STDDEV: 310,
        DST_TO_SRC_IAT_AVG: 180,
        RETRANSMITTED_OUT_PKTS: 15,
        DST_TO_SRC_AVG_THROUGHPUT: 5000,
        SRC_TO_DST_AVG_THROUGHPUT: 4500,
        IPV4_SRC_ADDR: '10.0.99.234',
      });
    } else if (type === 'normal') {
      setFeatures({
        ...DEFAULT_FEATURES,
        DST_TO_SRC_IAT_STDDEV: 12,
        SRC_TO_DST_IAT_AVG: 18,
        SRC_TO_DST_IAT_STDDEV: 8,
        DST_TO_SRC_IAT_AVG: 22,
        RETRANSMITTED_OUT_PKTS: 0,
        DST_TO_SRC_AVG_THROUGHPUT: 45000,
        SRC_TO_DST_AVG_THROUGHPUT: 52000,
        IPV4_SRC_ADDR: '10.0.0.12',
      });
    } else {
      const rng = (a: number, b: number) => Math.random() * (b - a) + a;
      setFeatures({
        ...DEFAULT_FEATURES,
        DST_TO_SRC_IAT_STDDEV: rng(5, 350),
        SRC_TO_DST_IAT_AVG: rng(5, 300),
        SRC_TO_DST_IAT_STDDEV: rng(5, 350),
        DST_TO_SRC_IAT_AVG: rng(5, 250),
        RETRANSMITTED_OUT_PKTS: Math.floor(rng(0, 20)),
        DST_TO_SRC_AVG_THROUGHPUT: rng(1000, 60000),
        SRC_TO_DST_AVG_THROUGHPUT: rng(1000, 60000),
      });
    }
  };

  return (
    <Layout title={t('nav.prediction')}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Input form */}
        <div className="xl:col-span-1">
          <Card title={t('prediction.inputFeatures')} icon={<Brain size={18} />} className="sticky top-20">
            <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-hide pr-2">
              {Object.entries(features).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-2 items-center">
                  <label className="text-xs text-cyber-muted truncate" title={key}>{key}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setFeatures({ ...features, [key]: e.target.value })}
                    className="input-cyber text-xs py-1.5 px-2"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => loadTemplate('congested')} className="btn-secondary text-xs px-3 py-1.5">
                {t('prediction.templateCongested')}
              </button>
              <button onClick={() => loadTemplate('normal')} className="btn-secondary text-xs px-3 py-1.5">
                {t('prediction.templateNormal')}
              </button>
              <button onClick={() => loadTemplate('random')} className="btn-secondary text-xs px-3 py-1.5">
                {t('prediction.templateRandom')}
              </button>
            </div>

            <button onClick={handlePredict} disabled={loading} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> {t('prediction.loading')}
                </>
              ) : (
                <>
                  <Zap size={16} /> {t('prediction.submit')}
                </>
              )}
            </button>
          </Card>
        </div>

        {/* Results */}
        <div className="xl:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-card p-12 flex flex-col items-center justify-center text-center"
              >
                <Brain size={48} className="text-cyber-muted mb-4" />
                <h3 className="text-lg font-medium text-cyber-text mb-2">{t('prediction.title')}</h3>
                <p className="text-cyber-muted text-sm max-w-md">{t('prediction.subtitle')}</p>
              </motion.div>
            )}

            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-card p-12 flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 border-4 border-cyber-primary/30 border-t-cyber-primary rounded-full animate-spin mb-4"></div>
                <p className="text-cyber-muted">{t('prediction.loading')}</p>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Prediction result banner */}
                <div className={clsx(
                  'glass-card p-6 border-2',
                  result.prediction.is_congested ? 'border-cyber-danger/40' : 'border-cyber-success/40'
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {result.prediction.is_congested ? (
                          <AlertTriangle size={20} className="text-cyber-danger" />
                        ) : (
                          <Shield size={20} className="text-cyber-success" />
                        )}
                        <span className={clsx(
                          'text-2xl font-bold',
                          result.prediction.is_congested ? 'text-cyber-danger' : 'text-cyber-success'
                        )}>
                          {result.prediction.is_congested ? t('prediction.congested') : t('prediction.normal')}
                        </span>
                      </div>
                      <p className="text-cyber-muted text-sm">
                        Prediction ID #{result.prediction_id} · Inference {result.prediction.inference_time_ms?.toFixed(1)}ms
                      </p>
                    </div>
                    <div className="text-right rtl:text-left">
                      <div className="text-3xl font-bold text-gradient">
                        {(result.prediction.confidence * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-cyber-muted">{t('prediction.confidence')}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-cyber-bg/40 rounded-xl p-3">
                      <div className="text-xs text-cyber-muted mb-1">{t('prediction.probability')}</div>
                      <div className="text-lg font-bold text-cyber-text">
                        {(result.prediction.predicted_probability * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div className="bg-cyber-bg/40 rounded-xl p-3">
                      <div className="text-xs text-cyber-muted mb-1">Label</div>
                      <div className="text-lg font-bold text-cyber-text">
                        {result.prediction.predicted_label}
                      </div>
                    </div>
                    <div className="bg-cyber-bg/40 rounded-xl p-3">
                      <div className="text-xs text-cyber-muted mb-1">Status</div>
                      <div className="text-lg font-bold text-cyber-text">
                        {result.prediction.is_congested ? 'Alert' : 'OK'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SHAP & RCA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SHAP top features */}
                  <Card title={t('shap.topFeatures')} icon={<TrendingUp size={18} />} delay={0.1}>
                    {result.shap.available && result.shap.top_features?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={result.shap.top_features.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E2A47" />
                          <XAxis type="number" stroke="#64748B" fontSize={10} />
                          <YAxis type="category" dataKey="feature" stroke="#64748B" fontSize={9} width={80} />
                          <Tooltip
                            contentStyle={{
                              background: '#131B30', border: '1px solid #1E2A47',
                              borderRadius: '12px', color: '#E2E8F0', fontSize: '12px',
                            }}
                          />
                          <Bar dataKey="contribution_pct" name="Contribution %" radius={[0, 8, 8, 0]}>
                            {result.shap.top_features.slice(0, 8).map((_: any, i: number) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-cyber-muted text-sm">
                        {t('shap.notAvailable')}
                      </div>
                    )}
                  </Card>

                  {/* Root Cause Analysis */}
                  <Card title={t('rca.title')} icon={<Target size={18} />} delay={0.15}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-cyber-muted">{t('rca.culpritScore')}</span>
                        <span className={clsx(
                          'text-2xl font-bold',
                          result.root_cause.total_rca_score >= 75 ? 'text-cyber-danger' :
                          result.root_cause.total_rca_score >= 50 ? 'text-cyber-warning' : 'text-cyber-success'
                        )}>
                          {result.root_cause.total_rca_score.toFixed(1)}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-cyber-muted">{t('rca.severity')}</span>
                          <Badge variant={
                            result.root_cause.severity === 'critical' ? 'danger' :
                            result.root_cause.severity === 'high' ? 'warning' :
                            result.root_cause.severity === 'medium' ? 'info' : 'success'
                          }>
                            {t(`severity.${result.root_cause.severity}`)}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <RcaStat label={t('rca.volumeContribution')} value={result.root_cause.volume_contribution} />
                        <RcaStat label={t('rca.qosImpact')} value={result.root_cause.qos_impact_score} />
                        <RcaStat label={t('rca.aiSupport')} value={result.root_cause.ai_support_score} />
                        <RcaStat label={t('rca.spatialPenalty')} value={result.root_cause.spatial_penalty} />
                      </div>

                      <div className="bg-cyber-bg/40 rounded-xl p-3 text-xs">
                        <div className="text-cyber-muted mb-1">{t('rca.narrative')}</div>
                        <p className="text-cyber-text leading-relaxed">{result.root_cause.congestion_cause}</p>
                      </div>

                      <div className="bg-cyber-warning/10 border border-cyber-warning/30 rounded-xl p-3 text-xs">
                        <div className="flex items-center gap-1.5 text-cyber-warning mb-1 font-medium">
                          <AlertTriangle size={12} /> {t('rca.recommendedAction')}
                        </div>
                        <p className="text-cyber-text leading-relaxed">{result.root_cause.recommended_mitigation}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Evidence */}
                {result.root_cause.evidence && (
                  <Card title={t('rca.evidence')} icon={<Activity size={18} />} delay={0.2}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(result.root_cause.evidence).map(([k, v]: any) => (
                        <div key={k} className="bg-cyber-bg/40 rounded-xl p-3">
                          <div className="text-[10px] uppercase text-cyber-muted">{k.replace(/_/g, ' ')}</div>
                          <div className="text-sm font-mono text-cyber-text mt-1">
                            {typeof v === 'number' ? v.toFixed(3) : String(v)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

function RcaStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-cyber-bg/40 rounded-lg p-2">
      <div className="text-cyber-muted text-[10px]">{label}</div>
      <div className="text-cyber-text font-semibold">{value?.toFixed(1) || 0}</div>
    </div>
  );
}

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#14B8A6'];
