export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type InterventionStatus =
  | 'GENERATED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DISMISSED';

export interface InterventionAction {
  action_id: string;
  action_type: string;
  title: string;
  description: string;
  target_weakness: string;
  resources: string[] | null;
  assigned_to: string | null;
  is_completed: boolean;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface Intervention {
  intervention_id: string;
  student_id: string;
  coordinator_id: string;
  mentor_id: string | null;
  trigger_reason: string;
  failure_summary: Record<string, unknown>;
  ai_analysis: string;
  recommendations: Record<string, unknown>[];
  priority: Priority;
  status: InterventionStatus;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  completed_at: string | null;
  actions: InterventionAction[];
}

export interface AtRiskStudent {
  student_id: string;
  student_name: string;
  department: string;
  cgpa: number;
  total_failures: number;
}

export interface StudentPattern {
  student_id: string;
  student_name: string;
  department: string;
  cgpa: number;
  total_drives_attempted: number;
  total_drives_cleared: number;
  failure_by_round_type: Record<string, number>;
  weakness_areas: Record<string, number>;
  score_trend: number[];
  failure_trend: string;
  always_clears: string[];
  biggest_bottleneck: string | null;
}
