import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import App from './App'
import './index.css'
import { LoginPage } from './components/LoginPage'
import TraditionalLoginPage from './components/TraditionalLoginPage'
import { StudentDashboard } from './components/StudentDashboard'
import { FacultyDashboard } from './components/FacultyDashboard'
import { PracticeSetup } from './components/PracticeSetup'
import QuestionView from './components/QuestionView'
import ExamResults from './components/ExamResults'
import { UserManagement } from './components/UserManagement'
import { ExamCompletionScreen } from './components/ExamCompletionScreen'
import Formg from './components/Formg'
import Formg1 from './components/Formg1'


function extractDisplayName(user: any): string | null {
  if (!user) return null;
  const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  const firstLast = (() => {
    const f = str(user.firstName) || str(user.FirstName) || str(user.givenName);
    const l = str(user.lastName)  || str(user.LastName)  || str(user.familyName);
    if (f && l) return `${f} ${l}`;
    if (f) return f;
    return null;
  })();

  const candidates = [
    str(user.FullName),
    str(user.fullName),
    str(user.displayName),
    str(user.DisplayName),
    str(user.name),
    str(user.Name),
    str(user.userName),
    str(user.UserName),
    str(user.username),
    str(user.Username),
    firstLast,
  ];

  for (const c of candidates) {
    if (c) return c;
  }
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const raw = localStorage.getItem('user')
  let user = null
  try { user = raw ? JSON.parse(raw) : null } catch { user = null }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function LoginRoute() {
  const navigate = useNavigate()
  const handleSignIn = () => {
    // navigate to the legacy/traditional login screen
    navigate('/traditional-login', { replace: true })
  }
  return <LoginPage onSignIn={handleSignIn} />
}

function StudentWrapper() {
  const navigate = useNavigate();
  const raw = localStorage.getItem('user');

  let username = 'Student';
  try {
    const u = raw ? JSON.parse(raw) : null;
    const extracted = extractDisplayName(u);
    username = extracted || u?.username || 'Student';
  } catch {
    username = 'Student';
  }

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleStartMode = (mode: 'practice' | 'exam') => {
    if (mode === 'practice') navigate('/practice');
    else navigate('/practice?mode=exam');
  };

  return (
    <RequireAuth>
      <StudentDashboard
        userName={username}
        onLogout={handleLogout}
        onStartMode={handleStartMode}
      />
    </RequireAuth>
  );
}

// PracticeWrapper: reads ?mode=exam (or default 'practice') and supplies onBack.

function PracticeWrapper() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const rawMode = params.get('mode')
  const mode: 'practice' | 'exam' = rawMode === 'exam' ? 'exam' : 'practice'

  const handleBack = () => {
    navigate('/student')
  }

  return (
    <RequireAuth>
      <PracticeSetup
        mode={mode}
        onBack={handleBack}
      />
    </RequireAuth>
  )
}

/**
 * QuestionWrapper
 *
 * A React component that determines the display mode for a question view (either "practice" or "exam")
 * based on the "mode" query parameter in the current location, and renders a protected QuestionView
 * inside a RequireAuth wrapper.
 *
 * Behavior:
 * - Reads the current location's query string and extracts the "mode" parameter.
 * - Normalizes the mode to either 'exam' or 'practice' (defaults to 'practice' for any non-'exam' value).
 * - Creates a back handler that:
 *   - navigates backwards in history if there is a previous entry (window.history.length > 1),
 *   - otherwise navigates to the '/practice' route as a fallback.
 * - Passes the resolved mode and the back handler to the QuestionView component.
 *
 * Hooks used:
 * - useNavigate() to perform imperative navigation.
 * - useLocation() to access the current URL and query parameters.
 *
 * Side effects:
 * - Uses navigation to change the current route when the back handler is invoked.
 *
 * @returns {JSX.Element} A RequireAuth-wrapped QuestionView configured with an onBack handler and the resolved mode.
 */
function QuestionWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rawMode = params.get('mode');
  const mode: 'practice' | 'exam' = rawMode === 'exam' ? 'exam' : 'practice';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/practice');
    }
  };

  return (
    <RequireAuth>
      <QuestionView onBack={handleBack} mode={mode} />
    </RequireAuth>
  );
}

