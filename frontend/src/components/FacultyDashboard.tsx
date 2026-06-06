import {
  ShieldCheck,
  ChevronDown,
  Users,
  FileText,
  LayoutDashboard,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";

/**
 * Props for the FacultyDashboard component.
 * @property {(page: string) => void} onNavigate - Callback function to navigate to a different page.
 * @property {() => void} onLogout - Callback function to handle user logout.
 */
interface FacultyDashboardProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

/**
 * Faculty Dashboard component that provides an administrative interface for faculty members.
 * 
 * Displays an overview of key metrics including total students, exam attempts, and pass rates.
 * Includes navigation to user management, exam results, and pending grading actions.
 * 
 * @component
 * @param {FacultyDashboardProps} props - The component props
 * @param {Function} props.onNavigate - Callback function to navigate to different sections (e.g., "userManagement", "examResults")
 * @param {Function} props.onLogout - Callback function to handle user logout
 * 
 * @returns {React.ReactElement} The rendered Faculty Dashboard with header, sidebar menu, and main content area
 * 
 * @example
 * ```tsx
 * <FacultyDashboard onNavigate={handleNavigate} onLogout={handleLogout} />
 * ```
 * 
 * @remarks
 * - Fetches faculty statistics from `/api/faculty-stats` endpoint on component mount
 * - Maintains mounted state to prevent memory leaks when component unmounts during async operations
 * - Displays loading states, error messages, and fallback values while data is being fetched
 * - Includes sidebar navigation with dashboard, users, and exam results menu options
 * - Shows pending grading actions with quick action buttons
 */
export function FacultyDashboard({
  onNavigate,
  onLogout,
}: FacultyDashboardProps) {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");

  const [stats, setStats] = useState<{ totalStudents: number; totalExamAttempts: number; avgPassRate: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // fetch faculty dashboard stats
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingStats(true);
      setStatsError(null);
      try {
        const res = await fetch('/api/faculty-stats');
        if (!res.ok) throw new Error('Failed to fetch faculty stats');
        const body = await res.json();
        if (!mounted) return;
        setStats({
          totalStudents: Number(body.totalStudents || 0),
          totalExamAttempts: Number(body.totalExamAttempts || 0),
          avgPassRate: Number(body.avgPassRate || 0),
          pendingGrading: Number(body.pendingGrading || 0),
        });
      } catch (e: any) {
        console.error('Failed to load faculty stats', e);
        if (mounted) setStatsError(e?.message || 'Failed to load');
      } finally {
        if (mounted) setLoadingStats(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}

      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-slate-50 border-b">
        <h1 className="text-xl font-bold">
          FACULTY ADMIN DASHBOARD
        </h1>
        <button
          onClick={onLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Main Content with Sidebar */}
      <div className="flex">
        {/* Sidebar Menu */}
        <div className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-73px)]">
          <div className="p-4">
            <h3 className="text-slate-500 text-sm uppercase mb-3 px-3">
              MENU
            </h3>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveMenu("dashboard")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeMenu === "dashboard"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => onNavigate("userManagement")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeMenu === "users"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Users</span>
              </button>

              <button
                onClick={() => onNavigate("examResults")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeMenu === "results"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <FileText className="w-5 h-5" />
                <span>Exam Results</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-8">
          <h2 className="text-slate-800 mb-8">OVERVIEW</h2>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <div className="text-slate-600 mb-2">
                Total Students
              </div>
              <div className="text-slate-800">
                {loadingStats ? '…' : (stats ? stats.totalStudents : (statsError ? 'Error' : '—'))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <div className="text-slate-600 mb-2">
                Total Exam Attempts
              </div>
              <div className="text-slate-800">
                {loadingStats ? '…' : (stats ? stats.totalExamAttempts : (statsError ? 'Error' : '—'))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <div className="text-slate-600 mb-2">
                Avg. Pass Rate
              </div>
              <div className="text-slate-800">
                {loadingStats ? '…' : (stats ? `${stats.avgPassRate}%` : (statsError ? 'Error' : '—'))}
              </div>
            </div>
          </div>          

          {/* Pending Actions */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6 mb-8">
            <h3 className="text-slate-800 mb-4">
              PENDING ACTIONS
            </h3>
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span className="text-slate-700">
                    {loadingStats ? '…' : (stats ? `${stats.pendingGrading} answers need grading` : (statsError ? 'Error' : '—'))}
                  </span>
                </div>
                <button
                  onClick={() => onNavigate("examResults")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Review Now
                </button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h3 className="text-slate-800 mb-4">QUICK LINKS</h3>
            <div className="flex gap-4">
              <button
                onClick={() => onNavigate("userManagement")}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add New Student
              </button>
              <button
                onClick={() => { onNavigate("examResults"); setActiveMenu("results"); }}
                className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Exam Results
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}