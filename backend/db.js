import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const {
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME,
} = process.env;

let pool;

export async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASS,
            database: DB_NAME,

            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,

            ssl: {
              rejectUnauthorized: false
            }
          });
  }
  return pool;
}

// convenience helper if you want to run queries with one call
export async function query(sql, params = []) {
  const p = await getPool();
  return p.execute(sql, params);
}


/**
 * Retrieve a user record by organization user ID or email.
 *
 * Searches the UserTbl for a row where OrgUserId equals the provided identifier
 * OR UserEmail equals the provided identifier. The query returns at most one
 * record (LIMIT 1) and the first matching row is returned.
 *
 * @async
 * @param {string} identifier - The OrgUserId or UserEmail to look up.
 * @returns {Promise<{
 *   UserId: number,
 *   FullName: string,
 *   UserRole: string,
 *   OrgUserId: string,
 *   UserEmail: string,
 *   UserPassword: string,
 *   Status: string
 * } | null>} A promise that resolves with the user object if found, or null if no match.
 * @throws {Error} If the database query fails, the promise will reject with the underlying error.
 */
export async function getUserByIdentifier(identifier) {
  const p = await getPool();
  const [rows] = await p.execute(
    'SELECT UserId, FullName, UserRole, OrgUserId, UserEmail, UserPassword, Status FROM UserTbl WHERE OrgUserId = ? OR UserEmail = ? LIMIT 1',
    [identifier, identifier]
  );
  return rows && rows.length ? rows[0] : null;
}

/**
 * Retrieve all scenarios from the database table `ScenarioTbl`, ordered by `ScenarioId` descending.
 *
 * Each returned scenario object has the shape:
 * {
 *   ScenarioId: number,
 *   ScenarioType: string,
 *   ShortSummary: string,
 *   Summary: string,
 *   SitePhoto: (string|null)
 * }
 *
 * @async
 * @function
 * @name getScenarios
 * @returns {Promise<Array<{ScenarioId: number, ScenarioType: string, ShortSummary: string, Summary: string, SitePhoto: (string|null)}>>}
 *   A promise that resolves to an array of scenario objects. Resolves to an empty array if no rows are found.
 * @throws {Error} If acquiring the DB pool or executing the query fails.
 */
export async function getScenarios() {
  const p = await getPool();
  const [rows] = await p.execute(
    'SELECT ScenarioId, ScenarioType, ShortSummary, Summary, SitePhoto FROM ScenarioTbl  WHERE ScenarioType = ?  ORDER BY ScenarioId DESC',
    [String("Exam")]
  );
  return rows || [];
}


/**
 * Retrieve all scenarios from the database table `ScenarioTbl`, ordered by `ScenarioId` descending.
 *
 * Each returned scenario object has the shape:
 * {
 *   ScenarioId: number,
 *   ScenarioType: string,
 *   ShortSummary: string,
 *   Summary: string,
 *   SitePhoto: (string|null)
 * }
 *
 * @async
 * @function
 * @name getScenarios
 * @returns {Promise<Array<{ScenarioId: number, ScenarioType: string, ShortSummary: string, Summary: string, SitePhoto: (string|null)}>>}
 *   A promise that resolves to an array of scenario objects. Resolves to an empty array if no rows are found.
 * @throws {Error} If acquiring the DB pool or executing the query fails.
 */
export async function getPracticeScenarios() {
  const p = await getPool();
  const [rows] = await p.execute(
    'SELECT ScenarioId, ScenarioType, ShortSummary, Summary, SitePhoto FROM ScenarioTbl WHERE ScenarioType = ?  ORDER BY ScenarioId DESC', 
    [String("Practice")]
  );
  return rows || [];
}

/**
 * Retrieve all performance criteria from the PerformanceCriteria table.
 *
 * Queries the database connection pool and returns rows ordered by the `PC`
 * column in ascending order. Each result row is expected to contain the
 * following properties:
 *  - PC: identifier of the performance criteria (number|string)
 *  - PCTitle: title or name of the performance criteria (string)
 *
 * If no rows are found, an empty array is returned.
 *
 * @async
 * @function getPerformanceCriteria
 * @returns {Promise<Array<{PC: (number|string), PCTitle: string}>>} Promise resolving to an array of performance criteria rows.
 * @throws {Error} If obtaining the connection pool or executing the query fails.
 */
export async function getPerformanceCriteria() {
  const p = await getPool();
  const [rows] = await p.execute(
    'SELECT PC, PCTitle FROM PerformanceCriteria ORDER BY PC ASC'
  );
  return rows || [];
}

