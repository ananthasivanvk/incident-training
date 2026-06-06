import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SubmissionConfirmationModal } from './SubmissionConfirmationModal';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';

/**
 * Props for the QuestionView component.
 *
 * Represents configuration and event handlers used to render and interact with a single
 * question view. All fields are optional to allow flexible composition and testing.
 *
 * @property mode - Optional. The display/interaction mode for the view. Allowed values:
 *                   'practice' | 'exam'. Use 'practice' for an exploratory mode and
 *                   'exam' for a timed/locked assessment flow.
 * @property scenario - Optional. A string identifying the current scenario or context for
 *                       the question (e.g., scenario id or descriptive title).
 * @property criterion - Optional. A string representing the evaluation criterion or rubric
 *                        to apply when assessing responses.
 * @property onBack - Optional. Callback invoked when the user requests to navigate back
 *                    (e.g., cancel or return to a previous screen). No arguments are passed.
 * @property onSubmit - Optional. Callback invoked when the user submits an answer. No
 *                      arguments are passed; implementers should handle validation/processing.
 */
interface QuestionViewProps {
  mode?: 'practice' | 'exam';
  scenario?: string;
  criterion?: string;
  onBack?: () => void;
  onSubmit?: () => void;
}

function safeParseJSON(val: any) {
  if (!val) return null;
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch {
    return null;
  }
}

