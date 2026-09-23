import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Intervention, Priority, InterventionStatus } from '../types/intervention';
import { getStudentInterventions, getAtRiskStudents } from '../services/interventionService';

const PRIORITY_COLORS: Record<Priority, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-green-100 text-green-700',
};

const STATUS_COLORS: Record<InterventionStatus, string> = {
  GENERATED: 'bg-slate-100 text-slate-700',
  PENDING_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DISMISSED: 'bg-slate-100 text-slate-500',
};

export const StudentInterventions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const atRisk = await getAtRiskStudents(1);
        const matched = atRisk.find(
          (s) => s.student_name.toLowerCase() === user.name.toLowerCase(),
        ) ?? atRisk[0];
        if (!matched) {
          setInterventions([]);
          return;
        }
        const data = await getStudentInterventions(matched.student_id);
        setInterventions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load interventions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.name]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-8 text-center text-slate-500 text-sm">
        Loading your intervention plans...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Intervention Plans</h1>
        <p className="mt-1 text-sm text-slate-500">
          Personalized improvement plans assigned to help you succeed
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
        </div>
      )}

      {interventions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="text-slate-400 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-slate-600 font-medium">No intervention plans for you</p>
          <p className="text-sm text-slate-500 mt-1">You're on track! No additional support is needed at this time.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {interventions.map((intv) => {
            const completedActions = intv.actions.filter((a) => a.is_completed).length;
            const totalActions = intv.actions.length;
            const progressPct = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

            return (
              <div
                key={intv.intervention_id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-5 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLORS[intv.priority]}`}>
                        {intv.priority}
                      </span>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[intv.status]}`}>
                        {intv.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-500">
                        Created {new Date(intv.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/interventions/${intv.intervention_id}`)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Focus Area</h3>
                    <p className="text-sm text-slate-800">{intv.trigger_reason}</p>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Progress ({completedActions}/{totalActions})
                      </h3>
                      <span className="text-sm font-semibold text-blue-600">{progressPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${progressPct === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {intv.actions.map((action) => (
                      <div
                        key={action.action_id}
                        className={`flex items-start gap-3 p-3 rounded-lg ${action.is_completed ? 'bg-green-50' : 'bg-slate-50'}`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {action.is_completed ? (
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-5 h-5 border-2 border-slate-300 rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${action.is_completed ? 'text-green-700 line-through' : 'text-slate-900'}`}>
                            {action.title}
                          </p>
                          <p className={`text-xs mt-0.5 ${action.is_completed ? 'text-green-600' : 'text-slate-500'}`}>
                            {action.target_weakness} &middot; {action.action_type}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
