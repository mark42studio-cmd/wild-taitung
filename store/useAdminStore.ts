import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Hardcoded credentials for dev/ops use — replace with proper auth before production
const ADMIN_USER = 'curatorwild';
const ADMIN_PASS = 'Mamapapaa2606521';

const SESSION_COOKIE = 'wt-admin-session';

function setSessionCookie() {
  if (typeof document === 'undefined') return;
  // 24-hour session; SameSite=Lax prevents CSRF; not HttpOnly so JS can clear it
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=86400; SameSite=Lax`;
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

interface AdminStore {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      login: (username, password) => {
        if (username === ADMIN_USER && password === ADMIN_PASS) {
          set({ isAuthenticated: true });
          setSessionCookie();
          return true;
        }
        return false;
      },
      logout: () => {
        set({ isAuthenticated: false });
        clearSessionCookie();
      },
    }),
    { name: 'wild-taitung-admin-auth' },
  ),
);
