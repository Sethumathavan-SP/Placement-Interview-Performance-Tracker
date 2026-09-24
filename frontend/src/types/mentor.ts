export interface MentorProfile {
  mentorId: string;
  name: string;
  email: string;
  department: string;
  specialization: string | null;
  maxMentees: number;
  currentMenteeCount: number;
}

export interface Mentee {
  studentId: string;
  name: string;
  registerNumber: string;
  department: string;
  email: string;
  cgpa: number;
  placementMarks: number | null;
  skills: string[] | null;
  assignedAt: string;
}

export interface PlacedMentee {
  studentId: string;
  name: string;
  registerNumber: string;
  department: string;
  cgpa: number;
  placedCompany: string;
  roleTitle: string;
  packageLpa: number;
}

export interface MentorDashboard {
  mentor: MentorProfile;
  totalMentees: number;
  placedMentees: number;
  atRiskMentees: number;
  activeInterventions: number;
  pendingActions: number;
}

export interface MenteeRound {
  driveId: string;
  companyName: string;
  roleTitle: string;
  driveDate: string;
  roundNumber: number;
  roundName: string;
  roundType: string;
  result: 'PASSED' | 'FAILED';
  score: number | null;
  maxScore: number | null;
  rejectionReason: string | null;
  feedback: string | null;
  weaknessArea: string | null;
  attemptDate: string;
}

export interface ViewRoundsResponse {
  studentId: string;
  studentName: string;
  department: string;
  cgpa: number;
  totalDrives: number;
  totalRoundsAttempted: number;
  roundsPassed: number;
  roundsFailed: number;
  rounds: MenteeRound[];
}

export interface InterventionAction {
  actionId: string;
  actionType: string;
  title: string;
  description: string;
  targetWeakness: string;
  resources: string[] | null;
  isCompleted: boolean;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
}

export interface MentorIntervention {
  interventionId: string;
  studentId: string;
  studentName: string | null;
  coordinatorId: string;
  triggerReason: string;
  aiAnalysis: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  createdAt: string;
  updatedAt: string;
  actions: InterventionAction[];
}

export interface MentorNote {
  noteId: string;
  mentorId: string;
  studentId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MenteeMetric {
  studentId: string;
  studentName: string;
  totalRoundsBefore: number;
  passedBefore: number;
  totalRoundsAfter: number;
  passedAfter: number;
  improved: boolean;
}

export interface MentorMetrics {
  mentorId: string;
  totalInterventions: number;
  completedInterventions: number;
  interventionCompletionRate: number;
  totalActions: number;
  completedActions: number;
  actionCompletionRate: number;
  menteesImproved: number;
  menteesTracked: number;
  improvementRate: number;
  menteeDetails: MenteeMetric[];
}

export interface StudentJobApplication {
  driveId: string;
  companyName: string;
  roleTitle: string;
  packageLpa: number;
  driveDate: string;
  finalStatus: string;
  roundsCleared: number;
  totalRounds: number;
}

export interface StudentDetail {
  studentId: string;
  name: string;
  registerNumber: string;
  email: string;
  department: string;
  cgpa: number;
  tenthPercentage: number;
  twelfthPercentage: number;
  placementMarks: number | null;
  skills: string[] | null;
  resumePath: string | null;
  rounds: MenteeRound[];
  applications: StudentJobApplication[];
  interventions: MentorIntervention[];
  notes: MentorNote[];
}
