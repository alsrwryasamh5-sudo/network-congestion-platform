import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PredictionPage } from './pages/PredictionPage';
import { ShapPage } from './pages/ShapPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { RootCausePage } from './pages/RootCausePage';
import { TrainingPage } from './pages/TrainingPage';
import { ReportsPage } from './pages/ReportsPage';
import { SimplePage, NotFoundPage, MaintenancePage } from './pages/SimplePage';
import { TopCulpritHostsPage } from './pages/TopCulpritHostsPage';
import {
  Bell, Database, Settings, User, Heart, Search, FileText,
  AlertTriangle, Users, Info, HelpCircle, MessageSquare, Server,
} from 'lucide-react';

function ProtectedRoute({ children }: { children: any }) {
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function PublicRoute({ children }: { children: any }) {
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/maintenance" element={<MaintenancePage />} />

      {/* Protected */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/congestion" element={<ProtectedRoute><PredictionPage /></ProtectedRoute>} />
      <Route path="/root-cause" element={<ProtectedRoute><RootCausePage /></ProtectedRoute>} />
      <Route path="/top-culprits" element={<ProtectedRoute><TopCulpritHostsPage /></ProtectedRoute>} />
      <Route path="/shap" element={<ProtectedRoute><ShapPage /></ProtectedRoute>} />
      <Route path="/performance" element={<ProtectedRoute><ShapPage /></ProtectedRoute>} />
      <Route path="/prediction" element={<ProtectedRoute><PredictionPage /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
      <Route path="/datasets" element={<ProtectedRoute><SimplePage title="Dataset Manager" subtitle="Upload, manage, and explore datasets for training and evaluation." icon={Database} comingSoon /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><SimplePage title="Alerts Center" subtitle="View and manage all congestion alerts in one place." icon={AlertTriangle} comingSoon /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><SimplePage title="Notifications" subtitle="Stay updated with system notifications and alerts." icon={Bell} comingSoon /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><SimplePage title="User Management" subtitle="Manage user accounts, roles, and permissions." icon={Users} comingSoon /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SimplePage title="Settings" subtitle="Configure platform settings and preferences." icon={Settings} comingSoon /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><SimplePage title="Profile" subtitle="View and edit your profile information." icon={User} comingSoon /></ProtectedRoute>} />
      <Route path="/system" element={<ProtectedRoute><SimplePage title="System Health" subtitle="Monitor platform health, uptime, and resource usage." icon={Heart} comingSoon /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute><SimplePage title="System Logs" subtitle="View audit logs, activity logs, and system events." icon={Search} comingSoon /></ProtectedRoute>} />
      <Route path="/about" element={<ProtectedRoute><SimplePage title="About" subtitle="Learn more about the Network Congestion Detection Platform." icon={Info} comingSoon /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><SimplePage title="Help & Documentation" subtitle="Find answers to common questions and platform documentation." icon={HelpCircle} comingSoon /></ProtectedRoute>} />
      <Route path="/feedback" element={<ProtectedRoute><SimplePage title="Feedback" subtitle="Share your feedback and suggestions to improve the platform." icon={MessageSquare} comingSoon /></ProtectedRoute>} />

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
