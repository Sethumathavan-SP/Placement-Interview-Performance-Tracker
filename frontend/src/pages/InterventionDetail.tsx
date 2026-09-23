import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Intervention, InterventionStatus, Priority } from '../types/intervention';
import {
  getIntervention,
  updateInterventionStatus,
  updateActionStatus,
} from '../services/interventionService';

const PRIORITY_COLORS: Record<Priority, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
};

const STATUS_COLORS: Record<InterventionStatus, string> = {
  GENERATED: 'bg-slate-100 text-slate-700',
  PENDING_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DISMISSED: 'bg-slate-100 text-slate-500',
};

const STATUS_TRANSITIONS: Record<InterventionStatus, InterventionStatus[]> = {
  GENERATED: ['PENDING_REVIEW', 'DISMISSED'],
  PENDING_REVIEW: ['APPROVED', 'DISMISSED'],
  APPROVED: ['IN_PROGRESS', 'DISMISSED'],
  IN_PROGRESS: ['COMPLETED', 'DISMISSED'],
  COMPLETED: [],
  DISMISSED: [],
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Send for Review',
  APPROVED: 'Approve',
  IN_PROGRESS: 'Start',
  COMPLETED: 'Mark Complete',
  DISMISSED: 'Dismiss',
};

export const InterventionDetail = () => {
  const { interventionId } = useParams<{ interventionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [togglingAction, setTogglingAction] = useState<string | null>(null);

  const role = user.role;
  const canManageStatus = role === 'coordinator';
  const canToggleActions = role === 'coordinator' || role === 'mentor';

  const load = async () => {
    if (!interventionId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getIntervention(interventionId);
      setIntervention(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intervention');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [interventionId]);

  const handleStatusChange = async (newStatus: InterventionStatus) => {
    if (!intervention || !canManageStatus) return;
    try {
      setUpdating(true);
      const updated = await updateInterventionStatus(intervention.intervention_id, newStatus);
      setIntervention(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleAction = async (actionId: string, currentCompleted: boolean) => {
    if (!intervention || !canToggleActions) return;
    try {
      setTogglingAction(actionId);
      const updated = await updateActionStatus(
        intervention.intervention_id,
        actionId,
        !currentCompleted,
      );
      setIntervention(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update action');
    } finally {
      setTogglingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-8 text-center text-slate-500 text-sm">
        Loading intervention...
      </div>
    );
  }

  if (error && !intervention) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="p-8 text-center">
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button onClick={() => navigate('/interventions')} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            Back to Interventions
          </button>
        </div>
      </div>
    );
  }

  if (!intervention) return null;

  const completedActions = intervention.actions.filter((a) => a.is_completed).length;
  const totalActions = intervention.actions.length;
  const progressPct = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
  const availableTransitions = canManageStatus ? (STATUS_TRANSITIONS[intervention.status] || []) : [];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/interventions')}
        className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Interventions
      </button>

      {/* Role indicator */}
      <div className="mb-4 px-3 py-1.5 bg-slate-100 rounded-lg inline-flex items-center gap-2 text-xs text-slate-600">
        <span className="font-medium capitalize">Viewing as: {role}</span>
        {role === 'student' && <span>&middot; Read-only</span>}
        {role === 'mentor' && <span>&middot; Can update actions</span>}
        {role === 'coordinator' && <span>&middot; Full control</span>}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-slate-900">Intervention Plan</h1>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLORS[intervention.priority]}`}>
                {intervention.priority}
              </span>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[intervention.status]}`}>
                {intervention.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-sm text-slate-500">Student: {intervention.student_id}</p>
            <p className="text-sm text-slate-500">
              Created: {new Date(intervention.created_at).toLocaleString()}
            </p>
          </div>

          {availableTransitions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {availableTransitions.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={updating}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    status === 'DISMISSED'
                      ? 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {updating ? '...' : STATUS_LABELS[status] || status}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trigger Reason */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Trigger Reason</h2>
        <p className="text-sm text-slate-800 leading-relaxed">{intervention.trigger_reason}</p>
      </div>

      {/* AI Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">AI Analysis</h2>
        <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
          {intervention.ai_analysis}
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Action Items ({completedActions}/{totalActions})
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-32 bg-slate-100 rounded-full h-2">
                <div
                  className={`rounded-full h-2 transition-all ${progressPct === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-sm text-slate-500">{progressPct}%</span>
            </div>
          </div>
        </div>

        {intervention.actions.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No action items.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {intervention.actions.map((action) => (
              <div key={action.action_id} className={`p-5 ${action.is_completed ? 'bg-slate-50/50' : ''}`}>
                <div className="flex items-start gap-4">
                  {canToggleActions ? (
                    <button
                      onClick={() => handleToggleAction(action.action_id, action.is_completed)}
                      disabled={togglingAction === action.action_id}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {action.is_completed ? (
                        <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 border-2 border-slate-300 rounded hover:border-blue-500 transition-colors" />
                      )}
                    </button>
                  ) : (
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
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${action.is_completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {action.title}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                        {action.action_type}
                      </span>
                    </div>
                    <p className={`text-sm ${action.is_completed ? 'text-slate-400' : 'text-slate-600'} mb-2`}>
                      {action.description}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">Target:</span> {action.target_weakness}
                      </span>
                      {action.resources && action.resources.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium">Resources:</span> {action.resources.length} linked
                        </span>
                      )}
                      {action.notes && (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium">Notes:</span> {action.notes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Failure Summary — visible to coordinator and mentor only */}
      {role !== 'student' && intervention.failure_summary && Object.keys(intervention.failure_summary).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Failure Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(intervention.failure_summary).map(([key, value]) => (
              <div key={key} className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 capitalize">{key.replace(/_/g, ' ')}</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
