import type {
  Intervention,
  InterventionStatus,
  AtRiskStudent,
  StudentPattern,
} from '../types/intervention';

const API_BASE = 'http://localhost:8000/api/intervention';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const getCoordinators = (): Promise<{ coordinator_id: string; name: string; department: string }[]> =>
  request(`${API_BASE}/coordinators`);

export const getMentors = (): Promise<{ mentor_id: string; name: string; department: string; specialization: string | null }[]> =>
  request(`${API_BASE}/mentors`);

export const getMentorInterventions = (mentorId: string): Promise<Intervention[]> =>
  request(`${API_BASE}/mentor/${mentorId}`);

export const getStudentInterventions = (studentId: string): Promise<Intervention[]> =>
  request(`${API_BASE}/student/${studentId}/interventions`);

export const getAtRiskStudents = (minFailures = 2): Promise<AtRiskStudent[]> =>
  request(`${API_BASE}/at-risk?min_failures=${minFailures}`);

export const getStudentPattern = (studentId: string): Promise<StudentPattern> =>
  request(`${API_BASE}/pattern/${studentId}`);

export const listInterventions = (filters?: {
  status?: string;
  priority?: string;
  student_id?: string;
}): Promise<Intervention[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.student_id) params.set('student_id', filters.student_id);
  const qs = params.toString();
  return request(`${API_BASE}/${qs ? `?${qs}` : ''}`);
};

export const getIntervention = (interventionId: string): Promise<Intervention> =>
  request(`${API_BASE}/${interventionId}`);

export const createIntervention = (
  studentId: string,
  coordinatorId: string,
): Promise<Intervention> =>
  request(`${API_BASE}/${studentId}`, {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, coordinator_id: coordinatorId }),
  });

export const updateInterventionStatus = (
  interventionId: string,
  status: InterventionStatus,
  mentorId?: string,
): Promise<Intervention> =>
  request(`${API_BASE}/${interventionId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(mentorId && { mentor_id: mentorId }) }),
  });

export const updateActionStatus = (
  interventionId: string,
  actionId: string,
  isCompleted: boolean,
  notes?: string,
): Promise<Intervention> =>
  request(`${API_BASE}/${interventionId}/actions/${actionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_completed: isCompleted, ...(notes && { notes }) }),
  });