export async function getQuestionsByScenarioAndPC(scenarioId, pc) {
  const p = await getPool();
  const [rows] = await p.execute(
    'SELECT QuestionID, QuestionText, Type, ImageURL, OptionsJSON, CorrectAnswersJSON, FiveWhysJSON, HintJSON FROM QuestionsTbl WHERE ScenarioID = ? AND PC = ? ORDER BY QuestionID ASC',
    [String(scenarioId), pc]
  );
  return rows || [];
}

/**
 * Fetch correct answers and option data for a set of question IDs from the database.
 *
 * This async helper queries the QuestionsTbl for the provided question IDs and returns
 * an array of rows containing QuestionID, CorrectAnswersJSON and OptionsJSON for each match.
 * If the input is not an array or is an empty array, the function resolves to an empty array
 * immediately (no database query is performed).
 *
 * Notes:
 * - The query uses parameterized placeholders to supply IDs and help prevent SQL injection.
 * - The order of rows returned by the database is not guaranteed to match the order of qIds;
 *   callers should map results by QuestionID if a specific order is required.
 * - CorrectAnswersJSON and OptionsJSON are returned as stored (typically JSON strings).
 *   Parse them with JSON.parse(...) if you need JavaScript objects/arrays.
 *
 * @async
 * @function
 * @param {Array<number|string>} [qIds=[]] - Array of QuestionID values to fetch. If omitted,
 *   not an array, or an empty array, the function returns [].
 * @returns {Promise<Array<{QuestionID: number|string, CorrectAnswersJSON: string, OptionsJSON: string}>>}
 *   A promise that resolves to an array of result rows. Each row contains:
 *     - QuestionID: the id of the question,
 *     - CorrectAnswersJSON: the stored correct answer(s) in JSON form,
 *     - OptionsJSON: the stored options in JSON form.
 *   If no matching questions are found, an empty array is returned.
 * @throws {Error} If obtaining the DB pool or executing the query fails, the error is propagated.
 *
 * @example
 * // Get data for questions 1 and 2
 * const rows = await getCorrectAnswersForQuestionIds([1, 2]);
 * // Map by QuestionID for easy lookup
 * const map = Object.fromEntries(rows.map(r => [r.QuestionID, r]));
 */
export async function getCorrectAnswersForQuestionIds(qIds = []) {
  if (!Array.isArray(qIds) || qIds.length === 0) return [];
  const p = await getPool();
  const placeholders = qIds.map(() => '?').join(',');
  // also return OptionsJSON so the server can map chosen text -> index
  const [rows] = await p.execute(
    `SELECT QuestionID, CorrectAnswersJSON, OptionsJSON FROM QuestionsTbl WHERE QuestionID IN (${placeholders})`,
    qIds
  );
  return rows || [];
}

export async function insertResult(studentId, questionId, chosenAnswer, uploadedDocLink, practiceStatus) {
  const p = await getPool();
  return p.execute(
    'INSERT INTO ResultsTbl (StudentId, QuestionId, ChosenAnswer, UploadedDocLink, PracticeStatus) VALUES (?, ?, ?, ?, ?)',
    [studentId, questionId, chosenAnswer, uploadedDocLink, practiceStatus]
  );
}

/**
 * Retrieve the most recent results for a given student.
 *
 * The function obtains a connection pool via `getPool()` and executes a parameterized
 * query to return recent rows from ResultsTbl joined with QuestionsTbl and ScenarioTbl.
 * The `limit` argument is validated and clamped to the range [1, 100] to avoid SQL injection
 * when interpolating the LIMIT clause.
 *
 * Returned row objects include fields from ResultsTbl, QuestionsTbl and ScenarioTbl:
 * - ResultId, StudentId, QuestionId, ChosenAnswer, UploadedDocLink, Grade,
 *   FacultyComments, PracticeStatus, CreatedDate
 * - ScenarioId (q.ScenarioID), PC, QuestionText, Type
 * - OptionsJSON, CorrectAnswersJSON, FiveWhysJSON
 * - ShortSummary (from ScenarioTbl)
 *
 * @async
 * @function getRecentResultsForStudent
 * @param {number|string} studentId - The ID of the student to fetch results for. Passed as a bound SQL parameter.
 * @param {number} [limit=10] - Optional maximum number of results to return. Will be parsed as an integer and clamped to [1, 100].
 * @returns {Promise<Array<Object>>} Promise that resolves to an array of result objects (possibly empty).
 * @throws {Error} If acquiring the DB pool or executing the query fails, the underlying error is propagated.
 *
 * @example
 * // Fetch up to 5 recent results for student with id 42
 * const rows = await getRecentResultsForStudent(42, 5);
 */
