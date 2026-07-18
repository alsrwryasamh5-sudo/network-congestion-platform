import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, Globe, Bell, Shield, Palette,
  Sun, Moon, Monitor, Lock, Mail, Save, Check, User,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge } from '../components/Card';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { setLanguage } from '../store/slices/uiSlice';
import { updateUser } from '../store/slices/authSlice';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const language = useSelector((s: RootState) => s.ui.language);

  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    congestion: true,
    reports: false,
    system: true,
  });
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleLanguageChange = (lang: 'en' | 'ar') => {
    dispatch(setLanguage(lang));
    i18n.changeLanguage(lang);
    toast.success(lang === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English');
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Save notification preferences to user preferences
      await new Promise(r => setTimeout(r, 800)); // simulate API
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      // handled by interceptor
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Layout title={t('nav.settings')}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Appearance */}
        <Card title="Appearance" icon={<Palette size={18} />} delay={0}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-cyber-muted mb-2">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
                  { value: 'light', label: 'Light', icon: <Sun size={16} /> },
                  { value: 'system', label: 'System', icon: <Monitor size={16} /> },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value as any)}
                    className={clsx(
                      'flex items-center justify-center gap-2 py-3 rounded-xl border transition',
                      theme === opt.value
                        ? 'border-cyber-primary bg-cyber-primary/10 text-cyber-primary'
                        : 'border-cyber-border text-cyber-muted hover:border-cyber-primary/50'
                    )}
                  >
                    {opt.icon}
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-cyber-muted mt-2">
                Note: Light theme will be available in the next release. Currently only Dark is supported.
              </p>
            </div>
          </div>
        </Card>

        {/* Language */}
        <Card title="Language & Region" icon={<Globe size={18} />} delay={0.05}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-cyber-muted mb-2">Interface Language</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={clsx(
                    'flex items-center justify-center gap-2 py-3 rounded-xl border transition',
                    language === 'en'
                      ? 'border-cyber-primary bg-cyber-primary/10 text-cyber-primary'
                      : 'border-cyber-border text-cyber-muted hover:border-cyber-primary/50'
                  )}
                >
                  <span className="text-lg">🇬🇧</span>
                  <span className="text-sm font-medium">English</span>
                  <span className="text-xs text-cyber-muted">LTR</span>
                </button>
                <button
                  onClick={() => handleLanguageChange('ar')}
                  className={clsx(
                    'flex items-center justify-center gap-2 py-3 rounded-xl border transition',
                    language === 'ar'
                      ? 'border-cyber-primary bg-cyber-primary/10 text-cyber-primary'
                      : 'border-cyber-border text-cyber-muted hover:border-cyber-primary/50'
                  )}
                >
                  <span className="text-lg">🇸🇦</span>
                  <span className="text-sm font-medium">العربية</span>
                  <span className="text-xs text-cyber-muted">RTL</span>
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card title="Notification Preferences" icon={<Bell size={18} />} delay={0.1}>
          <div className="space-y-3">
            {[
              { key: 'email', label: 'Email Notifications', desc: 'Receive notifications via email' },
              { key: 'push', label: 'Push Notifications', desc: 'Browser push notifications' },
              { key: 'congestion', label: 'Congestion Alerts', desc: 'Alert when congestion is detected' },
              { key: 'reports', label: 'Report Generation', desc: 'Notify when reports are ready' },
              { key: 'system', label: 'System Updates', desc: 'Platform maintenance and updates' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-cyber-bg/40 border border-cyber-border">
                <div>
                  <div className="text-sm font-medium text-cyber-text">{item.label}</div>
                  <div className="text-xs text-cyber-muted">{item.desc}</div>
                </div>
                <button
                  onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] })}
                  className={clsx(
                    'relative w-12 h-6 rounded-full transition',
                    notifications[item.key as keyof typeof notifications] ? 'bg-cyber-primary' : 'bg-cyber-border'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                      notifications[item.key as keyof typeof notifications] ? 'left-6' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Security - Change Password */}
        <Card title="Security" icon={<Shield size={18} />} delay={0.15}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-cyber-muted mb-1.5">Current Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted rtl:left-auto rtl:right-3" />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="input-cyber pl-10 rtl:pl-4 rtl:pr-10"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-cyber-muted mb-1.5">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted rtl:left-auto rtl:right-3" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input-cyber pl-10 rtl:pl-4 rtl:pr-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted rtl:left-auto rtl:right-3" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="input-cyber pl-10 rtl:pl-4 rtl:pr-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-cyber-muted">
              <Badge variant="info" size="sm">Tip</Badge>
              Use at least 8 characters with a mix of letters, numbers, and symbols.
            </div>
            <button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="btn-primary flex items-center gap-2"
            >
              {changingPassword ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Updating...</>
              ) : (
                <><Lock size={16} /> Change Password</>
              )}
            </button>
          </div>
        </Card>

        {/* Account Info */}
        <Card title="Account Information" icon={<User size={18} />} delay={0.2}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-cyber-muted mb-1">Username</label>
              <div className="px-3 py-2.5 rounded-xl bg-cyber-bg/40 border border-cyber-border text-cyber-text font-mono">
                {user?.username || '—'}
              </div>
            </div>
            <div>
              <label className="block text-xs text-cyber-muted mb-1">Email</label>
              <div className="px-3 py-2.5 rounded-xl bg-cyber-bg/40 border border-cyber-border text-cyber-text">
                {user?.email || '—'}
              </div>
            </div>
            <div>
              <label className="block text-xs text-cyber-muted mb-1">Full Name</label>
              <div className="px-3 py-2.5 rounded-xl bg-cyber-bg/40 border border-cyber-border text-cyber-text">
                {user?.full_name || '—'}
              </div>
            </div>
            <div>
              <label className="block text-xs text-cyber-muted mb-1">Role</label>
              <div className="px-3 py-2.5 rounded-xl bg-cyber-bg/40 border border-cyber-border">
                <Badge variant={user?.role === 'admin' ? 'danger' : user?.role === 'researcher' ? 'warning' : 'info'}>
                  {user?.role || '—'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Save button */}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary">Cancel</button>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Saving...</>
            ) : (
              <><Save size={16} /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
}
