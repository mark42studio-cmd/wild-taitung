'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAdminStore } from '@/store/useAdminStore';
import AdminLoginForm from './login/AdminLoginForm';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated } = useAdminStore();

  useEffect(() => { setMounted(true); }, []);

  // Prevent hydration flash: render nothing until client state is ready
  if (!mounted) {
    return (
      <div
        className="min-h-screen"
        style={{ background: 'radial-gradient(ellipse at 30% 20%, #0a2a18 0%, #060f0a 40%, #050e09 100%)' }}
      />
    );
  }

  // Always allow the login page through (no redirect loop)
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Gate all other /admin/* routes
  if (!isAuthenticated) {
    return <AdminLoginForm />;
  }

  return <>{children}</>;
}
