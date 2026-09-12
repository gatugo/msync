'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();

    useEffect(() => {
        // Supabase removed; redirect to home for local-first demo
        router.replace('/');
    }, [router]);

    return null;
}