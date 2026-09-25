import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MentorInterventions } from './pages/MentorInterventions';
import { StudentAccessDirectory } from './pages/StudentAccessDirectory';
import { StudentAccessDetail } from './pages/StudentAccessDetail';
import { MentorDashboard } from './pages/MentorDashboard';
import { Layout } from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/mentor/dashboard" replace />} />

          {/* Coordinator routes */}
          <Route path="/coordinator/access" element={<StudentAccessDirectory />} />
          <Route path="/coordinator/access/:studentId" element={<StudentAccessDetail />} />

          {/* Mentor Dashboard (single page with all mentor features) */}
          <Route path="/mentor/dashboard" element={<MentorDashboard />} />

          <Route path="/interventions" element={<MentorInterventions />} />

          <Route path="*" element={<Navigate to="/mentor/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
