import { useState, useEffect, useMemo } from 'react';
import type {
  MentorDashboard as MentorDashboardType,
  Mentee,
  PlacedMentee,
  MentorIntervention,
  ViewRoundsResponse,
  MentorMetrics,
  StudentDetail,
  MentorNote,
} from '../types/mentor';
import {
  listMentors,
  getMentorDashboard,
  getMentees,
  getPlacedMentees,
  getMentorInterventions,
  getMenteeRounds,
  updateActionProgress,
  createIntervention,
  getCoordinators,
  getMentorMetrics,
  getStudentDetail,
  createNote,
  updateNote,
  deleteNote,
} from '../services/mentorService';

type Tab = 'overview' | 'mentees' | 'placed' | 'interventions' | 'metrics';

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

const resultBadge = (result: string) => {
  if (result === 'PASSED') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Passed</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>;
};

export const MentorDashboard = () => {
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<MentorDashboardType | null>(null);
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [placedMentees, setPlacedMentees] = useState<PlacedMentee[]>([]);
  const [interventions, setInterventions] = useState<MentorIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [menteeSearch, setMenteeSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [roundsData, setRoundsData] = useState<ViewRoundsResponse | null>(null);
  const [roundsLoading, setRoundsLoading] = useState(false);

  const [expandedIntv, setExpandedIntv] = useState<string | null>(null);
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [actionNoteInput, setActionNoteInput] = useState<Record<string, string>>({});

  const [metrics, setMetrics] = useState<MentorMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const [coordinatorId, setCoordinatorId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    listMentors()
      .then((mentors) => {
        if (mentors.length === 0) {
          setError('No mentors found. Please seed the database first.');
          setLoading(false);
          return;
        }
        const id = mentors[0].mentorId;
        setMentorId(id);
        return Promise.all([
          getMentorDashboard(id),
          getMentees(id),
          getPlacedMentees(id),
          getMentorInterventions(id),
          getCoordinators(),
        ]).then(([d, m, p, i, coords]) => {
          setDashboard(d);
          setMentees(m);
          setPlacedMentees(p);
          setInterventions(i);
          if (coords.length > 0) setCoordinatorId(coords[0].coordinatorId);
        });
      })
      .catch((err) => setError(err.message || 'Failed to connect to backend'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'metrics' && !metrics && mentorId) {
      setMetricsLoading(true);
      getMentorMetrics(mentorId)
        .then(setMetrics)
        .catch(() => {})
        .finally(() => setMetricsLoading(false));
    }
  }, [activeTab, metrics, mentorId]);

  const filteredMentees = useMemo(() => {
    if (!menteeSearch) return mentees;
    const q = menteeSearch.toLowerCase();
    return mentees.filter(
      (m) => m.name.toLowerCase().includes(q) || m.registerNumber.toLowerCase().includes(q),
    );
  }, [mentees, menteeSearch]);

  const handleViewRounds = async (studentId: string) => {
    if (!mentorId) return;
    if (selectedStudentId === studentId) {
      setSelectedStudentId(null);
      setRoundsData(null);
      return;
    }
    setSelectedStudentId(studentId);
    setRoundsLoading(true);
    const data = await getMenteeRounds(mentorId, studentId);
    setRoundsData(data);
    setRoundsLoading(false);
  };

  const handleToggleAction = async (interventionId: string, actionId: string, completed: boolean) => {
    if (!mentorId) return;
    setUpdatingAction(actionId);
    const notes = actionNoteInput[actionId] || null;
    const updated = await updateActionProgress(mentorId, interventionId, actionId, completed, notes);
    if (updated) {
      setInterventions((prev) =>
        prev.map((i) => (i.interventionId === updated.interventionId ? updated : i)),
      );
    }
    setUpdatingAction(null);
  };

  const handleOpenDetail = async (studentId: string) => {
    if (!mentorId) return;
    setShowDetailPanel(true);
    setDetailLoading(true);
    const detail = await getStudentDetail(mentorId, studentId);
    setStudentDetail(detail);
    setDetailLoading(false);
  };

  const handleCloseDetail = () => {
    setShowDetailPanel(false);
    setStudentDetail(null);
  };

  const handleCreateIntervention = async (studentId: string) => {
    if (!mentorId || !coordinatorId) return;
    setGenerating(studentId);
    setGenerationError(null);
    try {
      const newIntv = await createIntervention(mentorId, studentId, coordinatorId);
      setInterventions((prev) => [newIntv, ...prev]);
      if (dashboard) {
        setDashboard({ ...dashboard, activeInterventions: dashboard.activeInterventions + 1 });
      }
      if (studentDetail && studentDetail.studentId === studentId) {
        setStudentDetail({
          ...studentDetail,
          interventions: [newIntv, ...studentDetail.interventions],
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate intervention';
      setGenerationError(msg);
      setTimeout(() => setGenerationError(null), 6000);
    }
    setGenerating(null);
  };

  const handleNoteCreated = (note: MentorNote) => {
    if (studentDetail) {
      setStudentDetail({ ...studentDetail, notes: [...studentDetail.notes, note] });
    }
  };

  const handleNoteUpdated = (updated: MentorNote) => {
    if (studentDetail) {
      setStudentDetail({
        ...studentDetail,
        notes: studentDetail.notes.map((n) => (n.noteId === updated.noteId ? updated : n)),
      });
    }
  };

  const handleNoteDeleted = (noteId: string) => {
    if (studentDetail) {
      setStudentDetail({
        ...studentDetail,
        notes: studentDetail.notes.filter((n) => n.noteId !== noteId),
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-red-800">Connection Error</h2>
        <p className="text-sm text-red-600 mt-2">{error}</p>
        <p className="text-xs text-red-400 mt-4">
          Make sure the backend is running: <code className="bg-red-100 px-1 py-0.5 rounded">uvicorn app.main:app --reload --port 8000</code>
        </p>
      </div>
    );
  }

  if (!dashboard) return null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'mentees', label: 'My Mentees', count: mentees.length },
    { key: 'placed', label: 'Placed Students', count: placedMentees.length },
    { key: 'interventions', label: 'Interventions', count: interventions.length },
    { key: 'metrics', label: 'Metrics' },
  ];

  const stats = [
    { label: 'Total Mentees', value: dashboard.totalMentees, bg: 'bg-blue-50', text: 'text-blue-700' },
    { label: 'Placed', value: dashboard.placedMentees, bg: 'bg-green-50', text: 'text-green-700' },
    { label: 'At Risk', value: dashboard.atRiskMentees, bg: 'bg-red-50', text: 'text-red-700' },
    { label: 'Active Interventions', value: dashboard.activeInterventions, bg: 'bg-amber-50', text: 'text-amber-700' },
    { label: 'Pending Actions', value: dashboard.pendingActions, bg: 'bg-purple-50', text: 'text-purple-700' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mentor Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {dashboard.mentor.name} &middot; {dashboard.mentor.department} &middot; {dashboard.mentor.specialization}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.bg} ${s.text}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-1 opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedStudentId(null); setRoundsData(null); }}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1.5 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab stats={stats} mentees={mentees} placedMentees={placedMentees} interventions={interventions} onNavigate={setActiveTab} />}
      {activeTab === 'mentees' && (
        <MenteesTab
          mentees={filteredMentees}
          total={mentees.length}
          search={menteeSearch}
          onSearchChange={setMenteeSearch}
          selectedStudentId={selectedStudentId}
          roundsData={roundsData}
          roundsLoading={roundsLoading}
          onViewRounds={handleViewRounds}
          onOpenDetail={handleOpenDetail}
        />
      )}
      {activeTab === 'placed' && <PlacedTab placed={placedMentees} />}
      {activeTab === 'interventions' && (
        <InterventionsTab
          interventions={interventions}
          mentees={mentees}
          expandedId={expandedIntv}
          onToggleExpand={(id) => setExpandedIntv(expandedIntv === id ? null : id)}
          updatingAction={updatingAction}
          noteInput={actionNoteInput}
          onNoteChange={(actionId, val) => setActionNoteInput((prev) => ({ ...prev, [actionId]: val }))}
          onToggleAction={handleToggleAction}
          onCreateIntervention={handleCreateIntervention}
          generating={generating}
          generationError={generationError}
        />
      )}
      {activeTab === 'metrics' && <MetricsTab metrics={metrics} loading={metricsLoading} />}

      {/* Student Detail Slide-out Panel */}
      {showDetailPanel && (
        <StudentDetailPanel
          detail={studentDetail}
          loading={detailLoading}
          mentorId={mentorId}
          onClose={handleCloseDetail}
          onNoteCreated={handleNoteCreated}
          onNoteUpdated={handleNoteUpdated}
          onNoteDeleted={handleNoteDeleted}
          onCreateIntervention={handleCreateIntervention}
          generating={generating}
          generationError={generationError}
        />
      )}
    </div>
  );
};

/* ────────────────────────── Overview Tab ────────────────────────── */

function OverviewTab({
  stats: _stats,
  mentees,
  placedMentees,
  interventions,
  onNavigate,
}: {
  stats: { label: string; value: number; bg: string; text: string }[];
  mentees: Mentee[];
  placedMentees: PlacedMentee[];
  interventions: MentorIntervention[];
  onNavigate: (tab: Tab) => void;
}) {
  const atRiskMentees = mentees.filter((m) => {
    const hasPlacement = placedMentees.some((p) => p.studentId === m.studentId);
    return !hasPlacement && m.cgpa < 8.0;
  });

  const activeInterventions = interventions.filter(
    (i) => i.status === 'IN_PROGRESS' || i.status === 'APPROVED',
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">At-Risk Mentees</h3>
          <button onClick={() => onNavigate('mentees')} className="text-xs text-blue-600 font-medium hover:underline">View all</button>
        </div>
        {atRiskMentees.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No at-risk mentees</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {atRiskMentees.slice(0, 5).map((m) => (
              <div key={m.studentId} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.registerNumber} &middot; CGPA: {m.cgpa}</div>
                </div>
                <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">At Risk</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Active Interventions</h3>
          <button onClick={() => onNavigate('interventions')} className="text-xs text-blue-600 font-medium hover:underline">View all</button>
        </div>
        {activeInterventions.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No active interventions</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeInterventions.slice(0, 5).map((intv) => {
              const done = intv.actions.filter((a) => a.isCompleted).length;
              const total = intv.actions.length;
              return (
                <div key={intv.interventionId} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-900">{intv.studentName}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityStyle[intv.priority]}`}>{intv.priority}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{done}/{total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:col-span-2">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Placed Mentees</h3>
          <button onClick={() => onNavigate('placed')} className="text-xs text-blue-600 font-medium hover:underline">View all</button>
        </div>
        {placedMentees.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No placed mentees yet</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {placedMentees.map((p) => (
              <div key={p.studentId} className="border border-slate-100 rounded-lg p-4">
                <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.placedCompany} &middot; {p.roleTitle} &middot; {p.packageLpa} LPA</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── Mentees Tab ────────────────────────── */

function MenteesTab({
  mentees, total, search, onSearchChange, selectedStudentId, roundsData, roundsLoading, onViewRounds, onOpenDetail,
}: {
  mentees: Mentee[];
  total: number;
  search: string;
  onSearchChange: (v: string) => void;
  selectedStudentId: string | null;
  roundsData: ViewRoundsResponse | null;
  roundsLoading: boolean;
  onViewRounds: (id: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search by name or register number..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-4 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
      </div>

      {mentees.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm">No mentees found.</div>
      ) : (
        <div>
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
                {mentees.map((m, idx) => (
                  <>
                    <tr key={m.studentId} className={`hover:bg-slate-50/80 transition-colors ${selectedStudentId === m.studentId ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-6 py-4 text-slate-500">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => onOpenDetail(m.studentId)}
                          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {m.name}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{m.registerNumber}</td>
                      <td className="px-6 py-4 text-slate-600">{m.cgpa}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {m.skills?.slice(0, 3).map((skill) => (
                            <span key={skill} className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{skill}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => onViewRounds(m.studentId)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedStudentId === m.studentId
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {selectedStudentId === m.studentId ? 'Hide Rounds' : 'View Rounds'}
                        </button>
                      </td>
                    </tr>
                    {selectedStudentId === m.studentId && (
                      <tr key={`${m.studentId}-rounds`}>
                        <td colSpan={6} className="p-0">
                          <RoundsPanel data={roundsData} loading={roundsLoading} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-slate-200 text-sm text-slate-500">
            Showing {mentees.length} of {total} mentees
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── Rounds Panel ────────────────────────── */

function RoundsPanel({ data, loading }: { data: ViewRoundsResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-slate-50 p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
        <p className="text-xs text-slate-500 mt-2">Loading rounds...</p>
      </div>
    );
  }

  if (!data) {
    return <div className="bg-slate-50 p-6 text-center text-sm text-slate-400">No round data available for this student.</div>;
  }

  const passRate = data.totalRoundsAttempted > 0 ? Math.round((data.roundsPassed / data.totalRoundsAttempted) * 100) : 0;
  const driveGroups = data.rounds.reduce<Record<string, typeof data.rounds>>((acc, round) => {
    const key = `${round.driveId}-${round.companyName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(round);
    return acc;
  }, {});

  return (
    <div className="bg-slate-50 border-t border-slate-200">
      <div className="flex items-center gap-6 px-6 py-3 border-b border-slate-200 text-xs">
        <span className="text-slate-500">Drives: <strong className="text-slate-700">{data.totalDrives}</strong></span>
        <span className="text-slate-500">Rounds: <strong className="text-slate-700">{data.totalRoundsAttempted}</strong></span>
        <span className="text-green-600">Passed: <strong>{data.roundsPassed}</strong></span>
        <span className="text-red-600">Failed: <strong>{data.roundsFailed}</strong></span>
        <span className="text-slate-500">Pass Rate: <strong className="text-slate-700">{passRate}%</strong></span>
      </div>
      <div className="divide-y divide-slate-200">
        {Object.entries(driveGroups).map(([key, rounds]) => {
          const first = rounds[0];
          return (
            <div key={key}>
              <div className="px-6 py-2.5 bg-white/50 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-semibold text-slate-900">{first.companyName}</span>
                  <span className="text-slate-400 mx-2">&middot;</span>
                  <span className="text-slate-500">{first.roleTitle}</span>
                  <span className="text-slate-400 mx-2">&middot;</span>
                  <span className="text-slate-400">{first.driveDate}</span>
                </div>
                <span className="text-xs text-slate-500">{rounds.filter((r) => r.result === 'PASSED').length}/{rounds.length} cleared</span>
              </div>
              <div className="divide-y divide-slate-100">
                {rounds.map((round) => (
                  <div key={`${round.driveId}-${round.roundNumber}`} className="px-6 py-3 pl-10">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-medium text-slate-400 w-6">R{round.roundNumber}</span>
                      <span className="text-sm font-medium text-slate-800">{round.roundName}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{round.roundType}</span>
                      {resultBadge(round.result)}
                      {round.score !== null && <span className="text-xs text-slate-500">{round.score}/{round.maxScore}</span>}
                    </div>
                    {round.result === 'FAILED' && (
                      <div className="ml-6 mt-1 space-y-0.5">
                        {round.rejectionReason && <p className="text-xs text-red-600">Reason: {round.rejectionReason}</p>}
                        {round.feedback && <p className="text-xs text-slate-500">Feedback: {round.feedback}</p>}
                        {round.weaknessArea && <span className="inline-block text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full mt-1">Weakness: {round.weaknessArea}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────── Placed Tab ────────────────────────── */

function PlacedTab({ placed }: { placed: PlacedMentee[] }) {
  if (placed.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-200 p-12 text-center"><p className="text-slate-500">No placed mentees yet.</p></div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {placed.map((s) => (
        <div key={s.studentId} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{s.name}</h3>
              <p className="text-sm text-slate-500">{s.registerNumber} &middot; {s.department}</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Placed</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Company</span><span className="font-medium text-slate-900">{s.placedCompany}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Role</span><span className="font-medium text-slate-900">{s.roleTitle}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Package</span><span className="font-medium text-slate-900">{s.packageLpa} LPA</span></div>
            <div className="flex justify-between"><span className="text-slate-500">CGPA</span><span className="font-medium text-slate-900">{s.cgpa}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────── Interventions Tab ────────────────────────── */

function InterventionsTab({
  interventions, mentees, expandedId, onToggleExpand, updatingAction, noteInput, onNoteChange, onToggleAction,
  onCreateIntervention, generating, generationError,
}: {
  interventions: MentorIntervention[];
  mentees: Mentee[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  updatingAction: string | null;
  noteInput: Record<string, string>;
  onNoteChange: (actionId: string, val: string) => void;
  onToggleAction: (interventionId: string, actionId: string, completed: boolean) => void;
  onCreateIntervention: (studentId: string) => void;
  generating: string | null;
  generationError: string | null;
}) {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNeedingPlans, setShowNeedingPlans] = useState(true);

  const studentIdsWithPlans = new Set(interventions.map((i) => i.studentId));
  const studentsNeedingPlans = mentees.filter((m) => !studentIdsWithPlans.has(m.studentId));

  const filtered = interventions.filter((intv) => {
    if (filterStatus !== 'ALL' && intv.status !== filterStatus) return false;
    if (filterPriority !== 'ALL' && intv.priority !== filterPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!intv.studentName?.toLowerCase().includes(q) && !intv.triggerReason.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Student Performance Analysis</h2>
        <p className="text-sm text-slate-500 mt-1">AI-powered analysis of student placement performance with personalized recommendations.</p>
      </div>

      {generationError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {generationError}
        </div>
      )}
      {generating && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600" />
          Running AI analysis... This may take a few seconds.
        </div>
      )}

      {studentsNeedingPlans.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowNeedingPlans(!showNeedingPlans)}
            className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-slate-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Pending Analysis</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{studentsNeedingPlans.length}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 text-slate-400 transition-transform ${showNeedingPlans ? 'rotate-180' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {showNeedingPlans && (
            <div className="border-t border-slate-200 divide-y divide-slate-100">
              {studentsNeedingPlans.map((m) => (
                <div key={m.studentId} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{m.name}</div>
                    <div className="text-xs text-slate-500">{m.registerNumber} &middot; CGPA: {m.cgpa}</div>
                  </div>
                  <button
                    onClick={() => onCreateIntervention(m.studentId)}
                    disabled={generating === m.studentId}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {generating === m.studentId ? (
                      <span className="flex items-center gap-1.5">
                        <span className="animate-spin inline-block rounded-full h-3 w-3 border-b-2 border-white" />
                        Analyzing...
                      </span>
                    ) : 'Run Analysis'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            placeholder="Search by student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
        >
          <option value="ALL">All Statuses</option>
          <option value="GENERATED">Generated</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
        >
          <option value="ALL">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">
            {interventions.length === 0
              ? 'No analyses yet. Run analysis for students from the Pending Analysis section above.'
              : 'No results match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((intv) => {
            const isExpanded = expandedId === intv.interventionId;
            const completedActions = intv.actions.filter((a) => a.isCompleted).length;
            const totalActions = intv.actions.length;
            const progress = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
            return (
              <div key={intv.interventionId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <button onClick={() => onToggleExpand(intv.interventionId)} className="flex-1 text-left hover:opacity-80 transition-opacity">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-slate-900">{intv.studentName}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityStyle[intv.priority] || 'bg-slate-100'}`}>{intv.priority}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[intv.status] || 'bg-slate-100'}`}>{intv.status.replace('_', ' ')}</span>
                        <span className="text-xs text-slate-400">{new Date(intv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{intv.triggerReason}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 max-w-xs bg-slate-100 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
                        <span className="text-xs text-slate-500">{completedActions}/{totalActions} actions</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <button
                        onClick={() => onCreateIntervention(intv.studentId)}
                        disabled={generating === intv.studentId}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                      >
                        {generating === intv.studentId ? (
                          <span className="flex items-center gap-1.5">
                            <span className="animate-spin inline-block rounded-full h-3 w-3 border-b-2 border-indigo-600" />
                            Analyzing...
                          </span>
                        ) : 'Re-analyze'}
                      </button>
                      <button onClick={() => onToggleExpand(intv.interventionId)} className="p-1 rounded hover:bg-slate-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-200">
                    <div className="px-6 py-4 bg-blue-50/50">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">AI Analysis</h4>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{intv.aiAnalysis}</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {intv.actions.map((action) => (
                        <div key={action.actionId} className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <button disabled={updatingAction === action.actionId} onClick={() => onToggleAction(intv.interventionId, action.actionId, !action.isCompleted)}
                              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${action.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-blue-400'} ${updatingAction === action.actionId ? 'opacity-50' : ''}`}>
                              {action.isCompleted && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${action.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{action.title}</span>
                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{action.actionType}</span>
                              </div>
                              <p className="text-sm text-slate-500 mt-0.5">{action.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                <span>Target: {action.targetWeakness}</span>
                                {action.dueDate && <span>Due: {action.dueDate}</span>}
                              </div>
                              {action.resources && action.resources.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {action.resources.map((r, i) => <a key={i} href={r} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Resource {i + 1}</a>)}
                                </div>
                              )}
                              {action.notes && <p className="text-xs text-green-600 mt-2">Notes: {action.notes}</p>}
                              {!action.isCompleted && (
                                <div className="mt-2">
                                  <input type="text" placeholder="Add notes before completing..." value={noteInput[action.actionId] || ''} onChange={(e) => onNoteChange(action.actionId, e.target.value)}
                                    className="w-full max-w-md text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-blue-400" />
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
}

/* ────────────────────────── Metrics Tab ────────────────────────── */

function MetricsTab({ metrics, loading }: { metrics: MentorMetrics | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!metrics) {
    return <div className="bg-white rounded-xl border border-slate-200 p-12 text-center"><p className="text-slate-500">No metrics data available.</p></div>;
  }

  const rateCards = [
    { label: 'Intervention Completion', value: metrics.interventionCompletionRate, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Action Completion', value: metrics.actionCompletionRate, color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'Improvement Rate', value: metrics.improvementRate, color: 'text-green-700', bg: 'bg-green-50' },
  ];

  const countCards = [
    { label: 'Total Interventions', value: metrics.totalInterventions, sub: `${metrics.completedInterventions} completed` },
    { label: 'Total Actions', value: metrics.totalActions, sub: `${metrics.completedActions} completed` },
    { label: 'Mentees Tracked', value: metrics.menteesTracked, sub: `${metrics.menteesImproved} improved` },
  ];

  return (
    <div className="space-y-6">
      {/* Rate cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {rateCards.map((c) => (
          <div key={c.label} className={`${c.bg} rounded-xl p-6 text-center`}>
            <div className={`text-3xl font-bold ${c.color}`}>{c.value}%</div>
            <div className={`text-sm font-medium mt-1 ${c.color} opacity-80`}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {countCards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="text-2xl font-bold text-slate-900">{c.value}</div>
            <div className="text-sm text-slate-500 mt-0.5">{c.label}</div>
            <div className="text-xs text-slate-400 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Per-mentee breakdown */}
      {metrics.menteeDetails.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Per-Mentee Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Rounds Before</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Pass Rate Before</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Rounds After</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Pass Rate After</th>
                  <th className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.menteeDetails.map((md) => {
                  const beforeRate = md.totalRoundsBefore > 0 ? Math.round((md.passedBefore / md.totalRoundsBefore) * 100) : 0;
                  const afterRate = md.totalRoundsAfter > 0 ? Math.round((md.passedAfter / md.totalRoundsAfter) * 100) : 0;
                  return (
                    <tr key={md.studentId} className="hover:bg-slate-50/80">
                      <td className="px-6 py-3 font-medium text-slate-900">{md.studentName}</td>
                      <td className="px-6 py-3 text-slate-600">{md.passedBefore}/{md.totalRoundsBefore}</td>
                      <td className="px-6 py-3 text-slate-600">{beforeRate}%</td>
                      <td className="px-6 py-3 text-slate-600">{md.passedAfter}/{md.totalRoundsAfter}</td>
                      <td className="px-6 py-3 text-slate-600">{afterRate}%</td>
                      <td className="px-6 py-3">
                        {md.improved
                          ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Improved</span>
                          : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">No change</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── Student Detail Panel ────────────────────────── */

function StudentDetailPanel({
  detail, loading, mentorId, onClose, onNoteCreated, onNoteUpdated, onNoteDeleted,
  onCreateIntervention, generating, generationError,
}: {
  detail: StudentDetail | null;
  loading: boolean;
  mentorId: string | null;
  onClose: () => void;
  onNoteCreated: (note: MentorNote) => void;
  onNoteUpdated: (note: MentorNote) => void;
  onNoteDeleted: (noteId: string) => void;
  onCreateIntervention: (studentId: string) => void;
  generating: string | null;
  generationError: string | null;
}) {
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddNote = async () => {
    if (!mentorId || !detail || !newNote.trim()) return;
    setSaving(true);
    try {
      const note = await createNote(mentorId, detail.studentId, newNote.trim());
      onNoteCreated(note);
      setNewNote('');
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!mentorId || !editContent.trim()) return;
    setSaving(true);
    try {
      const updated = await updateNote(mentorId, noteId, editContent.trim());
      onNoteUpdated(updated);
      setEditingId(null);
      setEditContent('');
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!mentorId) return;
    setDeletingId(noteId);
    try {
      await deleteNote(mentorId, noteId);
      onNoteDeleted(noteId);
    } catch { /* ignore */ }
    setDeletingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
        {/* Close button */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-900">
            {loading ? 'Loading...' : detail?.name || 'Student Detail'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : !detail ? (
          <div className="p-8 text-center text-sm text-slate-400">Failed to load student details.</div>
        ) : (
          <div className="p-6 space-y-8">
            {/* Profile Section */}
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Profile</h3>
              <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Register No.</span><div className="font-medium text-slate-900">{detail.registerNumber}</div></div>
                  <div><span className="text-slate-500">Email</span><div className="font-medium text-slate-900">{detail.email}</div></div>
                  <div><span className="text-slate-500">Department</span><div className="font-medium text-slate-900">{detail.department}</div></div>
                  <div><span className="text-slate-500">CGPA</span><div className="font-medium text-slate-900">{detail.cgpa}</div></div>
                  <div><span className="text-slate-500">10th %</span><div className="font-medium text-slate-900">{detail.tenthPercentage}%</div></div>
                  <div><span className="text-slate-500">12th %</span><div className="font-medium text-slate-900">{detail.twelfthPercentage}%</div></div>
                  {detail.placementMarks !== null && (
                    <div><span className="text-slate-500">Placement Marks</span><div className="font-medium text-slate-900">{detail.placementMarks}</div></div>
                  )}
                  {detail.resumePath && (
                    <div><span className="text-slate-500">Resume</span><div className="font-medium text-blue-600 text-xs truncate">{detail.resumePath}</div></div>
                  )}
                </div>
                {detail.skills && detail.skills.length > 0 && (
                  <div>
                    <span className="text-sm text-slate-500">Skills</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {detail.skills.map((s) => <span key={s} className="inline-block bg-white border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-full">{s}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Applications Section */}
            {detail.applications.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Job Applications ({detail.applications.length})</h3>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Company</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Role</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Rounds</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.applications.map((app) => (
                        <tr key={app.driveId}>
                          <td className="px-4 py-2 font-medium text-slate-900">{app.companyName}</td>
                          <td className="px-4 py-2 text-slate-600">{app.roleTitle}</td>
                          <td className="px-4 py-2 text-slate-600">{app.roundsCleared}/{app.totalRounds}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              app.finalStatus === 'SELECTED' ? 'bg-green-100 text-green-800' : app.finalStatus === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                            }`}>{app.finalStatus}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Interventions Section */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Interventions ({detail.interventions.length})</h3>
                <button
                  onClick={() => onCreateIntervention(detail.studentId)}
                  disabled={generating === detail.studentId}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
                >
                  {generating === detail.studentId ? (
                    <span className="flex items-center gap-1.5">
                      <span className="animate-spin inline-block rounded-full h-3 w-3 border-b-2 border-amber-600" />
                      Analyzing...
                    </span>
                  ) : 'Run Analysis'}
                </button>
              </div>
              {generationError && generating === null && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-3">
                  {generationError}
                </div>
              )}
              {detail.interventions.length > 0 && (
                <div className="space-y-3">
                  {detail.interventions.map((intv) => {
                    const done = intv.actions.filter((a) => a.isCompleted).length;
                    return (
                      <div key={intv.interventionId} className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityStyle[intv.priority] || 'bg-slate-100'}`}>{intv.priority}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[intv.status] || 'bg-slate-100'}`}>{intv.status.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm text-slate-700">{intv.triggerReason}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${intv.actions.length > 0 ? (done / intv.actions.length) * 100 : 0}%` }} /></div>
                          <span className="text-xs text-slate-400">{done}/{intv.actions.length}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Notes Section */}
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Mentor Notes ({detail.notes.length})</h3>

              {/* Add Note */}
              <div className="flex gap-2 mb-4">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a private observation or note..."
                  rows={2}
                  className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={saving || !newNote.trim()}
                  className="self-end bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? '...' : 'Save'}
                </button>
              </div>

              {/* Existing Notes */}
              {detail.notes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No notes yet. Add your first observation above.</p>
              ) : (
                <div className="space-y-3">
                  {detail.notes.map((note) => (
                    <div key={note.noteId} className="bg-slate-50 rounded-lg p-4">
                      {editingId === note.noteId ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={2}
                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateNote(note.noteId)} disabled={saving} className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                              {saving ? '...' : 'Update'}
                            </button>
                            <button onClick={() => { setEditingId(null); setEditContent(''); }} className="bg-slate-200 text-slate-700 px-3 py-1 rounded-md text-xs font-medium hover:bg-slate-300">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-slate-400">
                              {new Date(note.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {note.updatedAt !== note.createdAt && ' (edited)'}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setEditingId(note.noteId); setEditContent(note.content); }}
                                className="text-xs text-blue-600 hover:underline font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.noteId)}
                                disabled={deletingId === note.noteId}
                                className="text-xs text-red-500 hover:underline font-medium disabled:opacity-50"
                              >
                                {deletingId === note.noteId ? '...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
