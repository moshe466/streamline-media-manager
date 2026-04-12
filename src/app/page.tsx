
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { AnimatePresence, motion } from 'framer-motion';

const loadingTexts = [
    "מאמת פרטים...",
    "מתחבר לשרתים...",
    "טוען נתונים...",
    "מכין את סביבת העבודה...",
];

function LoadingBar({ delay }: { delay: number }) {
    return (
        <motion.div
            className="w-1.5 bg-primary/50"
            initial={{ height: "4px" }}
            animate={{ height: ["4px", "48px", "4px"] }}
            transition={{
                duration: 1.5,
                repeat: Infinity,
                delay,
            }}
        />
    );
}

export default function Home() {
  const router = useRouter();
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [nickname, setNickname] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    const userId = sessionStorage.getItem('userId');
    const userNickname = sessionStorage.getItem('userNickname');
    
    if (userNickname) {
        setNickname(userNickname);
    }

    if (role === 'viewer') {
        const viewerClientId = sessionStorage.getItem('clientId');
        if (viewerClientId) setClientId(viewerClientId);
    } else if (role === 'client') {
        if (userId) setClientId(userId);
    }
    
    const timer = setTimeout(() => {
        if (role === 'super-admin' || role === 'admin' || role === 'editor') {
          router.replace('/admin/dashboard');
        } else if (role === 'viewer') {
          const viewerClientId = sessionStorage.getItem('clientId');
          router.replace(`/viewer/${viewerClientId}/lobby`);
        } else if (role === 'client' && userId) {
          router.replace(`/client/${userId}/dashboard`);
        } else {
            router.replace('/login');
        }
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);
  
  useEffect(() => {
    const textInterval = setInterval(() => {
        setCurrentTextIndex((prevIndex) => (prevIndex + 1) % loadingTexts.length);
    }, 2000);
    return () => clearInterval(textInterval);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground overflow-hidden">
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-8"
        >
            <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                <Logo className="w-48 h-24" clientId={clientId} />
            </motion.div>

            {nickname && (
                <motion.h2
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, scale: [1, 1.02, 1] }}
                    transition={{ delay: 0.5, duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
                    className="text-2xl font-semibold tracking-tight text-primary"
                >
                    שלום, {nickname}
                </motion.h2>
            )}

            <div className="flex items-center justify-center gap-2 h-12">
                <LoadingBar delay={0} />
                <LoadingBar delay={0.2} />
                <LoadingBar delay={0.4} />
                <LoadingBar delay={0.6} />
                <LoadingBar delay={0.8} />
            </div>

            <div className="relative h-6 w-64 text-center">
                <AnimatePresence>
                    <motion.p
                        key={currentTextIndex}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 text-muted-foreground"
                    >
                        {loadingTexts[currentTextIndex]}
                    </motion.p>
                </AnimatePresence>
            </div>
        </motion.div>
    </div>
  );
}
