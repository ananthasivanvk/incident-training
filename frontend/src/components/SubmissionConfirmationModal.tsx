import { X } from "lucide-react";
import { useNavigate } from 'react-router-dom';

interface SubmissionConfirmationModalProps {
  questionsAnswered: number;
  totalQuestions: number;
  onCancel: () => void;
  onConfirm?: () => void;
  /** mode determines where Confirm navigates: 'exam' -> ExamCompletion, 'practice' -> StudentDashboard */
  mode?: 'exam' | 'practice';
  /** optional state passed to the exam completion screen */
  completionState?: any;
  /** optional question type to allow callers to hide some messages for specific forms */
  questionType?: 'form-g' | 'form-g1' | string;
}

export function SubmissionConfirmationModal({
  questionsAnswered,
  totalQuestions,
  onCancel,
  onConfirm,
  mode = 'practice',
  completionState,
  questionType
}: SubmissionConfirmationModalProps) {
  const navigate = useNavigate();

  const handleConfirm = () => {
    try {
      onConfirm?.();
    } catch (e) {
      console.error('Error in onConfirm callback', e);
    }

    if (mode === 'exam') {
      navigate('/exam-complete', { state: completionState });
    } else {
      navigate('/student');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="border-b border-slate-200 p-6 flex items-center justify-between">
          <h2 className="text-slate-800">Submit Assessment?</h2>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!(questionType === 'form-g' || questionType === 'form-g1') && (
            <p className="text-slate-700">
              You have answered <strong>{questionsAnswered} of {totalQuestions}</strong> questions.
            </p>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800">
              <strong>(!) Once you submit, you will NOT be able to return to change your answers.</strong>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 flex gap-4 justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            CONFIRM SUBMISSION
          </button>
        </div>
      </div>
    </div>
  );
}