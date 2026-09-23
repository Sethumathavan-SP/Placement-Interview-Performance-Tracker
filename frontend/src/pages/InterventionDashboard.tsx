import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AtRiskStudent,
  Intervention,
  StudentPattern,
  Priority,
  InterventionStatus,
} from '../types/intervention';
import {
  getCoordinators,
  getAtRiskStudents,
  listInterventions,
  createIntervention,
  getStudentPattern,
} from '../services/interventionService';

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

function PatternModal({
  pattern,
  studentName,
  onClose,
  onGenerate,
  generating,
}: {
  pattern: StudentPattern;
  studentName: string;
  onClose: () => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{studentName}</h2>
            <p className="text-sm text-slate-500">Failure Pattern Analysis</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">Drives Attempted</div>
              <div className="text-xl font-bold text-slate-900">{pattern.total_drives_attempted}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">Drives Cleared</div>
              <div className="text-xl font-bold text-green-600">{pattern.total_drives_cleared}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">CGPA</div>
              <div className="text-xl font-bold text-slate-900">{pattern.cgpa}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">Trend</div>
              <div className={`text-xl font-bold ${pattern.failure_trend === 'IMPROVING' ? 'text-green-600' : pattern.failure_trend === 'WORSENING' ? 'text-red-600' : 'text-slate-600'}`}>
                {pattern.failure_trend}
              </div>
            </div>
          </div>

          {pattern.biggest_bottleneck && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">Biggest Bottleneck</div>
              <div className="text-sm font-semibold text-red-800">{pattern.biggest_bottleneck}</div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Failures by Round Type</h3>
            <div className="space-y-2">
              {Object.entries(pattern.failure_by_round_type).map(([round, value]) => {
                const count = typeof value === 'object' && value !== null && 'count' in value
                  ? (value as { count: number }).count
                  : (value as number);
                const maxCount = Math.max(
                  ...Object.values(pattern.failure_by_round_type).map((v) =>
                    typeof v === 'object' && v !== null && 'count' in v
                      ? (v as { count: number }).count
                      : (v as number)
                  ),
                );
                return (
                  <div key={round} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-32">{round}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-red-500 rounded-full h-2"
                        style={{ width: `${Math.min((count / maxCount) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-900 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {Object.keys(pattern.weakness_areas).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Weakness Areas</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(pattern.weakness_areas).map(([area, count]) => (
                  <span key={area} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm">
                    {area} <span className="font-semibold">({count as number})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {pattern.always_clears.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Always Clears</h3>
              <div className="flex flex-wrap gap-2">
                {pattern.always_clears.map((round) => (
                  <span key={round} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                    {round}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">
            Close
          </button>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {generating ? 'Generating...' : 'Generate AI Intervention'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const InterventionDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'at-risk' | 'interventions'>('at-risk');
  const [coordinatorId, setCoordinatorId] = useState<string | null>(null);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const [patternModal, setPatternModal] = useState<{ pattern: StudentPattern; studentName: string } | null>(null);
  const [patternLoading, setPatternLoading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [coordinators, students, intv] = await Promise.all([
        getCoordinators(),
        getAtRiskStudents(),
        listInterventions(),
      ]);
      if (coordinators.length > 0) {
        setCoordinatorId(coordinators[0].coordinator_id);
      }
      setAtRiskStudents(students);
      setInterventions(intv);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInterventions = useMemo(() => {
    let result = [...interventions];
    if (statusFilter !== 'ALL') result = result.filter((i) => i.status === statusFilter);
    if (priorityFilter !== 'ALL') result = result.filter((i) => i.priority === priorityFilter);
    return result;
  }, [interventions, statusFilter, priorityFilter]);

  const handleViewPattern = async (student: AtRiskStudent) => {
    try {
      setPatternLoading(student.student_id);
      const pattern = await getStudentPattern(student.student_id);
      setPatternModal({ pattern, studentName: student.student_name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pattern');
    } finally {
      setPatternLoading(null);
    }
  };

  const handleGenerate = async () => {
    if (!patternModal || !coordinatorId) return;
    try {
      setGenerating(true);
      const intervention = await createIntervention(patternModal.pattern.student_id, coordinatorId);
      setPatternModal(null);
      navigate(`/interventions/${intervention.intervention_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate intervention');
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="p-8 text-center text-slate-500 text-sm">Loading intervention data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Interventions</h1>
        <p className="mt-1 text-sm text-slate-500">
          AI-powered intervention plans for at-risk students
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('at-risk')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'at-risk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          At-Risk Students
          {atRiskStudents.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
              {atRiskStudents.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('interventions')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'interventions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          All Interventions
          {interventions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
              {interventions.length}
            </span>
          )}
        </button>
      </div>

      {/* At-Risk Students Tab */}
      {tab === 'at-risk' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {atRiskStudents.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 text-sm">No at-risk students found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Student Name</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">CGPA</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Total Failures</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {atRiskStudents.map((student, idx) => (
                    <tr key={student.student_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 text-slate-500">{idx + 1}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{student.student_name}</td>
                      <td className="px-6 py-4 text-slate-600">{student.department}</td>
                      <td className="px-6 py-4 text-slate-600">{student.cgpa}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          student.total_failures >= 4 ? 'bg-red-100 text-red-700' :
                          student.total_failures >= 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {student.total_failures} failures
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleViewPattern(student)}
                          disabled={patternLoading === student.student_id}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          {patternLoading === student.student_id ? 'Loading...' : 'View Pattern'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Interventions Tab */}
      {tab === 'interventions' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="w-full sm:w-48">
                <label htmlFor="intv-status" className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select
                  id="intv-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="GENERATED">Generated</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DISMISSED">Dismissed</option>
                </select>
              </div>
              <div className="w-full sm:w-48">
                <label htmlFor="intv-priority" className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
                <select
                  id="intv-priority"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>
          </div>

          {filteredInterventions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 text-sm">
                {interventions.length === 0
                  ? 'No interventions created yet. Go to At-Risk Students to generate one.'
                  : 'No interventions match the selected filters.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Trigger</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInterventions.map((intv, idx) => {
                    const completedActions = intv.actions.filter((a) => a.is_completed).length;
                    return (
                      <tr key={intv.intervention_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 text-slate-500">{idx + 1}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{intv.student_id}</td>
                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{intv.trigger_reason}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLORS[intv.priority]}`}>
                            {intv.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[intv.status]}`}>
                            {intv.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {completedActions}/{intv.actions.length}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(intv.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => navigate(`/interventions/${intv.intervention_id}`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-slate-200">
            <div className="text-sm text-slate-500">
              Showing {filteredInterventions.length} of {interventions.length} interventions
            </div>
          </div>
        </div>
      )}

      {patternModal && (
        <PatternModal
          pattern={patternModal.pattern}
          studentName={patternModal.studentName}
          onClose={() => setPatternModal(null)}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}
    </div>
  );
};
