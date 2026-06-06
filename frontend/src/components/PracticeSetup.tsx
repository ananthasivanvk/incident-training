import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api";

interface PracticeSetupProps {
  mode: "practice" | "exam";
  onBack: () => void;
  onLoadQuestions?: (scenario: string, criterion: string) => void;
}

export function PracticeSetup({ mode, onBack, onLoadQuestions }: PracticeSetupProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [selectedCriterion, setSelectedCriterion] = useState<string>("");
  const [pcs, setPcs] = useState<Array<{ PC: string; PCTitle: string }>>([]);
  const [scenarios, setScenarios] = useState<Array<{ ScenarioId: number; ScenarioType: string; ShortSummary: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([api.get("/performance-criteria"), api.get("/practiceScenarios"), api.get("/scenarios")])
      .then(([pcRes, scRes, examScRes]) => {
        if (!mounted) return;
        setPcs(pcRes.data || []);
        if(mode == 'exam')
        setScenarios(examScRes.data || []);
      else
        setScenarios(scRes.data || []);
      })
      .catch(() => setError("Failed to load practice setup data"))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleLoadQuestions = async () => {
    if (!selectedScenario || !selectedCriterion) {
      alert('Please select both performance criteria and a scenario.');
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.get(
        `/questions?scenarioId=${encodeURIComponent(selectedScenario)}&pc=${encodeURIComponent(selectedCriterion)}`
      );
      // pass questions and selected scenario through navigation state so QuestionView renders exactly these
      const selectedScenarioObj = scenarios.find(s => String(s.ScenarioId) === String(selectedScenario)) || null;
      navigate(
        `/question-view?scenarioId=${encodeURIComponent(selectedScenario)}&pc=${encodeURIComponent(selectedCriterion)}&mode=${encodeURIComponent(mode)}`,
        { state: { questions: data || [], mode, scenario: selectedScenarioObj } }
      );
    } catch (e) {
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg">Mode: {mode.toUpperCase()}</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
          <div className="mb-8">
            <h2 className="text-slate-800 mb-4">STEP 1: Select Scenario</h2>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Scenario</option>
              {scenarios.map((s) => (
                <option
                  key={s.ScenarioId}
                  value={String(s.ScenarioId)}
                  title={s.ShortSummary || s.ScenarioType || `Scenario ${s.ScenarioId}`}
                >
                  {`${s.ScenarioId} — ${s.ShortSummary || s.ScenarioType || `Scenario ${s.ScenarioId}`}`}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-8">
            <h2 className="text-slate-800 mb-3">STEP 2: Select Performance Criterion</h2>
            <p className="text-slate-600 text-sm mb-6">
              (The questions you receive will be based on this specific skill area)
            </p>

            <div className="mb-6">
              

              <select
                value={selectedCriterion}
                onChange={(e) => setSelectedCriterion(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Criterion</option>
                {pcs.length === 0 ? (
                  <option value="" disabled>Loading…</option>
                ) : (
                  pcs.map((p) => (
                    <option key={p.PC} value={p.PC}>
                      {p.PC}{p.PCTitle ? ` — ${p.PCTitle}` : ''}
                    </option>
                  ))
                )}
              </select>

              {pcs.length === 0 && (
                <p className="mt-2 text-sm text-slate-500">No performance criteria available.</p>
              )}
            </div>
          </div>

          <button
            onClick={handleLoadQuestions}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-colors"
          >
            Load Questions
          </button>
          {loading && <div className="mt-4 text-slate-600">Loading…</div>}
          {error && <div className="mt-2 text-red-600">{error}</div>}
        </div>
      </div>
    </div>
  );
}
