'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  AuthErrorCodes
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

// ── Password validation ────────────────────────────────────────────────────
interface PasswordErrors {
  length?: string;
  uppercase?: string;
  lowercase?: string;
  number?: string;
  special?: string;
}

function validatePassword(password: string): PasswordErrors {
  const errors: PasswordErrors = {};
  if (password.length < 8) errors.length = 'At least 8 characters';
  if (!/[A-Z]/.test(password)) errors.uppercase = 'At least one uppercase letter';
  if (!/[a-z]/.test(password)) errors.lowercase = 'At least one lowercase letter';
  if (!/[0-9]/.test(password)) errors.number = 'At least one number';
  if (!/[^A-Za-z0-9]/.test(password)) errors.special = 'At least one special character';
  return errors;
}

// ── Map Firebase error codes to user-friendly messages ────────────────────
function mapFirebaseError(code: string): string {
  switch (code) {
    case AuthErrorCodes.EMAIL_EXISTS:
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case AuthErrorCodes.INVALID_EMAIL:
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case AuthErrorCodes.USER_DELETED:
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case AuthErrorCodes.INVALID_PASSWORD:
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. Please try again.';
    default:
      return 'Authentication failed. Please try again.';
  }
}

export default function AuthPage() {
  const router = useRouter();
  
  // UI State
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Per-field validation errors (sign up only)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: PasswordErrors;
    confirmPassword?: string;
  }>({});

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });

  // --- HANDLERS ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field-level errors as user types
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    setError('');
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleMode = () => {
    setIsSignUpMode(prev => !prev);
    setError('');
    setFieldErrors({});
  };

  const validateSignUp = (): boolean => {
    const errors: typeof fieldErrors = {};
    let valid = true;

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters.';
      valid = false;
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address.';
      valid = false;
    }

    const pwErrors = validatePassword(formData.password);
    if (Object.keys(pwErrors).length > 0) {
      errors.password = pwErrors;
      valid = false;
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
      valid = false;
    }

    setFieldErrors(errors);
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isSignUpMode && !validateSignUp()) return;

    setLoading(true);
    try {
      if (isSignUpMode) {
        await createUserWithEmailAndPassword(auth, formData.email.trim(), formData.password);
        showToast('Account created! Please sign in.', 'success');
        setTimeout(() => toggleMode(), 1200);
      } else {
        await signInWithEmailAndPassword(auth, formData.email.trim(), formData.password);
        showToast('Signed in successfully!', 'success');
        router.push('/main');
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      const message = mapFirebaseError(code);
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Signed in with Google!', 'success');
      router.push('/profile');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      const message = mapFirebaseError(code);
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helpers
  const pwErrors = fieldErrors.password ?? {};
  const hasPwErrors = Object.keys(pwErrors).length > 0;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl" style={{ animation: 'float 10s infinite reverse' }}></div>
      </div>

      {/* Toast */}
      {toast && (
        <div role="alert" className={`fixed top-5 right-5 z-50 px-6 py-4 rounded-lg shadow-xl backdrop-blur-md border-l-4 transition-all ${toast.type === 'error' ? 'bg-red-500/10 border-red-500 text-red-200' : 'bg-emerald-500/10 border-emerald-500 text-emerald-200'}`}>
          {toast.message}
        </div>
      )}

      {/* Main Card */}
      <div className={`relative bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden w-[850px] max-w-[95%] min-h-[600px] transition-all duration-700 ease-in-out z-10`}>
        
        {/* Sign Up Form Container */}
        <div className="absolute top-0 h-full transition-all duration-700 ease-in-out left-0 w-1/2" style={{ 
          transform: isSignUpMode ? 'translateX(100%)' : 'translateX(20%)',
          opacity: isSignUpMode ? 1 : 0,
          zIndex: isSignUpMode ? 5 : 1,
          pointerEvents: isSignUpMode ? 'all' : 'none'
        }}>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col items-center justify-center h-full px-10 text-center overflow-y-auto py-8">
            <h1 className="text-3xl font-bold text-white mb-1">Create Account</h1>
            <p className="text-slate-400 text-sm mb-5">Join us today and get started</p>
            
            <div className="w-full space-y-3">
              {/* Name */}
              <div className="text-left">
                <input 
                  type="text" name="name" placeholder="Full Name" 
                  value={formData.name}
                  className={`w-full bg-slate-900/50 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition ${fieldErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'}`}
                  onChange={handleInputChange} required
                />
                {fieldErrors.name && <p className="text-red-400 text-xs mt-1 pl-1">{fieldErrors.name}</p>}
              </div>

              {/* Email */}
              <div className="text-left">
                <input 
                  type="email" name="email" placeholder="Email" 
                  value={formData.email}
                  className={`w-full bg-slate-900/50 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition ${fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'}`}
                  onChange={handleInputChange} required
                />
                {fieldErrors.email && <p className="text-red-400 text-xs mt-1 pl-1">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div className="text-left">
                <input 
                  type="password" name="password" placeholder="Password" 
                  value={formData.password}
                  className={`w-full bg-slate-900/50 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition ${hasPwErrors ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'}`}
                  onChange={handleInputChange} required
                />
                {hasPwErrors && (
                  <ul className="mt-1 pl-1 space-y-0.5">
                    {Object.values(pwErrors).map((msg) => (
                      <li key={msg} className="text-red-400 text-xs flex items-center gap-1">
                        <span>•</span> {msg}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Confirm Password */}
              <div className="text-left">
                <input 
                  type="password" name="confirmPassword" placeholder="Confirm Password" 
                  value={formData.confirmPassword}
                  className={`w-full bg-slate-900/50 border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition ${fieldErrors.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500'}`}
                  onChange={handleInputChange} required
                />
                {fieldErrors.confirmPassword && <p className="text-red-400 text-xs mt-1 pl-1">{fieldErrors.confirmPassword}</p>}
              </div>
            </div>

            {error && <p role="alert" className="text-red-400 text-sm mt-3 text-center">{error}</p>}

            <button 
              type="submit" disabled={loading}
              className="mt-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-10 rounded-lg shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <span className="inline-block animate-spin mr-2">⟳</span> : null}
              {loading ? 'Creating...' : 'Sign Up'}
            </button>

            <button 
              type="button" onClick={handleGoogleAuth} disabled={loading}
              className="mt-3 w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium py-3 rounded-lg transition flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Sign Up with Google
            </button>
          </form>
        </div>

        {/* Sign In Form Container */}
        <div className="absolute top-0 h-full transition-all duration-700 ease-in-out left-0 w-1/2" style={{
           transform: isSignUpMode ? 'translateX(100%)' : 'translateX(0)',
           opacity: isSignUpMode ? 0 : 1,
           zIndex: isSignUpMode ? 1 : 5,
           pointerEvents: isSignUpMode ? 'none' : 'all'
        }}>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col items-center justify-center h-full px-12 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-slate-400 text-sm mb-8">Sign in to continue to your account</p>
            
            <div className="w-full space-y-4">
              <input 
                type="email" name="email" placeholder="Email" 
                value={formData.email}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                onChange={handleInputChange} required
              />
              <input 
                type="password" name="password" placeholder="Password" 
                value={formData.password}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                onChange={handleInputChange} required
              />
            </div>

            <div className="w-full flex justify-end mt-2">
              <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition">Forgot Password?</a>
            </div>

            {error && <p role="alert" className="text-red-400 text-sm mt-3 text-center">{error}</p>}

            <button 
              type="submit" disabled={loading}
              className="mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-10 rounded-lg shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <span className="inline-block animate-spin mr-2">⟳</span> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <button 
              type="button" onClick={handleGoogleAuth} disabled={loading}
              className="mt-4 w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium py-3 rounded-lg transition flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Sign In with Google
            </button>
          </form>
        </div>

        {/* Overlay Slider */}
        <div className="absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-700 ease-in-out z-20" style={{
            transform: isSignUpMode ? 'translateX(-100%)' : 'translateX(0)'
        }}>
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white relative -left-full h-full w-[200%] transition-transform duration-700 ease-in-out" style={{
              transform: isSignUpMode ? 'translateX(50%)' : 'translateX(0)'
          }}>
            {/* Left Panel (visible when Sign Up active) */}
            <div className="absolute flex items-center justify-center flex-col h-full w-1/2 top-0 px-12 transition-transform duration-700 ease-in-out max-w-full" style={{
               transform: isSignUpMode ? 'translateX(0)' : 'translateX(-20px)'
            }}>
              <h1 className="text-3xl font-bold mb-4">Welcome Back!</h1>
              <p className="text-xs font-light text-indigo-100 mb-10 leading-relaxed text-center">
                To keep connected with us please login with your personal info
              </p>
              <button 
                onClick={toggleMode}
                className="bg-transparent border-2 border-white text-white font-bold py-3 px-10 rounded-lg hover:bg-white hover:text-indigo-600 transition-all duration-300"
              >
                Sign In
              </button>
            </div>

            {/* Right Panel (visible when Sign In active) */}
            <div className="absolute flex items-center justify-center flex-col h-full w-1/2 top-0 right-0 px-12 transition-transform duration-700 ease-in-out max-w-full" style={{
               transform: isSignUpMode ? 'translateX(20px)' : 'translateX(0)'
            }}>
              <h1 className="text-3xl font-bold mb-4">Hello, Friend!</h1>
              <p className="text-xs font-light text-indigo-100 mb-10 leading-relaxed text-center">
                Enter your personal details and start your journey with us
              </p>
              <button 
                onClick={toggleMode}
                className="bg-transparent border-2 border-white text-white font-bold py-3 px-10 rounded-lg hover:bg-white hover:text-indigo-600 transition-all duration-300"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -20px) scale(1.05); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}</style>
    </div>
  );
}