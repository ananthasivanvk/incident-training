import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowLeft, Edit, Eye, Search } from "lucide-react";
import { fetchExamResults, gradeExamResult, ExamResult } from "../api";
import { ViewResultsModal } from "./ViewResultsModal";
import { GradeAssessmentModal } from "./GradeAssessmentModal";

// Format an ISO / date-like value as "11 Dec 2025"

/**
 * Formats a date value into a short localized string format (DD MMM YYYY).
 * 
 * @param val - The date value to format. Can be a Date object, timestamp (string or number), or date string.
 * @returns A formatted date string in "en-GB" locale (e.g., "25 Dec 2023"), or "--" if the value is null/undefined/empty, or the string representation of the value if parsing fails.
 * 
 * @remarks
 * - Returns "--" for null, undefined, or empty string values
 * - Handles numeric timestamp strings by converting them to numbers first
 * - Falls back to string representation if date parsing fails
 * - Uses "en-GB" locale formatting with day, short month, and year
 */
function formatDateShort(val: any) {
  if (val === null || val === undefined || val === "") return "--";
  try {
    // If val is numeric timestamp string, convert to number first
    if (typeof val === "string" && /^\d+$/.test(val)) {
      const n = Number(val);
      return new Date(n).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(val);
  }
}

/**
 * Props for the ExamResults component.
 * 
 * @interface ExamResultsProps
 * @property {() => void} onBack - Callback function to handle navigation back to the previous screen
 */
interface ExamResultsProps {
  onBack: () => void;
}

/**
 * ExamResults component displays a paginated table of exam results for students.
 * 
 * Features:
 * - Displays exam results with student name, scenario, criterion, grade, and date
 * - Supports filtering results by student name
 * - Pagination with configurable page size (default: 5 results per page)
 * - Allows grading of pending results via modal
 * - Allows viewing of graded results via modal
 * - Fetches exam results on component mount
 * - Displays loading and error states
 * - Updates results list when grades are published
 * 
 * @param props - Component props
 * @param props.onBack - Callback function to navigate back to previous view
 * 
 * @returns A React component that renders the exam results page with filtering, pagination, and grading capabilities
 * 
 * @example
 * ```tsx
 * <ExamResults onBack={() => navigate('/dashboard')} />
 * ```
 */
export default function ExamResults({ onBack }: ExamResultsProps) {
  const location = useLocation() as any;
  const stateSummary = location?.state?.gradeSummary;
  const summary = stateSummary || null;

  const [filters, setFilters] = useState({
    student: '',
  });
  const [showViewModal, setShowViewModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);

  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5; // same default as UserManagement

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchExamResults(); // optionally pass studentId here if needed
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Error loading results');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Handles the click event when viewing an exam result.
   * Sets the selected result and displays the view modal.
   * 
   * @param result - The exam result object to be viewed
   * @returns void
   */
  const handleViewClick = (result: any) => {
    setSelectedResult(result);
    setShowViewModal(true);
  };

  const handleGradeClick = (result: any) => {
    console.log("handleGradeClick — selected result:", result);
    setSelectedResult(result);
    setShowGradeModal(true);
  };

  /**
   * Publishes grades and feedback for a selected exam result.
   * 
   * @param grades - An object containing the grade and feedback to publish
   * @param grades.grade - The grade to assign (defaults to 'Competent' if not provided)
   * @param grades.feedback - Optional feedback comments from faculty
   * 
   * @returns A promise that resolves when the grade has been published and state updated
   * 
   * @throws Will set error state if the grade publishing fails
   * 
   * @remarks
   * - Returns early if no result is currently selected
   * - Updates the local results state to reflect the new grade and feedback
   * - Marks the result as no longer needing grading
   * - Preserves existing faculty feedback if no new feedback is provided
   */
  const handlePublishGrades = async (grades: any) => {
    if (!selectedResult) return;
    const newGrade = grades?.grade || 'Competent';
    const newFeedback = grades?.feedback;

    try {
      await gradeExamResult(selectedResult.resultId, { grade: newGrade, facultyComments: newFeedback });
      setResults(prev =>
        prev.map(r =>
          r.resultId === selectedResult.resultId
            ? { ...r, grade: newGrade, facultyFeedback: newFeedback ?? r.facultyFeedback, needsGrading: false }
            : r
        )
      );
    } catch (e) {
      setError((e as Error).message || 'Failed to publish grade');
    }
  };

  // Derived filtered results based on Student text

  /**
   * Filters the results array based on the student name filter.
   * @param results - The array of results to filter
   * @param filters - The filters object containing the student name query
   * @returns An array of results where the student name includes the filter query (case-insensitive)
   */
  const filteredResults = results.filter(r => {
    const q = filters.student.trim().toLowerCase();
    if (q === '') return true;
    return String(r.student || '').toLowerCase().includes(q);
  });

  // Pagination helpers
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const displayedResults = filteredResults.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    const maxButtons = 7; // maximum page number buttons to show (including first/last)
    if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);

    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages) pages.add(i);
    }

    return Array.from(pages).sort((a, b) => a - b);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-slate-800">Exam Results</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
          {/* Filters */}
          <div className="mb-6">
            <h3 className="text-slate-700 mb-4">FILTERS:</h3>
            <div className="flex flex-wrap gap-4 mb-4 items-end">
              <div>
                <div className="relative inline-block w-64">
                  <input
                    type="text"
                    placeholder="Search by name"
                    value={filters.student}
                    onChange={(e) => { setFilters({ ...filters, student: e.target.value }); setCurrentPage(1); }}
                    style={{ paddingRight: 72 }}
                    className="w-full pl-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {filters.student && (
                    <button
                      type="button"
                      onClick={() => { setFilters({ ...filters, student: '' }); setCurrentPage(1); }}
                      aria-label="Clear search"
                      style={{ right: 36 }}
                      className="absolute top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center bg-white rounded text-slate-500 hover:text-slate-700 z-20"
                    >
                      &times;
                    </button>
                  )}

                  <Search
                    aria-hidden="true"
                    style={{ right: 12 }}
                    className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status messages */}
          {loading && <div className="p-4 text-center text-slate-600">Loading results…</div>}
          {error && <div className="p-4 text-center text-red-600">{error}</div>}

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-700">Student</th>
                  <th className="text-left py-3 px-4 text-slate-700">Scenario</th>
                  <th className="text-left py-3 px-4 text-slate-700">Criterion</th>
                  <th className="text-left py-3 px-4 text-slate-700">Grade</th>
                  <th className="text-left py-3 px-4 text-slate-700">Date</th>
                  <th className="text-left py-3 px-4 text-slate-700">Details</th>
                </tr>
              </thead>
              <tbody>
                {displayedResults.map((result, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-700">{result.student}</td>
                    <td className="py-3 px-4 text-slate-700">{result.scenario}</td>
                    <td className="py-3 px-4 text-slate-700">{result.criterion}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {result.needsGrading || !result.grade ? (
                        <span className="text-amber-600">Pending</span>
                      ) : (
                        <span className={result.grade === "Competent" ? "text-green-600" : "text-red-600"}>
                          {result.grade}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{formatDateShort(result.date)}</td>
                    <td className="py-3 px-4">
                      {result.needsGrading ? (
                        <button
                          onClick={() => handleGradeClick(result)}
                          className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Grade
                        </button>
                      ) : (
                        <button
                          onClick={() => handleViewClick(result)}
                          className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {displayedResults.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center text-slate-500">No results found.</td>
                  </tr>
                )}
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
        </div>
      </div>

      {/* Modals */}
      {showViewModal && selectedResult && (
        <ViewResultsModal
          result={selectedResult}
          onClose={() => setShowViewModal(false)}
        />
      )}

      {showGradeModal && selectedResult && (
        <GradeAssessmentModal
          result={selectedResult}
          onClose={() => setShowGradeModal(false)}
          onPublish={handlePublishGrades}
        />
      )}
    </div>
  );
}