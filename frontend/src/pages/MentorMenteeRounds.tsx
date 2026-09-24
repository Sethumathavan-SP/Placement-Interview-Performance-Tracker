import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ViewRoundsResponse } from '../types/mentor';
import { getMenteeRounds } from '../services/mentorService';

const MENTOR_ID = 'mentor-1';

const resultBadge = (result: string) => {
  if (result === 'PASSED') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Passed</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>;
};

export const MentorMenteeRounds = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ViewRoundsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    getMenteeRounds(MENTOR_ID, studentId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-slate-500">No round data found for this student.</p>
        <button onClick={() => navigate('/mentor/students')} className="mt-4 text-blue-600 text-sm font-medium hover:underline">
          Back to Mentees
        </button>
      </div>
    );
  }

  const passRate = data.totalRoundsAttempted > 0
    ? Math.round((data.roundsPassed / data.totalRoundsAttempted) * 100)
    : 0;

  const driveGroups = data.rounds.reduce<Record<string, typeof data.rounds>>((acc, round) => {
    const key = `${round.driveId}-${round.companyName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(round);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto">
      <button
        onClick={() => navigate('/mentor/students')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 mb-4 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Mentees
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{data.studentName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {data.department} &middot; CGPA: {data.cgpa}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{data.totalDrives}</div>
          <div className="text-xs text-slate-500 mt-1">Drives Attempted</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{data.totalRoundsAttempted}</div>
          <div className="text-xs text-slate-500 mt-1">Total Rounds</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-green-600">{data.roundsPassed}</div>
          <div className="text-xs text-slate-500 mt-1">Passed</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-red-600">{data.roundsFailed}</div>
          <div className="text-xs text-slate-500 mt-1">Failed ({100 - passRate}% failure rate)</div>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(driveGroups).map(([key, rounds]) => {
          const first = rounds[0];
          return (
            <div key={key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{first.companyName}</h3>
                    <p className="text-sm text-slate-500">{first.roleTitle} &middot; {first.driveDate}</p>
                  </div>
                  <div className="text-sm text-slate-500">
                    {rounds.filter((r) => r.result === 'PASSED').length}/{rounds.length} rounds cleared
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {rounds.map((round) => (
                  <div key={`${round.driveId}-${round.roundNumber}`} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-400">R{round.roundNumber}</span>
                          <span className="text-sm font-semibold text-slate-900">{round.roundName}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{round.roundType}</span>
                          {resultBadge(round.result)}
                        </div>
                        {round.score !== null && (
                          <p className="text-sm text-slate-500 mt-1">
                            Score: {round.score}/{round.maxScore}
                          </p>
                        )}
                        {round.rejectionReason && (
                          <p className="text-sm text-red-600 mt-1">
                            Reason: {round.rejectionReason}
                          </p>
                        )}
                        {round.feedback && (
                          <p className="text-sm text-slate-500 mt-1">
                            Feedback: {round.feedback}
                          </p>
                        )}
                        {round.weaknessArea && (
                          <span className="inline-block mt-2 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                            Weakness: {round.weaknessArea}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
