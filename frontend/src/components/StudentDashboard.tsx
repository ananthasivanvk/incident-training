import {
  BookOpen,
  FileCheck,
  Eye,
} from "lucide-react";
import { ViewResultsModal } from './ViewResultsModal';
import { useState, useEffect } from "react";
import api from '../api';

/**
 * Properties for the StudentDashboard component.
 *
 * userName
 *   The display name of the currently authenticated student shown in the dashboard header.
 *
 * onStartMode
 *   Callback invoked when the student starts a session. Receives a single argument indicating the chosen
 *   mode: "practice" | "exam".
 *
 * onLogout
 *   Callback invoked to sign the user out of the application.
 *
 * recentResults
 *   Optional array of recent attempt summaries for the student. Each entry includes:
 *     - date: ISO 8601 date string representing when the attempt occurred.
 *     - scenario: Human-readable name or identifier of the scenario attempted.
 *     - score: Resulting score as a string (for example "85/100" or "Pass/Fail").
 *     - status: One of "pending" | "completed" | "practice" indicating the state of the attempt.
 */
interface StudentDashboardProps {
  userName: string;
  onStartMode: (mode: "practice" | "exam") => void;
  onLogout: () => void;
  recentResults?: Array<{
    date: string;
    scenario: string;
    score: string;
    status: "pending" | "completed" | "practice";
  }>;
}

/**
 * StudentDashboard
 *
 * Top-level student dashboard component that displays mode selection (Practice / Exam),
 * and a paginated list of recent activity/results. The component normalizes a variety
 * of possible backend result shapes into a consistent display model and provides a
 * lightweight "view" flow for individual results.
 *
 * Behavior & responsibilities
 * - Accepts an optional pre-fetched list of recent results via `recentResults`. If not
 *   provided it will attempt to load results for the current user from the API using
 *   the `user` object stored in localStorage (expects JSON with `UserId`). The API
 *   request uses `api.get('/results?studentId=...&limit=200')` and the component paginates
 *   client-side.
 * - Normalizes result records to a consistent shape (see normalizeResults):
 *   - Accepts many alternative field names for scenario/criterion, dates, grades, status, etc.
 *   - Formats many date-like inputs into human-readable strings via `formatDateVal`.
 *   - Maps grade values (numeric or textual) into human labels such as "Competent",
 *     "Not Competent", or a preserved string; uses '--' when unknown.
 *   - Derives a status label ("pending", "completed", "practice", etc.) from multiple
 *     potential fields.
 * - Supports client-side pagination with page size 5 and a compact page number renderer.
 *   If currentPage becomes greater than the computed total pages the component clamps it
 *   back to the last page (uses a micro task via setTimeout to set state synchronously-safe).
 * - Provides a "View" flow that derives a selectedResult object with fields useful for
 *   the view modal (student, scenario, grade, date, question, studentAnswer, facultyFeedback,
 *   needsGrading, raw). The modal is rendered via <ViewResultsModal result={...} />.
 * - Shows loading state while fetching and a friendly "No recent results" row when empty.
 * - Exposes two mode-start callbacks (via buttons): `onStartMode("practice")` and
 *   `onStartMode("exam")`, and an `onLogout` callback.
 *
 * Props
 * @param props.userName - Display name of the signed-in student (used in header and fallback values).
 * @param props.onStartMode - Callback invoked when a mode is started. Called with a string mode
 *                            ("practice" | "exam") depending on which card is clicked.
 * @param props.onLogout - Callback invoked when the Logout button is clicked.
 * @param props.recentResults - Optional array of raw result records. If provided the component
 *                              uses these instead of fetching from the API. Records may use a
 *                              variety of field names; normalizeResults will attempt to map them.
 *
 * State (implementation notes)
 * - showProfileMenu: boolean (controls a profile menu — present but not displayed in markup excerpt).
 * - resultsState: Array<any> | null (normalized results used for display).
 * - loadingResults: boolean (fetch in-progress indicator).
 * - currentPage: number (1-based current page).
 * - pageSize: number (constant, 5).
 * - showViewModal: boolean (controls visibility of result viewer modal).
 * - selectedResult: any | null (normalized result details passed to ViewResultsModal).
 *
 * Side effects & data access
 * - Reads localStorage.getItem('user') and expects a parsed object with `UserId` if
 *   `recentResults` is not supplied.
 * - Calls `api.get('/results?...')` to fetch results. Errors are caught, logged, and an
 *   empty result set is used as fallback.
 *
 * Accessibility & UX
 * - Displays simple status badges ("PENDING", "COMPLETED", or other upper-cased status).
 * - Uses a loading row, an empty-state row, and hover states for interactive rows.
 * - Pagination includes previous/next buttons and a compact page-number renderer with ellipses.
 *
 * Example
 * <StudentDashboard
 *   userName="Jane Doe"
 *   onStartMode={(mode) => console.log('start', mode)}
 *   onLogout={() => console.log('logout')}
 *   recentResults={fetchedResults}
 * />
 *
 * Returns
 * @returns JSX.Element - the rendered dashboard UI.
 */
