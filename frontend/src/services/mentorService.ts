import type {
  MentorDashboard,
  MentorProfile,
  Mentee,
  PlacedMentee,
  ViewRoundsResponse,
  MentorIntervention,
  MentorNote,
  MentorMetrics,
  StudentDetail,
} from '../types/mentor';
import { apiGet, apiPost, apiPatch, apiDelete } from './api';

export const listMentors = async (): Promise<MentorProfile[]> => {
  return apiGet<MentorProfile[]>('/api/mentor/');
};

export const getMentorDashboard = async (mentorId: string): Promise<MentorDashboard> => {
  return apiGet<MentorDashboard>(`/api/mentor/${mentorId}/dashboard`);
};

export const getMentees = async (mentorId: string): Promise<Mentee[]> => {
  return apiGet<Mentee[]>(`/api/mentor/${mentorId}/students`);
};

export const getPlacedMentees = async (mentorId: string): Promise<PlacedMentee[]> => {
  return apiGet<PlacedMentee[]>(`/api/mentor/${mentorId}/placed-students`);
};

export const getMenteeRounds = async (
  mentorId: string,
  studentId: string,
): Promise<ViewRoundsResponse | null> => {
  try {
    return await apiGet<ViewRoundsResponse>(`/api/mentor/${mentorId}/students/${studentId}/rounds`);
  } catch {
    return null;
  }
};

export const getMentorInterventions = async (mentorId: string): Promise<MentorIntervention[]> => {
  return apiGet<MentorIntervention[]>(`/api/mentor/${mentorId}/interventions`);
};

export const updateActionProgress = async (
  mentorId: string,
  interventionId: string,
  actionId: string,
  isCompleted: boolean,
  notes: string | null,
): Promise<MentorIntervention | null> => {
  try {
    return await apiPatch<MentorIntervention>(
      `/api/mentor/${mentorId}/interventions/${interventionId}/actions/${actionId}`,
      { isCompleted, notes },
    );
  } catch {
    return null;
  }
};

export const createIntervention = async (
  mentorId: string,
  studentId: string,
  coordinatorId: string,
): Promise<MentorIntervention> => {
  return apiPost<MentorIntervention>(`/api/mentor/${mentorId}/interventions`, {
    studentId,
    coordinatorId,
  });
};

export const getStudentDetail = async (
  mentorId: string,
  studentId: string,
): Promise<StudentDetail | null> => {
  try {
    return await apiGet<StudentDetail>(`/api/mentor/${mentorId}/students/${studentId}/detail`);
  } catch {
    return null;
  }
};

export const getMentorMetrics = async (mentorId: string): Promise<MentorMetrics> => {
  return apiGet<MentorMetrics>(`/api/mentor/${mentorId}/metrics`);
};

export const getStudentNotes = async (
  mentorId: string,
  studentId: string,
): Promise<MentorNote[]> => {
  return apiGet<MentorNote[]>(`/api/mentor/${mentorId}/students/${studentId}/notes`);
};

export const createNote = async (
  mentorId: string,
  studentId: string,
  content: string,
): Promise<MentorNote> => {
  return apiPost<MentorNote>(`/api/mentor/${mentorId}/students/${studentId}/notes`, { content });
};

export const updateNote = async (
  mentorId: string,
  noteId: string,
  content: string,
): Promise<MentorNote> => {
  return apiPatch<MentorNote>(`/api/mentor/${mentorId}/notes/${noteId}`, { content });
};

export const deleteNote = async (mentorId: string, noteId: string): Promise<void> => {
  await apiDelete<unknown>(`/api/mentor/${mentorId}/notes/${noteId}`);
};

export const getCoordinators = async (): Promise<{ coordinatorId: string; name: string }[]> => {
  return apiGet<{ coordinatorId: string; name: string }[]>('/api/coordinator/');
};
