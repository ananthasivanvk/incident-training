import { LoginPage } from "./components/LoginPage";
import TraditionalLoginPage from "./components/TraditionalLoginPage";
import { ProfileCompletionPage } from "./components/ProfileCompletionPage";
import { StudentDashboard } from "./components/StudentDashboard";
import { PracticeSetup } from "./components/PracticeSetup";
import QuestionView from "./components/QuestionView";
import { ExamCompletionScreen } from "./components/ExamCompletionScreen";
import { FacultyDashboard } from "./components/FacultyDashboard";
import { UserManagement } from "./components/UserManagement";
import ExamResults from "./components/ExamResults";
import { useState } from "react";

type Page = "landing" | "login" | "profileCompletion" | "studentDashboard" | "practiceSetup" | "examSetup" | "questions" | "examCompletion" | "facultyDashboard" | "userManagement" | "examResults";
type UserRole = "student" | "faculty" | null;
type Mode = "practice" | "exam";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("landing");
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userName, setUserName] = useState("");
  const [selectedMode, setSelectedMode] = useState<Mode>("practice");
  const [selectedScenario, setSelectedScenario] = useState("");
  const [selectedCriterion, setSelectedCriterion] = useState("");

  const handleLogin = (role: UserRole, name: string) => {
    setUserRole(role);
    setUserName(name);
    if (role === "student") {
      setCurrentPage("studentDashboard");
    } else if (role === "faculty") {
      setCurrentPage("facultyDashboard");
    }
  };

  const handleStartMode = (mode: Mode) => {
    setSelectedMode(mode);
    if (mode === "practice") {
      setCurrentPage("practiceSetup");
    } else {
      setCurrentPage("examSetup");
    }
  };

  const handleLoadQuestions = (scenario: string, criterion: string) => {
    setSelectedScenario(scenario);
    setSelectedCriterion(criterion);
    setCurrentPage("questions");
  };

  if (currentPage === "login") {
    return <TraditionalLoginPage />;
  }

  if (currentPage === "profileCompletion") {
    return <ProfileCompletionPage onComplete={(role) => {
      setUserName("John Doe"); // Set the name from M365
      if (role === "Student") {
        setUserRole("student");
        setCurrentPage("studentDashboard");
      } else if (role === "Faculty") {
        setUserRole("faculty");
        setCurrentPage("facultyDashboard");
      }
    }} />;
  }

  if (currentPage === "studentDashboard") {
    return (
      <StudentDashboard
        userName={userName}
        onStartMode={handleStartMode}
        onLogout={() => {
          setCurrentPage("landing");
          setUserRole(null);
        }}
      />
    );
  }

  if (currentPage === "practiceSetup" || currentPage === "examSetup") {
    return (
      <PracticeSetup
        mode={selectedMode}
        onBack={() => setCurrentPage("studentDashboard")}
        onLoadQuestions={handleLoadQuestions}
      />
    );
  }

  if (currentPage === "questions") {
    return (
      <QuestionView
        mode={selectedMode}
        scenario={selectedScenario}
        criterion={selectedCriterion}
        onBack={() => setCurrentPage("studentDashboard")}
        onSubmit={() => setCurrentPage("examCompletion")}
      />
    );
  }

  if (currentPage === "examCompletion") {
    return (
      <ExamCompletionScreen
        scenario={selectedScenario}
        date={new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        timeTaken="25 mins"
        onReturnToDashboard={() => setCurrentPage("studentDashboard")}
      />
    );
  }

  if (currentPage === "facultyDashboard") {
    return (
      <FacultyDashboard
        onNavigate={(page) => setCurrentPage(page as Page)}
        onLogout={() => {
          setCurrentPage("landing");
          setUserRole(null);
        }}
      />
    );
  }

  if (currentPage === "userManagement") {
    return (
      <UserManagement onBack={() => setCurrentPage("facultyDashboard")} />
    );
  }

  if (currentPage === "examResults") {
    return (
      <ExamResults onBack={() => setCurrentPage("facultyDashboard")} />
    );
  }

  return <LoginPage onSignIn={() => setCurrentPage("login")} />;
}