export async function getRecentResultsForStudent(studentId, limit = 10) {
  const p = await getPool();
  // Validate / sanitize limit to avoid SQL injection when interpolating
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const sql = `
    SELECT
      r.ResultId,
      r.StudentId,
      r.QuestionId,
      r.ChosenAnswer,
      r.UploadedDocLink,
      r.Grade,
      r.FacultyComments,
      r.PracticeStatus,
      r.CreatedDate,
      q.ScenarioID AS ScenarioId,
      q.PC AS PC,
      q.QuestionText AS QuestionText,
      q.Type AS Type,
      q.OptionsJSON AS OptionsJSON,
      q.CorrectAnswersJSON AS CorrectAnswersJSON,
      q.FiveWhysJSON AS FiveWhysJSON,
      s.ShortSummary AS ShortSummary
    FROM ResultsTbl r
    LEFT JOIN QuestionsTbl q ON q.QuestionID = r.QuestionId
    LEFT JOIN ScenarioTbl s ON s.ScenarioId = q.ScenarioID
    WHERE r.StudentId = ?
    ORDER BY r.ResultId DESC
    LIMIT ${lim}
  `;
  const [rows] = await p.execute(sql, [studentId]);
  return rows || [];
}

// Insert a new user. Expects OrgUserId to be the employee/student/staff ID.
export async function insertUser({ fullName, userRole, userEmail, userPassword, orgUserId, status = 'Active' }) {
  const p = await getPool();
  const [result] = await p.execute(
    'INSERT INTO UserTbl (FullName, UserRole, UserEmail, UserPassword, OrgUserId, Status) VALUES (?, ?, ?, ?, ?, ?)',
    [fullName, userRole, userEmail, userPassword, orgUserId, status]
  );
  return result;
}

// Update user by identifier (OrgUserId or UserEmail).
export async function updateUserByIdentifier(identifier, updates = {}) {
  if (!identifier) throw new Error('Missing identifier');
  const p = await getPool();

  const fields = [];
  const params = [];

  if (updates.fullName !== undefined) {
    fields.push('FullName = ?');
    params.push(updates.fullName);
  }
  if (updates.userRole !== undefined) {
    fields.push('UserRole = ?');
    params.push(updates.userRole);
  }
  if (updates.status !== undefined) {
    fields.push('Status = ?');
    params.push(updates.status);
  }
  if (updates.userPassword !== undefined) {
    fields.push('UserPassword = ?');
    params.push(updates.userPassword);
  }
  if (updates.userEmail !== undefined) {
    fields.push('UserEmail = ?');
    params.push(updates.userEmail);
  }
  if (fields.length === 0) {
    // nothing to update
    return { affectedRows: 0 };
  }

  // update by OrgUserId or UserEmail
  const sql = `UPDATE UserTbl SET ${fields.join(', ')} WHERE OrgUserId = ? OR UserEmail = ?`;
  params.push(identifier, identifier);
  const [result] = await p.execute(sql, params);
  return result;
}

export async function setUserStatusByIdentifier(identifier, status) {
  if (!identifier) throw new Error('Missing identifier');
  const p = await getPool();
  const [result] = await p.execute(
    'UPDATE UserTbl SET Status = ? WHERE OrgUserId = ? OR UserEmail = ?',
    [status, identifier, identifier]
  );
  return result;
}

export async function getUsers() {
  const p = await getPool();
  const [rows] = await p.execute(
    'SELECT UserId, FullName, UserRole, OrgUserId, UserEmail, Status FROM UserTbl ORDER BY FullName ASC'
  );
  return rows || [];
}

