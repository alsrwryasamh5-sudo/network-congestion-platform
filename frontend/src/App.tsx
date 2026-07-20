import { useEffect, Component, ReactNode } from 'react';
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
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { UsersPage } from './pages/UsersPage';
import { TopCulpritHostsPage } from './pages/TopCulpritHostsPage';
import { DeviceConnectionPage } from './pages/DeviceConnectionPage';
import { NOCDashboardPage } from './pages/NOCDashboardPage';
import { NetworkDevicesPage } from './pages/NetworkDevicesPage';
import { InterfaceMonitoringPage } from './pages/InterfaceMonitoringPage';
import { SimplePage, NotFoundPage, MaintenancePage } from './pages/SimplePage';
import { AlertTriangle } from 'lucide-react';

// Error Boundary
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cyber-bg p-6">
          <div className="glass-card p-12 text-center max-w-md">
            <AlertTriangle size={48} className="text-cyber-danger mx-auto mb-4" />
            <h2 className="text-xl font-bold text-cyber-text mb-2">Something went wrong</h2>
            <p className="text-cyber-muted text-sm mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: any }) {
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <ErrorBoundary>{children}</ErrorBoundary>;
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
    <ErrorBoundary>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/maintenance" element={<MaintenancePage />} />

        {/* Protected - Monitoring & Analysis */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/noc" element={<ProtectedRoute><NOCDashboardPage /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><NetworkDevicesPage /></ProtectedRoute>} />
        <Route path="/devices/:id/interfaces" element={<ProtectedRoute><InterfaceMonitoringPage /></ProtectedRoute>} />
        <Route path="/root-cause" element={<ProtectedRoute><RootCausePage /></ProtectedRoute>} />
        <Route path="/top-culprits" element={<ProtectedRoute><TopCulpritHostsPage /></ProtectedRoute>} />
        <Route path="/shap" element={<ProtectedRoute><ShapPage /></ProtectedRoute>} />

        {/* Protected - AI & Operations */}
        <Route path="/congestion" element={<ProtectedRoute><PredictionPage /></ProtectedRoute>} />
        <Route path="/training" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
        <Route path="/ingest" element={<ProtectedRoute><DeviceConnectionPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />

        {/* Protected - Management */}
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

        {/* Redirects for removed pages */}
        <Route path="/live" element={<Navigate to="/noc" replace />} />
        <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
        <Route path="/performance" element={<Navigate to="/shap" replace />} />
        <Route path="/prediction" element={<Navigate to="/congestion" replace />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
