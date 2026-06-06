import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface GradeAssessmentModalProps {
  result: {
    student: string;
    studentId: number;
    scenario: string;
    date: string;
    question?: string;
    studentAnswer?: string;
    // optional metadata provided by the server
    questionType?: string;
    options?: any;
    correctAnswers?: any;
    fiveWhys?: any;
    raw?: any;
    modeofexam?: any;
    mode?: any;
    questionId?: any;
    QuestionId?: any;
    questionid?: any;
  };
  onClose: () => void;
  onPublish: (grades: { grade: "Competent" | "Not Competent"; feedback?: string }) => void;
}

function safeParseJSON(maybe: any): any {
  if (maybe == null) return undefined;
  if (typeof maybe === "object") return maybe;
  if (typeof maybe === "string") {
    try {
      return JSON.parse(maybe);
    } catch {
      try {
        return JSON.parse(maybe.replace(/'/g, '"'));
      } catch {
        return maybe;
      }
    }
  }
  return maybe;
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

export function GradeAssessmentModal({ result, onClose, onPublish }: GradeAssessmentModalProps) {
  console.log("GradeAssessmentModal - result:", result);
  const navigate = useNavigate();

  const [grade, setGrade] = useState<"Competent" | "Not Competent" | "">("");
  const [feedback, setFeedback] = useState("");

  const questionText = result.question || "Exam Question";

  // Parse the metadata once
  const parsed = useMemo(() => {
    const options = safeParseJSON(result.options);
    const correctRaw = safeParseJSON(result.correctAnswers);
    const five = safeParseJSON(result.fiveWhys);
    return { options, correctRaw, five };
  }, [result.options, result.correctAnswers, result.fiveWhys]);

  const questionType = result.questionType ?? result.raw?.questionType ?? "";
  const qType = String(questionType ?? "").toLowerCase();

  const studentWhys = useMemo(() => {
    if (qType === "5-whys") {
      const parsedAns = safeParseJSON(result.studentAnswer);
      if (parsedAns && Array.isArray(parsedAns.student_whys)) return parsedAns.student_whys;
      if (Array.isArray(parsedAns)) return parsedAns;
      return null;
    } else {
      if (Array.isArray(result.studentAnswer)) return result.studentAnswer;
      return null;
    }
  }, [result.studentAnswer, qType]);

  // extract and order hint entries from parsed.five.hint (for faculty correct/hint)
  const fiveHintEntries = useMemo(() => {
    const f = parsed.five;
    if (!f) return null;
    const hint = (f as any).hint ?? null;
    if (hint && typeof hint === "object") {
      const entries: Array<any> = [];
      Object.keys(hint).forEach((k) => {
        const m = k.match(/\d+/);
        const num = m ? Number(m[0]) : undefined;
        const item = (hint as any)[k];
        const question = item?.question ?? "";
        const answer = item?.answer ?? item?.system_answer ?? "";
        entries.push({ key: k, num, question, answer });
      });
      entries.sort((a, b) => (a.num ?? 0) - (b.num ?? 0));
      return entries;
    }
    return null;
  }, [parsed.five]);

  // produce a human-friendly array of correct answer strings when possible
  const correctAnswerDisplay = useMemo(() => {
    const t = result.questionType;
    if (!t) return null;

    if (t === "mcq-single" || t === "mcq-multiselect") {
      const opts = Array.isArray(parsed.options) ? parsed.options : undefined;
      let correctArr: string[] = [];
      if (Array.isArray(parsed.correctRaw)) {
        parsed.correctRaw.forEach((c: any) => {
          const asNum = Number(c);
          if (!isNaN(asNum) && opts && opts[asNum] !== undefined) {
            const o = opts[asNum];
            correctArr.push(typeof o === "object" ? (o.text ?? o.label ?? o.value ?? JSON.stringify(o)) : String(o));
          } else if (opts && typeof c === "string") {
            const match = opts.find((o: any) => {
              const txt = typeof o === "object" ? (o.text ?? o.label ?? o.value ?? "") : String(o);
              return String(txt).trim().toLowerCase() === String(c).trim().toLowerCase();
            });
            if (match !== undefined) {
              const o = match;
              correctArr.push(typeof o === "object" ? (o.text ?? o.label ?? o.value ?? JSON.stringify(o)) : String(o));
            } else {
              correctArr.push(String(c));
            }
          } else {
            correctArr.push(String(c));
          }
        });
      } else if (parsed.correctRaw != null) {
        const c = parsed.correctRaw;
        const asNum = Number(c);
        if (!isNaN(asNum) && opts && opts[asNum] !== undefined) {
          const o = opts[asNum];
          correctArr.push(typeof o === "object" ? (o.text ?? o.label ?? o.value ?? JSON.stringify(o)) : String(o));
        } else {
          correctArr.push(String(c));
        }
      }
      return correctArr.length ? correctArr : null;
    }

    if (t === "5-whys") {
      if (Array.isArray(parsed.five)) {
        return parsed.five.map((x: any) => (typeof x === "object" ? JSON.stringify(x) : String(x)));
      }
      if (parsed.five != null) {
        return [String(parsed.five)];
      }
    }

    return null;
  }, [result.questionType, parsed]);

  const handlePublishResults = () => {
    if (!grade) {
      alert("Please select a grade (Competent / Not Competent) before publishing");
      return;
    }
    onPublish({ grade, feedback: feedback || undefined });
    onClose();
  };

  // NEW: navigate to form pages instead of dynamic-importing them.
  // This mirrors ViewResultsModal's `openFormG` behavior and passes identifiers via router state.
  const loadFormComponent = (type: "form-g" | "form-g1") => {
    console.log("the result inside loadFormComponent:", result);
    console.log("the result student:", result.studentId);
    const studentId = result.studentId;

    // derive modeofexam (use raw.status when available like ViewResultsModal)
    const rawStatus = String((result as any).status ?? "").toLowerCase();
    
    let modeofexam: string;
    if (rawStatus === "pending" || rawStatus === "completed") {
      modeofexam = "practice";
    } else if (rawStatus === "exam") {
      modeofexam = "exam";
    } else {
      modeofexam =
        (result as any).modeofexam ??
        (result as any).mode ??
        (result as any).raw?.modeofexam ??
        (result as any).raw?.mode ??
        "exam";
    }

    const questionid =
      (result as any).questionId ??
      (result as any).QuestionId ??
      (result as any).questionid ??
      (result as any).raw?.questionId ??
      (result as any).raw?.QuestionId ??
      null;

    if (!studentId || !questionid) {
      alert("Cannot open Form — missing studentId or questionId.");
      return;
    }

    const route = type === "form-g" ? "/form-g" : "/form-g1";

    navigate(route, {
      state: {
        studentId: String(studentId),
        mode: String(modeofexam),
        questionId: String(questionid),
        readOnly: true,
      },
    });

    // close the grader modal so the user is in the full form page
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Cancel Grading
            </button>
            <h2 className="text-slate-800">Grade: {result.student}</h2>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-slate-700">
              <span className="text-slate-500">Scenario:</span> {result.scenario}
            </p>
            <p className="text-slate-700">
              <span className="text-slate-500">Date:</span> {result.date}
            </p>
          </div>
        </div>

        {/* Single Question */}
        <div className="p-6 space-y-6">
          <div className="border border-slate-300 rounded-lg p-6">
            <h3 className="text-slate-800 mb-4">Q1. {questionText}</h3>

            <div className="mb-4">
              <p className="text-slate-700 mb-2">STUDENT ANSWER:</p>
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
                {studentWhys ? (
                  <div className="space-y-4">
                    {studentWhys.map((w: any, idx: number) => {
                      const num = Number(w.why_number ?? w.whyNumber ?? idx + 2);
                      const q = String(w.question ?? w.why ?? "");
                      const a = String(w.answer ?? w.ans ?? "");
                      return (
                        <div key={idx}>
                          <p className="text-slate-600 font-medium">
                            {ordinalLabel(num)} Why : {q}
                          </p>
                          <p className="text-slate-700 ml-4">
                            {ordinalLabel(num)} Ans : {a}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-700">"{String(result.studentAnswer ?? "No answer submitted.")}"</p>
                )}
              </div>
            </div>

            {(result.questionType === "form-g" || result.questionType === "form-g1") && (
              <div className="mb-4">
                <button
                  onClick={() =>
                    loadFormComponent(result.questionType === "form-g" ? "form-g" : "form-g1")
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {result.questionType === "form-g" ? "Form G" : "Form G1"}
                </button>
              </div>
            )}

            {/* Correct answer / hint display for supported types */}
            {result.questionType === "5-whys" && fiveHintEntries ? (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-slate-700 mb-2 font-medium">Correct Answer (Hint):</p>
                <div className="bg-white border border-green-100 rounded-lg p-4 space-y-3">
                  {fiveHintEntries.map((e: any) => (
                    <div key={e.key}>
                      <p className="text-slate-600 font-medium">
                        {typeof e.num === "number" ? ordinalLabel(e.num) : e.key} : {e.question}
                      </p>
                      <p className="text-slate-700 ml-4">
                        {typeof e.num === "number" ? ordinalLabel(e.num) : e.key} Ans : {e.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : correctAnswerDisplay ? (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-slate-700 mb-2 font-medium">Correct Answer:</p>
                <ul className="list-disc list-inside text-slate-700">
                  {correctAnswerDisplay.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Grading controls */}
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-slate-700 mb-3">EVALUATION:</p>

              <div className="flex items-center gap-6 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="grade"
                    value="Competent"
                    checked={grade === "Competent"}
                    onChange={() => setGrade("Competent")}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-700">Competent</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="grade"
                    value="Not Competent"
                    checked={grade === "Not Competent"}
                    onChange={() => setGrade("Not Competent")}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-700">Not Competent</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Faculty Feedback (optional):</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide brief feedback for the student..."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6">
          <div className="flex gap-4 justify-center">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePublishResults}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              PUBLISH GRADE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}