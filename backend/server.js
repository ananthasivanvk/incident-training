import http from 'http';
import url from 'url';
import { StringDecoder } from 'string_decoder';
import querystring from 'querystring';
import dotenv from 'dotenv';
import {
  getPool,
  getUserByIdentifier,
  getScenarios,
  getPracticeScenarios,
  getPerformanceCriteria,
  getQuestionsByScenarioAndPC,
  getCorrectAnswersForQuestionIds,
  insertResult,
  getRecentResultsForStudent,
  insertUser,
  updateUserByIdentifier,
  setUserStatusByIdentifier,
  getUsers,
  deleteUserAndDataByIdentifier,
  getExamResults,
  updateResultGrade,
  countActiveStudents,
  countExamAttempts,
  getExamGradeStats,
  countPendingGrades,
  insertFormG,
  getFormGByKeys,
  insertFormG1,
  getFormG1ByKeys,
} from './db.js';
// bcrypt intentionally not used per requirements (plaintext compare)

dotenv.config();

const {
  APP_PORT,
} = process.env;
const PORT = Number(APP_PORT) || 3001;

function sendJSON(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve) => {
    const decoder = new StringDecoder('utf-8');
    let buffer = '';
    req.on('data', (data) => {
      buffer += decoder.write(data);
    });
    req.on('end', () => {
      buffer += decoder.end();
      try {
        const parsed = buffer ? JSON.parse(buffer) : {};
        resolve(parsed);
      } catch (e) {
        resolve({});
      }
    });
  });
}

async function handleLogin(req, res) {
  const body = await parseBody(req);
  const { identifier, password } = body || {};
  if (!identifier || !password) {
    return sendJSON(res, 400, { success: false, message: 'Missing identifier or password' });
  }
  try {
    const user = await getUserByIdentifier(identifier);
    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'User not found' });
    }
    const stored = user.UserPassword;
    const ok = String(stored) === String(password);
    if (!ok) {
      return sendJSON(res, 200, { success: false, message: 'Invalid credentials' });
    }
    const publicUser = {
      UserId: user.UserId,
      FullName: user.FullName,
      UserRole: user.UserRole,
      OrgUserId: user.OrgUserId,
      UserEmail: user.UserEmail,
      Status: user.Status || 'Active',
    };
    return sendJSON(res, 200, { success: true, user: publicUser });
  } catch (err) {
    console.error('Login error', err);
    return sendJSON(res, 500, { success: false, message: 'Server error' });
  }
}

