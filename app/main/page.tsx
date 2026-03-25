'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { 
  Radio, 
  Home, 
  Cog, 
  Briefcase, 
  Tag, 
  Users, 
  Phone, 
  Mic, 
  Share2, 
  Megaphone, 
  Laptop, 
  Image as ImageIcon, 
  Menu, 
  X, 
  ChevronDown,
  User,
  Mail,
  LogOut,
  Edit3,
  MessageSquare,
  AlertCircle,
  Loader2
} from 'lucide-react';

// Defined outside component so the reference is stable (no re-creation on render)
const INTERSECTION_OPTIONS = { threshold: 0.1 };

// Firestore chat message shape
interface ChatMessage {
  id: string;
  name?: string;
  text?: string;
  senderType?: string;
  sender?: string; // legacy field
  userEmail?: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
}


// --- Custom Hook for Scroll Animation ---
interface IntersectionOptions { threshold?: number; rootMargin?: string; }

const useOnScreen = (options: IntersectionOptions) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, options);
    observer.observe(el);
    return () => observer.unobserve(el);
    // options ref is stable (constant defined outside component)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, isVisible] as const;
};

// --- Reusable Animation Component ---
const Reveal = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const [ref, isVisible] = useOnScreen(INTERSECTION_OPTIONS);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out transform ${className} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      {children}
    </div>
  );
};