// Normalise option for stable comparison/storage & friendly label
function optionValue(op: any) {
  if (op === null || op === undefined) return String(op);
  if (typeof op === 'object') {
    return op.value ?? op.id ?? JSON.stringify(op);
  }
  return String(op);
}
function optionLabel(op: any) {
  if (op === null || op === undefined) return String(op);
  if (typeof op === 'object') {
    return op.label ?? op.name ?? JSON.stringify(op);
  }
  return String(op);
}
function ordinal(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * QuestionView
 *
 * Renders an interactive question/scene view used for both practice and exam modes.
 *
 * Responsibilities / behavior
 * - Loads scenario summary and site photo when a scenarioId is present in the URL or when provided via location.state.
 * - Loads question list from location.state if available; otherwise fetches from the API using scenarioId and pc query params.
 * - Maintains local component state for:
 *   - current question index, answers map, derived lookup options, cached lookup tables,
 *     UI state (active tab, revealAnswer, showSubmitModal), and loading/error flags.
 * - Derives "options" for a question from OptionsJSON:
 *   - supports array options or a lookup descriptor (lookupTable + optional valueColumn)
 *   - caches lookup table responses in lookupCache to avoid refetching
 * - Renders question content and UI for multiple question types, including:
 *   - form-g / form-g1: navigates to a separate form page
 *   - mcq-single: single-select dropdown/radio UI
 *   - mcq, mcq-multiselect, multi: multi-select checkboxes
 *   - 5-whys: specialized renderer that supports system-provided first WHY, editable subsequent WHYs,
 *     canonicalizes legacy/stored shapes into a consistent structure, and allows user edits
 *   - fallback: single-select radio list (legacy behavior)
 * - Hint and correct-answer UX:
 *   - In practice mode, hints are shown (with special handling for "5-whys": correct answer block only shown when revealAnswer is toggled)
 *   - In exam mode hints are suppressed and revealAnswer controls are hidden
 *   - Normalizes and compares normalized chosen answers vs correct answers to compute attempted / correct status,
 *     and shows a colored answer block (green/red/blue) as feedback in practice mode
 * - Submission flow:
 *   - Requires a parsed `user` object from localStorage. If not available, navigates to /login.
 *   - Posts collected answers along with mode and studentId to /practice/submit
 *   - On success:
 *     - In exam mode: computes a best-effort timeTaken string from the local timer and navigates to /exam-complete with state
 *     - In practice mode: navigates back to /student
 * - Navigation and contextual controls:
 *   - Back button invokes onBack if provided, otherwise navigates back via history
 *   - Provides Next / Submit button behavior that differs between practice and exam modes, and shows a submission confirmation modal for exams
 *
 * Side effects and external interactions:
 * - Uses react-router's useNavigate/useLocation to inspect query params and navigation
 * - Calls out to an `api` helper for endpoints:
 *   - GET /scenarios/:id
 *   - GET /questions?scenarioId=...&pc=...
 *   - GET /lookups/:table
 *   - POST /practice/submit
 * - Reads `user` from localStorage for submission
 *
 * Notes / assumptions:
 * - The component expects question objects to contain fields like QuestionID, QuestionText, Type, OptionsJSON, CorrectAnswersJSON, HintJson/HintJSON/Hint and (for 5-whys) FiveWhysJSON.
 * - Derived options and normalization helpers attempt to be tolerant of legacy shapes (numeric indices into options, stringified JSON, and mixed object shapes).
 * - Initial timer total is assumed to be 860 seconds (kept in sync with local timer usage).
 *
 * @param props.mode - Either 'practice' (default) or 'exam'. Affects hint visibility, submission behavior and UI labels.
 * @param props.onBack - Optional callback invoked when the user clicks the Back button. If omitted, navigation goes back in history.
 * @param props.onSubmit - Optional callback invoked after a successful submission (if the parent wants to handle post-submit behavior).
 *
 * @returns JSX.Element - The rendered question view UI.
 */
export default function QuestionView({ mode = 'practice', onBack, onSubmit }: QuestionViewProps) {
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [textAnswer, setTextAnswer] = useState('');
  const [activeTab, setActiveTab] = useState('photo');
  const [timeRemaining, setTimeRemaining] = useState(860);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [revealAnswer, setRevealAnswer] = useState(false);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [questions, setQuestions] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupCache, setLookupCache] = useState<Record<string, any[]>>({});
  const [derivedOptions, setDerivedOptions] = useState<any[]>([]);

  const navigate = useNavigate();
  const location = useLocation();
  function getNormalizedQType(q: any) {
    if (!q) return '';
    const candidates = [q.Type, q.QuestionType, q.questionType, q.qtype, q.QType, q.TypeName, q.type, q.type_name, q.Type_Name];
    for (const c of candidates) {
      if (c != null) {
        const s = String(c || '').trim();
        if (s) return s.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    }
    return '';
  }
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const scenarioId = params.get('scenarioId');
  const pc = params.get('pc');

    const scenarioFromState = (location.state as any)?.scenario;

    const [scenarioSummary, setScenarioSummary] = useState<string | null>(
      scenarioFromState?.Summary ?? scenarioFromState?.summary ?? scenarioFromState?.ShortSummary ?? null
    );

    const [scenarioPhoto, setScenarioPhoto] = useState<string | null>(
      scenarioFromState?.SitePhoto ??
      scenarioFromState?.sitePhoto ??
      scenarioFromState?.SitePhotoUrl ??
      scenarioFromState?.SitePhotoURL ??
      scenarioFromState?.photo ??
      scenarioFromState?.PhotoUrl ??
      null
    );

  useEffect(() => {
    if (scenarioSummary == null && scenarioId) {
      api.get(`/scenarios/${encodeURIComponent(scenarioId)}`)
          .then(res => {
          const s = res.data || {};
          const summary = s?.Summary ?? s?.summary ?? s?.ShortSummary ?? null;
          if (summary) setScenarioSummary(summary);

          const photo =
            s?.SitePhoto ??
            s?.sitePhoto ??
            s?.SitePhotoUrl ??
            s?.SitePhotoURL ??
            s?.photo ??
            s?.PhotoUrl ??
            null;

          if (photo) setScenarioPhoto(photo);
        })
        .catch(() => {
          // ignore; leave summary null
        });
    }
  }, [scenarioId, scenarioSummary]);

  useEffect(() => {
    const stateQuestions = (location.state as any)?.questions;
    if (Array.isArray(stateQuestions) && stateQuestions.length > 0) {
      setQuestions(stateQuestions);
      return;
    }
    if (!scenarioId || !pc) return;
    setLoading(true);
    setError(null);
    api
      .get(`/questions?scenarioId=${encodeURIComponent(scenarioId)}&pc=${encodeURIComponent(pc)}`)
      .then((res) => setQuestions(res.data || []))
      .catch(() => setError('Failed to load questions'))
      .finally(() => setLoading(false));
  }, [scenarioId, pc, location.state]);

  // Derive options for current question (supports lookup descriptor)
  useEffect(() => {
    const q = questions[currentQuestion - 1];
    if (!q) { setDerivedOptions([]); return; }
    const raw = safeParseJSON(q.OptionsJSON);
    if (!raw) { setDerivedOptions([]); return; }
    if (Array.isArray(raw)) { setDerivedOptions(raw); return; }
    if (raw.lookupTable) {
      const table: string = raw.lookupTable;
      const valueColumn: string | undefined = raw.valueColumn;
      if (lookupCache[table]) {
        const rows = lookupCache[table];
        setDerivedOptions(valueColumn ? rows.map((r: any) => r[valueColumn]) : rows);
      } else {
        api.get(`/lookups/${encodeURIComponent(table)}`)
          .then(res => {
            const rows = res.data || [];
            setLookupCache(c => ({ ...c, [table]: rows }));
            setDerivedOptions(valueColumn ? rows.map((r: any) => r[valueColumn]) : rows);
          })
          .catch(() => setDerivedOptions([]));
      }
    } else {
      setDerivedOptions([]);
    }
  }, [questions, currentQuestion, lookupCache]);

  useEffect(() => {
    setRevealAnswer(false);
  }, [currentQuestion]);

  const totalQuestions = questions.length || 1;

  const handleNext = () => {
    if (currentQuestion < totalQuestions) setCurrentQuestion((s) => s + 1);
  };
  const handlePrevious = () => {
    if (currentQuestion > 1) setCurrentQuestion((s) => s - 1);
  };

  /**
   * Submit the current answers for the signed-in student and navigate based on mode.
   *
   * This async handler:
   * - Reads the serialized user from localStorage ('user') and parses it to obtain the
   *   authenticated student's ID. If no user is present it redirects to '/login'.
   * - Builds a submission payload containing:
   *   - studentId: the parsed UserId from local storage,
   *   - mode: either 'practice' or 'exam',
   *   - answers: an array of { questionId, chosenAnswer } where chosenAnswer is
   *     stringified if the original chosen value is an object.
   * - Sends the payload to POST '/practice/submit' via `api.post`.
   * - If the response indicates success (`data?.saved`):
   *   - In 'exam' mode:
   *     - Computes a best-effort friendly time taken string using a local `initialTotal`
   *       (keep this constant in sync with the timer initialization) and the component's
   *       `timeRemaining`.
   *     - Navigates (replace) to '/exam-complete' and passes location.state with:
   *       - scenario (from `scenarioSummary` or `scenarioId`),
   *       - date (formatted 'Mon DD, YYYY' using en-US locale),
   *       - timeTaken (friendly string).
   *   - In 'practice' mode:
   *     - Navigates (replace) back to '/student'.
   * - On non-saved response or network/error conditions, shows an alert message
   *   ('Failed to save results' or 'Submission failed').
   *
   * Notes:
   * - The function has side effects: it reads from localStorage, performs a network request,
   *   uses `navigate` for routing, and displays alert dialogs on error.
   * - Expected surrounding context/state used by this handler:
   *   - `mode`: 'practice' | 'exam'
   *   - `answers`: Record<string, string | object | null>
   *   - `timeRemaining`: number | undefined
   *   - `scenarioSummary` / `scenarioId`: string | undefined
   *   - `api` and `navigate` are available in scope.
   *
   * @async
   * @returns Promise<void> A promise that resolves when submission handling (including navigation) completes.
   */
  const handleSubmit = async () => {
    const raw = localStorage.getItem('user');
    if (!raw) return navigate('/login');
    let user: any = null;
    try { user = JSON.parse(raw); } catch {}
    const studentId = user?.UserId;
    if (!studentId) return;

    const payload = {
      studentId,
      mode, // <-- include mode ('practice' | 'exam')
      answers: Object.entries(answers).map(([qid, chosen]) => {
        let value: any = chosen;
        if (value && typeof value === 'object') {
          try { value = JSON.stringify(value); } catch {}
        }
        return { questionId: qid, chosenAnswer: value };
      }),
    };

    try {
      const { data } = await api.post('/practice/submit', payload);
      if (data?.saved) {
        if (mode === 'exam') {
          // compute a friendly timeTaken string — best-effort based on the local `timeRemaining`
          const initialTotal = 860; // keep in sync with initial timer if you change it
          const elapsedSecs = Math.max(0, initialTotal - (timeRemaining || 0));
          const elapsedMins = Math.floor(elapsedSecs / 60);
          const timeTakenStr = `${elapsedMins} mins`;

          // Navigate to exam-complete route and pass info via location.state
          navigate('/exam-complete', {
            replace: true,
            state: {
              scenario: scenarioSummary || scenarioId || '',
              date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              timeTaken: timeTakenStr,
            },
          });
        } else {
          // practice mode — go straight back to student dashboard
          navigate('/student', { replace: true });
        }
      } else {
        alert('Failed to save results');
      }
    } catch (e) {
      alert('Submission failed');
      console.error('Submission error', e);
    }
  };

  const currentQ = questions[currentQuestion - 1];

  /**
   * Memoized, human-readable hint text extracted from the current question object.
   *
   * The returned value is derived from one of the hint-like fields on `currentQ`
   * (checked in order: `HintJson`, `HintJSON`, `Hint`) and is produced by parsing
   * the raw hint value with `safeParseJSON` and normalizing several possible shapes.
   *
   * Behavior summary:
   * - If `currentQ` is falsy, returns `null`.
   * - If the parsed hint is a string, that string is returned.
   * - If the parsed hint is an object with a `text` string property, that string is returned.
   * - If the parsed hint is an object with a `hint` property:
   *   - If `hint` is a string, that string is returned.
   *   - If `hint` is an array, each element is converted to a string and joined with `\n`.
   *   - If `hint` is an object, each property is processed:
   *     - If a property value is an object, the code attempts to extract
   *       `question`, `question_placeholder`, `answer`, `system_answer`, or
   *       `answer_placeholder` fields and formats them as labeled Q/A pairs.
   *       - It prefers an explicit numeric `why_number` when present; otherwise it
   *         attempts to infer a number by stripping non-digits from the property key.
   *       - Numeric labels are converted to ordinals (e.g. `1` -> `1st`) and used to
   *         produce labels like `"1st WHY"` and `"1st ANSWER"`. If no number can be inferred,
   *         plain `"WHY"` and `"ANSWER"` labels are used.
   *       - Each Q/A pair (or single Q or A) is separated by a blank line for readability.
   *     - If a property value is not an object, it is stringified with `String(...)`.
   *   - For other `hint` value types, the value is stringified.
   * - For any other parsed hint shapes, the code falls back to `JSON.stringify`.
   *
   * The returned type is `string | null`. This value is memoized and will update when
   * `currentQ` changes.
   *
   * Examples of produced values:
   * - "Short hint text"
   * - "WHY: What went wrong?\nANSWER: We missed step 3"
   * - "1st WHY: Why did this happen?\n1st ANSWER: Because X\n\n2nd WHY: Why did X occur?\n2nd ANSWER: Because Y"
   *
   * @returns A normalized hint string suitable for display, or `null` if no hint is available.
   * @remarks Depends on `currentQ` and uses `safeParseJSON` to handle both raw strings and structured hint payloads.
   */
  const hintText = useMemo(() => {
    if (!currentQ) return null;
    const _hintRaw = safeParseJSON(currentQ.HintJson ?? currentQ.HintJSON ?? currentQ.Hint ?? null);
    let _hintText: string | null = null;
    if (_hintRaw) {
      if (typeof _hintRaw === 'string') {
        _hintText = _hintRaw;
      } else if (typeof (_hintRaw as any).text === 'string') {
        _hintText = (_hintRaw as any).text;
      } else if ((_hintRaw as any).hint != null) {
        const hr = (_hintRaw as any).hint;
        if (typeof hr === 'string') {
          _hintText = hr;
        } else if (Array.isArray(hr)) {
          _hintText = hr.map((h: any) => (typeof h === 'string' ? h : JSON.stringify(h))).join('\n');
        } else if (typeof hr === 'object') {
          const parts: string[] = [];
          for (const key of Object.keys(hr)) {
            const v = hr[key];
            if (v && typeof v === 'object') {
              const q = v.question ?? v.question_placeholder ?? '';
              const a = v.answer ?? v.system_answer ?? v.answer_placeholder ?? '';

              // Prefer explicit why_number if present, otherwise infer from the key (e.g. "why_2")
              const parsedNum = (typeof v.why_number === 'number') ? v.why_number : (parseInt(String(key).replace(/\D/g, ''), 10) || null);
              const labelNum = parsedNum ? ordinal(parsedNum) : null;
              const whyLabel = labelNum ? `${labelNum} WHY` : 'WHY';
              const ansLabel = labelNum ? `${labelNum} ANSWER` : 'ANSWER';

              if (q && a) {
                // e.g. "1st WHY: <question>\n1st ANSWER: <answer>"
                parts.push(`${whyLabel}: ${q}\n${ansLabel}: ${a}`);
              } else if (q) {
                parts.push(`${whyLabel}: ${q}`);
              } else if (a) {
                parts.push(`${ansLabel}: ${a}`);
              } else {
                parts.push(JSON.stringify(v));
              }
            } else {
              parts.push(String(v));
            }
          }
          // separate each Q/A pair by a blank line for readability
          _hintText = parts.join('\n\n');
        } else {
          _hintText = String(hr);
        }
      } else {
        _hintText = JSON.stringify(_hintRaw);
      }
    }
    return _hintText;
  }, [currentQ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-full px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => (onBack ? onBack() : navigate(-1))}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <h1 className="text-slate-800">{mode === 'exam' ? 'Exam' : 'Practice Questions'}</h1>

          <div />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 h-[calc(100vh-80px)]">
        <div className="bg-white border-r border-slate-200 overflow-y-auto">
          <div className="p-6">
            <h2 className="text-slate-800 mb-4">CONTEXT / ATTACHMENTS</h2>
            <div className="flex gap-2 mb-6 border-b border-slate-200">
              <button onClick={() => setActiveTab('description')} className={`px-4 py-2 ${activeTab === 'description' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}>
                Description
              </button>
              <button onClick={() => setActiveTab('photo')} className={`px-4 py-2 ${activeTab === 'photo' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}>
                Site Photo
              </button>
            </div>

            {activeTab === 'photo' ? (
              <div className="bg-slate-100 rounded-lg p-8 flex items-center justify-center min-h-[400px]">
                <ImageWithFallback
                  src={scenarioPhoto}
                  alt="scene"
                  className="max-w-full h-auto rounded-lg shadow-lg"
                />
              </div>
            ) : (
              <div className="text-slate-700">
                {scenarioSummary ? (
                  String(scenarioSummary).split(/\n\n/).map((para, pi) => (
                    <div key={`para-${pi}`} className="mb-2">
                      {para.split(/\n/).map((line, li) => (
                        <div key={`line-${pi}-${li}`} className="whitespace-pre-wrap">
                          {line}
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">No description available for this scenario.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white overflow-y-auto">
          <div className="p-6">
            <div className="mb-6">
              <span className="text-slate-500">Question</span>
            </div>

            {loading && <div>Loading questions…</div>}
            {error && <div className="text-red-600">{error}</div>}

            {currentQ ? (
              <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
                <h3 className="text-slate-800 mb-3">{currentQ.QuestionText}</h3>
                

                {currentQ.Type === '5-whys' ? (
                  // For 5-whys: only show the correct-answer block after the user clicks "Reveal Answer".
                  // Reveal button is shown in practice mode, so also require mode === 'practice'.
                  mode === 'practice' && revealAnswer && hintText ? (
                    <div className="p-3 rounded-md border bg-blue-50 border-blue-200 text-blue-800 mb-3">
                      <div className="text-sm font-medium mb-1">Correct Answer</div>
                      <div className="text-sm">
                        {String(hintText).split(/\n\n/).map((para, pi) => (
                          <div key={`para-${pi}`} className="mb-2">
                            {para.split(/\n/).map((line, li) => (
                              <div key={`line-${pi}-${li}`} className="whitespace-pre-wrap">
                                {line}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                ) : (
                  // Non-5-whys behavior: show hint in practice (hide in exam)
                  mode !== 'exam' && hintText && (
                    <div className="mb-3 p-3 rounded-md border bg-slate-100 border-slate-200 text-slate-800">
                      <div className="text-sm font-medium mb-1">Hint</div>
                      <div className="text-sm whitespace-pre-wrap">{hintText}</div>
                    </div>
                  )
                )}
                {/* Render by type */}
                {(() => {
                  const opts = derivedOptions;
                  const rawCorrect = safeParseJSON(currentQ.CorrectAnswersJSON);
                  const qid = String(currentQ.QuestionID);
                  const chosenRaw = answers[qid];
                  const chosen = (() => {
                    if (Array.isArray(chosenRaw)) {
                      return chosenRaw.map((c: any) => (typeof c === 'string' ? c : optionValue(c)));
                    }
                    if (typeof chosenRaw === 'string') {
                      const parsed = safeParseJSON(chosenRaw);
                      if (parsed && typeof parsed === 'object') {
                        return parsed;
                      }
                      return chosenRaw;
                    }
                    if (chosenRaw && typeof chosenRaw === 'object') {
                      return chosenRaw;
                    }
                    return null;
                  })();

                  const setChosen = (value: any) => setAnswers(a => ({ ...a, [qid]: value }));

                  // EARLY: form-g and form-g1 types -> show a button to open respective form page
                  // placed early so it takes precedence over other renderers
                  // Simple equality check as requested
                  if (currentQ.Type === 'form-g' || currentQ.Type === 'form-g1') {
                    const _label = currentQ.Type === 'form-g1' ? 'Form G1' : 'Form G';
                    const _path = currentQ.Type === 'form-g1' ? '/form-g1' : '/form-g';
                    return (
                      <div className="py-6">
                        <p className="text-slate-700 mb-3">This question requires a detailed form.</p>
                        <button
                          onClick={() => navigate(`${_path}${mode === 'exam' ? '?mode=exam' : ''}`, { state: { question: currentQ, mode, from: location.pathname } })}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {_label}
                        </button>
                      </div>
                    );
                  }

                  // mcq-single -> dropdown select
                  if (currentQ.Type === 'mcq-single') {
                    return (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Select answer</label>
                        {opts.map((op: any, idx: number) => (
                          <label key={idx} className="flex items-center gap-3 p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="radio"
                              name={`q-${currentQ.QuestionID}`}
                              checked={chosen === optionValue(op)}
                              onChange={() => setChosen(optionValue(op))}
                              className="w-5 h-5 text-blue-600"
                            />
                            <span className="text-slate-700">{optionLabel(op)}</span>
                          </label>
                        ))}
                      </div>
                    );
                  }

                  // 5-whys -> show five rows. first row shows the why prompt as label and a text input for the answer.
                  // other four rows show editable why & answer text fields for student to fill in.
                  if (currentQ.Type === '5-whys') {
                    try {
                      const fwRaw = safeParseJSON(currentQ.FiveWhysJSON) || {};

                      // normalize descriptors: support array `student_whys` OR object keyed by why_2..why_5
                      let descriptors: any[] = [];
                      if (Array.isArray(fwRaw.student_whys)) {
                        descriptors = fwRaw.student_whys.slice(0, 4);
                      } else if (fwRaw.student_whys && typeof fwRaw.student_whys === 'object') {
                        descriptors = Object.keys(fwRaw.student_whys).map(k => {
                          const v = fwRaw.student_whys[k];
                          const num = (v && typeof v.why_number === 'number') ? v.why_number : (parseInt(String(k).replace(/\D/g, ''), 10) || null);
                          return {
                            why_number: num,
                            question_placeholder: v?.question_placeholder ?? v?.question ?? '',
                            answer_placeholder: v?.answer_placeholder ?? '',
                          };
                        }).filter(d => d.why_number != null).sort((a,b) => a.why_number - b.why_number).slice(0,4);
                      }

                      // pad descriptors to 4 items if missing
                      while (descriptors.length < 4) {
                        const nextNum = 2 + descriptors.length;
                        descriptors.push({
                          why_number: nextNum,
                          question_placeholder: `Enter your ${ordinal(nextNum)} WHY question`,
                          answer_placeholder: 'Enter your answer',
                        });
                      }

                      const why1Question = fwRaw?.why_1?.question ?? (opts.length ? String(opts[0]) : 'Why 1');
                      const why1System = fwRaw?.why_1?.system_answer ?? '';

                      // Normalize stored answer shapes into canonical { why_1_answer, student_whys: [{why_number, question, answer}, ...] }
                      let existing: any = null;
                      if (chosen && typeof chosen === 'object' && !Array.isArray(chosen)) {
                        // if already in our canonical shape
                        if ('why_1_answer' in chosen || Array.isArray(chosen.student_whys)) {
                          existing = chosen;
                        } else {
                          // legacy: object keyed by why_1..why_5 or why_2..why_5
                          // convert to canonical shape
                          const why_1_answer = (typeof chosen.why_1 === 'string') ? chosen.why_1 : (chosen.why_1?.answer ?? '');
                          const student_whys: any[] = [];
                          for (let i = 2; i <= 5; i++) {
                            const key = `why_${i}`;
                            const val = chosen[key];
                            let question = '';
                            let answer = '';
                            if (typeof val === 'string') {
                              answer = val;
                            } else if (val && typeof val === 'object') {
                              answer = val.answer ?? '';
                              question = val.question ?? '';
                            }
                            student_whys.push({
                              why_number: i,
                              question: question || '',
                              answer,
                            });
                          }
                          existing = { why_1_answer, student_whys };
                        }
                      } else {
                        // default empty canonical shape
                        existing = {
                          why_1_answer: '',
                          student_whys: descriptors.map(d => ({ why_number: d.why_number, question: '', answer: '' })),
                        };
                      }

                      // Ensure array copy (non-mutating)
                      const studentArr: any[] = Array.isArray(existing.student_whys) ? existing.student_whys.concat([]) : descriptors.map(d => ({ why_number: d.why_number, question: d.question_placeholder, answer: '' }));
                      while (studentArr.length < 4) studentArr.push({ why_number: 2 + studentArr.length, question: descriptors[studentArr.length]?.question_placeholder ?? '', answer: '' });

                      const updateWhy1Answer = (v: string) => {
                        setChosen({ ...existing, why_1_answer: v, student_whys: studentArr });
                      };
                      const updateStudentQuestion = (i: number, v: string) => {
                        const copy = studentArr.concat();
                        copy[i] = { ...copy[i], question: String(v ?? '') };
                        setChosen({ ...existing, student_whys: copy, why_1_answer: existing.why_1_answer });
                      };
                      const updateStudentAnswer = (i: number, v: string) => {
                        const copy = studentArr.concat();
                        copy[i] = { ...copy[i], answer: String(v ?? '') };
                        setChosen({ ...existing, student_whys: copy, why_1_answer: existing.why_1_answer });
                      };

                      return (
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium text-slate-700 mb-1">{String(why1Question)}</div>

                            {why1System ? (
                              <div className="mb-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                                <div className="text-sm font-medium text-slate-600 mb-1">System answer</div>
                                <div className="text-sm">{String(why1System)}</div>
                              </div>
                            ) : (
                              <input
                                type="text"
                                placeholder="Your answer"
                                value={String(existing.why_1_answer || '')}
                                onChange={(e) => updateWhy1Answer(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                          </div>

                          {studentArr.map((sd: any, idx: number) => {
                            const displayQuestion = String(sd.question ?? '');
                            const displayAnswer = String(sd.answer ?? '');
                            return (
                              <div key={sd.why_number} className="grid grid-cols-1 gap-2">
                                <label className="text-sm font-medium text-slate-700">Why {sd.why_number}</label>
                                <input
                                  type="text"
                                  placeholder={descriptors[idx]?.question_placeholder ?? `Why ${sd.why_number}`}
                                  value={displayQuestion}
                                  onChange={(e) => updateStudentQuestion(idx, e.target.value)}
                                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                                />
                                <input
                                  type="text"
                                  placeholder={descriptors[idx]?.answer_placeholder ?? 'Enter your answer'}
                                  value={displayAnswer}
                                  onChange={(e) => updateStudentAnswer(idx, e.target.value)}
                                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    } catch (err) {
                      console.error('5-whys render error', err);
                      const fwRaw = safeParseJSON(currentQ.FiveWhysJSON);
                      return (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-800">
                          <div className="font-medium mb-2">Error rendering 5-whys</div>
                          <pre className="text-xs whitespace-pre-wrap">{String(err)}</pre>
                          <div className="mt-2 text-xs">
                            <div><strong>FiveWhysJSON (parsed):</strong></div>
                            <pre className="whitespace-pre-wrap">{JSON.stringify(fwRaw, null, 2)}</pre>
                          </div>
                          <div className="mt-2 text-xs">
                            <div><strong>chosenRaw:</strong></div>
                            <pre className="whitespace-pre-wrap">{JSON.stringify(chosenRaw, null, 2)}</pre>
                          </div>
                        </div>
                      );
                    }
                  }

                  // mcq-multiselect / mcq / multi -> checkboxes
                  if (currentQ.Type === 'mcq' || currentQ.Type === 'multi' || currentQ.Type === 'mcq-multiselect') {
                    const chosenArr: string[] = Array.isArray(chosen) ? chosen : [];
                    return (
                      <div className="space-y-3">
                        {opts.map((op: any, idx: number) => {
                          const val = optionValue(op);
                          return (
                            <label key={idx} className="flex items-center gap-3 p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={chosenArr.includes(val)}
                                onChange={(e) => {
                                  const prev = chosenArr.slice();
                                  if (e.target.checked) {
                                    if (!prev.includes(val)) prev.push(val);
                                  } else {
                                    const i = prev.indexOf(val);
                                    if (i >= 0) prev.splice(i, 1);
                                  }
                                  setChosen(prev);
                                }}
                                className="w-5 h-5 text-blue-600"
                              />
                              <span className="text-slate-700">{optionLabel(op)}</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  }

                  

                  // fallback: single-select radios (legacy behavior)
                  {
                    return (
                      <div className="space-y-3">
                        {opts.map((op: any, idx: number) => (
                          <label key={idx} className="flex items-center gap-3 p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="radio"
                              name={`q-${currentQ.QuestionID}`}
                              checked={chosen === optionValue(op)}
                              onChange={() => setChosen(optionValue(op))}
                              className="w-5 h-5 text-blue-600"
                            />
                            <span className="text-slate-700">{optionLabel(op)}</span>
                          </label>
                        ))}
                      </div>
                    );
                  }

                  
                })()}

                {/* Practice hint + visual correct-answer display (practice mode only) */}
                {mode === 'practice' && currentQ && (
                  <div className="mt-8">
                    {(() => {
                      

                      // normalize helper -> returns sorted unique array of strings, or null when input is null/undefined
                      const normalize = (v: any): string[] | null => {
                        if (v == null) return null;
                        const arr = Array.isArray(v) ? v.slice() : [v];
                        const mapped = arr
                          .map((x: any) => (typeof x === 'string' ? x : optionValue(x)))
                          .map((s: any) => String(s).trim())
                          .filter((s: string) => s !== '');
                        const unique = Array.from(new Set(mapped));
                        unique.sort();
                        return unique;
                      };

                      // Normalize CorrectAnswersJSON taking numeric indices into account.
                      // If an element in correct answers is a number (or numeric string), treat it as an index into `derivedOptions`.
                      const normalizeCorrectWithIndices = (raw: any, options: any[] | undefined): string[] | null => {
                        if (raw == null) return null;
                        const arr = Array.isArray(raw) ? raw.slice() : [raw];
                        const mapped = arr.map((x: any) => {
                          // numeric index (number or numeric string)
                          if (typeof x === 'number' || (typeof x === 'string' && /^\d+$/.test(x.trim()))) {
                            const idx = typeof x === 'number' ? x : parseInt(x, 10);
                            if (Array.isArray(options) && options[idx] !== undefined) {
                              return String(optionValue(options[idx]));
                            }
                            // no matching option - fall back to the index string
                            return String(x);
                          }
                          // if it's an object or non-numeric string - try to normalize to optionValue
                          return typeof x === 'string' ? x : optionValue(x);
                        })
                        .map((s: any) => String(s).trim())
                        .filter((s: string) => s !== '');
                        const unique = Array.from(new Set(mapped));
                        unique.sort();
                        return unique;
                      };

                      const rawCorrect = safeParseJSON(currentQ.CorrectAnswersJSON);
                      const normalizedCorrect = normalizeCorrectWithIndices(rawCorrect, derivedOptions);

                      const chosenVal = answers[String(currentQ.QuestionID)];
                      const normalizedChosen = normalize(chosenVal);

                      // consider "attempted" only when there is at least one chosen value
                      const attempted = Array.isArray(normalizedChosen) && normalizedChosen.length > 0;

                      // both must be non-null arrays to compare; otherwise not attempted or no correct provided
                      const isCorrect = attempted && Array.isArray(normalizedCorrect) && JSON.stringify(normalizedCorrect) === JSON.stringify(normalizedChosen);

                      // compute class for the answer block:
                      // - green when attempted & correct
                      // - red when attempted & incorrect
                      // - keep existing blue styling when not attempted
                      const answerBlockClass = attempted
                        ? (isCorrect
                            ? 'p-3 rounded-md border bg-green-50 border-green-200 text-green-800'
                            : 'p-3 rounded-md border bg-red-50 border-red-200 text-red-800')
                        : 'p-3 rounded-md border bg-blue-50 border-blue-200 text-blue-800';

                      // helper to map a normalized value back to a readable label using derivedOptions
                      const labelFor = (val: string) => {
                        if (!derivedOptions || derivedOptions.length === 0) return val;
                        // try to find matching option by normalized optionValue
                        const found = derivedOptions.find((op: any) => optionValue(op) === val);
                        if (found !== undefined) return optionLabel(found);
                        return val;
                      };

                      return (
                        <>
                          
                          {revealAnswer && normalizedCorrect && (
                            <div className={answerBlockClass}>
                              <div className="text-sm font-medium mb-1">Correct Answer</div>
                              <div className="text-sm">
                                {normalizedCorrect.map((v: string, i: number) => (
                                  <span key={v} className="inline-block mr-2">
                                    {labelFor(v)}
                                    {i < normalizedCorrect.length - 1 ? ',' : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div>No question selected</div>
            )}

            <div className="flex gap-4 w-full items-center">
              {mode === 'practice' ? (
                <>
                  <button
                    onClick={() => setRevealAnswer(r => !r)}
                    className="px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {revealAnswer ? 'Hide Answer' : 'Reveal Answer'}
                  </button>

                  {currentQuestion < totalQuestions ? (
                    <button
                      onClick={handleNext}
                      className="ml-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      className="ml-auto px-6 py-3 w-40 sm:w-52 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      SUBMIT
                    </button>
                  )}
                </>
              ) : (
                // exam / other modes: keep existing behaviour (Submit only on last question)
                <>
                  {currentQuestion === totalQuestions ? (
                    mode === 'exam' ? (
                      <button
                        onClick={() => setShowSubmitModal(true)}
                        className="ml-auto px-6 py-3 w-auto bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        SUBMIT EXAM
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        className="ml-auto flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        SUBMIT
                      </button>
                    )
                  ) : (
                    <button
                      onClick={handleNext}
                      className="ml-auto flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Next
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <SubmissionConfirmationModal
          questionsAnswered={totalQuestions}
          totalQuestions={totalQuestions}
          onCancel={() => setShowSubmitModal(false)}
          onConfirm={() => { setShowSubmitModal(false); handleSubmit(); }}
        />
      )}
    </div>
  );
}