import { useAuth } from '../context/AuthContext';
import { InterventionDashboard } from '../pages/InterventionDashboard';
import { MentorInterventions } from '../pages/MentorInterventions';
import { StudentInterventions } from '../pages/StudentInterventions';

export const InterventionRouter = () => {
  const { user } = useAuth();

  switch (user.role) {
    case 'coordinator':
      return <InterventionDashboard />;
    case 'mentor':
      return <MentorInterventions />;
    case 'student':
      return <StudentInterventions />;
  }
};
