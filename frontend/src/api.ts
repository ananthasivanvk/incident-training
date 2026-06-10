import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
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
  const { data: res } = await api.get(`/exam-results${qs.toString() ? `?${qs.toString()}` : ''}`);
  
  return res;
}

export async function gradeExamResult(resultId: number, payload: { grade: 'Competent' | 'Not Competent'; facultyComments?: string }) {
  const { data: res } = await api.post('/exam-results/grade', { resultId, ...payload });
  return res;
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
  const { data: res } = await api.get(`/api/formg1?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch FormG1: ${res.status} ${text}`);
  }
  const json = await res.json();
  // Expecting { success: true, row: {...} } or plain row
  if (json && json.success === false) throw new Error(json.message || 'Server returned error');
  return json.row ?? json.data ?? json;
}
