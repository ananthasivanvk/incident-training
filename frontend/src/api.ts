import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export default api;

export type ExamResult = {
  resultId: number;
  studentId: number;
  student: string;
  scenario: string;
  criterion: string;
  question: string;
  studentAnswer: string;
  facultyFeedback?: string | null;
  grade?: 'Competent' | 'Not Competent';
  date: string | null;
  needsGrading: boolean;

  // New metadata from server:
  questionType?: string; // e.g. 'mcq-single', 'mcq-multiselect', '5-whys', etc.
  options?: any; // could be array or JSON string
  correctAnswers?: any; // could be array or JSON string
  fiveWhys?: any; // could be array or JSON string
};

export async function fetchExamResults(params?: { studentId?: string | number; limit?: number }): Promise<ExamResult[]> {
  const qs = new URLSearchParams();
  if (params?.studentId) qs.set('studentId', String(params.studentId));
  if (params?.limit) qs.set('limit', String(params.limit));
  const res = await fetch(`/api/exam-results${qs.toString() ? `?${qs.toString()}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch exam results');
  return res.json();
}

export async function gradeExamResult(resultId: number, payload: { grade: 'Competent' | 'Not Competent'; facultyComments?: string }) {
  const res = await fetch('/api/exam-results/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resultId, ...payload }),
  });
  if (!res.ok) throw new Error('Failed to update grade');
  return res.json();
}

// Fetch a saved Form G row by identifiers.
// Accepts either studentId / studentid, modeofexam, questionid.
export async function fetchFormG(params: { studentId?: string | number; modeofexam?: string; questionid?: string | number }) {
  const { studentId, modeofexam, questionid } = params || {};
  const res = await api.get('/formg', {
    params: {
      studentId,
      modeofexam,
      questionid,
    },
  });
  return res.data;
}

// frontend/src/api.ts
export async function fetchFormG1({ studentId, mode, questionId }: { studentId: string; mode: string; questionId: string; }) {
  const params = new URLSearchParams();
  params.set('studentId', String(studentId));
  params.set('modeofexam', String(mode));
  params.set('questionId', String(questionId));
  const res = await fetch(`/api/formg1?${params.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch FormG1: ${res.status} ${text}`);
  }
  const json = await res.json();
  // Expecting { success: true, row: {...} } or plain row
  if (json && json.success === false) throw new Error(json.message || 'Server returned error');
  return json.row ?? json.data ?? json;
}
