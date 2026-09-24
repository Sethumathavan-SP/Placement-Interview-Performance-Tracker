import { useState, useEffect } from 'react';
import type { MentorIntervention } from '../types/mentor';
import { getMentorInterventions, updateActionProgress } from '../services/mentorService';

const MENTOR_ID = 'mentor-1';

const priorityStyle: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800',
};

const statusStyle: Record<string, string> = {
  GENERATED: 'bg-slate-100 text-slate-700',
  PENDING_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DISMISSED: 'bg-slate-100 text-slate-500',
};

export const MentorInterventions = () => {
  const [interventions, setInterventions] = useState<MentorIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});

  useEffect(() => {
    getMentorInterventions(MENTOR_ID)
      .then(setInterventions)
      .finally(() => setLoading(false));
  }, []);

  const handleToggleAction = async (interventionId: string, actionId: string, completed: boolean) => {
    setUpdating(actionId);
    const notes = noteInput[actionId] || null;
    const updated = await updateActionProgress(MENTOR_ID, interventionId, actionId, completed, notes);
    if (updated) {
      setInterventions((prev) =>
        prev.map((i) => (i.interventionId === updated.interventionId ? updated : i)),
      );
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Interventions</h1>
        <p className="mt-1 text-sm text-slate-500">
          {interventions.length} intervention plan{interventions.length !== 1 ? 's' : ''} assigned to you
        </p>
      </div>

      {interventions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No interventions assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {interventions.map((intv) => {
            const isExpanded = expandedId === intv.interventionId;
            const completedActions = intv.actions.filter((a) => a.isCompleted).length;
            const totalActions = intv.actions.length;
            const progress = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

            return (
              <div key={intv.interventionId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : intv.interventionId)}
                  className="w-full px-6 py-4 text-left hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-slate-900">{intv.studentName}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityStyle[intv.priority] || 'bg-slate-100'}`}>
                          {intv.priority}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[intv.status] || 'bg-slate-100'}`}>
                          {intv.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{intv.triggerReason}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 max-w-xs bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{completedActions}/{totalActions} actions</span>
                      </div>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                      className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200">
                    <div className="px-6 py-4 bg-blue-50/50">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">AI Analysis</h4>
                      <p className="text-sm text-slate-700">{intv.aiAnalysis}</p>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {intv.actions.map((action) => (
                        <div key={action.actionId} className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <button
                              disabled={updating === action.actionId}
                              onClick={() => handleToggleAction(intv.interventionId, action.actionId, !action.isCompleted)}
                              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                action.isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-slate-300 hover:border-blue-400'
                              } ${updating === action.actionId ? 'opacity-50' : ''}`}
                            >
                              {action.isCompleted && (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              )}
                            </button>

                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${action.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                  {action.title}
                                </span>
                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{action.actionType}</span>
                              </div>
                              <p className="text-sm text-slate-500 mt-0.5">{action.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                <span>Target: {action.targetWeakness}</span>
                                {action.dueDate && <span>Due: {action.dueDate}</span>}
                              </div>
                              {action.resources && action.resources.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {action.resources.map((r, i) => (
                                    <a
                                      key={i}
                                      href={r}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      Resource {i + 1}
                                    </a>
                                  ))}
                                </div>
                              )}
                              {action.notes && (
                                <p className="text-xs text-green-600 mt-2">Notes: {action.notes}</p>
                              )}
                              {!action.isCompleted && (
                                <div className="mt-2">
                                  <input
                                    type="text"
                                    placeholder="Add notes before completing..."
                                    value={noteInput[action.actionId] || ''}
                                    onChange={(e) => setNoteInput((prev) => ({ ...prev, [action.actionId]: e.target.value }))}
                                    className="w-full max-w-md text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-blue-400"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