// Delete a user and associated exam/practice data by OrgUserId or UserEmail.
// Returns an object with info about deletes.
export async function deleteUserAndDataByIdentifier(identifier) {
  if (!identifier) throw new Error('Missing identifier');

  const p = await getPool();

  // First find the user to obtain UserId (for ResultsTbl.StudentId)
  const [userRows] = await p.execute(
    'SELECT UserId FROM UserTbl WHERE OrgUserId = ? OR UserEmail = ? LIMIT 1',
    [identifier, identifier]
  );
  const user = userRows && userRows.length ? userRows[0] : null;

  // If user not found by OrgUserId/email, attempt nothing
  if (!user) {
    return { deletedUserRows: 0, deletedResultRows: 0, userId: null };
  }

  const userId = user.UserId;

  // Delete results associated with this user
  const [delResults] = await p.execute(
    'DELETE FROM ResultsTbl WHERE StudentId = ?',
    [userId]
  );

  // Delete the user row
  const [delUser] = await p.execute(
    'DELETE FROM UserTbl WHERE UserId = ?',
    [userId]
  );

  return {
    userId,
    deletedResultRows: delResults.affectedRows || 0,
    deletedUserRows: delUser.affectedRows || 0
  };
}


/**
 * Retrieve exam result rows from the database.
 *
 * Executes a parameterized query against the connection pool to fetch rows from
 * ResultsTbl joined with QuestionsTbl, ScenarioTbl and UserTbl. If a studentId
 * is provided, results are filtered to that student. Results are ordered by
 * ResultId DESC and limited; the limit is parsed as an integer and clamped to
 * the range [1, 1000] (default 200).
 *
 * @typedef {Object} ExamResultRow
 * @property {number} ResultId
 * @property {number} StudentId
 * @property {number} QuestionId
 * @property {string|null} ChosenAnswer
 * @property {string|null} UploadedDocLink
 * @property {number|null} Grade
 * @property {string|null} FacultyComments
 * @property {string|null} PracticeStatus
 * @property {string} CreatedDate
 * @property {number|null} ScenarioId
 * @property {string|null} PC
 * @property {string} QuestionText
 * @property {string} Type
 * @property {string|null} OptionsJSON
 * @property {string|null} CorrectAnswersJSON
 * @property {string|null} FiveWhysJSON
 * @property {string|null} ShortSummary
 * @property {string|null} StudentName
 *
 * @param {Object} [options] - Query options.
 * @param {number|string} [options.studentId] - If provided, filters results to this studentId.
 * @param {number} [options.limit=200] - Max rows to return. Parsed as int and clamped to [1,1000].
 *
 * @async
 * @returns {Promise<ExamResultRow[]>} Resolves with an array of exam result rows (empty array if none).
 * @throws {Error} If obtaining the DB pool or executing the query fails.
 */
export async function getExamResults({ studentId, limit = 200 } = {}) {
  const p = await getPool();
  const lim = Math.max(1, Math.min(1000, parseInt(limit, 10) || 200));
  const params = [];
  const where = studentId ? 'WHERE r.StudentId = ?' : '';
  if (studentId) params.push(studentId);
  const sql = `
    SELECT
      r.ResultId,
      r.StudentId,
      r.QuestionId,
      r.ChosenAnswer,
      r.UploadedDocLink,
      r.Grade,
      r.FacultyComments,
      r.PracticeStatus,
      r.CreatedDate,
      q.ScenarioID AS ScenarioId,
      q.PC AS PC,
      q.QuestionText,
      q.Type AS Type,
      q.OptionsJSON AS OptionsJSON,
      q.CorrectAnswersJSON AS CorrectAnswersJSON,
      q.FiveWhysJSON AS FiveWhysJSON,
      s.ShortSummary AS ShortSummary,
      u.FullName AS StudentName
    FROM ResultsTbl r
    LEFT JOIN QuestionsTbl q ON q.QuestionID = r.QuestionId
    LEFT JOIN ScenarioTbl s ON s.ScenarioId = q.ScenarioID
    LEFT JOIN UserTbl u ON u.UserId = r.StudentId
    ${where}
    ORDER BY r.ResultId DESC
    LIMIT ${lim}
  `;
  const [rows] = await p.execute(sql, params);
  return rows || [];
}

export async function updateResultGrade(resultId, { grade, facultyComments }) {
  const p = await getPool();
  const fields = [];
  const params = [];
  if (grade !== undefined) {
    fields.push('Grade = ?');
    params.push(grade);
  }
  if (facultyComments !== undefined) {
    fields.push('FacultyComments = ?');
    params.push(facultyComments);
  }
  if (fields.length === 0) return { affectedRows: 0 };
  const sql = `UPDATE ResultsTbl SET ${fields.join(', ')} WHERE ResultId = ?`;
  params.push(resultId);
  const [res] = await p.execute(sql, params);
  return res;
}

// get total number of active users with role Student
export async function countActiveStudents() {
  const p = await getPool();
  const [rows] = await p.execute(
    `SELECT COUNT(*) AS cnt FROM UserTbl WHERE UserRole = 'Student' AND Status = 'Active'`
  );
  return (rows && rows[0] && rows[0].cnt) ? Number(rows[0].cnt) : 0;
}

