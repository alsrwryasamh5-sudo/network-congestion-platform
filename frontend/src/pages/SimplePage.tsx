import { useTranslation } from 'react-i18next';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Search, FileQuestion, Construction } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface SimplePageProps {
  title: string;
  subtitle?: string;
  icon?: any;
  comingSoon?: boolean;
}

export function SimplePage({ title, subtitle, icon: Icon = Search, comingSoon = false }: SimplePageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Layout title={title}>
      <Card className="min-h-[400px] flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-20 h-20 rounded-2xl bg-cyber-gradient flex items-center justify-center mb-6 shadow-lg shadow-cyber-primary/30"
        >
          {comingSoon ? <Construction size={36} className="text-white" /> : <Icon size={36} className="text-white" />}
        </motion.div>
        <h2 className="text-2xl font-bold text-cyber-text mb-2">{title}</h2>
        <p className="text-cyber-muted max-w-md mb-6">
          {subtitle || (comingSoon
            ? 'This module is under active development and will be available in the next release.'
            : 'No content available yet. Check back soon.')}
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Back to Dashboard
        </button>
      </Card>
    </Layout>
  );
}

// Convenience wrappers for each page
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-bg p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 text-center max-w-md"
      >
        <div className="text-7xl font-bold text-gradient mb-4">404</div>
        <h2 className="text-xl font-bold text-cyber-text mb-2">Page Not Found</h2>
        <p className="text-cyber-muted text-sm mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <a href="/dashboard" className="btn-primary inline-block">Back to Dashboard</a>
      </motion.div>
    </div>
  );
}

export function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-bg p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 text-center max-w-md"
      >
        <Construction size={48} className="text-cyber-warning mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-cyber-text mb-2">Under Maintenance</h2>
        <p className="text-cyber-muted text-sm">We're performing scheduled maintenance. Please check back shortly.</p>
      </motion.div>
    </div>
  );
}
