'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // The only action: go to /auth/sign
    router.replace('/main');
  }, [router]);

  return null;
}