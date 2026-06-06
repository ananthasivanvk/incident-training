import { ShieldCheck, CheckCircle } from "lucide-react";
import { useEffect } from "react";

interface ExamCompletionScreenProps {
  scenario: string;
  date: string;
  timeTaken: string;
  onReturnToDashboard: () => void;
  autoRedirectMs?: number; // optional: auto-redirect after this many ms (default 4000)
}

export function ExamCompletionScreen({
  scenario,
  date,
  timeTaken,
  onReturnToDashboard,
  autoRedirectMs = 300000,
}: ExamCompletionScreenProps) {
  useEffect(() => {
    const t = setTimeout(() => {
      onReturnToDashboard();
    }, autoRedirectMs);
    return () => clearTimeout(t);
  }, [onReturnToDashboard, autoRedirectMs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" strokeWidth={2} />
            <span className="text-blue-900">Incident Investigation Training</span>
          </div>
          <span className="text-slate-700">Logged in as Student</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-12">
          {/* Success Icon */}
          <div className="flex justify-center mb-8">
            <CheckCircle className="w-24 h-24 text-green-600" strokeWidth={1.5} />
          </div>

          {/* Success Message */}
          <h1 className="text-center text-green-600 mb-8">EXAM SUBMITTED SUCCESSFULLY!</h1>

          {/* Exam Details */}
          <div className="text-center mb-8 space-y-2 text-slate-700">
            <p>{scenario}</p>
            <p>
              Date: {date} | Time Taken: {timeTaken}
            </p>
          </div>

          {/* Important Notice */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-blue-900 mb-4">IMPORTANT: GRADING PENDING</h3>
            <div className="space-y-3 text-slate-700">
              <p>Your final result will be available on your Dashboard once exam is evaluated and graded by the faculty.</p>
            </div>
          </div>

          {/* Return Button */}
          <div className="flex justify-center">
            <button
              onClick={onReturnToDashboard}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}