import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Network, Mail, Lock, User, Globe, ArrowRight, Activity, Shield, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/slices/authSlice';
import { authService } from '../services/authService';
import { toggleLanguage } from '../store/slices/uiSlice';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface LoginForm {
  username: string;
  password: string;
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const language = useSelector((s: RootState) => s.ui.language);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const response = isLogin
        ? await authService.login(data.username, data.password)
        : await authService.register({
            username: data.username,
            email: data.username,
            password: data.password,
          });
      dispatch(setCredentials(response.data));
      toast.success(isLogin ? t('common.success') : 'Account created!');
      navigate('/dashboard');
    } catch (err: any) {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-cyber-surface">
        <div className="absolute inset-0 bg-grid-pattern bg-[size:40px_40px] opacity-30"></div>
        <div className="absolute top-0 -left-40 w-96 h-96 bg-cyber-primary/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyber-accent/20 rounded-full blur-3xl animate-pulse-slow"></div>

        <div className="relative z-10 flex flex-col justify-center px-16 py-12 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-cyber-gradient flex items-center justify-center shadow-lg shadow-cyber-primary/30">
                <Network size={24} className="text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-cyber-text">NetCongestion</div>
                <div className="text-xs text-cyber-muted">{t('app.tagline')}</div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-cyber-text leading-tight mb-4">
              <span className="text-gradient">AI-Powered</span> Network
              <br />Congestion Detection
            </h1>
            <p className="text-cyber-muted mb-8 max-w-md">
              Detect, explain, and mitigate network congestion in real-time using a hybrid
              Stacking machine learning model with SHAP explainability and root cause analysis.
            </p>

            <div className="space-y-4">
              {[
                { icon: <Activity size={18} />, text: 'Real-time flow analysis with 97% accuracy' },
                { icon: <Shield size={18} />, text: 'SHAP-based explainable AI for every prediction' },
                { icon: <Zap size={18} />, text: 'Automatic root cause identification & mitigation' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-3 text-cyber-text"
                >
                  <div className="w-9 h-9 rounded-lg bg-cyber-primary/15 text-cyber-primary flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="text-sm">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        <button
          onClick={() => dispatch(toggleLanguage())}
          className="absolute top-6 right-6 btn-ghost flex items-center gap-2"
        >
          <Globe size={18} />
          <span className="text-sm">{language === 'en' ? 'العربية' : 'English'}</span>
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-2xl bg-cyber-gradient flex items-center justify-center">
              <Network size={24} className="text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-cyber-text">NetCongestion</div>
              <div className="text-xs text-cyber-muted">{t('app.tagline')}</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-cyber-text mb-1">
            {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h2>
          <p className="text-cyber-muted text-sm mb-6">
            {isLogin ? t('auth.signInToContinue') : t('auth.joinPlatform')}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm text-cyber-muted mb-1.5">{t('auth.username')}</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted rtl:left-auto rtl:right-3" />
                <input
                  type="text"
                  {...register('username', { required: true })}
                  className="input-cyber pl-10 rtl:pl-4 rtl:pr-10"
                  placeholder="admin"
                />
              </div>
              {errors.username && <span className="text-xs text-cyber-danger mt-1 block">Required</span>}
            </div>

            <div>
              <label className="block text-sm text-cyber-muted mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted rtl:left-auto rtl:right-3" />
                <input
                  type="password"
                  {...register('password', { required: true, minLength: 4 })}
                  className="input-cyber pl-10 rtl:pl-4 rtl:pr-10"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <span className="text-xs text-cyber-danger mt-1 block">Min 4 chars</span>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  {isLogin ? t('auth.loginButton') : t('auth.registerButton')}
                  <ArrowRight size={16} className="rtl:rotate-180" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-cyber-muted">
            {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-cyber-primary hover:underline font-medium"
            >
              {isLogin ? t('auth.register') : t('auth.login')}
            </button>
          </div>

          <div className="mt-6 p-3 rounded-xl bg-cyber-card/50 border border-cyber-border text-xs text-cyber-muted">
            <div className="font-semibold text-cyber-text mb-1">Demo Credentials</div>
            <div>Username: <code className="text-cyber-primary">admin</code></div>
            <div>Password: <code className="text-cyber-primary">admin12345</code></div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
