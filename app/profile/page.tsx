'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, updateProfile, type User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    location: ''
  });

  // Verify auth and pre-fill name
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setFormData(prev => ({ ...prev, name: currentUser.displayName ?? '' }));
      } else {
        // Fix: was incorrectly redirecting to /auth (404) — now /auth/sign
        router.push('/auth/sign');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSaveError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Basic validation
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setSaveError('Name must be at least 2 characters.');
      return;
    }
    if (!formData.phone.trim()) {
      setSaveError('Phone number is required.');
      return;
    }

    setLoading(true);
    setSaveError('');
    try {
      // Save extended profile to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        gender: formData.gender,
        location: formData.location,
        email: user.email,
        updatedAt: new Date(),
      }, { merge: true });

      // Sync display name in Firebase Auth
      await updateProfile(user, { displayName: formData.name.trim() });

      router.push('/main');
    } catch (err) {
      console.error('[ProfilePage] Error saving profile:', err);
      setSaveError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 shadow-2xl">
        <h1 className="text-4xl font-bold text-white text-center mb-2">Complete Profile</h1>
        <p className="text-slate-400 text-center mb-8">One last step before entering the Broadcast Hub</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm text-slate-300 mb-1">Full Name</label>
            <input
              id="name" type="text" name="name" value={formData.name}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm text-slate-300 mb-1">Phone Number</label>
            <input
              id="phone" type="tel" name="phone" value={formData.phone}
              onChange={handleChange} placeholder="+20 123 456 7890"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm text-slate-300 mb-1">Gender</label>
            <select
              id="gender" name="gender" value={formData.gender}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
              required
            >
              <option value="">Choose gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm text-slate-300 mb-1">Location</label>
            <select
              id="location" name="location" value={formData.location}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
              required
            >
              <option value="">Choose location</option>
              <option value="Beni Suweif">Beni Suweif</option>
              <option value="Cairo">Cairo</option>
              <option value="Giza">Giza</option>
              <option value="Alexandria">Alexandria</option>
              <option value="Luxor">Luxor</option>
              <option value="Aswan">Aswan</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {saveError && (
            <p role="alert" className="text-red-400 text-sm text-center">{saveError}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 py-4 rounded-2xl font-bold text-white text-lg transition-all disabled:opacity-70"
          >
            {loading ? 'Saving…' : 'Save Profile → Go to Main'}
          </button>
        </form>
      </div>
    </div>
  );
}