import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Users as UsersIcon, User, Shield, Mail, Calendar, Edit2, Trash2,
  Plus, Search, Crown, Activity, CheckCircle, XCircle, Lock,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card, Badge, Skeleton } from '../components/Card';
import { apiGet, apiPatch, apiDelete, apiPost } from '../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    username: '', email: '', password: '', full_name: '', role: 'viewer',
  });

  const load = () => {
    setLoading(true);
    apiGet('/admin/users').then((r) => {
      setUsers(r.data?.items || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    try {
      if (editingUser) {
        await apiPatch(`/admin/users/${editingUser.id}`, {
          full_name: editingUser.full_name,
          email: editingUser.email,
          role: editingUser.role,
          is_active: editingUser.is_active,
        });
        toast.success('User updated');
        setEditingUser(null);
      } else {
        await apiPost('/auth/register', newUser);
        toast.success('User created');
        setShowAddModal(false);
        setNewUser({ username: '', email: '', password: '', full_name: '', role: 'viewer' });
      }
      load();
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await apiDelete(`/admin/users/${id}`);
      toast.success('User deleted');
      load();
    } catch {}
  };

  const toggleActive = async (user: any) => {
    try {
      await apiPatch(`/admin/users/${user.id}`, { is_active: !user.is_active });
      toast.success(`User ${!user.is_active ? 'activated' : 'deactivated'}`);
      load();
    } catch {}
  };

  return (
    <Layout title="User Management">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted rtl:left-auto rtl:right-3" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-cyber pl-10 rtl:pl-4 rtl:pr-10 w-64"
            />
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="text-center">
          <UsersIcon size={20} className="text-cyber-primary mx-auto mb-1" />
          <div className="text-2xl font-bold text-cyber-text">{users.length}</div>
          <div className="text-xs text-cyber-muted">Total Users</div>
        </Card>
        <Card className="text-center">
          <Crown size={20} className="text-cyber-danger mx-auto mb-1" />
          <div className="text-2xl font-bold text-cyber-text">{users.filter(u => u.role === 'admin').length}</div>
          <div className="text-xs text-cyber-muted">Admins</div>
        </Card>
        <Card className="text-center">
          <Shield size={20} className="text-cyber-warning mx-auto mb-1" />
          <div className="text-2xl font-bold text-cyber-text">{users.filter(u => u.role === 'researcher').length}</div>
          <div className="text-xs text-cyber-muted">Researchers</div>
        </Card>
        <Card className="text-center">
          <CheckCircle size={20} className="text-cyber-success mx-auto mb-1" />
          <div className="text-2xl font-bold text-cyber-text">{users.filter(u => u.is_active).length}</div>
          <div className="text-xs text-cyber-muted">Active</div>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon size={40} className="text-cyber-muted mx-auto mb-3 opacity-40" />
            <p className="text-cyber-muted">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cyber-muted text-xs border-b border-cyber-border">
                  <th className="text-left py-3 px-2">User</th>
                  <th className="text-left py-3 px-2">Email</th>
                  <th className="text-left py-3 px-2">Role</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Last Login</th>
                  <th className="text-left py-3 px-2">Created</th>
                  <th className="text-left py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user, i) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-cyber-border/40 hover:bg-cyber-bg/30"
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-cyber-gradient flex items-center justify-center text-white font-bold text-sm">
                          {user.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="text-cyber-text font-medium">{user.username}</div>
                          <div className="text-[10px] text-cyber-muted">{user.full_name || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-cyber-muted text-xs">{user.email}</td>
                    <td className="py-3 px-2">
                      <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'researcher' ? 'warning' : 'info'} size="sm">
                        {user.role === 'admin' && <Crown size={10} className="mr-1" />}
                        {user.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-2">
                      <button onClick={() => toggleActive(user)} className="cursor-pointer">
                        <Badge variant={user.is_active ? 'success' : 'danger'} size="sm">
                          {user.is_active ? <><CheckCircle size={10} className="mr-1" /> Active</> : <><XCircle size={10} className="mr-1" /> Inactive</>}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-3 px-2 text-cyber-muted text-xs">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-2 text-cyber-muted text-xs">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingUser({ ...user })}
                          className="p-1.5 rounded-lg hover:bg-cyber-card text-cyber-muted hover:text-cyber-primary"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-1.5 rounded-lg hover:bg-cyber-card text-cyber-muted hover:text-cyber-danger"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit User Modal */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowAddModal(false); setEditingUser(null); }}>
          <div className="max-w-md w-full glass-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-cyber-text mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Username</label>
                <input
                  type="text"
                  value={editingUser ? editingUser.username : newUser.username}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, username: e.target.value }) : setNewUser({ ...newUser, username: e.target.value })}
                  className="input-cyber"
                  disabled={!!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Email</label>
                <input
                  type="email"
                  value={editingUser ? editingUser.email : newUser.email}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, email: e.target.value }) : setNewUser({ ...newUser, email: e.target.value })}
                  className="input-cyber"
                />
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingUser ? editingUser.full_name || '' : newUser.full_name}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, full_name: e.target.value }) : setNewUser({ ...newUser, full_name: e.target.value })}
                  className="input-cyber"
                />
              </div>
              <div>
                <label className="block text-sm text-cyber-muted mb-1">Role</label>
                <select
                  value={editingUser ? editingUser.role : newUser.role}
                  onChange={(e) => editingUser ? setEditingUser({ ...editingUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}
                  className="input-cyber"
                >
                  <option value="admin">Admin</option>
                  <option value="researcher">Researcher</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm text-cyber-muted mb-1">Password</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="input-cyber"
                    placeholder="At least 8 characters"
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} className="btn-primary flex-1">Save</button>
                <button onClick={() => { setShowAddModal(false); setEditingUser(null); }} className="btn-secondary flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
