import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from "lucide-react";

interface ViewResultsModalProps {
  result: {
    student: string;
    scenario: string;
    grade?: string | null;
    date?: string | null;
    question?: string;
    studentAnswer?: string | any;
    facultyFeedback?: string | null;
    needsGrading?: boolean;
    questionType?: string | undefined;
  };
  onClose: () => void;
}

function tryParseJSON(val: any) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  if (typeof val !== "string") return null;
  try {
    return JSON.parse(val);
  } catch {
    try {
      return JSON.parse(val.replace(/'/g, '"'));
    } catch {
      return null;
    }
  }
}

function ordinalLabel(n: number) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function ViewResultsModal({ result, onClose }: ViewResultsModalProps) {
  const navigate = useNavigate();

  const openFormG = () => {    
    // read authenticated user (existing behavior); keep unchanged besides using studentId
    const rawUser = localStorage.getItem('user');
    let user: any = null;
    if (rawUser) {
      try { user = JSON.parse(rawUser); } catch {}
    }
    const studentId = user?.UserId ?? null;  

    // Derive modeofexam from result.raw.status when present (preferred),
    // otherwise fall back to existing fields and default to 'exam'.
    const rawStatus = String((result as any).raw?.status ?? '').toLowerCase();

    let modeofexam: string;
    if (rawStatus === 'pending' || rawStatus === 'completed') {
      modeofexam = 'practice';
    } else if (rawStatus === 'exam') {
      modeofexam = 'exam';
    } else {
      modeofexam =
        (result as any).modeofexam ??
        (result as any).mode ??
        (result as any).raw?.modeofexam ??
        (result as any).raw?.mode ??
        'exam';
    }

    const questionid =
      (result as any).questionId ??
      (result as any).QuestionId ??
      (result as any).questionid ??
      (result as any).QuestionId ??
      (result as any).raw?.questionId ??
      (result as any).raw?.QuestionId ??
      null;

    console.log("Opening Form G/G1 with:", { studentId, modeofexam, questionid });  
    const isFormG1 = formButtonLabel === 'Form G1';

    if (!studentId || !questionid) {
      alert('Cannot open Form G — missing studentId or questionId.');
      return;
    }

    const route = isFormG1 ? '/form-g1' : '/form-g';

    // Preferred: navigate in-app and pass identifiers in state
    navigate(route, {
      state: {
        studentId: String(studentId),
        mode: String(modeofexam),
        questionId: String(questionid),
        readOnly: true
      },
    });
  };

  const questionText = result.question || "Exam Question";

  const questionType = result.questionType?? result.raw.questionType ?? "";
  const qType = String(questionType ?? "").toLowerCase();

  // determine if we should show a Form G / Form G1 button
  const formButtonLabel = qType.includes("form-g1")
    ? "Form G1"
    : qType.includes("form-g")
    ? "Form G"
    : null;

  let studentWhys: any[] | null = null;

  if (qType === "5-whys") {
    const parsed = tryParseJSON(result.studentAnswer ?? "");
    if (parsed && Array.isArray(parsed.student_whys)) {
      studentWhys = parsed.student_whys;
    } else if (Array.isArray(parsed)) {
      studentWhys = parsed;
    } else {
      studentWhys = null;
    }
  } else {
    if (Array.isArray(result.studentAnswer)) {
      studentWhys = result.studentAnswer;
    } else {
      studentWhys = null;
    }
  }

  const status =
    result.needsGrading || !result.grade
      ? "PENDING"
      : result.grade === "Competent"
      ? "COMPETENT"
      : "NOT COMPETENT";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Results
            </button>
            <h2 className="text-slate-800">Exam Detail</h2>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-wrap gap-x-8 gap-y-2 mb-3">
            <p className="text-slate-700">
              <span className="text-slate-500">Student:</span> <strong>{result.student}</strong>
            </p>
            <p className="text-slate-700">
              <span className="text-slate-500">|</span> <strong>{result.scenario}</strong>
            </p>
            <p className="text-slate-700">
              <span className="text-slate-500">|</span> Date: <strong>{result.date ?? "--"}</strong>
            </p>
          </div>

          <p className="text-slate-700">
            <span className="text-slate-500">Grade:</span>{" "}
            {status === "PENDING" ? (
              <strong className="text-amber-600">Pending</strong>
            ) : (
              <strong className={result.grade === "Competent" ? "text-green-600" : "text-red-600"}>
                {result.grade}
              </strong>
            )}
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="border-b border-slate-200 pb-6 last:border-b-0">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-slate-800">Q1. {questionText}</h3>
              <span
                className={`px-3 py-1 rounded text-sm ${
                  status === "COMPETENT"
                    ? "bg-green-100 text-green-700"
                    : status === "NOT COMPETENT"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {status}
              </span>
            </div>

            <div className="pl-4 space-y-4">
              <div>
                <p className="text-slate-500 mb-2">Student Answer:</p>

                {studentWhys ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                    {studentWhys.map((w: any, idx: number) => {
                      const num = Number(w.why_number ?? w.whyNumber ?? idx + 2);
                      const q = String(w.question ?? w.why ?? "");
                      const a = String(w.answer ?? w.ans ?? "");
                      return (
                        <div key={idx}>
                          <p className="text-slate-600 font-medium">
                            {ordinalLabel(num)} Why : {q}
                          </p>
                          <p className="text-slate-700 ml-4">{ordinalLabel(num)} Ans : {a}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-slate-700 italic">"{String(result.studentAnswer ?? "")}"</p>
                  </div>
                )}

                {/* Form G / Form G1 button (shown only for form-g / form-g1 question types) */}
                {formButtonLabel && (
                  <div className="mt-6 w-full flex justify-end pr-6">
                    <button
                      type="button"
                      className="px-6 py-2 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors shadow-sm whitespace-nowrap min-w-[96px] transform active:scale-95 active:translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300"
                      onClick={openFormG}
                      aria-label={`Open ${formButtonLabel}`}
                    >
                      {formButtonLabel}
                    </button>
                  </div>
                )}
              </div>

              {result.facultyFeedback && (
                <div>
                  <p className="text-slate-500 mb-2">Faculty Feedback:</p>
                  <div className="bg-white border border-slate-100 rounded-lg p-3">
                    <p className="text-slate-700">"{result.facultyFeedback}"</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-6 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  );
}