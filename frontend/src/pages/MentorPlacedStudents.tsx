import { useState, useEffect } from 'react';
import type { PlacedMentee } from '../types/mentor';
import { getPlacedMentees } from '../services/mentorService';

const MENTOR_ID = 'mentor-1';

export const MentorPlacedStudents = () => {
  const [placed, setPlaced] = useState<PlacedMentee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlacedMentees(MENTOR_ID)
      .then(setPlaced)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Placed Mentees</h1>
        <p className="mt-1 text-sm text-slate-500">
          Students who successfully got placed
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : placed.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No placed mentees yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {placed.map((s) => (
            <div key={s.studentId} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{s.name}</h3>
                  <p className="text-sm text-slate-500">{s.registerNumber} &middot; {s.department}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Placed
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Company</span>
                  <span className="font-medium text-slate-900">{s.placedCompany}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Role</span>
                  <span className="font-medium text-slate-900">{s.roleTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Package</span>
                  <span className="font-medium text-slate-900">{s.packageLpa} LPA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CGPA</span>
                  <span className="font-medium text-slate-900">{s.cgpa}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