export function StudentDashboard({
  userName,
  onStartMode,
  onLogout,
  recentResults,
}: StudentDashboardProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [resultsState, setResultsState] = useState<Array<any> | null>(recentResults ?? null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Helper: parse/format a date-like value into a readable string (or '--')
  function formatDateVal(val: any) {
    if (val === null || val === undefined || val === '') return '--';
    if (typeof val === 'number') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleString();
      return String(val);
    }
    if (typeof val === 'string') {
      // numeric timestamp string?
      if (/^\d+$/.test(val)) {
        const d = new Date(parseInt(val, 10));
        if (!isNaN(d.getTime())) return d.toLocaleString();
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleString();
      return val;
    }
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    } catch {}
    return String(val);
  }

  
  /**
   * Normalize an array of raw result objects into a consistent shape for display.
   *
   * This function is defensive about the various shapes and field names that
   * incoming result objects may have. It accepts a possibly null/undefined array
   * and maps each input object to a normalized object with predictable properties:
   * - resultId: canonical identifier (if present)
   * - date: human-readable formatted date (via formatDateVal)
   * - scenario: human-friendly label derived from PC/criterion and short summary
   * - criterion: raw PC/criterion identifier (empty string when not available)
   * - grade: human-friendly grade label (e.g. "Competent", "Not Competent", numeric or original string)
   * - status: practice/exam status normalized to 'pending' | 'completed' | 'practice'
   * - raw: the original input object for reference
   *
   * Field discovery rules
   * - Criterion / PC: accepts any of r.PC, r.criterion, r.criterionId, r.PCId.
   * - Short summary: accepts any of r.ShortSummary, r.shortSummary, r.summary, r.Short.
   * - Scenario label construction: if both PC and shortSummary exist, returns "PC : shortSummary";
   *   otherwise prefers shortSummary, then PC, then r.ScenarioId, then r.scenario, then "--".
   * - Date fields: accepts common date/timestamp variants (CreatedDate, createdDate,
   *   CreatedAt, createdAt, Date, date, created_on, createdOn, timestamp, Timestamp, created).
   *   The extracted raw date value is passed to formatDateVal to produce the returned date string.
   * - Result id: accepts r.ResultId or r.resultId.
   *
   * Grade normalization rules
   * - Looks for r.Grade or r.grade.
   * - If missing, the returned grade is the placeholder "--".
   * - If the grade is the string "competent" (case-insensitive) it becomes "Competent".
   * - If the grade is "not competent" (allows -, _, or spaces between words, case-insensitive) it becomes "Not Competent".
   * - If the grade parses as a number:
   *   - numeric values extremely close to 1 are treated as "Competent";
   *   - numeric values extremely close to 0 are treated as "Not Competent";
   *   - otherwise the original numeric/string representation is preserved.
   * - Any other non-numeric string is returned (trimmed) as-is.
   *
   * Status / practice detection
   * - Accepts r.PracticeStatus, r.practiceStatus, or r.status.
   * - If the practice value is "exam": status is "pending" when no grade is present, otherwise "completed".
   * - If the practice value is one of "pending", "completed", or "practice", that value is used as the status.
   * - All other/missing practice values default to "pending".
   *
   * Behavior
   * - The input may be null/undefined; the function returns [] in that case.
   * - Each returned entry includes the original object under the `raw` key for debugging/inspection.
   *
   * @param arr - Array of raw result objects (may be heterogeneous); null/undefined treated as empty array.
   * @returns Array of normalized result objects with the shape:
   *   {
   *     resultId: string | number | null,
   *     date: string,
   *     scenario: string,
   *     criterion: string,
   *     grade: string,
   *     status: string,
   *     raw: any
   *   }
   */
  function normalizeResults(arr: Array<any>) {
    return (arr || []).map((r: any) => {
      // Try many possible fields for PC/criterion and short summary
      const pc = r.PC ?? r.criterion ?? r.criterionId ?? r.PCId ?? null;
      const shortSummary = r.ShortSummary ?? r.shortSummary ?? r.summary ?? r.Short ?? null;

      let scenarioLabel = '';
      if (pc && shortSummary) {
        scenarioLabel = `${pc} : ${shortSummary}`;
      } else if (shortSummary) {
        scenarioLabel = shortSummary;
      } else if (pc) {
        scenarioLabel = pc;
      } else {
        scenarioLabel = r.ScenarioId ? String(r.ScenarioId) : (r.scenario || '--');
      }

      // Accept many date field names and format them
      const dateVal =
        r.CreatedDate ??
        r.createdDate ??
        r.CreatedAt ??
        r.createdAt ??
        r.Date ??
        r.date ??
        r.created_on ??
        r.createdOn ??
        r.timestamp ??
        r.Timestamp ??
        r.created ??
        null;

      const dateStr = formatDateVal(dateVal);

      // grade can be stored under many names and as number or string
      const rawGrade = r.Grade != null ? r.Grade : (r.grade != null ? r.grade : null);

      // Map numeric/string grades to human labels when applicable
      let gradeLabel = '--';
      if (rawGrade != null) {
        const gStr = String(rawGrade).trim();
        if (/^competent$/i.test(gStr)) {
          gradeLabel = 'Competent';
        } else if (/^not[\s_-]?competent$/i.test(gStr)) {
          gradeLabel = 'Not Competent';
        } else {
          const num = Number(gStr);
          if (!Number.isNaN(num)) {
            // treat close-to-1 as Competent, close-to-0 as Not Competent
            if (Math.abs(num - 1) < 1e-9) gradeLabel = 'Competent';
            else if (Math.abs(num - 0) < 1e-9) gradeLabel = 'Not Competent';
            else gradeLabel = String(gStr);
          } else {
            gradeLabel = gStr;
          }
        }
      }
      
      // Practice/status detection (use original fields where present)
      const practice = r.PracticeStatus || r.practiceStatus || r.status || null;
      let statusLabel = 'pending';
      if (practice === 'exam') {
        statusLabel = rawGrade == null ? 'pending' : 'completed';
      } else if (practice === 'pending' || practice === 'completed' || practice === 'practice') {
        statusLabel = practice;
      } else {
        statusLabel = 'pending';
      }

      return {
        resultId: r.ResultId || r.resultId || null,
        date: dateStr,
        scenario: scenarioLabel,
        criterion: pc || '',
        grade: gradeLabel,
        status: statusLabel,
        raw: r,
      };
    });
  }

  // compute derived pagination values
  const totalItems = (resultsState || []).length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (currentPage > totalPages) {
    // clamp (non-state side-effect safe because synchronous render)
    setTimeout(() => setCurrentPage(totalPages), 0);
  }
  const startIndex = (currentPage - 1) * pageSize;
  const displayedResults = (resultsState || []).slice(startIndex, startIndex + pageSize);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const handleViewClick = (res: any) => {
    // res is the normalized display object created by normalizeResults
    const raw = res.raw || {};
    const studentName = raw.StudentName || raw.student || userName || '';
    const questionText = raw.QuestionText || raw.question || raw.Question || '';
    const studentAnswer = raw.StudentAnswer || raw.studentAnswer || raw.chosenAnswer || raw.ChosenAnswer || raw.answer || raw.studentAnswerText || '';
    const facultyFeedback = raw.FacultyComments || raw.facultyComments || raw.facultyFeedback || raw.facultyFeedback || '';
    const needsGrading = res.status === 'pending' || raw.NeedsGrading || raw.needsGrading || false;
    
    setSelectedResult({
      student: studentName,
      scenario: res.scenario,
      grade: res.grade === '--' ? undefined : res.grade,
      date: res.date,
      question: questionText,
      studentAnswer,
      facultyFeedback,
      needsGrading,
      raw
    });
    setShowViewModal(true);
  };

  const getPageNumbers = () => {
    const maxButtons = 7;
    if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);

    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages) pages.add(i);
    }

    return Array.from(pages).sort((a, b) => a - b);
  };

  useEffect(() => {
    let mounted = true;
    if (recentResults) {
      setResultsState(normalizeResults(recentResults));
      setCurrentPage(1);
      return;
    }
    const raw = localStorage.getItem('user');
    if (!raw) return;
    let user = null;
    try {
      user = JSON.parse(raw);
    } catch {}
    if (!user || !user.UserId) return;

    /**
     * Load recent results for the current student and update component state.
     *
     * Initiates an asynchronous request for up to 200 results for the current user,
     * normalizes the returned data, and updates local component state (results, loading
     * indicator, and current page). All state updates are guarded by a `mounted` flag
     * to avoid updating state after the component has unmounted.
     *
     * Behavior summary:
     * - Sets a loading indicator before the request.
     * - Performs a GET to `/results?studentId={user.UserId}&limit=200`.
     * - Normalizes the response with `normalizeResults` and stores it via `setResultsState`.
     * - Resets pagination to page 1 via `setCurrentPage`.
     * - On error, logs the failure and clears results if still mounted.
     * - Ensures the loading indicator is cleared in a finally block if still mounted.
     *
     * @async
     * @returns {Promise<void>} Resolves when the load operation and component state updates complete.
     */
    async function load() {
      setLoadingResults(true);
      try {
        // request a larger page so we can paginate on the client
        const { data } = await api.get(`/results?studentId=${encodeURIComponent(user.UserId)}&limit=200`);
        if (!mounted) return;

        const normalized = normalizeResults(data || []);
        setResultsState(normalized);
        setCurrentPage(1);
      } catch (e) {
        console.error('Failed to fetch recent results', e);
        if (mounted) setResultsState([]);
      } finally {
        if (mounted) setLoadingResults(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [recentResults]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-slate-50 border-b">
        <h1 className="text-xl font-bold">
          Incident Investigation Training
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-700">
            Welcome, {userName}
          </span>
          <button
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Mode Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Practice Mode Card */}
          <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <BookOpen className="w-8 h-8 text-green-600" />
              <h2 className="text-slate-800">PRACTICE MODE</h2>
            </div>

            <ul className="space-y-3 mb-8 text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">•</span>
                <span>30 Scenarios</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">•</span>
                <span>Instant Feedback</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">•</span>
                <span>Unlimited Attempts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">•</span>
                <span>Practice at your own pace</span>
              </li>
            </ul>

            <button
              onClick={() => onStartMode("practice")}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg transition-colors"
            >
              START PRACTICE
            </button>
          </div>

          {/* Exam Mode Card */}
          <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileCheck className="w-8 h-8 text-blue-600" />
              <h2 className="text-slate-800">EXAM MODE</h2>
            </div>

            <ul className="space-y-3 mb-8 text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>30 Scenarios</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>No hints</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>No feedback</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Grading recorded</span>
              </li>
            </ul>

            <button
              onClick={() => onStartMode("exam")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-colors"
            >
              START EXAM
            </button>
          </div>
        </div>

        {/* Recent Activity & Results */}
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
          <h2 className="text-slate-800 mb-6">
            Recent Activity & Results:
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-700">Date</th>
                  <th className="text-left py-3 px-4 text-slate-700">Scenario & Criterion</th>
                  <th className="text-left py-3 px-4 text-slate-700">Grade</th>
                  <th className="text-left py-3 px-4 text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingResults && (
                  <tr><td colSpan={4} className="py-4 px-4 text-slate-500">Loading...</td></tr>
                )}
                {!loadingResults && (displayedResults || []).length === 0 && (
                  <tr><td colSpan={4} className="py-4 px-4 text-slate-500">No recent results</td></tr>
                )}
                {!loadingResults && (displayedResults || []).map((result, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-4 px-4 text-slate-700">{result.date}</td>
                    <td className="py-4 px-4 text-slate-700">
                      {result.scenario}
                    </td>
                    <td className="py-4 px-4 text-slate-700">
                      {result.grade === "--" ? (
                        <span className="text-slate-500">--</span>
                      ) : result.grade === "Competent" ? (
                        <span className="text-green-600">{result.grade}</span>
                      ) : result.grade === "Not Competent" ? (
                        <span className="text-red-600">{result.grade}</span>
                      ) : (
                        <span className="text-slate-700">{result.grade}</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {result.status === "pending" ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm">PENDING</span>
                        </div>
                      ) : result.status === "completed" ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm">COMPLETED</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded text-sm">{String(result.status).toUpperCase()}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleViewClick(result)}
                        className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 border rounded transition-colors ${
                currentPage === 1 ? "opacity-50 cursor-not-allowed" : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              &lt;
            </button>

            {(() => {
              const pages = getPageNumbers();
              const items: React.ReactNode[] = [];
              let last = 0;
              for (const p of pages) {
                if (last && p - last > 1) {
                  items.push(
                    <span key={`dots-${last}`} className="px-2 text-slate-500 select-none">…</span>
                  );
                }
                items.push(
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`px-3 py-1 border rounded transition-colors ${
                      currentPage === p ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                );
                last = p;
              }
              return items;
            })()}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 border rounded transition-colors ${
                currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              &gt;
            </button>
          </div>

          {showViewModal && selectedResult && (
            <ViewResultsModal
              result={selectedResult}
              onClose={() => setShowViewModal(false)}
            />
          )}

        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;