export default function MainPage() {
  const router = useRouter();
  
  // States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  
  // User Profile State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // NEW: Loading state while Firebase checks auth
  const [authLoading, setAuthLoading] = useState(true);

  // --- MESSAGE SYSTEM STATES ---
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [messageForm, setMessageForm] = useState({ name: '', text: '' });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [messagesSentToday, setMessagesSentToday] = useState(0);
  // ------------------------------

  // Handle Logout
  const handleLogout = async () => {
    await signOut(auth);
    router.push('/auth/sign');
  };

  // Handle Edit Profile
  const handleEditProfile = () => {
    setIsProfileOpen(false); 
    router.push('/profile'); 
  };

  // --- RATE LIMIT CHECKER ---
  const checkDailyLimit = () => {
    const today = new Date().toDateString();
    const historyKey = 'broadcast_sent_history';
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    // Count messages sent today
    const count = history.filter((timestamp: string) => new Date(timestamp).toDateString() === today).length;
    
    setMessagesSentToday(count);
    return count < 3;
  };

  // Update count on mount
  useEffect(() => {
    checkDailyLimit();
  }, []);

  // --- REAL-TIME FIRESTORE LISTENER ---
  useEffect(() => {
    if (!user?.email) return;

    const q = query(
      collection(db, "messages"),
      where("userEmail", "==", user.email),
      orderBy("createdAt")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatHistory(msgs);
    });

    return () => unsubscribe();
  }, [user?.email]);

  // --- HANDLE MESSAGE SUBMIT ---
  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!messageForm.text || !messageForm.name) {
      setStatusMsg({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }

    // 1. Check Rate Limit
    if (!checkDailyLimit()) {
      setStatusMsg({ type: 'error', text: 'Daily limit reached (3 messages). Please try again tomorrow.' });
      return;
    }

    setIsSending(true);

    try {
      // 2. Call Next.js API Route with email included
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: messageForm.name,
          text: messageForm.text,
          fromEmail: user?.email || '',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        
        // 3. Save to LocalStorage (Rate Limit Logic)
        const historyKey = 'broadcast_sent_history';
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        history.push(new Date().toISOString());
        localStorage.setItem(historyKey, JSON.stringify(history));
        setMessagesSentToday(prev => prev + 1);

        // 4. Save to Firestore (real-time listener will update the UI)
        await addDoc(collection(db, "messages"), {
          name: messageForm.name,
          text: messageForm.text,
          userEmail: user?.email || null,
          senderType: "user",
          createdAt: serverTimestamp(),
        });
        
        setStatusMsg({ type: 'success', text: 'Message sent successfully!' });
        setMessageForm({ name: '', text: '' });
        setIsSending(false);

      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to send message.' });
        setIsSending(false);
      }

    } catch {
      setStatusMsg({ type: 'error', text: 'Network error. Please try again.' });
      setIsSending(false);
    }
  };

  // Intro Animation
  useEffect(() => {
    const hasSeenIntro = localStorage.getItem('introShown');
    if (!hasSeenIntro) {
      setShowIntro(true);
      const timer = setTimeout(() => {
        setShowIntro(false);
        localStorage.setItem('introShown', 'true');
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, []);

  // AUTH STATE LISTENER + AUTO REDIRECT
  // If user is NOT signed in (never signed in or signed out), redirect to sign-in page
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        router.push('/auth/sign');   // <-- This is the required redirect
      }
      setAuthLoading(false); // auth check is done
    });
    return () => unsubscribe();
  }, [router]);

  // FORCE DARK MODE
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const toggleFaq = (id: number) => {
    setActiveFaq(activeFaq === id ? null : id);
  };

  const getDisplayName = () => {
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return "User";
  };

  // --- SMART UNREAD NOTIFICATION ---
  const hasUnread = chatHistory.some(msg => (msg.senderType || msg.sender) === 'admin');

  const services = [
    { icon: Mic, title: "Radio & Podcast", desc: "Production, editing, and distribution of audio programs." },
    { icon: Share2, title: "Social Media", desc: "Full management + content creation + paid campaigns." },
    { icon: Megaphone, title: "Ad Campaigns", desc: "Execution for institutions, malls, and exhibitions." },
    { icon: Laptop, title: "Web Design", desc: "Custom websites tailored specifically to your business." },
    { icon: Cog, title: "Business Systems", desc: "Order systems, accounting, and reporting tools." },
    { icon: ImageIcon, title: "Graphic & Motion", desc: "Attractive designs that catch the eye and explain ideas." },
    { icon: Tag, title: "Packages", desc: "Flexible plans starting from competitive rates.", link: "/packages" },
    { icon: Briefcase, title: "Portfolio", desc: "Check out our work and judge for yourself.", link: "/portfolio" },
  ];

  const faqs = [
    { id: 1, q: "How long does delivery take?", a: "Delivery takes from 3 to 5 working days depending on the project size." },
    { id: 2, q: "What are the payment methods?", a: "We accept credit cards, bank transfers, and electronic payment methods." },
    { id: 3, q: "Are modifications allowed?", a: "Yes, you can request modifications after delivery as per the agreement." },
  ];

  // Show loading screen while Firebase is checking auth state
  // (prevents flash of content for unauthenticated users)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
          <p className="text-slate-400 text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 font-sans selection:bg-blue-900 selection:text-white transition-colors duration-300">
      
      {showIntro && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-1000">
          <div className="text-center animate-pulse">
            <Radio className="w-24 h-24 text-blue-500 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white tracking-wider">BROADCAST HUB</h1>
          </div>
        </div>
      )}

      {/* MESSAGE MODAL */}
      {isMessageOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsMessageOpen(false)}></div>
          
          <div className="relative bg-[#0F172A] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                  <MessageSquare size={18} />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-white text-sm">Contact Support</h3>
                  <span className="text-xs text-slate-400">Daily Limit: {messagesSentToday}/3</span>
                </div>
              </div>
              <button onClick={() => setIsMessageOpen(false)} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              
              {/* Status Message */}
              {statusMsg && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${statusMsg.type === 'error' ? 'bg-red-900/30 text-red-200 border border-red-800' : 'bg-emerald-900/30 text-emerald-200 border border-emerald-800'}`}>
                  {statusMsg.type === 'error' ? <AlertCircle size={16} /> : <MessageSquare size={16} />}
                  {statusMsg.text}
                </div>
              )}

              {/* Chat History (real-time from Firestore) */}
              {chatHistory.length > 0 && (
                <div className="space-y-4 mb-6">
                  {chatHistory
                    .map((msg) => {
                      const senderType = msg.senderType || msg.sender;
                      return (
                    <div key={msg.id} className={`flex flex-col ${senderType === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 mb-1 text-xs ${senderType === 'user' ? 'text-blue-400' : 'text-emerald-400'}`}>
                        <span>{senderType === 'admin' ? 'Support' : msg.name}</span>
                        <span>
                          {msg.createdAt?.seconds
                            ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '...'}
                        </span>
                      </div>
                      <div className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed ${
                        senderType === 'user' 
                          ? 'bg-blue-600 text-white rounded-br-none' 
                          : 'bg-slate-700 text-slate-200 rounded-bl-none border border-slate-600'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  )})}
                  {isSending && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs animate-pulse pl-2">
                      <Loader2 size={14} className="animate-spin" />
                      Sending securely...
                    </div>
                  )}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleMessageSubmit} className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 shadow-sm">
                <div className="mb-3">
                  <input 
                    value={messageForm.name}
                    onChange={(e) => setMessageForm({...messageForm, name: e.target.value})}
                    placeholder="Your Name" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition text-sm placeholder:text-slate-600" 
                    type="text" 
                  />
                </div>
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-2">Admin replies are managed from Firebase Console and will appear here.</p>
                  <textarea 
                    value={messageForm.text}
                    onChange={(e) => setMessageForm({...messageForm, text: e.target.value})}
                    placeholder="Tell us about your project..." 
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition text-sm placeholder:text-slate-600 resize-none"
                  ></textarea>
                </div>
                <button 
                  type="submit" 
                  disabled={isSending}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>Sending <Loader2 size={16} className="animate-spin" /></>
                  ) : (
                    <>Send to Admin <Mail size={16} /></>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-800 shadow-sm">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <Radio className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold text-white">Broadcast Hub</h1>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#home" className="flex items-center gap-2 text-slate-300 hover:text-blue-400 transition font-medium"><Home size={18} /> Home</a>
            <a href="#services" className="flex items-center gap-2 text-slate-300 hover:text-blue-400 transition font-medium"><Cog size={18} /> Services</a>
            <a href="#portfolio" className="flex items-center gap-2 text-slate-300 hover:text-blue-400 transition font-medium"><Briefcase size={18} /> Portfolio</a>
            <a href="#packages" className="flex items-center gap-2 text-slate-300 hover:text-blue-400 transition font-medium"><Tag size={18} /> Packages</a>
            <a href="#about" className="flex items-center gap-2 text-slate-300 hover:text-blue-400 transition font-medium"><Users size={18} /> About</a>
            <a href="#contact" className="flex items-center gap-2 text-slate-300 hover:text-blue-400 transition font-medium"><Phone size={18} /> Contact</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-medium transition text-sm shadow-lg shadow-blue-900/50">
              Book Consultation
            </button>

            {/* Message Icon */}
            <div className="relative">
              <button 
                onClick={() => setIsMessageOpen(true)}
                className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 hover:text-blue-400 text-slate-300 transition relative group"
                title="Messages"
              >
                <Mail size={20} />
                {hasUnread && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-800"></span>
                )}
              </button>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition">
                <User size={20} className="text-blue-400" />
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Signed in as</p>
                    <h3 className="font-semibold text-white truncate flex items-center gap-2"><User size={14} /> {getDisplayName()}</h3>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-2 mt-1"><Mail size={12} /> {user?.email}</p>
                  </div>
                  <div className="p-2">
                    <button onClick={handleEditProfile} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition group"><Edit3 size={16} className="text-blue-400 group-hover:text-blue-300" /> Edit Profile</button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 rounded-lg transition group mt-1"><LogOut size={16} /> Sign Out</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button className="md:hidden text-slate-200" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-[#0B1120] border-b border-slate-800 shadow-xl p-6 flex flex-col gap-4 animate-in slide-in-from-top-5">
             <a href="#home" className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg text-slate-200"><Home size={20} /> Home</a>
             <a href="#services" className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg text-slate-200"><Cog size={20} /> Services</a>
             <a href="#portfolio" className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg text-slate-200"><Briefcase size={20} /> Portfolio</a>
             <a href="#contact" className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg text-slate-200"><Phone size={20} /> Contact</a>
             <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                   <div><span className="text-xs text-slate-400 block">Logged in</span><span className="text-sm font-semibold text-white truncate block max-w-[180px]">{user?.email}</span></div>
                   <button onClick={handleLogout} className="text-red-500 p-2"><LogOut size={18} /></button>
                </div>
                <button onClick={handleEditProfile} className="w-full flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-1"><Edit3 size={14} /> Edit Profile</button>
             </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section id="home" className="relative py-24 lg:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950 to-black -z-10"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 translate-y-1/2 -translate-x-1/2"></div>
          <div className="container mx-auto px-6 text-center text-white">
            <span className="inline-block py-1 px-3 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-semibold mb-6 backdrop-blur-sm">All-in-one Digital Solutions</span>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">Crafting Your Complete Digital Presence, <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">From Audio to Visuals!</span></h2>
            <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">Podcasts, campaigns, websites, operating systems, graphics, and everything your company needs—all in one place.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-slate-800 text-white hover:bg-slate-700 px-8 py-4 rounded-xl font-bold transition border border-slate-700 flex items-center justify-center gap-2">View Our Work <Briefcase size={18} /></button>
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-bold transition shadow-lg shadow-blue-600/30 border border-blue-500">Get a Quote</button>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="py-20 bg-[#0F172A]">
          <Reveal>
            <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 flex items-center justify-center gap-4">
                  Our Services
                  <span className="text-sm font-semibold bg-amber-500 text-black px-5 py-1.5 rounded-3xl shadow-inner">Coming Soon</span>
                </h2>
                <div className="w-20 h-1 bg-blue-600 mx-auto rounded-full"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {services.map((service, index) => {
                  const Icon = service.icon;
                  return (
                    <div key={index} onClick={() => service.link && router.push(service.link)} className="group bg-slate-800/50 p-8 rounded-2xl shadow-sm hover:shadow-xl border border-slate-700 hover:border-blue-500/50 transition-all duration-300 cursor-pointer flex flex-col items-center text-center">
                      <div className="w-14 h-14 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors"><Icon size={28} /></div>
                      <h3 className="text-xl font-bold text-white mb-3">{service.title}</h3>
                      <p className="text-slate-400 leading-relaxed">{service.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </section>

        {/* Portfolio */}
        <section id="portfolio" className="py-20 bg-[#0B1120]">
          <Reveal>
            <div className="container mx-auto px-6">
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Latest Works</h2>
                  <p className="text-slate-400">Coming Soon – Our recent projects will be showcased here soon!</p>
                </div>
                <button className="hidden md:block text-blue-400 font-semibold hover:underline">View All</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: "Podcast", icon: Mic, desc: "Professional audio production" },
                  { title: "Campaign", icon: Megaphone, desc: "Impactful ad campaigns" },
                  { title: "Website", icon: Laptop, desc: "Custom digital experiences" },
                  { title: "Graphic", icon: ImageIcon, desc: "Stunning visuals & motion" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="group bg-slate-800/50 p-8 rounded-2xl shadow-sm hover:shadow-xl border border-slate-700 hover:border-blue-500/50 transition-all duration-300 flex flex-col items-center text-center relative">
                      <div className="w-14 h-14 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <Icon size={28} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                      <p className="text-slate-400 leading-relaxed text-sm">{item.desc}</p>
                      {/* Coming soon badge */}
                      <div className="absolute top-6 right-6 px-3 py-1 text-[10px] font-bold bg-amber-500 text-black rounded-3xl shadow-inner">
                        Coming Soon
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-[#0F172A]">
          <Reveal>
            <div className="container mx-auto px-6 max-w-3xl">
              <h2 className="text-3xl font-bold text-center text-white mb-10">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {faqs.map((faq) => (
                  <div key={faq.id} className="bg-slate-800/50 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
                    <button onClick={() => toggleFaq(faq.id)} className="w-full flex justify-between items-center p-6 text-left focus:outline-none"><h3 className="text-lg font-semibold text-slate-100">{faq.q}</h3><ChevronDown className={`w-5 h-5 text-slate-300 transition-transform duration-300 ${activeFaq === faq.id ? 'rotate-180' : ''}`} /></button>
                    <div className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${activeFaq === faq.id ? 'max-h-40 pb-6' : 'max-h-0'}`}><p className="text-slate-300">{faq.a}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* Info */}
        <section id="info" className="py-12 bg-blue-950 text-white">
          <Reveal>
            <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-left"><h3 className="text-xl font-bold mb-1">Working Hours & Support</h3><p className="text-blue-200">We reply within 24 hours</p></div>
              <div className="text-center md:text-right"><p className="font-semibold"><i className="far fa-clock mr-2"></i>Sun - Thu: 10:00 AM - 6:00 PM</p></div>
            </div>
          </Reveal>
        </section>

        {/* Footer */}
        <footer id="contact" className="bg-black text-slate-300 pt-20 pb-10">
          <Reveal>
            <div className="container mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-6">Contact Us</h2>
                  <p className="mb-8 text-slate-400 leading-relaxed">Have an idea? Send it to us and we will get back to you.</p>
                  <div className="flex gap-4 mb-8">
                    {['whatsapp', 'linkedin', 'instagram', 'facebook'].map((social) => (
                      <a key={social} href="#" className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition"><span className="capitalize text-xs font-bold">{social[0].toUpperCase()}</span></a>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                  <p className="text-slate-400 text-center">Want to send us a message?</p>
                  <button
                    type="button"
                    onClick={() => setIsMessageOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    Open Chat <MessageSquare size={18} />
                  </button>
                </div>
              </div>
              <div className="border-t border-slate-900 pt-8 text-center text-sm text-slate-500">&copy; {new Date().getFullYear()} Broadcast Hub. All rights reserved.</div>
            </div>
          </Reveal>
        </footer>
      </main>
    </div>
  );
} 