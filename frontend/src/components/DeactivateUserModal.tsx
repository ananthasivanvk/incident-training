import { X, AlertCircle } from "lucide-react";

interface DeactivateUserModalProps {
  userName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeactivateUserModal({ userName, onClose, onConfirm }: DeactivateUserModalProps) {
  const handleDeactivate = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600" />
            <h2 className="text-slate-800">Deactivate User Account</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-slate-700">
            Are you sure you want to deactivate <strong>{userName}</strong>?
          </p>

          <div>
            <h3 className="text-slate-700 mb-3">Consequences:</h3>
            <ul className="space-y-2 text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>User will no longer be able to log in.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>Historical exam data will be PRESERVED.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-1">•</span>
                <span>You can reactivate them later from the "Inactive" list.</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeactivate}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Yes, Deactivate User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
