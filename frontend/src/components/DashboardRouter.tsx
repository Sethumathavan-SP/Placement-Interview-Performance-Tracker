import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const DashboardRouter = () => {
  const { user } = useAuth();

  switch (user.role) {
    case 'coordinator':
      return <Navigate to="/coordinator/access" replace />;
    case 'mentor':
      return <Navigate to="/mentor/dashboard" replace />;
    case 'student':
      return <Navigate to="/interventions" replace />;
  }
};
