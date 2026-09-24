import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Mentee } from '../types/mentor';
import { getMentees } from '../services/mentorService';

const MENTOR_ID = 'mentor-1';

export const MentorMentees = () => {
  const navigate = useNavigate();
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getMentees(MENTOR_ID)
      .then(setMentees)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return mentees;
    const q = search.toLowerCase();
    return mentees.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.registerNumber.toLowerCase().includes(q),
    );
  }, [mentees, search]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Mentees</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mentees.length} students assigned to you
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search by name or register number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading mentees...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No mentees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Register No.</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">CGPA</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Skills</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m, idx) => (
                  <tr key={m.studentId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-slate-500">{idx + 1}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{m.name}</td>
                    <td className="px-6 py-4 text-slate-600">{m.registerNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{m.cgpa}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {m.skills?.slice(0, 3).map((skill) => (
                          <span key={skill} className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                            {skill}
                          </span>
                        ))}
                        {m.skills && m.skills.length > 3 && (
                          <span className="text-xs text-slate-400">+{m.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/mentor/students/${m.studentId}/rounds`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        View Rounds
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-200 text-sm text-slate-500">
          Showing {filtered.length} of {mentees.length} mentees
        </div>
      </div>
    </div>
  );
};