async function handleGetScenarios(req, res) {
  try {
    const rows = await getScenarios();
    return sendJSON(res, 200, rows);
  } catch (err) {
    console.error('Scenarios error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}


async function handleGetPracticeScenarios(req, res) {
  try {
    const rows = await getPracticeScenarios();
    return sendJSON(res, 200, rows);
  } catch (err) {
    console.error('Scenarios error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}

async function handleGetPerformanceCriteria(req, res) {
  try {
    const rows = await getPerformanceCriteria();
    return sendJSON(res, 200, rows);
  } catch (err) {
    console.error('PerformanceCriteria error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}

async function handleGetQuestions(req, res, query) {
  const scenarioId = query.scenarioId;
  const pc = query.pc;
  if (!scenarioId || !pc) {
    return sendJSON(res, 400, { message: 'Missing scenarioId or pc' });
  }
  try {
    const rows = await getQuestionsByScenarioAndPC(scenarioId, pc);
    return sendJSON(res, 200, rows);
  } catch (err) {
    console.error('Questions error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}
/**
 * HTTP handler that grades and saves practice/exam answers for a student.
 *
 * Behavior & validation:
 * - Parses request body with `parseBody(req)` (tolerant JSON parsing).
 * - Expects `{ studentId, answers, mode }` in the body:
 *     - `studentId` (required) — identifier for the submitting student.
 *     - `answers` (required) — array of answer objects; each answer should include at least `questionId` and `chosenAnswer`.
 *     - `mode` (optional) — when set to `'exam'` the submission is recorded with `PracticeStatus = 'exam'` and not auto-graded.
 * - If `studentId` is missing or `answers` is not an array, responds 400 with `{ saved: false, message: 'Missing studentId or answers' }`.
 * - If no `questionId` values are present in `answers`, responds 400 with `{ saved: false, message: 'No questionId in answers' }`.
 *
 * Main flow:
 * - Collects distinct question IDs referenced in `answers` and calls `getCorrectAnswersForQuestionIds(qIds)` to fetch
 *   DB metadata for grading: `CorrectAnswersJSON` and `OptionsJSON`.
 * - Parses `CorrectAnswersJSON` and `OptionsJSON` robustly (handles already-parsed objects, JSON strings,
 *   and some JS-like string variants). Logs debug info on parse failures but continues with best-effort defaults.
 * - Uses an internal helper (`mapChosenToIndexes`) to map the submitted `chosenAnswer` (string/number/array/object)
 *   to option index-strings relative to `options` (when available). Falls back to returning the raw chosen value
 *   if options are not available or matching fails.
 * - Normalizes both chosen indexes and correct answers to sorted string arrays (`normalizeIndexes`) and compares them
 *   to determine correctness.
 * - For each `answers` entry:
 *     - Determines `PracticeStatus`:
 *         - If `mode === 'exam'` -> `'exam'`.
 *         - Else if correct -> `'completed'`.
 *         - Else -> `'pending'`.
 *     - Persists the attempt by calling `insertResult(studentId, questionId, ChosenAnswerString, UploadedDocLink, PracticeStatus)`.
 * - Computes `gradeSummary` with `totalQuestions`, `correctCount`, and integer `percent`.
 * - On success responds 200 `{ saved: true, gradeSummary }`.
 *
 * Grading details & tolerances:
 * - Compares normalized arrays (sorted string arrays) for equality to determine correctness; this handles multi-select answers.
 * - Tries multiple parsing strategies for DB JSON fields (straight JSON.parse, single-quote replacement fallback).
 * - Tries loose matching when mapping chosen text to option indexes (exact normalized match, then contains-based match).
 * - Treats numeric-looking chosen values as indexes when in range.
 *
 * Error handling & logging:
 * - Logs unexpected errors with `console.error('Practice submit error', err)` and responds 500 `{ saved: false, message: 'Server error' }`.
 * - Does not throw on malformed per-question metadata; it uses best-effort grading and still persists results.
 *
 * Side effects:
 * - Calls `getCorrectAnswersForQuestionIds`, `insertResult`, and may write debug logs via `console.debug`.
 *
 * Example payload:
 * {
 *   studentId: "student-123",
 *   mode: "practice",
 *   answers: [
 *     { questionId: 42, chosenAnswer: "Yes", uploadedDocLink: null },
 *     { questionId: 43, chosenAnswer: [0,2] }
 *   ]
 * }
 *
 * @async
 * @param {http.IncomingMessage} req - Node HTTP request object (body parsed via `parseBody`).
 * @param {http.ServerResponse} res - Node HTTP response object (used via `sendJSON`).
 * @returns {Promise<void>} Sends an HTTP response and resolves.
 */
async function handlePracticeSubmit(req, res) {
  const body = await parseBody(req);
  const { studentId, answers, mode } = body || {};
  if (!studentId || !Array.isArray(answers)) {
    return sendJSON(res, 400, { saved: false, message: 'Missing studentId or answers' });
  }

  try {
    // Collect question IDs referenced in payload
    const qIds = answers.map(a => a.questionId).filter(Boolean).map(String);
    if (qIds.length === 0) {
      return sendJSON(res, 400, { saved: false, message: 'No questionId in answers' });
    }

    // Fetch correct answers + options for the involved question IDs
    const rows = await getCorrectAnswersForQuestionIds(qIds);

    // Map meta (correct + options) by stringified QuestionID for stable lookup
    const questionMeta = new Map();
    for (const r of rows) {
      // parse CorrectAnswersJSON robustly (may be JSON string or already parsed)
      let correct = null;
      if (r.CorrectAnswersJSON != null) {
        if (typeof r.CorrectAnswersJSON === 'string') {
          try {
            correct = JSON.parse(r.CorrectAnswersJSON);
          } catch (e) {
            // try a tolerant fallback replacing single quotes with double quotes (best-effort)
            try {
              correct = JSON.parse(r.CorrectAnswersJSON.replace(/'/g, '"'));
            } catch (e2) {
              console.debug('CorrectAnswersJSON parse error', {
                questionId: r.QuestionID,
                CorrectAnswersJSON: r.CorrectAnswersJSON,
                errorMessage: e2 && e2.message ? e2.message : String(e2)
              });
              correct = null;
            }
          }
        } else {
          correct = r.CorrectAnswersJSON;
        }
      } else {
        correct = null;
      }

      // parse OptionsJSON robustly (may be JSON string, JS value, or JS-like string)
      let options = null;
      if (r.OptionsJSON != null) {
        if (typeof r.OptionsJSON === 'string') {
          try {
            options = JSON.parse(r.OptionsJSON);
          } catch (e) {
            // best-effort fallback for strings that use single quotes or are JS literals
            try {
              options = JSON.parse(r.OptionsJSON.replace(/'/g, '"'));
            } catch (e2) {
              console.debug('OptionsJSON parse error', {
                questionId: r.QuestionID,
                OptionsJSON: r.OptionsJSON,
                errorMessage: e2 && e2.message ? e2.message : String(e2)
              });
              options = null;
            }
          }
        } else {
          // already a parsed JS value (mysql2 may return objects for JSON columns)
          options = r.OptionsJSON;
        }
      } else {
        options = null;
      }
      questionMeta.set(String(r.QuestionID), { correct, options });
    }

    // helper: map a chosen value (string/number/array) into index string(s) relative to options array
    const mapChosenToIndexes = (chosen, options) => {
      if (chosen == null) return [];

      const toArray = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') {
          // try parse JSON (some frontends send JSON string)
          try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) return parsed;
          } catch {}
          return [v];
        }
        return [v];
      };

      const chosenArr = toArray(chosen);

      // If options not available, attempt best-effort: if chosen looks numeric, return it
      if (!Array.isArray(options) || options.length === 0) {
        return chosenArr.map(x => String(x));
      }

      // Helper to normalize strings for matching
      const norm = (s) => (s == null ? '' : String(s).trim().toLowerCase());

      // normalize options: create array of possible normalized match tokens for each option
      const optionTokens = options.map(opt => {
        if (opt == null) return [norm(opt)];
        if (typeof opt === 'string' || typeof opt === 'number') return [norm(opt)];
        // object — try common fields, normalized
        const candidates = [];
        if (opt.value !== undefined) candidates.push(norm(opt.value));
        if (opt.id !== undefined) candidates.push(norm(opt.id));
        if (opt.key !== undefined) candidates.push(norm(opt.key));
        if (opt.text !== undefined) candidates.push(norm(opt.text));
        if (opt.label !== undefined) candidates.push(norm(opt.label));
        // also stringify the whole object as a fallback
        try { candidates.push(norm(JSON.stringify(opt))); } catch {}
        return Array.from(new Set(candidates.filter(c => c !== ''))); // unique non-empty
      });

      // For each chosen item, try to find matching option index
      const indexes = [];
      for (const c of chosenArr) {
        const cStrRaw = String(c);
        const cStr = norm(cStrRaw);

        // if chosen looks numeric and in range, treat as index (0-based)
        if (/^\d+$/.test(cStrRaw)) {
          const idx = Number(cStrRaw);
          if (idx >= 0 && idx < options.length) {
            indexes.push(String(idx));
            continue;
          }
        }

        let found = false;
        for (let i = 0; i < optionTokens.length; i++) {
          const tokens = optionTokens[i];
          for (const t of tokens) {
            if (t === cStr) {
              indexes.push(String(i));
              found = true;
              break;
            }
          }
          if (found) break;
        }

        // If not found, try a loose contains match (helpful for variations)
        if (!found) {
          for (let i = 0; i < optionTokens.length && !found; i++) {
            for (const t of optionTokens[i]) {
              if (t && cStr && (t.includes(cStr) || cStr.includes(t))) {
                indexes.push(String(i));
                found = true;
                break;
              }
            }
          }
        }

        // if still not found, add the raw chosen string as fallback
        if (!found) indexes.push(cStrRaw);
      }

      // return normalized index-strings
      return indexes;
    };

    // helper: normalize to sorted string array
    const normalizeIndexes = (arr) => {
      if (arr == null) return [];
      let a = null;

      if (Array.isArray(arr)) {
        a = arr.map(String);
      } else {
        // try parse if string
        if (typeof arr === 'string') {
          try {
            const p = JSON.parse(arr);
            if (Array.isArray(p)) {
              a = p.map(String);
            } else {
              // parsed to non-array (object/number/string) -> wrap as single item
              a = [String(p)];
            }
          } catch {
            // not JSON -> treat as single value
            a = [String(arr)];
          }
        } else {
          // not array and not string (maybe number/object) -> cast to single element
          try {
            a = [String(arr)];
          } catch {
            a = [];
          }
        }
      }

      // ensure a is an array before sorting
      if (!Array.isArray(a)) a = [];
      return a.sort();
    };

    let correctCount = 0;
    const totalQuestions = answers.length;

    for (const ans of answers) {
      const qidStr = String(ans.questionId);
      const meta = questionMeta.get(qidStr) || {};
      const correctAns = meta.correct; // may be array of indexes
      const options = meta.options; // may be array of option strings/objects

      let PracticeStatus = 'pending';

      if (mode === 'exam') {
        PracticeStatus = 'exam';
      } else {
        if (correctAns != null) {
          // Map chosen answer text -> index(es)
          const chosenIndexes = mapChosenToIndexes(ans.chosenAnswer, options);
          const chosenNorm = normalizeIndexes(chosenIndexes);
          const correctNorm = normalizeIndexes(correctAns);

          const isCorrect = JSON.stringify(chosenNorm) === JSON.stringify(correctNorm);
          if (!isCorrect) {
            console.debug('grading-mismatch', {
              qid: qidStr,
              options,
              correctAns,
              chosen: ans.chosenAnswer,
              chosenIndexes,
              chosenNorm,
              correctNorm
            });
          }
          if (isCorrect) {
            PracticeStatus = 'completed';
            correctCount++;
          } else {
            PracticeStatus = 'pending';
          }
        } else {
          PracticeStatus = 'pending';
        }
      }

      const UploadedDocLink = ans.uploadedDocLink || null;
      const ChosenAnswer = (() => {
        try {
          return typeof ans.chosenAnswer === 'string' ? ans.chosenAnswer : JSON.stringify(ans.chosenAnswer);
        } catch {
          return String(ans.chosenAnswer);
        }
      })();

      await insertResult(studentId, qidStr, ChosenAnswer, UploadedDocLink, PracticeStatus);
    }

    const percent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    return sendJSON(res, 200, {
      saved: true,
      gradeSummary: { totalQuestions, correctCount, percent },
    });
  } catch (err) {
    console.error('Practice submit error', err);
    return sendJSON(res, 500, { saved: false, message: 'Server error' });
  }
}

async function handleGetResults(req, res, query) {
  const studentId = query.studentId;
  const limit = Number(query.limit || 10);
  if (!studentId) {
    return sendJSON(res, 400, { message: 'Missing studentId' });
  }
  try {
    const rows = await getRecentResultsForStudent(studentId, limit);
    // Map to friendly shape for frontend
    const results = (rows || []).map(r => ({
      resultId: r.ResultId,
      questionId: r.QuestionId,
      question: r.QuestionText || '',
      questionType: r.Type || undefined,
      options: r.OptionsJSON != null ? r.OptionsJSON : undefined,
      correctAnswers: r.CorrectAnswersJSON != null ? r.CorrectAnswersJSON : undefined,
      fiveWhys: r.FiveWhysJSON != null ? r.FiveWhysJSON : undefined,
      scenario: r.ScenarioId || '',
      criterion: r.PC || '',
      shortSummary: r.ShortSummary || null,
      chosenAnswer: r.ChosenAnswer,
      uploadedDocLink: r.UploadedDocLink,
      grade: r.Grade != null ? String(r.Grade) : null,
      facultyComments: r.FacultyComments || null,
      status: r.PracticeStatus || null,
      // source DB has no timestamp field; frontend can display '--' if null
      date: r.CreatedDate || null
    }));
    return sendJSON(res, 200, results);
  } catch (err) {
    console.error('Results error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}

async function handleCreateUser(req, res) {
  const body = await parseBody(req);
  const { fullName, email, employeeId, role, password } = body || {};
  if (!fullName || !email || !employeeId || !role || !password) {
    return sendJSON(res, 400, { success: false, message: 'Missing required fields' });
  }
  try {
    const insertResult = await insertUser({
      fullName,
      userRole: role,
      userEmail: email,
      userPassword: password,
      orgUserId: employeeId,
      status: 'Active'
    });

    // Fetch created user via identifier
    const created = await getUserByIdentifier(employeeId) || {};
    const publicUser = {
      UserId: created.UserId || insertResult.insertId || null,
      FullName: created.FullName || fullName,
      UserRole: created.UserRole || role,
      OrgUserId: created.OrgUserId || employeeId,
      UserEmail: created.UserEmail || email,
      Status: created.Status || 'Active'
    };
    return sendJSON(res, 200, { success: true, user: publicUser });
  } catch (err) {
    console.error('Create user error', err);
    if (err && err.code === 'ER_DUP_ENTRY') {
      return sendJSON(res, 409, { success: false, message: 'Email or OrgUserId already exists' });
    }
    return sendJSON(res, 500, { success: false, message: 'Server error' });
  }
}

async function handleUpdateUser(req, res) {
  const body = await parseBody(req);
  const { id, fullName, status, promoteToFaculty, password, email } = body || {};
  if (!id) {
    return sendJSON(res, 400, { success: false, message: 'Missing id' });
  }
  try {
    const updates = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (status !== undefined) updates.status = status;
    if (promoteToFaculty === true) updates.userRole = 'Faculty';
    if (promoteToFaculty === false && body.userRole) updates.userRole = body.userRole;
    if (password !== undefined) updates.userPassword = password;
    if (email !== undefined) updates.userEmail = email;

    const result = await updateUserByIdentifier(id, updates);
    if (result && result.affectedRows >= 0) {
      const updated = await getUserByIdentifier(id);
      return sendJSON(res, 200, { success: true, user: updated || null });
    } else {
      return sendJSON(res, 400, { success: false, message: 'Update failed' });
    }
  } catch (err) {
    console.error('Update user error', err);
    return sendJSON(res, 500, { success: false, message: 'Server error' });
  }
}

async function handleDeactivateUser(req, res) {
  const body = await parseBody(req);
  const { id } = body || {};
  if (!id) {
    return sendJSON(res, 400, { success: false, message: 'Missing id' });
  }
  try {
    const result = await setUserStatusByIdentifier(id, 'Inactive');
    if (result && result.affectedRows > 0) {
      const updated = await getUserByIdentifier(id);
      return sendJSON(res, 200, { success: true, user: updated || null });
    } else {
      return sendJSON(res, 404, { success: false, message: 'User not found' });
    }
  } catch (err) {
    console.error('Deactivate user error', err);
    return sendJSON(res, 500, { success: false, message: 'Server error' });
  }
}

async function handleGetUsers(req, res) {
  try {
    const rows = await getUsers();
    // map to a simple shape the frontend expects
    const users = (rows || []).map(r => ({
      userId: r.UserId,
      fullName: r.FullName,
      role: r.UserRole,
      orgUserId: r.OrgUserId,
      email: r.UserEmail,
      status: r.Status || 'Active'
    }));
    return sendJSON(res, 200, users);
  } catch (err) {
    console.error('Get users error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}
/**
 * HTTP handler that returns aggregated faculty-facing statistics.
 *
 * Behavior:
 * - Calls DB helpers to collect metrics:
 *     - `countActiveStudents()` -> total active students (number)
 *     - `countExamAttempts()` -> total exam attempts (number)
 *     - `getExamGradeStats()` -> object `{ graded, passed }` where `graded` is number of graded attempts and `passed` is number passed
 *     - `countPendingGrades()` -> number of exam attempts pending manual grading
 * - Computes `avgPassRate` as `Math.round((passed / graded) * 100)` when `graded > 0`, otherwise `0`.
 * - Responds with 200 and a JSON object containing:
 *     - `totalStudents` (number)
 *     - `totalExamAttempts` (number)
 *     - `avgPassRate` (integer percent)
 *     - `graded` (number)
 *     - `passed` (number)
 *     - `pendingGrading` (number)
 *
 * Error handling:
 * - Logs unexpected errors via `console.error` and responds with 500 and `{ message: 'Server error' }`.
 *
 * Notes / assumptions:
 * - DB helpers are expected to return numeric values (or values coercible to numbers).
 * - The handler performs no authorization or request-parameter validation; it simply returns server-side aggregated stats.
 * - Values are returned as-is (after minimal numeric coercion) for the frontend to display.
 *
 * Side effects:
 * - Calls `countActiveStudents`, `countExamAttempts`, `getExamGradeStats`, `countPendingGrades`.
 * - Uses `sendJSON(res, status, body)` to send responses and `console.error` for logging.
 *
 * @async
 * @param {http.IncomingMessage} req - Node HTTP request object (not used by this handler).
 * @param {http.ServerResponse} res - Node HTTP response object (used via `sendJSON`).
 * @returns {Promise<void>} Sends an HTTP response and resolves.
 */
async function handleGetFacultyStats(req, res) {
  try {
    const totalStudents = await countActiveStudents();
    const totalExamAttempts = await countExamAttempts();
    const { graded, passed } = await getExamGradeStats();
    const pendingGrading = await countPendingGrades();
    const avgPassRate = graded > 0 ? Math.round((passed / graded) * 100) : 0;
    return sendJSON(res, 200, {
      totalStudents,
      totalExamAttempts,
      avgPassRate, // integer percent
      graded,
      passed,
      pendingGrading
    });
  } catch (err) {
    console.error('Faculty stats error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}

async function handleDeleteUser(req, res) {
  const body = await parseBody(req);
  const { id } = body || {}; // id expected to be OrgUserId or email
  if (!id) {
    return sendJSON(res, 400, { success: false, message: 'Missing id' });
  }

  try {
    const result = await deleteUserAndDataByIdentifier(id);
    if (result && result.deletedUserRows > 0) {
      return sendJSON(res, 200, {
        success: true,
        message: 'User and data deleted',
        deletedUserId: result.userId,
        deletedResults: result.deletedResultRows
      });
    } else {
      return sendJSON(res, 404, { success: false, message: 'User not found' });
    }
  } catch (err) {
    console.error('Delete user error', err);
    return sendJSON(res, 500, { success: false, message: 'Server error' });
  }
}

// Helper converters (place near other helper functions in server.js)
function boolToTiny(v) {
  return v ? 1 : 0;
}
function yesNoToEnum(v) {
  if (v === 'Yes' || v === 'yes' || v === true) return 'Yes';
  if (v === 'No' || v === 'no' || v === false) return 'No';
  return null;
}
/**
 * Normalize a date-like value to an ISO `YYYY-MM-DD` string or return `null` for invalid/empty input.
 *
 * This helper accepts common date representations produced by UIs and attempts to
 * produce a stable `YYYY-MM-DD` value suitable for DB insertion or further processing.
 *
 * Behavior:
 * - If the input `s` is falsy (`undefined`, `null`, `''`, etc.), the function returns `null`.
 * - Attempts to construct a `Date` from `s` (via `new Date(s)`):
 *   - If the constructed Date is valid, returns `date.toISOString().slice(0, 10)` (UTC date portion).
 *   - If the Date is invalid, returns `null`.
 *
 * Examples:
 * - `toDateISO('2023-08-05')` -> `'2023-08-05'`
 * - `toDateISO('August 5, 2023')` -> `'2023-08-05'` (when the environment `Date` parser accepts that format)
 * - `toDateISO(new Date('2023-08-05T12:00:00Z'))` -> `'2023-08-05'`
 * - `toDateISO('')` -> `null`
 *
 * Caveats / Notes:
 * - The function relies on the JavaScript `Date` parser which is implementation-dependent for non-ISO inputs.
 *   Prefer providing ISO-like inputs (`YYYY-MM-DD` or full ISO timestamps) for reliable behavior.
 * - The returned date is derived from the Date's UTC ISO string (so the local timezone may affect the resulting
 *   day if the input includes a time component). If you need local-date semantics, convert explicitly before calling.
 * - The function intentionally returns `null` for unparseable values rather than throwing.
 *
 * @param {string|number|Date|null|undefined} s - Date-like input to normalize.
 * @returns {string|null} `YYYY-MM-DD` normalized string, or `null` if input is empty/invalid.
 */
function toDateISO(s) {
  if (!s) return null;
  // Accept YYYY-MM-DD or Date-ish strings
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
/**
 * Normalize a time-like value to an `HH:MM:SS` string or return `null` for invalid/empty input.
 *
 * This function accepts a variety of time representations commonly produced by UIs:
 * - Strings in `HH:MM` or `HH:MM:SS` format (one- or two-digit hours allowed).
 * - ISO-like time fragments (e.g. `07:30`, `7:30:00`, `07:30:00.000Z`).
 * - Values that can be parsed by the `Date` constructor when combined with a fixed date.
 *
 * Behavior:
 * - If `s` is falsy (`undefined`, `null`, `''`, etc.) the function returns `null`.
 * - If `s` matches the regex for `HH:MM` or `HH:MM:SS`, it returns:
 *     - For `HH:MM` -> `HH:MM:00`
 *     - For `HH:MM:SS` -> `HH:MM:SS`
 *   Hours and minutes may be one or two digits; seconds are optional.
 * - Otherwise, it attempts a fallback by creating a `Date` from `1970-01-01T${s}` and,
 *   if valid, returns the `HH:MM:SS` portion from the resulting Date's `toTimeString()`.
 * - If parsing fails, the function returns `null`.
 *
 * Caveats:
 * - The fallback `Date` parsing depends on the JS environment and may interpret timezone
 *   information in `s`; callers should prefer supplying a plain `HH:MM[:SS]` string.
 * - The function intentionally returns `null` for unparseable values rather than throwing.
 *
 * Examples:
 * - `toTimeHHMMSS("7:5")` -> `"7:05:00"`
 * - `toTimeHHMMSS("07:30")` -> `"07:30:00"`
 * - `toTimeHHMMSS("13:45:22")` -> `"13:45:22"`
 * - `toTimeHHMMSS("")` -> `null`
 *
 * @param {string|number|Date|null|undefined} s - Time-like input to normalize.
 * @returns {string|null} `HH:MM:SS` normalized string, or `null` if input is empty/invalid.
 */
function toTimeHHMMSS(s) {
  if (!s) return null;
  // Accept "HH:MM" or "HH:MM:SS" or ISO time
  const m = String(s).match(/^(\d{1,2}:\d{2})(?::(\d{2}))?/);
  if (m) {
    return m[2] ? `${m[1]}:${m[2]}` : `${m[1]}:00`;
  }
  // fallback: try parsing ISO
  const d = new Date(`1970-01-01T${s}`);
  if (!isNaN(d.getTime())) {
    return d.toTimeString().split(' ')[0];
  }
  return null;
}

/**
 * Maps a nested Form G payload object from a client request to a flat database row object.
 *
 * This function takes a potentially complex, nested JavaScript object (typically from a JSON
 * payload) and transforms it into a single-level object where keys correspond to the column
 * names in the `FormGTbl` database table.
 *
 * Key transformations include:
 * - Flattening nested objects (e.g., `p.reportingEntity.nameOfEntity` becomes `row.reporting_name_of_entity`).
 * - Handling multiple possible key names from the payload (e.g., `p.questionid`, `p.questionId`) using nullish coalescing.
 * - Normalizing data types for database insertion using helper functions:
 *   - `toDateISO` for date strings.
 *   - `toTimeHHMMSS` for time strings.
 *   - `boolToTiny` to convert boolean-like values to 1 or 0.
 *   - `yesNoToEnum` to convert boolean-like values or 'Yes'/'No' strings to a 'Yes'/'No' enum.
 * - Safely accessing and mapping array data, such as `actionsTaken`.
 *
 * @param {object} p - The raw payload object for Form G, typically parsed from the request body.
 * @returns {object} A flattened object with snake_case keys, ready for database insertion.
 */
function mapFormGPayloadToRow(p) {
  const row = {};

  // questionid and studentid
  row.questionid = p.questionid ?? p.questionId ?? p.questionID ?? null;
  row.studentid = p.studentid ?? p.studentId ?? null;

  // mode
  row.modeofexam = p.modeofexam ?? p.mode ?? 'exam';

  // Notification
  row.notification_to = p.notificationTo ?? p.notification_to ?? null;
  row.notification_date = toDateISO(p.notificationDate ?? p.notification_date);

  // Reporting entity
  const rep = p.reportingEntity || {};
  row.reporting_name_of_entity = rep.nameOfEntity ?? rep.name ?? null;
  row.reporting_sector = rep.sector ?? null;
  row.reporting_classification_code = rep.classificationCode ?? rep.classification_code ?? null;
  row.reporting_registration_number = rep.registrationNumber ?? rep.registration_number ?? null;
  row.reporting_address = rep.address ?? null;
  row.reporting_authorized_contact = rep.authorizedContactPerson ?? rep.authorized_contact_person ?? null;
  row.reporting_email = rep.email ?? null;
  row.reporting_telephone = rep.telephone ?? null;
  row.reporting_mobile = rep.mobile ?? null;
  row.reporting_incident_no = rep.incidentNo ?? rep.incident_no ?? null;

  // Contractor
  const c = p.contractorInfo || {};
  row.contractor_reporting_on_behalf = yesNoToEnum(c.reportingOnBehalf ?? c.reporting_on_behalf) ?? null;
  row.contractor_name = c.name ?? null;
  row.contractor_business_type = c.businessType ?? c.business_type ?? null;
  row.contractor_address = c.address ?? null;

  // Incident info
  const inc = p.incidentInfo || {};
  row.incident_date = toDateISO(inc.date ?? inc.incident_date);
  row.incident_time = toTimeHHMMSS(inc.time ?? inc.incident_time);
  row.incident_type = inc.incidentType ?? inc.incident_type ?? null;
  row.mechanism_schedule_a = boolToTiny(inc.mechanismScheduleA ?? inc.mechanism_schedule_a);
  row.mechanism_schedule_b = boolToTiny(inc.mechanismScheduleB ?? inc.mechanism_schedule_b);
  row.mechanism_schedule_c = boolToTiny(inc.mechanismScheduleC ?? inc.mechanism_schedule_c);

  // Other consequences
  const oc = inc.otherConsequences || {};
  row.consequence_restricted_workday = boolToTiny(oc.restrictedWorkdayCase ?? oc.restricted_workday_case);
  row.consequence_medical_treatment = boolToTiny(oc.medicalTreatmentCase ?? oc.medical_treatment_case);
  row.consequence_first_aid = boolToTiny(oc.firstAidCases ?? oc.first_aid_cases);
  row.consequence_equipment_damage = boolToTiny(oc.equipmentPropertyDamage ?? oc.equipment_property_damage);

  // Narrative
  row.incident_description = inc.description ?? null;
  row.incident_location_on_site = inc.locationOnSite ?? inc.incident_location_on_site ?? null;
  row.incident_workplace_address = inc.workplaceAddress ?? inc.incident_workplace_address ?? null;
  row.incident_region = inc.region ?? null;

  // Applicable reports & attachments
  const ar = inc.applicableReports || {};
  row.report_police = boolToTiny(ar.police);
  row.report_medical = boolToTiny(ar.medical);
  row.report_other = boolToTiny(ar.other);
  row.report_other_specify = ar.otherSpecify ?? null;
  const att = ar.attachments || {};
  row.attach_police = yesNoToEnum(att.policeAttached ?? att.police_attached) ?? null;
  row.attach_medical = yesNoToEnum(att.medicalAttached ?? att.medical_attached) ?? null;
  row.attach_other = yesNoToEnum(att.otherAttached ?? att.other_attached) ?? null;

  // Injury immediate types
  const iit = p.injuryImmediateTypes || {};
  row.inj_restricted_or_unable_next_shift = boolToTiny(iit.restrictedWorkOrUnableNextShift);
  row.inj_inpatient_hospital_treatment = boolToTiny(iit.inpatientHospitalTreatment);
  row.inj_treatment_within_48h_exposure = boolToTiny(iit.treatmentWithin48hExposure);
  row.inj_fracture_excl_fingers_toes = boolToTiny(iit.fractureExcludingFingersToes);
  row.inj_electric_shock_or_burn = boolToTiny(iit.electricShockOrBurn);
  row.inj_loss_body_part_or_amputation = boolToTiny(iit.lossOfBodyPartOrOrganAmputation);
  row.inj_serious_burns_thermal_chemical = boolToTiny(iit.seriousBurnsThermalChemical);
  row.inj_loss_of_consciousness_or_resus = boolToTiny(iit.lossOfConsciousnessOrResuscitation);
  row.inj_entrapment_in_machinery = boolToTiny(iit.entrapmentInMachinery);
  row.inj_serious_head_injury = boolToTiny(iit.seriousHeadInjury);
  row.inj_spinal_injury = boolToTiny(iit.spinalInjury);
  row.inj_serious_eye_injury_loss_sight = boolToTiny(iit.seriousEyeInjuryLossOfSight);
  row.inj_dislocation_of_joints = boolToTiny(iit.dislocationOfJoints);
  row.inj_loss_of_bodily_function = boolToTiny(iit.lossOfBodilyFunction);
  row.inj_exposure_hazardous_material = boolToTiny(iit.exposureToHazardousMaterial);
  row.inj_serious_laceration = boolToTiny(iit.seriousLaceration);
  row.inj_scalping_or_degloving = boolToTiny(iit.scalpingOrDegloving);
  row.inj_other_specify = iit.other ?? null;

  // Injury severity
  row.injury_severity_known = p.injurySeverityKnown ?? null;

  // Injured Person
  const ip = p.injuredPerson || {};
  row.injured_name = ip.name ?? null;
  row.injured_occupation = ip.occupation ?? null;
  row.injured_relationship_with_entity = ip.relationshipWithEntity ?? null;
  row.injured_nationality = ip.nationality ?? null;
  row.injured_date_of_birth = toDateISO(ip.dateOfBirth ?? ip.injured_date_of_birth);
  row.injured_passport_number = ip.passportNumber ?? null;
  row.injured_length_service_years = ip.lengthOfServiceYears ?? null;
  row.injured_length_service_months = ip.lengthOfServiceMonths ?? null;
  row.injured_contact_phone = ip.contactPhone ?? null;
  row.injured_gender = ip.gender ?? null;

  // ActionsTaken -> up to 5 entries
  const actions = Array.isArray(p.actionsTaken) ? p.actionsTaken : [];
  for (let i = 0; i < 5; i++) {
    const a = actions[i] || {};
    row[`action${i + 1}_action`] = a.action ?? null;
    row[`action${i + 1}_responsibility`] = a.responsibility ?? null;
    row[`action${i + 1}_status`] = a.status ?? null;
  }

  // Declaration
  const dec = p.declaration || {};
  row.declaration_agreed = boolToTiny(dec.agreed);
  row.declaration_official_stamp = dec.officialStamp ?? null;
  row.declaration_date = toDateISO(dec.date);

  // SRA Official Use
  const sra = p.sraOfficialUse || {};
  row.sra_requires_reporting_adphc = yesNoToEnum(sra.requiresReportingToADPHC) ?? null;
  row.sra_requires_investigation_followup = yesNoToEnum(sra.requiresSRAInvestigationFollowup) ?? null;
  row.sra_remarks = sra.remarks ?? null;
  row.sra_relevant_authority_stamp = sra.relevantAuthorityStamp ?? null;
  row.sra_entered_name = sra.enteredIntoDatabaseBy?.name ?? null;
  row.sra_entered_date = toDateISO(sra.enteredIntoDatabaseBy?.date);
  row.sra_reviewed_by_name = sra.reviewedBy?.name ?? null;

  return row;
}

/**
 * HTTP handler that saves a Form G payload into the database.
 *
 * Behavior and validation:
 * - Parses request body using `parseBody(req)` (tolerant JSON parsing).
 * - Accepts multiple key variants for the question identifier:
 *     - `questionid` | `questionId` | `questionID` (required).
 * - Accepts multiple key variants for the student identifier:
 *     - `studentid` | `studentId` (required).
 * - If `questionid` or `studentid` is missing the handler responds with 400:
 *     - `{ success: false, message: 'Missing questionid' }` or
 *       `{ success: false, message: 'Missing studentId' }`.
 *
 * Main flow:
 * - Calls `mapFormGPayloadToRow(body)` to flatten and normalize the incoming nested payload
 *   into DB column names and normalized values (dates, times, booleans, etc.).
 * - Coerces `studentid` to `Number` and `questionid` to `String` before insert:
 *     - `row.studentid = Number(studentid);`
 *     - `row.questionid = String(questionid);`
 * - Calls the DB helper `insertFormG(row)` to persist the flattened row.
 * - On success responds with 200 and `{ success: true, insertId: <id|null> }`.
 *
 * Error handling:
 * - If the DB helper throws an error with `err.code === 'ER_BAD_FIELD_ERROR'` the handler
 *   responds with 400 and a helpful message indicating a payload/column mismatch:
 *     - `{ success: false, message: 'Invalid field for insert — check payload keys match DB columns', detail: String(err) }`
 * - Any other unexpected errors are logged with `console.error` and produce a 500:
 *     - `{ success: false, message: 'Server error' }`.
 *
 * Notes / assumptions:
 * - `studentid` is required and taken from the request body; in production this should
 *   be derived from authentication/session rather than trusting the request body.
 * - The handler relies on `mapFormGPayloadToRow` for normalization; it does not deeply
 *   validate individual field formats beyond presence of required identifiers.
 * - The DB helper `insertFormG` is expected to accept the object returned by the mapper.
 *
 * Side effects:
 * - Calls `mapFormGPayloadToRow`, `insertFormG`, `sendJSON(res, ...)` and `console.error`.
 *
 * @async
 * @param {http.IncomingMessage} req - Node HTTP request object (body parsed via `parseBody`).
 * @param {http.ServerResponse} res - Node HTTP response object (used via `sendJSON`).
 * @returns {Promise<void>} Sends an HTTP response and resolves.
 */
async function handleSaveFormG(req, res) {
  const body = await parseBody(req);
  // accept questionid / questionId etc
  const questionid = body?.questionid ?? body?.questionId ?? body?.questionID;
  if (!questionid) {
    return sendJSON(res, 400, { success: false, message: 'Missing questionid' });
  }

  // studentid required by DB - prefer server-side auth in production
  const studentid = body?.studentid ?? body?.studentId ?? null;
  if (!studentid) {
    return sendJSON(res, 400, { success: false, message: 'Missing studentId' });
  }

  try {
    // Map nested payload to DB column names
    const row = mapFormGPayloadToRow(body);

    // Ensure required columns for DB are present
    row.studentid = Number(studentid);
    row.questionid = String(questionid);

    // Insert into DB via existing helper
    const insertRes = await insertFormG(row);
    return sendJSON(res, 200, {
      success: true,
      insertId: insertRes && insertRes.insertId ? insertRes.insertId : null
    });
  } catch (err) {
    console.error('Save FormG error', err);
    // Surface DB column issues clearly for debugging
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      return sendJSON(res, 400, { success: false, message: 'Invalid field for insert — check payload keys match DB columns', detail: String(err) });
    }
    return sendJSON(res, 500, { success: false, message: 'Server error' });
  }
}
/**
 * HTTP handler that retrieves a stored Form G record for a given student, exam mode and question.
 *
 * Accepts a parsed `query` object and supports multiple key name variants:
 *  - student id: `studentid` | `studentId` | `studentID` (required)
 *  - mode: `modeofexam` | `mode` | `modeOfExam` (required)
 *  - question id: `questionid` | `questionId` | `QuestionID` (required)
 *
 * Behavior:
 *  - Validates presence of the three required keys; if any are missing, responds with
 *    400 and `{ message: 'Missing studentid, modeofexam or questionid' }`.
 *  - Coerces values to strings and calls `getFormGByKeys({ studentid, modeofexam, questionid })`.
 *  - If no row is returned, responds with 404 and `{ message: 'Form G not found' }`.
 *  - On success responds with 200 and the DB row (returned as-is).
 *  - On unexpected errors logs the error and responds with 500 and `{ message: 'Server error' }`.
 *
 * Notes:
 *  - Minimal validation is performed (presence only); values are forwarded as strings to the DB helper.
 *  - Side effects: calls `getFormGByKeys`, uses `sendJSON(res, ...)` to send responses and `console.error` to log errors.
 *
 * @async
 * @param {http.IncomingMessage} req - Node HTTP request object (not used directly by this handler).
 * @param {http.ServerResponse} res - Node HTTP response object (used via `sendJSON`).
 * @param {Object} query - Parsed query parameters (e.g. from `querystring.parse(req.url)`).
 * @returns {Promise<void>} Sends an HTTP response and resolves.
 */
async function handleGetFormG(req, res, query) {
  try {
    // Accept both studentId / studentid keys
    const studentid = query.studentid ?? query.studentId ?? query.studentID;
    const modeofexam = query.modeofexam ?? query.mode ?? query.modeOfExam;
    const questionid = query.questionid ?? query.questionId ?? query.QuestionID;

    if (!studentid || !modeofexam || !questionid) {
      return sendJSON(res, 400, { message: 'Missing studentid, modeofexam or questionid' });
    }

    const row = await getFormGByKeys({ studentid: String(studentid), modeofexam: String(modeofexam), questionid: String(questionid) });

    if (!row) {
      return sendJSON(res, 404, { message: 'Form G not found' });
    }

    return sendJSON(res, 200, row);
  } catch (err) {
    console.error('handleGetFormG error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}
/**
 * HTTP handler that retrieves a stored Form G1 record for a given student, exam mode and question.
 *
 * Accepts a parsed `query` object and supports multiple key name variants:
 *  - student id: `studentid` | `studentId` | `studentID` (required)
 *  - mode: `modeofexam` | `mode` | `modeOfExam` (required)
 *  - question id: `questionid` | `questionId` | `QuestionID` (required)
 *
 * Behavior:
 *  - Validates presence of the three required keys; if any are missing, responds with
 *    400 and `{ message: 'Missing studentid, modeofexam or questionid' }`.
 *  - Coerces values to strings and calls `getFormG1ByKeys({ studentid, modeofexam, questionid })`.
 *  - If no row is returned, responds with 404 and `{ message: 'Form G1 not found' }`.
 *  - On success responds with 200 and the DB row (returned as-is).
 *  - On unexpected errors logs the error and responds with 500 and `{ message: 'Server error' }`.
 *
 * Notes:
 *  - Minimal validation is performed (presence only); values are forwarded as strings to the DB helper.
 *  - Side effects: calls `getFormG1ByKeys`, uses `sendJSON(res, ...)` to send responses and `console.error` to log errors.
 *
 * @async
 * @param {http.IncomingMessage} req - Node HTTP request object (not used directly by this handler).
 * @param {http.ServerResponse} res - Node HTTP response object (used via `sendJSON`).
 * @param {Object} query - Parsed query parameters (e.g. from `querystring.parse(req.url)`).
 * @returns {Promise<void>} Sends an HTTP response and resolves.
 */
async function handleGetFormG1(req, res, query) {
  try {
    // Accept both studentId / studentid keys
    const studentid = query.studentid ?? query.studentId ?? query.studentID;
    const modeofexam = query.modeofexam ?? query.mode ?? query.modeOfExam;
    const questionid = query.questionid ?? query.questionId ?? query.QuestionID;

    if (!studentid || !modeofexam || !questionid) {
      return sendJSON(res, 400, { message: 'Missing studentid, modeofexam or questionid' });
    }

    const row = await getFormG1ByKeys({ studentid: String(studentid), modeofexam: String(modeofexam), questionid: String(questionid) });

    if (!row) {
      return sendJSON(res, 404, { message: 'Form G1 not found' });
    }

    return sendJSON(res, 200, row);
  } catch (err) {
    console.error('handleGetFormG error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}

/**
 * Convert a client Form G1 payload into a flat DB row object for insertion into FormG1Tbl.
 *
 * This function accepts a (usually camelCase) payload representing the Form G1 UI and
 * maps it into a single-level object whose keys match the expected snake_case column
 * names in the database. It performs tolerant parsing and normalization for dates,
 * times, booleans and numeric values and applies sensible defaults where the UI
 * may omit fields.
 *
 * Mapping notes and behavior:
 * - IDs & mode:
 *   - Accepts multiple key variants for IDs: `questionid` | `questionId` | `questionID`.
 *   - `studentid` accepts `studentid` | `studentId`.
 *   - `modeofexam` defaults to `'exam'` when absent.
 * - Dates and times:
 *   - Uses `toDateISO(...)` to normalize date-like strings to `YYYY-MM-DD` or `null`.
 *   - Uses `toTimeHHMMSS(...)` to normalize time strings to `HH:MM:SS` or `null`.
 * - Booleans/flags:
 *   - Flags in payload are converted to numeric 1/0 where DB expects integers.
 *   - Where a string enum-like value is used, the function maps truthy values to 1.
 * - Arrays:
 *   - `injuredPersons`: only the first injured person (index 0) is mapped (FormG1Tbl stores single injured person).
 *   - `actionsTakenImmediately`: maps up to 3 actions (fields `action1_*`..`action3_*`).
 *   - `incidentRootCauses`: maps the first three causes into `incident_root_cause1..3`.
 *   - `correctiveActionsToPreventRecurrence`: maps up to 3 corrective actions into `corr1..corr3`.
 *   - `incidentCosts`: maps by index to known `cost_*` columns and computes `cost_total`.
 * - Risk assessment and additional fields:
 *   - Maps `riskAssessment` fields to `risk_probability`, `risk_severity`, `risk_residual`.
 *   - Copies additional info and various declarations, converting booleans to 1/0 and dates via `toDateISO`.
 * - Robustness:
 *   - Uses nullish coalescing to accept multiple input key names and to fall back to `null`.
 *   - Converts numeric-looking fields where appropriate (e.g., length of service).
 *   - Does not perform DB validation; it only formats the row object expected by the DB helper.
 *
 * Side effects:
 * - No network or DB side effects — returns a plain object.
 * - Relies on helper functions in the module: `toDateISO` and `toTimeHHMMSS` and local boolean checks.
 *
 * Example usage:
 *   const row = mapFormG1PayloadToRow(payload);
 *   // then pass `row` to your DB insert helper (e.g. `insertFormG1(row)`).
 *
 * @param {Object} [p={}] - The raw Form G1 payload (typically request body). Missing keys are tolerated.
 * @returns {Object} A flattened row object with snake_case keys suitable for DB insertion.
 */
function mapFormG1PayloadToRow(p = {}) {
  const row = {};

  // Basic IDs
  row.questionid = p.questionid ?? p.questionId ?? p.questionID ?? null;
  row.studentid = p.studentid ?? p.studentId ?? null;
  row.modeofexam = p.modeofexam ?? p.mode ?? 'exam';

  // Part A – incident / reporting
  row.reporting_to = p.reportingTo ?? p.reporting_to ?? null;
  row.reporting_date = toDateISO(p.reportingDate ?? p.reporting_date);
  row.incident_no = p.incidentNo ?? p.incident_no ?? null;

  row.entity_name = p.entityName ?? null;
  row.sector = p.sector ?? null;
  row.classification_code = p.classificationCode ?? p.classification_code ?? null;
  row.registration_number = p.registrationNumber ?? p.registration_number ?? null;
  row.entity_address = p.entityAddress ?? p.entity_address ?? null;
  row.authorized_contact_person = p.authorizedContactPerson ?? p.authorized_contact_person ?? null;
  row.email_address = p.emailAddress ?? null;
  row.telephone_number = p.telephoneNumber ?? null;
  row.mobile_number = p.mobileNumber ?? null;

  row.reporting_on_behalf_non_nominated_contractor = p.reportingOnBehalfNonNominatedContractor ?? p.reporting_on_behalf_non_nominated_contractor ?? null;
  row.contractor_name = p.contractorName ?? null;
  row.contractor_business_type = p.contractorBusinessType ?? p.contractor_business_type ?? null;
  row.contractor_address = p.contractorAddress ?? null;

  row.date_of_incident = toDateISO(p.dateOfIncident ?? p.date_of_incident);
  row.time_24hr = toTimeHHMMSS(p.time24hr ?? p.time_24hr);

  // incidentType is an object of flags -> map to the enum-like columns where applicable
  const it = p.incidentType || {};
  if (it.fatality) row.incident_fatality = 1;
  if (it.permanentTotalDisability) row.incident_permanent_total_disability = 1;
  if (it.permanentPartialDisability) row.incident_permanent_partial_disability = 1;
  if (it.lostWorkdaysInjury) row.incident_lost_workdays_injury = 1;
  if (it.lostWorkdaysOccupationalIllness) row.incident_lost_workdays_occupational_illness = 1;
  if (it.seriousDangerousOccurrence) row.incident_serious_dangerous_occurrence = 1;

  row.incident_details_description = p.incidentDetailsDescription ?? p.incident_details_description ?? null;
  row.incident_location_on_site = p.incidentLocationOnSite ?? p.incident_location_on_site ?? null;
  row.incident_workplace_address = p.incidentWorkplaceAddress ?? p.incident_workplace_address ?? null;

  row.region_where_incident_occurred = p.region ?? p.region_where_incident_occurred ?? null;

  // applicable reports
  if (p.applicableReports) {
    const ar = p.applicableReports;
    row.applicable_reports_police = ar.police ? 1 : 0;
    row.applicable_reports_medical = ar.medical ? 1 : 0;
    row.applicable_reports_investigation_photos = ar.investigationReportPhotos ? 1 : 0;
    row.applicable_reports_other = ar.other ? 1 : 0;
    row.applicable_reports_other_specify = ar.otherSpecify ?? null;
    row.applicable_attached_police = ar.attachedPolice ?? null;
    row.applicable_attached_medical = ar.attachedMedical ?? null;
    row.applicable_attached_investigation = ar.attachedInvestigation ?? null;
  }

  // injuredPersons -> pick first if present (FormG1Tbl stores single injured person)
  if (Array.isArray(p.injuredPersons) && p.injuredPersons.length > 0) {
    const ip = p.injuredPersons[0];
    row.injured_name = ip.name ?? null;
    row.injured_occupation = ip.occupation ?? null;
    row.injured_relationship = ip.relationship ?? null;
    row.injured_nationality = ip.nationality ?? null;
    row.injured_date_of_birth = toDateISO(ip.dateOfBirth ?? ip.injured_date_of_birth);
    row.injured_passport_number = ip.passportNumber ?? ip.injured_passport_number ?? null;
    row.injured_length_of_service_years = (ip.lengthOfServiceYears !== '' && ip.lengthOfServiceYears != null) ? Number(ip.lengthOfServiceYears) : null;
    row.injured_length_of_service_months = (ip.lengthOfServiceMonths !== '' && ip.lengthOfServiceMonths != null) ? Number(ip.lengthOfServiceMonths) : null;
    row.injured_contact_phone = ip.contactPhone ?? null;
    row.injured_gender = ip.gender ?? null;
  }

  // actionsTakenImmediately - map up to 3 actions (FormG1Tbl has 3 date fields in many schemas)
  const actions = Array.isArray(p.actionsTakenImmediately) ? p.actionsTakenImmediately : [];
  for (let i = 0; i < Math.min(3, actions.length); i++) {
    const a = actions[i] || {};
    row[`action${i+1}_action`] = a.action ?? null;
    row[`action${i+1}_responsibility`] = a.responsibility ?? null;
    row[`action${i+1}_date_completed`] = toDateISO(a.dateCompleted ?? a.date_completed);
  }

  // incident root causes (first three)
  if (Array.isArray(p.incidentRootCauses)) {
    row.incident_root_cause1 = p.incidentRootCauses[0] ?? null;
    row.incident_root_cause2 = p.incidentRootCauses[1] ?? null;
    row.incident_root_cause3 = p.incidentRootCauses[2] ?? null;
  }

  // corrective actions -> map up to 3
  const corr = Array.isArray(p.correctiveActionsToPreventRecurrence) ? p.correctiveActionsToPreventRecurrence : [];
  for (let i = 0; i < Math.min(3, corr.length); i++) {
    const c = corr[i] || {};
    row[`corr${i+1}_action`] = c.action ?? null;
    row[`corr${i+1}_person_responsible`] = c.personResponsible ?? c.person_responsible ?? null;
    row[`corr${i+1}_target_date`] = toDateISO(c.targetDate ?? c.target_date);
  }

  // costs mapping (map by index -> cost_* fields if available)
  const costs = Array.isArray(p.incidentCosts) ? p.incidentCosts : [];
  // The FormG1Tbl has specific cost columns; map common ones if available
  if (costs.length > 0) {
    // attempt to map by known order used in form (defaultCosts)
    if (costs[0]) row.cost_injury = (typeof costs[0].amount === 'number') ? costs[0].amount : null;
    if (costs[1]) row.cost_legal = (typeof costs[1].amount === 'number') ? costs[1].amount : null;
    if (costs[2]) row.cost_productivity = (typeof costs[2].amount === 'number') ? costs[2].amount : null;
    if (costs[3]) row.cost_asset_repair_maintenance = (typeof costs[3].amount === 'number') ? costs[3].amount : null;
    if (costs[4]) row.cost_asset_replacement = (typeof costs[4].amount === 'number') ? costs[4].amount : null;
    if (costs[5]) row.cost_enforcement_action = (typeof costs[5].amount === 'number') ? costs[5].amount : null;
    if (costs[6]) row.cost_area_restoration = (typeof costs[6].amount === 'number') ? costs[6].amount : null;
    if (costs[7]) row.cost_other = (typeof costs[7].amount === 'number') ? costs[7].amount : null;
    // compute total if not provided
    const total = costs.reduce((s, c) => s + (typeof c.amount === 'number' ? c.amount : 0), 0);
    row.cost_total = total || null;
  }

  // risk assessment
  if (p.riskAssessment) {
    row.risk_probability = p.riskAssessment.probability ?? null;
    row.risk_severity = p.riskAssessment.severity ?? null;
    row.risk_residual = p.riskAssessment.residualRisk ?? p.riskAssessment.residualRisk ?? null;
  }

  // additional info and declarations
  row.additional_information = p.additionalInformation ?? p.additional_information ?? null;

  // injured person declaration
  if (p.declarationInjuredPerson) {
    row.injured_decl_name_or_representative = p.declarationInjuredPerson.nameOrRepresentative ?? null;
    row.injured_decl_date = toDateISO(p.declarationInjuredPerson.date ?? p.declaration_injured_person_date);
  }

  // reporting entity declaration
  if (p.declarationReportingEntity) {
    const dr = p.declarationReportingEntity;
    row.entity_decl_info_true_correct_complete = dr.infoTrueCorrectComplete ? 1 : 0;
    row.entity_decl_complete_investigation_attached = dr.completeInvestigationReportAttached ? 1 : 0;
    row.entity_decl_relevant_evidence_included = dr.relevantEvidenceIncluded ? 1 : 0;
    row.entity_decl_corrective_actions_will_be_implemented = dr.correctiveActionsWillBeImplemented ? 1 : 0;
    row.entity_decl_status_closed_completed = dr.investigationStatusClosedCompleted ? 1 : 0;
    row.entity_decl_report_attached = dr.reportAttached ? 1 : 0;
    row.entity_decl_official_stamp = dr.officialStamp ?? null;
    row.entity_decl_date = toDateISO(dr.date ?? dr.entity_decl_date);
  }

  // SRA official use
  if (p.officialUseSRA) {
    const sra = p.officialUseSRA;
    row.sra_requires_reporting_to_adphc = sra.requiresReportingToADPHC ?? null;
    row.sra_requires_investigation_followup = sra.requiresSRAInvestigationFollowup ?? null;
    row.sra_remarks = sra.remarks ?? null;
    row.sra_relevant_authority_stamp = sra.relevantAuthorityStamp ?? null;
  }

  return row;
}
/**
 * HTTP handler that saves a Form G1 payload into the database.
 *
 * Behavior and validation:
 * - Parses the request body via `parseBody(req)`.
 * - Expects the body to include a question identifier (accepts `questionid` | `questionId` | `questionID`).
 * - Expects a `studentid` (accepts `studentid` | `studentId`) — required for DB insertion.
 * - If either required key is missing, responds with 400 and `{ saved: false, message: 'Missing questionid' }`
 *   or `{ saved: false, message: 'Missing studentid' }` as applicable.
 *
 * Main flow:
 * - Maps the incoming payload to DB column names using `mapFormG1PayloadToRow(body)`.
 * - Calls `insertFormG1(row)` to persist the flattened row.
 * - On success responds with 200 and `{ saved: true, insertId: <id|null> }`.
 *
 * Error handling:
 * - Logs unexpected errors with `console.error`.
 * - On error responds with 500 and `{ saved: false, message: 'Server error' }`.
 *
 * Notes / assumptions:
 * - The handler relies on `mapFormG1PayloadToRow` for normalization (dates, times, booleans).
 * - It does not coerce `studentid` to a numeric type before calling `insertFormG1`; the DB helper should accept the provided format.
 * - No further validation (e.g., value ranges or formats) is performed here — this handler focuses on presence checks and persistence.
 *
 * Side effects:
 * - Calls `mapFormG1PayloadToRow` and `insertFormG1`.
 * - Sends responses via `sendJSON(res, status, body)`.
 *
 * @async
 * @param {http.IncomingMessage} req - Node HTTP request object (body parsed with `parseBody`).
 * @param {http.ServerResponse} res - Node HTTP response object (used via `sendJSON`).
 * @returns {Promise<void>} Sends an HTTP response and resolves.
 */
async function handleSaveFormG1(req, res) {
  const body = await parseBody(req);
  // questionid required by UI
  const questionid = body?.questionid ?? body?.questionId ?? body?.questionID;
  if (!questionid) {
    return sendJSON(res, 400, { saved: false, message: 'Missing questionid' });
  }

  // studentid required by DB; in production derive from session/auth
  const studentid = body?.studentid ?? body?.studentId ?? null;
  if (!studentid) {
    return sendJSON(res, 400, { saved: false, message: 'Missing studentid' });
  }

  try {
    const row = mapFormG1PayloadToRow(body);

    // Use the db helper we added
    const insertResult = await insertFormG1(row);

    return sendJSON(res, 200, { saved: true, insertId: insertResult.insertId || null });
  } catch (err) {
    console.error('Save FormG1 error', err);
    return sendJSON(res, 500, { saved: false, message: 'Server error' });
  }
}
/**
 * HTTP handler that returns exam result rows, optionally filtered by student.
 *
 * Query parameters accepted (from `query` passed by the caller):
 *  - `studentId` (optional): when provided, results are scoped to this student.
 *  - `limit` (optional): maximum number of rows to return; coerced to Number, defaults to 200.
 *
 * Behavior:
 *  - Coerces `limit` to a Number and calls `getExamResults({ studentId, limit })`.
 *  - Maps database rows into a frontend-friendly shape. Important mapping rules:
 *    - `grade` normalization:
 *      - If `r.Grade` is numeric and equals `1` => `'Competent'`.
 *      - If `r.Grade` is numeric and equals `0` => `'Not Competent'`.
 *      - Otherwise preserves `r.Grade` as a string when present.
 *    - `scenario` is derived as `Scenario ${r.ScenarioId}` when `r.ShortSummary` is truthy, otherwise `String(r.ScenarioId || '')`.
 *    - `needsGrading` is true when `PracticeStatus` equals `'exam'` (case-insensitive) and `Grade == null`.
 *    - Fields passed through: `resultId`, `studentId`, `student`, `criterion`, `question`, `questionType`,
 *      `options`, `correctAnswers`, `fiveWhys`, `studentAnswer`, `facultyFeedback`, `date`, `questionId`, `status`.
 *
 * Responses:
 *  - 200: Array of mapped result objects.
 *  - 500: On unexpected errors, logs error and responds `{ message: 'Server error' }`.
 *
 * Side effects:
 *  - Calls `getExamResults`.
 *  - Uses `sendJSON(res, status, body)` to send responses and `console.error` for logging.
 *
 * @async
 * @param {http.IncomingMessage} req - Node HTTP request object (not used directly by handler).
 * @param {http.ServerResponse} res - Node HTTP response object (used via `sendJSON`).
 * @param {Object} query - Parsed query object (e.g. from `querystring.parse(req.url)`).
 * @returns {Promise<void>} Sends an HTTP response and resolves.
 */
async function handleGetExamResults(req, res, query) {
  try {
    const studentId = query.studentId;
    const limit = Number(query.limit || 200);
    const rows = await getExamResults({ studentId, limit });
       const results = (rows || []).map(r => {
      // Normalize grade: DB stores numeric (DECIMAL). Use convention:
      // 1 -> "Competent", 0 -> "Not Competent". Other numeric grades may be retained as-is.
      let mappedGrade = undefined;
      if (r.Grade != null) {
        // If grade is exactly 1 or 0, map to expected strings
        const asNum = Number(r.Grade);
        if (!Number.isNaN(asNum)) {
          if (asNum === 1) mappedGrade = 'Competent';
          else if (asNum === 0) mappedGrade = 'Not Competent';
          else mappedGrade = String(r.Grade); // preserve numeric/percent values
        } else {
          mappedGrade = String(r.Grade);
        }
      }

      return {
        resultId: r.ResultId,
        studentId: r.StudentId,
        student: r.StudentName || '',
        scenario: r.ShortSummary ? `Scenario ${r.ScenarioId}` : String(r.ScenarioId || ''),
        criterion: r.PC || '',
        question: r.QuestionText || '',
        questionType: r.Type || undefined,
        options: r.OptionsJSON != null ? r.OptionsJSON : undefined,
        correctAnswers: r.CorrectAnswersJSON != null ? r.CorrectAnswersJSON : undefined,
        fiveWhys: r.FiveWhysJSON != null ? r.FiveWhysJSON : undefined,
        studentAnswer: r.ChosenAnswer || '',
        facultyFeedback: r.FacultyComments || null,
        grade: mappedGrade,
        date: r.CreatedDate || null,
        needsGrading: String(r.PracticeStatus || '').toLowerCase() === 'exam' && (r.Grade == null),
        questionId: r.QuestionId,
        status: r.PracticeStatus || null
      };
    });
    return sendJSON(res, 200, results);
  } catch (err) {
    console.error('Get exam results error', err);
    return sendJSON(res, 500, { message: 'Server error' });
  }
}

/**
 * Handle grading an exam result.
 *
 * Parses the request body for { resultId, grade, facultyComments }, normalizes the incoming
 * grade into a numeric value compatible with the database, and updates the stored result.
 *
 * Grade normalization rules:
 *  - "Competent" (case-insensitive) => 1
 *  - "Not Competent", "not_competent", "not-competent" (case-insensitive) => 0
 *  - Numeric strings or numeric values are parsed and used as-is when parseable
 *  - Unparseable grade values result in an attempt to update only facultyComments (if provided);
 *    if neither a numeric grade nor facultyComments can be derived, a 400 response is returned
 *    with message "Unable to interpret grade value".
 *
 * Behavior / responses:
 *  - 400: Missing resultId or grade in the request body
 *  - 400: Unable to interpret grade value (neither a numeric grade nor facultyComments can be derived)
 *  - 200: { success: true } on successful update (affectedRows > 0)
 *  - 404: { success: false, message: 'Result not found' } when the update reports no affected rows
 *  - 500: { success: false, message: 'Server error' } on unexpected exceptions
 *
 * Side effects:
 *  - Calls updateResultGrade(resultId, payload) to persist changes
 *  - Uses sendJSON(res, status, body) to send HTTP responses
 *  - Logs errors to console.error on exceptions
 *
 * @async
 * @function handleGradeExamResult
 * @param {Object} req - HTTP request object; body will be parsed via parseBody(req)
 * @param {Object} res - HTTP response object; used with sendJSON to return JSON responses
 * @returns {Promise<void>} Resolves after sending the HTTP response.
 */
async function handleGradeExamResult(req, res) {
  const body = await parseBody(req);
  const { resultId, grade, facultyComments } = body || {};
  if (!resultId || (grade === undefined || grade === null)) {
    return sendJSON(res, 400, { success: false, message: 'Missing resultId or grade' });
  }

  try {
    // Map grade strings to numeric values to match the existing DB column type (DECIMAL).
    // Convention:
    //   "Competent" => 1
    //   "Not Competent" => 0
    // If the incoming grade is already numeric (or parseable), use that.
    let dbGrade = null;
    if (typeof grade === 'string') {
      const gLower = grade.trim().toLowerCase();
      if (gLower === 'competent') dbGrade = 1;
      else if (gLower === 'not competent' || gLower === 'not_competent' || gLower === 'not-competent') dbGrade = 0;
      else {
        // try numeric parse fallback
        const parsed = Number(grade);
        dbGrade = Number.isNaN(parsed) ? null : parsed;
      }
    } else if (typeof grade === 'number') {
      dbGrade = grade;
    } else {
      // fallback: stringify then attempt parse
      const parsed = Number(String(grade));
      dbGrade = Number.isNaN(parsed) ? null : parsed;
    }

    // If we couldn't derive a numeric grade, still attempt to set facultyComments only
    const payload = {};
    if (dbGrade != null) payload.grade = dbGrade;
    if (facultyComments !== undefined) payload.facultyComments = facultyComments;

    if (Object.keys(payload).length === 0) {
      return sendJSON(res, 400, { success: false, message: 'Unable to interpret grade value' });
    }

    const upd = await updateResultGrade(resultId, payload);
    if (upd && upd.affectedRows > 0) {
      return sendJSON(res, 200, { success: true });
    } else {
      return sendJSON(res, 404, { success: false, message: 'Result not found' });
    }
  } catch (err) {
    console.error('Grade exam result error', err);
    return sendJSON(res, 500, { success: false, message: 'Server error' });
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  const path = parsedUrl.pathname || '/';
  const method = req.method || 'GET';

  // Basic CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    });
    return res.end();
  }

  // Route handling
  try {
    if (method === 'POST' && path === '/api/auth/login') {
      return await handleLogin(req, res);
    }
    if (method === 'GET' && path === '/api/scenarios') {
      return await handleGetScenarios(req, res);
    }
    if (method === 'GET' && path === '/api/practiceScenarios') {
      return await handleGetPracticeScenarios(req, res);
    }
    if (method === 'GET' && path === '/api/performance-criteria') {
      return await handleGetPerformanceCriteria(req, res);
    }
    if (method === 'GET' && path === '/api/questions') {
      const query = querystring.parse(parsedUrl.query || '');
      return await handleGetQuestions(req, res, query);
    }
    if (method === 'POST' && path === '/api/practice/submit') {
      return await handlePracticeSubmit(req, res);
    }
    if (method === 'GET' && path === '/api/results') {
      const query = querystring.parse(parsedUrl.query || '');
      return await handleGetResults(req, res, query);
    }
    if (method === 'POST' && path === '/api/users') {
      return await handleCreateUser(req, res);
    }
    if (method === 'PUT' && path === '/api/users') {
      return await handleUpdateUser(req, res);
    }
    if (method === 'POST' && path === '/api/users/deactivate') {
      return await handleDeactivateUser(req, res);
    }
    if (method === 'GET' && path === '/api/users') {
      return await handleGetUsers(req, res);
    }
    if (method === 'POST' && path === '/api/users/delete') {
      return await handleDeleteUser(req, res);
    }
    if (method === 'GET' && path === '/api/exam-results') {
      const query = querystring.parse(parsedUrl.query || '');
      return await handleGetExamResults(req, res, query);
    }
    if (method === 'POST' && path === '/api/exam-results/grade') {
      return await handleGradeExamResult(req, res);
    }
    if (method === 'GET' && path === '/api/faculty-stats') {
      const query = querystring.parse(parsedUrl.query || '');
      return await handleGetFacultyStats(req, res, query);
    }

    if (method === 'POST' && path === '/api/formg') {
      return await handleSaveFormG(req, res);
    }

    if (method === 'GET' && path === '/api/formg') {
      const query = querystring.parse(parsedUrl.query || '');
      await handleGetFormG(req, res, query);
      return;
    }

    // inside server request handling routes switch/cases
    if (method === 'POST' && path === '/api/formG1') {
      await handleSaveFormG1(req, res);
      return;
    }

    if (method === 'GET' && path === '/api/formg1') {
      const query = querystring.parse(parsedUrl.query || '');
      await handleGetFormG1(req, res, query);
      return;
    }

    // Not found
    sendJSON(res, 404, { message: 'Not Found' });
  } catch (err) {
    console.error('Unhandled server error', err);
    sendJSON(res, 500, { message: 'Server error' });
  }
});

server.listen(Number(PORT), () => {
  console.log(`Server listening on port ${PORT}`);
});