/**
 * ExamCompleteRoute
 *
 * Route component that renders the exam completion screen for a student.
 *
 * This component:
 * - Reads navigation state from the current location (via useLocation()) and
 *   extracts the following optional values from location.state:
 *   - scenario: string identifying the scenario shown on the completion screen
 *   - date: display date for the completion event; if not provided, a localized
 *     default is produced using new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
 *   - timeTaken: string describing the duration the student spent on the exam
 * - Provides a handleReturn callback that navigates the user back to the student
 *   dashboard route ('/student') and replaces the current history entry.
 * - Wraps the ExamCompletionScreen inside a RequireAuth component to ensure the
 *   route is only accessible to authenticated users.
 *
 * Notes:
 * - The component assumes location.state may be any shape; callers should prefer
 *   to pass a well-typed state object when navigating to this route.
 * - The date default uses the 'en-US' locale with a short month name; modify
 *   formatting as needed for different locales.
 *
 * @returns JSX.Element - the route UI (RequireAuth -> ExamCompletionScreen)
 */
function ExamCompleteRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as any) || {};
  const scenario = state.scenario || '';
  const date = state.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeTaken = state.timeTaken || '';

  const handleReturn = () => {
    navigate('/student', { replace: true });
  };

  return (
    <RequireAuth>
      <ExamCompletionScreen
        scenario={scenario}
        date={date}
        timeTaken={timeTaken}
        onReturnToDashboard={handleReturn}
      />
    </RequireAuth>
  );
}

function FacultyWrapper() {
  const navigate = useNavigate();
  const raw = localStorage.getItem('user');

  let username = 'Faculty';
  try {
    const u = raw ? JSON.parse(raw) : null;
    const extracted = extractDisplayName(u);
    username = extracted || u?.username || 'Faculty';
  } catch {
    username = 'Faculty';
  }

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleNavigate = (page: string) => {
    if (page === 'userManagement') {
      navigate('/faculty/user-management');
    } else if (page === 'examResults') {
      navigate('/faculty/exam-results');
    } else {
      navigate('/faculty');
    }
  };

  return (
    <RequireAuth>
      <FacultyDashboard onLogout={handleLogout} onNavigate={handleNavigate} />
    </RequireAuth>
  );
}

// Wrappers that provide a working `onBack` using useNavigate()
function FacultyUserManagementRoute() {
  const navigate = useNavigate();
  return (
    <RequireAuth>
      <UserManagement onBack={() => navigate('/faculty')} />
    </RequireAuth>
  );
}

function FacultyExamResultsRoute() {
  const navigate = useNavigate();
  return (
    <RequireAuth>
      <ExamResults onBack={() => navigate('/faculty')} />
    </RequireAuth>
  );
}

function FormgWrapper() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as any) || {};
  const qs = new URLSearchParams(location.search);

  // Prefer explicit navigation state; fall back to query params
  const isReadOnly = state.readOnly === true || qs.get('readOnly') === '1';
  const studentId = state.studentId ?? qs.get('studentId') ?? qs.get('studentid') ?? null;
  const questionId = state.questionId ?? qs.get('questionId') ?? qs.get('questionid') ?? null;
  const mode = state.mode ?? qs.get('mode') ?? 'exam';

  // Dev-only logging to inspect incoming values (safe to keep, but will be trimmed in production)
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[FormgWrapper] location.state:', state);
      console.log('[FormgWrapper] location.search:', location.search);
      console.log('[FormgWrapper] derived:', { isReadOnly, studentId, questionId, mode });
    }
  }, [location.search, state, isReadOnly, studentId, questionId, mode]);

  if (isReadOnly) {
    // Sanity check
    if (!studentId || !questionId) {
      navigate('/student', { replace: true });
      return null;
    }
    return <Formg initialValues={undefined} readOnly={true} showSRASection={true} />;
  }

  return (
    <RequireAuth>
      <Formg onCancel={() => { window.history.length > 1 ? window.history.back() : window.location.assign('/student'); }} />
    </RequireAuth>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/traditional-login" element={<TraditionalLoginPage />} />
        <Route path="/student" element={<StudentWrapper />} />
        <Route path="/faculty" element={<FacultyWrapper />} />
        <Route path="/faculty/user-management" element={<FacultyUserManagementRoute />} />
        <Route path="/faculty/exam-results" element={<FacultyExamResultsRoute />} />
        <Route path="/practice" element={<PracticeWrapper />} />
        <Route path="/question-view" element={<QuestionWrapper />} />
        <Route path="/form-g" element={<FormgWrapper />} />
        <Route path="/form-g1" element={<RequireAuth><Formg1 onSaveDraft={() => {}} onSubmit={() => {}} /></RequireAuth>} />
        <Route path="/results" element={<RequireAuth><ExamResults onBack={() => {}} /></RequireAuth>} />
        <Route path="*" element={<App />} />
        <Route path="/exam-complete" element={<ExamCompleteRoute />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)