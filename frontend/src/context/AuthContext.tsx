import { createContext, useContext, useState, type ReactNode } from 'react';

export type UserRole = 'coordinator' | 'mentor' | 'student';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser;
  setUser: (user: AuthUser) => void;
  switchRole: (role: UserRole) => void;
}

const DEMO_USERS: Record<UserRole, AuthUser> = {
  coordinator: { id: 'demo-coordinator', name: 'Dr. Priya Kumar', role: 'coordinator' },
  mentor: { id: 'demo-mentor', name: 'Prof. Arun Raj', role: 'mentor' },
  student: { id: 'demo-student', name: 'Rahul Sharma', role: 'student' },
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser>(DEMO_USERS.coordinator);

  const switchRole = (role: UserRole) => {
    setUser(DEMO_USERS[role]);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const DEMO_USERS_MAP = DEMO_USERS;
