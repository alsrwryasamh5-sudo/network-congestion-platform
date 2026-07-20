import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Server, Activity, AlertTriangle, CheckCircle, Zap,
  Wifi, Ban, Eye, FileSpreadsheet, Download, Trash2, RefreshCw,
  Radio, Crown, Clock, TrendingUp, ArrowRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Layout } from '../components/Layout';
import { Card, Badge, StatCard } from '../components/Card';
import { apiGet, apiPost } from '../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

export function DeviceConnectionPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [deviceId, setDeviceId] = useState('router_01');
  const [maxFlows, setMaxFlows] = useState(100);
  const [results, setResults] = useState<any>(null);
  const [isLive, setIsLive] = useState(true);
  const intervalRef = useRef<any>(null);

  const fetchStatus = async () => {
    try {
      const r = await apiGet('/ingest/status');
      setStatus(r.data);
      setLoading(false);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    if (isLive) {
      intervalRef.current = setInterval(fetchStatus, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      if (!deviceId || deviceId === 'router_01') {
        setDeviceId(file.name.replace('.csv', ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file first');
      return;
    }
    setUploading(true);
    setResults(null);
    try {
      toast.loading('Processing flows from device...', { id: 'upload' });
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('device_id', deviceId);
      formData.append('max_flows', String(maxFlows));

      const token = JSON.parse(localStorage.getItem('congestion_auth') || '{}').accessToken;
      const resp = await fetch('/api/v1/ingest/csv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const r = await resp.json();

      if (r.success) {
        setResults(r.data);
        toast.success(
          `Processed ${r.data.total_processed} flows · ${r.data.total_congested} congested`,
          { id: 'upload' }
        );
        fetchStatus();
      } else {
        throw new Error(r.error?.message || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process CSV', { id: 'upload' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const r = await apiGet('/ingest/template');
      const blob = new Blob([r.data.content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleClearState = async () => {
    if (!confirm('Clear all ingestion state? This cannot be undone.')) return;
    try {
      await apiPost('/ingest/clear');
      toast.success('State cleared');
      fetchStatus();
      setResults(null);
    } catch {
      toast.error('Failed to clear state');
    }
  };

  const recentFlows = status?.recent_flows || [];
  const devices = status?.active_devices || [];

  // Status distribution
  const statusDist = [
    { name: 'Allowed', value: recentFlows.filter((f: any) => f.status === 'allowed').length, color: '#10B981' },
    { name: 'Throttled', value: recentFlows.filter((f: any) => f.status === 'throttled').length, color: '#F59E0B' },
    { name: 'Blocked', value: recentFlows.filter((f: any) => f.status === 'blocked').length, color: '#EF4444' },
  ].filter(d => d.value > 0);

  return (
    <Layout title="ربط الأجهزة - Device Connection">
      <p className="text-cyber-muted text-sm mb-6">
        استقبل التدفقات الشبكية من أجهزتك الحقيقية بصيغة CSV واعرض النتائج مباشرة في الواجهات
      </p>

      {/* Live status banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 mb-6 border-l-4 border-l-cyber-success"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-cyber-success/15 flex items-center justify-center">
                <Radio size={24} className="text-cyber-success" />
              </div>
              {isLive && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyber-success rounded-full border-2 border-cyber-card animate-ping" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-cyber-text flex items-center gap-2">
                Live Device Ingestion
                {isLive ? (
                  <span className="badge badge-success text-[10px]">● LIVE</span>
                ) : (
                  <span className="badge badge-warning text-[10px]">⏸ PAUSED</span>
                )}
              </h2>
              <p className="text-xs text-cyber-muted">
                {status?.device_count || 0} device(s) connected ·
                Uptime: {status ? Math.floor(status.uptime_seconds / 60) : 0}m ·
                Last: {status?.last_ingest_time ? new Date(status.last_ingest_time).toLocaleTimeString() : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLive(!isLive)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium', isLive ? 'btn-secondary' : 'btn-primary')}
            >
              {isLive ? '⏸ إيقاف' : '▶ تشغيل'}
            </button>
            <button onClick={fetchStatus} className="btn-secondary text-xs flex items-center gap-1">
              <RefreshCw size={12} /> تحديث
            </button>
            <button onClick={handleClearState} className="btn-secondary text-xs flex items-center gap-1 text-cyber-danger">
              <Trash2 size={12} /> مسح
            </button>
          </div>
        </div>
      </motion.div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard title="Total Ingested" value={status?.total_ingested ?? 0} icon={<Upload size={18} />} color="primary" />
        <StatCard title="Processed" value={status?.total_processed ?? 0} icon={<CheckCircle size={18} />} color="success" />
        <StatCard title="Congested" value={status?.total_congested ?? 0} icon={<AlertTriangle size={18} />} color="danger" />
        <StatCard title="Blocked" value={status?.total_blocked ?? 0} icon={<Ban size={18} />} color="warning" />
        <StatCard title="Congestion Rate" value={`${status?.congestion_rate ?? 0}%`} icon={<TrendingUp size={18} />} color="accent" />
        <StatCard title="Active Devices" value={status?.device_count ?? 0} icon={<Server size={18} />} color="info" />
      </div>

      {/* Upload section */}
      <Card title="رفع ملف CSV من جهاز" icon={<Upload size={18} />} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-cyber-muted mb-1.5">Device ID</label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="input-cyber"
              placeholder="router_01"
            />
          </div>
          <div>
            <label className="block text-sm text-cyber-muted mb-1.5">Max Flows</label>
            <input
              type="number"
              min="10"
              max="5000"
              value={maxFlows}
              onChange={(e) => setMaxFlows(parseInt(e.target.value) || 100)}
              className="input-cyber"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleDownloadTemplate}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Download size={16} /> تحميل قالب CSV
            </button>
          </div>
        </div>

        <div className="relative mb-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-ingest-upload"
          />
          <label
            htmlFor="csv-ingest-upload"
            className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-cyber-border rounded-xl cursor-pointer hover:border-cyber-primary transition text-cyber-muted hover:text-cyber-primary"
          >
            <FileSpreadsheet size={32} />
            {csvFile ? (
              <div className="text-center">
                <div className="text-cyber-text font-medium">{csvFile.name}</div>
                <div className="text-xs text-cyber-muted">{(csvFile.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-sm">اضغط لاختيار ملف CSV</div>
                <div className="text-xs text-cyber-muted mt-1">
                  الأعمدة: IPV4_SRC_ADDR, IPV4_DST_ADDR, PROTOCOL, ...
                </div>
              </div>
            )}
          </label>
        </div>

        <button
          onClick={handleUpload}
          disabled={!csvFile || uploading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              جاري معالجة التدفقات...
            </>
          ) : (
            <>
              <Zap size={16} /> استقبال وتحليل التدفقات
            </>
          )}
        </button>
      </Card>

      {/* Upload results */}
      {results && (
        <Card title="نتائج المعالجة" icon={<CheckCircle size={18} />} className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <ResultStat label="Flows Received" value={results.total_flows_received} />
            <ResultStat label="Processed" value={results.total_processed} color="text-cyber-success" />
            <ResultStat label="Congested" value={results.total_congested} color="text-cyber-danger" />
            <ResultStat label="Errors" value={results.total_errors} color="text-cyber-warning" />
            <ResultStat label="Time" value={`${results.processing_time_seconds}s`} />
          </div>

          {results.recent_results && results.recent_results.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-cyber-text mb-2">أحدث التدفقات المعالجة:</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                      <th className="text-left py-2 px-2">Source IP</th>
                      <th className="text-left py-2 px-2">Dst IP</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">RCA Score</th>
                      <th className="text-left py-2 px-2">Severity</th>
                      <th className="text-left py-2 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.recent_results.slice(0, 10).map((r: any, i: number) => (
                      <tr key={i} className="border-b border-cyber-border/40">
                        <td className="py-2 px-2 font-mono text-cyber-text text-xs">{r.src_ip}</td>
                        <td className="py-2 px-2 font-mono text-cyber-text text-xs">{r.dst_ip}</td>
                        <td className="py-2 px-2">
                          <Badge variant={r.status === 'blocked' ? 'danger' : r.status === 'throttled' ? 'warning' : 'success'} size="sm">
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs" style={{ color: r.rca_score >= 75 ? '#EF4444' : r.rca_score >= 50 ? '#F59E0B' : '#10B981' }}>
                          {r.rca_score.toFixed(1)}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={r.severity === 'critical' ? 'danger' : r.severity === 'high' ? 'warning' : 'info'} size="sm">
                            {r.severity}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-cyber-muted text-xs">{r.mitigation?.substring(0, 30)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Connected devices */}
      {devices.length > 0 && (
        <Card title="الأجهزة المتصلة" icon={<Server size={18} />} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {devices.map((device: any, i: number) => (
              <motion.div
                key={device.device_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl border border-cyber-border bg-cyber-bg/30 hover:border-cyber-primary/40 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-cyber-primary/15 text-cyber-primary flex items-center justify-center">
                      <Server size={16} />
                    </div>
                    <div>
                      <div className="font-mono text-sm text-cyber-text">{device.device_id}</div>
                      <div className="text-[10px] text-cyber-muted">
                        Connected: {new Date(device.first_seen).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-cyber-success animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-cyber-bg/40 rounded-lg p-2">
                    <div className="text-cyber-muted">Flows Sent</div>
                    <div className="text-cyber-text font-bold">{device.flows_sent}</div>
                  </div>
                  <div className="bg-cyber-bg/40 rounded-lg p-2">
                    <div className="text-cyber-muted">Congested</div>
                    <div className="text-cyber-danger font-bold">{device.flows_congested}</div>
                  </div>
                </div>
                <div className="text-[10px] text-cyber-muted mt-2">
                  Last: {new Date(device.last_seen).toLocaleTimeString()}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* Live ingested flows */}
      <Card title="التدفقات المستقبلة (Live)" icon={<Activity size={18} />}
        action={isLive && <Badge variant="success">● LIVE</Badge>}
      >
        {recentFlows.length === 0 ? (
          <div className="text-center py-12">
            <Upload size={40} className="text-cyber-muted mx-auto mb-3 opacity-40" />
            <p className="text-cyber-muted text-sm">لا توجد تدفقات مستقبلة بعد</p>
            <p className="text-cyber-muted text-xs mt-1">ارفع ملف CSV من جهازك لبدء الاستقبال</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {recentFlows.slice(0, 20).map((flow: any, i: number) => (
                <motion.div
                  key={`${flow.device_id}-${i}-${flow.timestamp}`}
                  initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(14,165,233,0.1)' }}
                  animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border transition',
                    flow.status === 'blocked' ? 'border-cyber-danger/30 bg-cyber-danger/5' :
                    flow.status === 'throttled' ? 'border-cyber-warning/30 bg-cyber-warning/5' :
                    'border-cyber-border bg-cyber-bg/30'
                  )}
                >
                  <div className={clsx(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    flow.status === 'blocked' ? 'bg-cyber-danger/15 text-cyber-danger' :
                    flow.status === 'throttled' ? 'bg-cyber-warning/15 text-cyber-warning' :
                    'bg-cyber-success/15 text-cyber-success'
                  )}>
                    {flow.status === 'blocked' ? <Ban size={16} /> : flow.status === 'throttled' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-cyber-text">{flow.src_ip}</span>
                      <ArrowRight size={10} className="text-cyber-muted" />
                      <span className="font-mono text-xs text-cyber-text">{flow.dst_ip}</span>
                      <Badge variant="info" size="sm">{flow.protocol}:{flow.port}</Badge>
                      {flow.is_congested && <Badge variant="danger" size="sm">CONGESTED</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-cyber-muted mt-0.5">
                      <span>Device: {flow.device_id}</span>
                      <span>·</span>
                      <span>RCA: {flow.rca_score?.toFixed(1)}</span>
                      <span>·</span>
                      <span>Confidence: {(flow.confidence * 100).toFixed(1)}%</span>
                      <span>·</span>
                      <span>{new Date(flow.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <Badge
                    variant={flow.status === 'blocked' ? 'danger' : flow.status === 'throttled' ? 'warning' : 'success'}
                    size="sm"
                  >
                    {flow.status}
                  </Badge>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* API documentation */}
      <Card title="API للأجهزة - Device Integration Guide" icon={<FileSpreadsheet size={18} />} className="mt-6">
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold text-cyber-text mb-1">1. رفع ملف CSV (HTTP POST):</h4>
            <pre className="bg-cyber-bg/60 p-3 rounded-lg text-xs text-cyber-muted overflow-x-auto">
{`curl -X POST https://network-congestion-platform-1.onrender.com/api/v1/ingest/csv \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -F "file=@network_flows.csv" \\
  -F "device_id=router_01" \\
  -F "max_flows=500"`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold text-cyber-text mb-1">2. إرسال CSV كنص خام (للأجهزة الذكية):</h4>
            <pre className="bg-cyber-bg/60 p-3 rounded-lg text-xs text-cyber-muted overflow-x-auto">
{`curl -X POST "https://network-congestion-platform-1.onrender.com/api/v1/ingest/raw?device_id=sensor_01" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: text/csv" \\
  --data-binary @flows.csv`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold text-cyber-text mb-1">3. إرسال تدفق واحد JSON (real-time):</h4>
            <pre className="bg-cyber-bg/60 p-3 rounded-lg text-xs text-cyber-muted overflow-x-auto">
{`curl -X POST https://network-congestion-platform-1.onrender.com/api/v1/ingest/flow \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "device_id": "router_01",
    "flow": {
      "IPV4_SRC_ADDR": "192.168.1.100",
      "IPV4_DST_ADDR": "10.0.0.5",
      "PROTOCOL": 6,
      "L4_DST_PORT": 443,
      "IN_BYTES": 15240,
      "OUT_BYTES": 8520
    }
  }'`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold text-cyber-text mb-1">4. الأعمدة المتوقعة في CSV:</h4>
            <div className="bg-cyber-bg/60 p-3 rounded-lg text-xs text-cyber-muted">
              <code>IPV4_SRC_ADDR, IPV4_DST_ADDR, PROTOCOL, L4_SRC_PORT, L4_DST_PORT, IN_BYTES, OUT_BYTES, IN_PKTS, OUT_PKTS, FLOW_DURATION_MILLISECONDS, SRC_TO_DST_IAT_AVG, DST_TO_SRC_IAT_AVG, SRC_TO_DST_IAT_STDDEV, DST_TO_SRC_IAT_STDDEV, SRC_TO_DST_AVG_THROUGHPUT, DST_TO_SRC_AVG_THROUGHPUT, TCP_WIN_MAX_IN, TCP_WIN_MAX_OUT, RETRANSMITTED_IN_PKTS, RETRANSMITTED_OUT_PKTS</code>
              <p className="mt-2 text-[10px]">الأسماء البديلة مدعومة: src_ip, dst_ip, proto, dst_port, in_bytes, out_bytes, etc.</p>
            </div>
          </div>
        </div>
      </Card>
    </Layout>
  );
}

function ResultStat({ label, value, color = 'text-cyber-text' }: { label: string; value: any; color?: string }) {
  return (
    <div className="bg-cyber-bg/40 rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase text-cyber-muted">{label}</div>
      <div className={`text-xl font-bold ${color} mt-1`}>{value}</div>
    </div>
  );
}
