import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Zap, Brain, CheckCircle, XCircle, Loader, Clock, Target,
  Database, UploadCloud, Cloud, FileSpreadsheet, AlertCircle,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge, Skeleton } from '../components/Card';
import { mlService } from '../services/mlService';
import { apiGet, apiPost } from '../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

type TrainingMode = 'synthetic' | 'kaggle' | 'csv';

export function TrainingPage() {
  const { t } = useTranslation();
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [mode, setMode] = useState<TrainingMode>('synthetic');
  const [samples, setSamples] = useState(50000);
  const [expName, setExpName] = useState(`exp_${Date.now()}`);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvFile2, setCsvFile2] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);

  const load = () => {
    setLoading(true);
    apiGet('/admin/experiments').then((r) => setExperiments(r.data.items || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startTraining = async () => {
    setTraining(true);
    setResult(null);
    try {
      let r;
      if (mode === 'synthetic') {
        r = await mlService.train({
          synthetic: true,
          n_samples: samples,
          experiment_name: expName,
        });
      } else if (mode === 'kaggle') {
        r = await apiPost('/ml/train-kaggle', {
          n_samples: samples,
          experiment_name: expName,
        });
      } else if (mode === 'csv') {
        if (!csvFile) {
          toast.error('Please select a CSV file first');
          setTraining(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', csvFile);
        if (csvFile2) {
          formData.append('file2', csvFile2);
        }
        formData.append('n_samples', String(samples));
        formData.append('experiment_name', expName);
        // Use fetch for multipart upload
        const token = JSON.parse(localStorage.getItem('congestion_auth') || '{}').accessToken;
        const resp = await fetch('/api/v1/ml/train-csv', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        r = await resp.json();
        if (!r.success) throw new Error(r.error?.message || 'Training failed');
      }

      const metrics = r.data?.metrics || r.data?.result || {};
      const stacking = metrics.models?.stacking || {};
      const nSamples = r.data?.n_samples || samples;

      setResult({
        n_samples: nSamples,
        accuracy: stacking.accuracy,
        f1: stacking.f1,
        auc: stacking.auc,
        source: mode,
        confusion_matrix: metrics.confusion_matrix,
      });

      toast.success(
        mode === 'kaggle'
          ? `Trained on ${nSamples.toLocaleString()} real samples! Accuracy: ${(stacking.accuracy * 100).toFixed(2)}%`
          : mode === 'csv'
          ? `Trained on uploaded CSV! Accuracy: ${(stacking.accuracy * 100).toFixed(2)}%`
          : `Training complete! Accuracy: ${(stacking.accuracy * 100).toFixed(2)}%`
      );
      load();
    } catch (err: any) {
      // handled by interceptor
    } finally {
      setTraining(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      if (!csvFile2) {
        setExpName(`csv_${file.name.replace('.csv', '')}_${Date.now()}`);
      } else {
        setExpName(`csv_merged_${Date.now()}`);
      }
    }
  };

  const handleFile2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile2(file);
      setExpName(`csv_merged_${Date.now()}`);
    }
  };

  return (
    <Layout title={t('training.title')}>
      <p className="text-cyber-muted text-sm mb-6">{t('training.subtitle')}</p>

      {/* Training Mode Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Mode Card 1: Synthetic */}
        <Card
          className={clsx('cursor-pointer transition-all', mode === 'synthetic' && 'ring-2 ring-cyber-primary')}
          delay={0}
        >
          <div onClick={() => setMode('synthetic')}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyber-primary/15 text-cyber-primary flex items-center justify-center">
                <Brain size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-cyber-text">Synthetic Data</h3>
                <p className="text-xs text-cyber-muted">Quick demo training</p>
              </div>
            </div>
            <p className="text-xs text-cyber-muted">
              Generates fake network flow data for testing. Fast (~30s) but not production-grade.
            </p>
          </div>
        </Card>

        {/* Mode Card 2: Kaggle */}
        <Card
          className={clsx('cursor-pointer transition-all', mode === 'kaggle' && 'ring-2 ring-cyber-primary')}
          delay={0.05}
        >
          <div onClick={() => setMode('kaggle')}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyber-accent/15 text-cyber-accent flex items-center justify-center">
                <Cloud size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-cyber-text">Kaggle Dataset</h3>
                <p className="text-xs text-cyber-muted">NF-UNSW-NB15-v3 (real)</p>
              </div>
            </div>
            <p className="text-xs text-cyber-muted">
              Downloads the real NF-UNSW-NB15-v3 dataset from Kaggle. Requires KAGGLE credentials.
            </p>
          </div>
        </Card>

        {/* Mode Card 3: CSV Upload */}
        <Card
          className={clsx('cursor-pointer transition-all', mode === 'csv' && 'ring-2 ring-cyber-primary')}
          delay={0.1}
        >
          <div onClick={() => setMode('csv')}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyber-success/15 text-cyber-success flex items-center justify-center">
                <UploadCloud size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-cyber-text">Upload CSV Files</h3>
                <p className="text-xs text-cyber-muted">NF-UNSW-NB15 (1 or 2 files)</p>
              </div>
            </div>
            <p className="text-xs text-cyber-muted">
              Upload NF-UNSW-NB15-v3.csv and optionally NetFlow_v3_Features.csv.
              Files will be merged like the original notebook.
            </p>
          </div>
        </Card>
      </div>

      {/* Training Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Training Configuration" icon={<Zap size={18} />} className="lg:col-span-1">
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
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={samples}
                onChange={(e) => setSamples(parseInt(e.target.value))}
                className="w-full accent-cyber-primary"
              />
              <div className="flex items-center justify-between text-xs text-cyber-muted mt-1">
                <span>1K</span>
                <span className="text-cyber-text font-semibold">{samples.toLocaleString()} rows</span>
                <span>100K</span>
              </div>
              <p className="text-[10px] text-cyber-muted mt-1">
                {mode === 'kaggle' && '⚠️ Large samples = longer training. 50K recommended on free tier.'}
                {mode === 'csv' && 'Will be sampled from your uploaded file.'}
                {mode === 'synthetic' && 'Number of synthetic rows to generate.'}
              </p>
            </div>

            {mode === 'csv' && (
              <>
                <div>
                  <label className="block text-sm text-cyber-muted mb-1.5">
                    CSV File 1 (required) — NF-UNSW-NB15-v3.csv
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-cyber-border rounded-xl cursor-pointer hover:border-cyber-primary transition text-cyber-muted hover:text-cyber-primary"
                    >
                      <FileSpreadsheet size={18} />
                      {csvFile ? (
                        <span className="text-cyber-text">
                          {csvFile.name} ({(csvFile.size / 1024 / 1024).toFixed(1)} MB)
                        </span>
                      ) : (
                        'Click to select NF-UNSW-NB15-v3.csv'
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-cyber-muted mb-1.5">
                    CSV File 2 (optional) — NetFlow_v3_Features.csv
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFile2Change}
                      className="hidden"
                      id="csv-upload-2"
                    />
                    <label
                      htmlFor="csv-upload-2"
                      className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-cyber-border rounded-xl cursor-pointer hover:border-cyber-accent transition text-cyber-muted hover:text-cyber-accent"
                    >
                      <FileSpreadsheet size={18} />
                      {csvFile2 ? (
                        <span className="text-cyber-text">
                          {csvFile2.name} ({(csvFile2.size / 1024 / 1024).toFixed(1)} MB)
                        </span>
                      ) : (
                        'Click to select NetFlow_v3_Features.csv (optional)'
                      )}
                    </label>
                  </div>
                  <p className="text-[10px] text-cyber-muted mt-1">
                    If both files are provided, they will be merged (like the original notebook).
                  </p>
                </div>
              </>
            )}

            {mode === 'kaggle' && (
              <div className="bg-cyber-warning/10 border border-cyber-warning/30 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-cyber-warning flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-cyber-text">
                    <div className="font-semibold text-cyber-warning mb-1">Kaggle Credentials Required</div>
                    <p className="text-cyber-muted">
                      Set these environment variables on Render:
                    </p>
                    <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-cyber-muted">
                      <li>KAGGLE_USERNAME=your_username</li>
                      <li>KAGGLE_KEY=your_api_key</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={startTraining}
              disabled={training}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
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

        {/* Model Architecture */}
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
                <PipelineNode icon={<Brain size={20} />} label="Decision Tree" color="primary" />
                <PipelineConnector />
                <PipelineNode icon={<Zap size={20} />} label="XGBoost" color="accent" />
                <PipelineConnector />
                <PipelineNode icon={<Target size={20} />} label="LogReg Meta" color="success" />
              </div>
            </div>

            {/* Training Result */}
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-cyber-success/10 border border-cyber-success/30 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={18} className="text-cyber-success" />
                  <span className="font-semibold text-cyber-success">Training Complete!</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ResultStat label="Samples" value={result.n_samples?.toLocaleString() || '—'} />
                  <ResultStat label="Accuracy" value={`${(result.accuracy * 100).toFixed(2)}%`} />
                  <ResultStat label="F1-Score" value={`${(result.f1 * 100).toFixed(2)}%`} />
                  <ResultStat label="ROC-AUC" value={`${(result.auc * 100).toFixed(2)}%`} />
                </div>
                {result.confusion_matrix && (
                  <div className="mt-3">
                    <div className="text-xs text-cyber-muted mb-2">Confusion Matrix</div>
                    <div className="grid grid-cols-3 gap-1 text-center text-xs max-w-xs">
                      <div></div>
                      <div className="text-cyber-muted">Pred Normal</div>
                      <div className="text-cyber-muted">Pred Congest</div>
                      <div className="text-cyber-muted">Act Normal</div>
                      <div className="bg-cyber-success/15 text-cyber-success p-2 rounded">{result.confusion_matrix[0][0]}</div>
                      <div className="bg-cyber-warning/15 text-cyber-warning p-2 rounded">{result.confusion_matrix[0][1]}</div>
                      <div className="text-cyber-muted">Act Congest</div>
                      <div className="bg-cyber-warning/15 text-cyber-warning p-2 rounded">{result.confusion_matrix[1][0]}</div>
                      <div className="bg-cyber-success/15 text-cyber-success p-2 rounded">{result.confusion_matrix[1][1]}</div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </Card>
      </div>

      {/* Experiment History */}
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
                      {exp.hyperparameters?.data_source && (
                        <span className="ml-2">· {exp.hyperparameters.data_source}</span>
                      )}
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

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cyber-bg/40 rounded-lg p-2 text-center">
      <div className="text-[10px] uppercase text-cyber-muted">{label}</div>
      <div className="text-lg font-bold text-cyber-text mt-0.5">{value}</div>
    </div>
  );
}

function PipelineNode({ icon, label, color }: { icon: any; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-cyber-primary/15 text-cyber-primary',
    accent: 'bg-cyber-accent/15 text-cyber-accent',
    success: 'bg-cyber-success/15 text-cyber-success',
  };
  return (
    <div className="text-center">
      <div className={`w-16 h-16 rounded-xl ${colorMap[color]} flex items-center justify-center mb-1 mx-auto`}>
        {icon}
      </div>
      <div className="text-[10px] text-cyber-muted">{label}</div>
    </div>
  );
}

function PipelineConnector() {
  return <div className="flex-1 h-0.5 bg-cyber-border mx-2"></div>;
}