// get total number of exam attempts (rows in ResultsTbl with PracticeStatus = 'exam')
export async function countExamAttempts() {
  const p = await getPool();
  const [rows] = await p.execute(
    `SELECT COUNT(*) AS cnt FROM ResultsTbl WHERE PracticeStatus = 'exam'`
  );
  return (rows && rows[0] && rows[0].cnt) ? Number(rows[0].cnt) : 0;
}

// get graded count and passed count for exam attempts
// graded => Grade IS NOT NULL; passed => Grade = 1
export async function getExamGradeStats() {
  const p = await getPool();
  const [rows] = await p.execute(
    `SELECT 
       SUM(CASE WHEN Grade IS NOT NULL THEN 1 ELSE 0 END) AS graded,
       SUM(CASE WHEN Grade = 1 THEN 1 ELSE 0 END) AS passed
     FROM ResultsTbl
     WHERE PracticeStatus = 'exam'`
  );
  const r = (rows && rows[0]) ? rows[0] : {};
  return {
    graded: r.graded != null ? Number(r.graded) : 0,
    passed: r.passed != null ? Number(r.passed) : 0,
  };
}

// count results where Grade is NULL (awaiting faculty grading)
export async function countPendingGrades() {
  const p = await getPool();
  const [rows] = await p.execute(
    `SELECT COUNT(*) AS cnt FROM ResultsTbl WHERE Grade IS NULL`
  );
  return (rows && rows[0] && rows[0].cnt) ? Number(rows[0].cnt) : 0;
}

// Insert a FormG row dynamically. Keys must be valid column identifiers.
export async function insertFormG(formData = {}) {
  const p = await getPool();
  const keys = Object.keys(formData || {}).filter(k => typeof k === 'string' && /^[A-Za-z0-9_]+$/.test(k));
  if (keys.length === 0) {
    throw new Error('No form data provided');
  }

  const fields = keys.map(k => `\`${k}\``).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const params = keys.map(k => formData[k]);

  const sql = `INSERT INTO FormGTbl (${fields}) VALUES (${placeholders})`;
  const [result] = await p.execute(sql, params);
  return result;
}

/**
 * Retrieve a single record from the FormGTbl table that matches the provided keys.
 *
 * @param {Object} [options={}] - Lookup options object.
 * @param {string|number} options.studentid - Student identifier (required). Will be coerced to a string for the query.
 * @param {string|number} options.modeofexam - Mode of the exam (required). Will be coerced to a string for the query.
 * @param {string|number} options.questionid - Question identifier (required). Will be coerced to a string for the query.
 * @returns {Promise<Object|null>} A promise that resolves to the first matching row object, or null if no match is found
 *                                  or if any required key is missing.
 * @throws {Error} If a database error occurs while executing the query.
 */
export async function getFormGByKeys({ studentid, modeofexam, questionid } = {}) {
  if (!studentid || !modeofexam || !questionid) return null;
  const p = await getPool();
  const [rows] = await p.execute(
    'SELECT * FROM FormGTbl WHERE studentid = ? AND modeofexam = ? AND questionid = ? LIMIT 1',
    [String(studentid), String(modeofexam), String(questionid)]
  );
  return rows && rows.length ? rows[0] : null;
}

// Insert a FormG1 row dynamically. Keys must be valid column identifiers.
export async function insertFormG1(formData = {}) {
  const p = await getPool();
  const keys = Object.keys(formData || {}).filter(k => typeof k === 'string' && /^[A-Za-z0-9_]+$/.test(k));
  if (keys.length === 0) {
    throw new Error('No form data provided');
  }

  const fields = keys.map(k => `\`${k}\``).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const params = keys.map(k => formData[k]);

  const sql = `INSERT INTO FormG1Tbl (${fields}) VALUES (${placeholders})`;
  const [result] = await p.execute(sql, params);
  return result;
}

export async function getFormG1ByKeys({ studentid, modeofexam, questionid } = {}) {
  if (!studentid || !modeofexam || !questionid) return null;
  const p = await getPool();
  const [rows] = await p.execute(
    'SELECT * FROM FormG1Tbl WHERE studentid = ? AND modeofexam = ? AND questionid = ? LIMIT 1',
    [String(studentid), String(modeofexam), String(questionid)]
  );
  return rows && rows.length ? rows[0] : null;
}