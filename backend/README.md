Incident Training Backend (Plain Node.js)

Tech: Node.js built-in http, mysql2/promise, bcrypt. No Express.

Environment variables (.env):
- DB_HOST
- DB_USER
- DB_PASS
- DB_NAME
- PORT (default 3001)

Endpoints:
- POST /api/auth/login
  Body: { "identifier": string, "password": string }
  Finds user by OrgUserId OR UserEmail, compares bcrypt hash in PasswordHash.
  Response: { success: true, user: { UserId, FullName, UserRole, OrgUserId, UserEmail } } or { success: false, message }

- GET /api/scenarios
  Returns: [ { ScenarioId, ScenarioType, ShortSummary } ]

- GET /api/performance-criteria
  Returns: [ { PC, PCTitle } ]

- GET /api/questions?scenarioId=&pc=
  Returns: [ { QuestionID, QuestionText, Type, ImageURL, OptionsJSON, CorrectAnswersJSON, HintJSON } ]

- POST /api/practice/submit
  Body: { studentId: number, answers: [ { questionId: number, chosenAnswer: any, uploadedDocLink?: string } ] }
  Computes correctness using CorrectAnswersJSON if available, inserts into ResultsTbl with PracticeStatus.
  Response: { saved: true, gradeSummary: { totalQuestions, correctCount, percent } }

Development & Start

```zsh
cd backend
npm install

# create .env with DB_HOST, DB_USER, DB_PASS, DB_NAME, PORT
node server.js
```

Notes:
- Uses parameterized queries.
- If your DB currently stores plaintext passwords, you must migrate to bcrypt and populate `UserTbl.PasswordHash`.
- CORS is permissive for local dev; tighten for production as needed.
