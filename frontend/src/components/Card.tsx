import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  delay?: number;
}

export function Card({ children, className, title, icon, action, delay = 0 }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={clsx('glass-card p-6', className)}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {icon && <span className="text-cyber-primary">{icon}</span>}
            {title && <h3 className="text-lg font-semibold text-cyber-text">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </motion.div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  delay?: number;
}

export function StatCard({
  title,
  value,
  icon,
  change,
  changeType = 'neutral',
  color = 'primary',
  delay = 0,
}: StatCardProps) {
  const colorMap = {
    primary: 'text-cyber-primary bg-cyber-primary/10',
    accent: 'text-cyber-accent bg-cyber-accent/10',
    success: 'text-cyber-success bg-cyber-success/10',
    warning: 'text-cyber-warning bg-cyber-warning/10',
    danger: 'text-cyber-danger bg-cyber-danger/10',
    info: 'text-cyber-info bg-cyber-info/10',
  };
  const changeColor = changeType === 'up' ? 'text-cyber-success' : changeType === 'down' ? 'text-cyber-danger' : 'text-cyber-muted';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5 hover:border-cyber-primary/40 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('p-2.5 rounded-xl', colorMap[color])}>
          {icon}
        </div>
        {change && <span className={clsx('text-xs font-medium', changeColor)}>{change}</span>}
      </div>
      <div className="text-2xl font-bold text-cyber-text mb-1">{value}</div>
      <div className="text-sm text-cyber-muted">{title}</div>
    </motion.div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'info', size = 'md' }: BadgeProps) {
  const variantMap = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    primary: 'badge-primary',
  };
  return (
    <span className={clsx('badge', variantMap[variant], size === 'sm' && 'text-[10px] py-0.5 px-2')}>
      {children}
    </span>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('skeleton', className)} />;
}
