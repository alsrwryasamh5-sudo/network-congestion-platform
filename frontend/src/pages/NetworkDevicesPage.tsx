import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Server, Router, Shield, Edit2, Trash2, Search, Wifi,
  Activity, Cpu, MemoryStick, Thermometer, Clock, MapPin,
  Network, Settings, AlertCircle, CheckCircle, XCircle, Power,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge, Skeleton } from '../components/Card';
import { deviceService } from '../services/deviceService';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const DEVICE_TYPES = ['Router', 'Switch', 'Firewall'];
const VENDORS = ['Cisco', 'MikroTik', 'Juniper', 'Other'];

export function NetworkDevicesPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '', device_type: 'Router', vendor: 'Cisco', ip_address: '',
    location: '', netflow_enabled: true, ipfix_enabled: false,
    snmp_enabled: true, collector_ip: '10.0.0.100', export_port: 2055,
    snmp_community: 'public', notes: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([deviceService.list(), deviceService.overview()])
      .then(([dRes, oRes]) => {
        setDevices(dRes.data || []);
        setOverview(oRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Auto-refresh every 15 seconds for live metrics
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = devices.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.ip_address?.includes(search) ||
    d.location?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!formData.name || !formData.ip_address) {
      toast.error('Name and IP Address are required');
      return;
    }
    try {
      if (editingDevice) {
        await deviceService.update(editingDevice.id, formData);
        toast.success('Device updated');
      } else {
        await deviceService.create(formData);
        toast.success('Device created');
      }
      setShowModal(false);
      setEditingDevice(null);
      setFormData({
        name: '', device_type: 'Router', vendor: 'Cisco', ip_address: '',
        location: '', netflow_enabled: true, ipfix_enabled: false,
        snmp_enabled: true, collector_ip: '10.0.0.100', export_port: 2055,
        snmp_community: 'public', notes: '',
      });
      load();
    } catch {}
  };

  const handleEdit = (device: any) => {
    setEditingDevice(device);
    setFormData({
      name: device.name, device_type: device.device_type, vendor: device.vendor,
      ip_address: device.ip_address, location: device.location || '',
      netflow_enabled: device.netflow_enabled, ipfix_enabled: device.ipfix_enabled,
      snmp_enabled: device.snmp_enabled, collector_ip: device.collector_ip || '10.0.0.100',
      export_port: device.export_port || 2055, snmp_community: device.snmp_community || 'public',
      notes: device.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    try {
      await deviceService.delete(id);
      toast.success('Device deleted');
      load();
    } catch {}
  };

  const getDeviceIcon = (type: string) => {
    if (type === 'Router') return <Router size={18} />;
    if (type === 'Switch') return <Network size={18} />;
    if (type === 'Firewall') return <Shield size={18} />;
    return <Server size={18} />;
  };

  return (
    <Layout title="Network Devices Management">
      {/* Data Flow Diagram */}
      <Card className="mb-6 border-cyber-primary/30">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyber-primary/15 text-cyber-primary border border-cyber-primary/30">
            <Router size={14} /> Router / Switch
          </div>
          <span className="text-cyber-muted">↓</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyber-accent/15 text-cyber-accent border border-cyber-accent/30">
            <Wifi size={14} /> NetFlow/IPFIX Export
          </div>
          <span className="text-cyber-muted">↓</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyber-info/15 text-cyber-info border border-cyber-info/30">
            <Server size={14} /> Collector
          </div>
          <span className="text-cyber-muted">↓</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyber-warning/15 text-cyber-warning border border-cyber-warning/30">
            <Activity size={14} /> AI Model
          </div>
          <span className="text-cyber-muted">↓</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyber-success/15 text-cyber-success border border-cyber-success/30">
            <Settings size={14} /> Dashboard
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card className="text-center">
          <Server size={20} className="text-cyber-primary mx-auto mb-1" />
          <div className="text-2xl font-bold text-cyber-text">{overview?.total_devices ?? 0}</div>
          <div className="text-xs text-cyber-muted">Total Devices</div>
        </Card>
        <Card className="text-center">
          <CheckCircle size={20} className="text-cyber-success mx-auto mb-1" />
          <div className="text-2xl font-bold text-cyber-text">{overview?.online_devices ?? 0}</div>
          <div className="text-xs text-cyber-muted">Online</div>
        </Card>
        <Card className="text-center">
          <AlertCircle size={20} className="text-cyber-warning mx-auto mb-1" />
          <div className="text-2xl font-bold text-cyber-text">{overview?.warning_devices ?? 0}</div>
          <div className="text-xs text-cyber-muted">Warning</div>
        </Card>
        <Card className="text-center">
          <XCircle size={20} className="text-cyber-danger mx-auto mb-1" />
          <div className="text-2xl font-bold text-cyber-text">{overview?.offline_devices ?? 0}</div>
          <div className="text-xs text-cyber-muted">Offline</div>
        </Card>
        <Card className="text-center">
          <Wifi size={20} className="text-cyber-accent mx-auto mb-1" />
          <div className="text-2xl font-bold text-cyber-text">{overview?.total_interfaces ?? 0}</div>
          <div className="text-xs text-cyber-muted">Interfaces</div>
        </Card>
      </div>

      {/* Header with search and add */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted rtl:left-auto rtl:right-3" />
          <input
            type="text"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-cyber pl-10 rtl:pl-4 rtl:pr-10 w-64"
          />
        </div>
        <button
          onClick={() => { setEditingDevice(null); setFormData({ name: '', device_type: 'Router', vendor: 'Cisco', ip_address: '', location: '', netflow_enabled: true, ipfix_enabled: false, snmp_enabled: true, collector_ip: '10.0.0.100', export_port: 2055, snmp_community: 'public', notes: '' }); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add New Device
        </button>
      </div>

      {/* Devices grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <Server size={48} className="text-cyber-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-lg font-medium text-cyber-text mb-1">No devices yet</h3>
          <p className="text-cyber-muted text-sm mb-4">Add your first network device to start monitoring</p>
          <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> Add New Device
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((device, i) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="hover:border-cyber-primary/40 transition h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      device.status === 'online' ? 'bg-cyber-success/15 text-cyber-success' :
                      device.status === 'warning' ? 'bg-cyber-warning/15 text-cyber-warning' :
                      'bg-cyber-danger/15 text-cyber-danger'
                    )}>
                      {getDeviceIcon(device.device_type)}
                    </div>
                    <div>
                      <div className="font-semibold text-cyber-text text-sm">{device.name}</div>
                      <div className="text-[10px] text-cyber-muted">{device.vendor} · {device.device_type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={clsx(
                      'w-2 h-2 rounded-full',
                      device.status === 'online' ? 'bg-cyber-success animate-pulse' :
                      device.status === 'warning' ? 'bg-cyber-warning' :
                      'bg-cyber-danger'
                    )} />
                  </div>
                </div>

                {/* IP & Location */}
                <div className="space-y-1.5 mb-3 text-xs">
                  <div className="flex items-center gap-2 text-cyber-muted">
                    <Server size={12} />
                    <span className="font-mono text-cyber-text">{device.ip_address}</span>
                  </div>
                  {device.location && (
                    <div className="flex items-center gap-2 text-cyber-muted">
                      <MapPin size={12} />
                      <span>{device.location}</span>
                    </div>
                  )}
                </div>

                {/* Live Metrics */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Metric icon={<Cpu size={12} />} label="CPU" value={`${device.cpu_usage?.toFixed(1) || 0}%`} color={device.cpu_usage >= 80 ? 'text-cyber-danger' : device.cpu_usage >= 60 ? 'text-cyber-warning' : 'text-cyber-success'} />
                  <Metric icon={<MemoryStick size={12} />} label="Mem" value={`${device.memory_usage?.toFixed(1) || 0}%`} color={device.memory_usage >= 80 ? 'text-cyber-danger' : device.memory_usage >= 60 ? 'text-cyber-warning' : 'text-cyber-primary'} />
                  <Metric icon={<Thermometer size={12} />} label="Temp" value={`${device.temperature?.toFixed(0) || 0}°`} color={device.temperature >= 45 ? 'text-cyber-danger' : 'text-cyber-info'} />
                </div>

                {/* Interfaces summary */}
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="text-cyber-muted">Interfaces:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" size="sm">{(device.interfaces || []).filter((i: any) => i.status === 'up').length} up</Badge>
                    <Badge variant="warning" size="sm">{(device.interfaces || []).filter((i: any) => i.status === 'warning').length} warn</Badge>
                    <Badge variant="danger" size="sm">{(device.interfaces || []).filter((i: any) => i.status === 'congested').length} cong</Badge>
                  </div>
                </div>

                {/* Collector status */}
                <div className="flex items-center gap-2 mb-3 text-[10px]">
                  <Badge variant={device.netflow_enabled ? 'success' : 'danger'} size="sm">NetFlow: {device.netflow_enabled ? 'ON' : 'OFF'}</Badge>
                  <Badge variant={device.snmp_enabled ? 'success' : 'danger'} size="sm">SNMP: {device.snmp_enabled ? 'ON' : 'OFF'}</Badge>
                  <Badge variant={device.ipfix_enabled ? 'success' : 'danger'} size="sm">IPFIX: {device.ipfix_enabled ? 'ON' : 'OFF'}</Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-cyber-border">
                  <a href={`/devices/${device.id}/interfaces`} className="btn-secondary text-xs flex-1 text-center">
                    Interfaces
                  </a>
                  <button onClick={() => handleEdit(device)} className="btn-ghost text-cyber-primary" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(device.id)} className="btn-ghost text-cyber-danger" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="max-w-2xl w-full glass-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-cyber-text mb-4">
              {editingDevice ? 'Edit Device' : 'Add New Device'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Device Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-cyber" placeholder="Main Router" />
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Device Type *</label>
                <select value={formData.device_type} onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                  className="input-cyber">
                  {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Vendor</label>
                <select value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="input-cyber">
                  {VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">IP Address *</label>
                <input type="text" value={formData.ip_address} onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  className="input-cyber" placeholder="192.168.1.1" />
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Location</label>
                <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input-cyber" placeholder="Head Office" />
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Collector IP</label>
                <input type="text" value={formData.collector_ip} onChange={(e) => setFormData({ ...formData, collector_ip: e.target.value })}
                  className="input-cyber" placeholder="10.0.0.100" />
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Export Port</label>
                <input type="number" value={formData.export_port} onChange={(e) => setFormData({ ...formData, export_port: parseInt(e.target.value) || 2055 })}
                  className="input-cyber" placeholder="2055" />
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">SNMP Community</label>
                <input type="text" value={formData.snmp_community} onChange={(e) => setFormData({ ...formData, snmp_community: e.target.value })}
                  className="input-cyber" placeholder="public" />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Toggle label="NetFlow" value={formData.netflow_enabled} onChange={(v) => setFormData({ ...formData, netflow_enabled: v })} />
              <Toggle label="IPFIX" value={formData.ipfix_enabled} onChange={(v) => setFormData({ ...formData, ipfix_enabled: v })} />
              <Toggle label="SNMP" value={formData.snmp_enabled} onChange={(v) => setFormData({ ...formData, snmp_enabled: v })} />
            </div>

            <div className="mt-3">
              <label className="block text-sm text-cyber-muted mb-1">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-cyber" rows={2} placeholder="Optional notes about this device..." />
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} className="btn-primary flex-1">Save Device</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function Metric({ icon, label, value, color }: any) {
  return (
    <div className="bg-cyber-bg/40 rounded-lg p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-cyber-muted mb-0.5">{icon}</div>
      <div className={clsx('text-xs font-bold', color)}>{value}</div>
      <div className="text-[9px] text-cyber-muted">{label}</div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={clsx(
        'flex items-center justify-between px-3 py-2 rounded-xl border transition',
        value ? 'border-cyber-success/30 bg-cyber-success/10' : 'border-cyber-border bg-cyber-bg/30'
      )}
    >
      <span className="text-xs text-cyber-text">{label}</span>
      <span className={clsx('w-8 h-4 rounded-full relative transition', value ? 'bg-cyber-success' : 'bg-cyber-border')}>
        <span className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white transition', value ? 'left-4' : 'left-0.5')} />
      </span>
    </button>
  );
}
