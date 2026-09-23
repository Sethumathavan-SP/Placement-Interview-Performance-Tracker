import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StudentAccessDirectory } from './pages/StudentAccessDirectory';
import { StudentAccessDetail } from './pages/StudentAccessDetail';
import { MentorDashboard } from './pages/MentorDashboard';
import { InterventionDetail } from './pages/InterventionDetail';
import { InterventionRouter } from './components/InterventionRouter';
import { DashboardRouter } from './components/DashboardRouter';
import { Layout } from './components/Layout';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardRouter />} />

            {/* Coordinator routes */}
            <Route path="/coordinator/access" element={<StudentAccessDirectory />} />
            <Route path="/coordinator/access/:studentId" element={<StudentAccessDetail />} />

            {/* Mentor routes */}
            <Route path="/mentor/dashboard" element={<MentorDashboard />} />

            {/* Intervention routes (role-aware) */}
            <Route path="/interventions" element={<InterventionRouter />} />
            <Route path="/interventions/:interventionId" element={<InterventionDetail />} />

            <Route path="*" element={<DashboardRouter />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
