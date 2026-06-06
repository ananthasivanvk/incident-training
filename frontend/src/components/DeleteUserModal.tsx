import { X, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface DeleteUserModalProps {
  userName: string;
  userId: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteUserModal({ userName, userId, onClose, onConfirm }: DeleteUserModalProps) {
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = () => {
    if (confirmText === "DELETE") {
      onConfirm();
      onClose();
    }
  };

  const isDeleteEnabled = confirmText === "DELETE";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-slate-800">PERMANENT DELETE USER</h2>
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
            Are you sure you want to delete <strong>{userName} ({userId})</strong>?
          </p>

          {/* Critical Warning Box */}
          <div className="border-2 border-red-400 bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-red-800">CRITICAL WARNING</h3>
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            
            <div className="space-y-2 text-slate-700">
              <p className="flex items-start gap-2">
                <span className="text-red-600 mt-1">1.</span>
                <span>This action CANNOT be undone.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-600 mt-1">2.</span>
                <span>All EXAM RESULTS and PRACTICE LOGS for this user will be permanently erased from the database.</span>
              </p>
            </div>
          </div>

          {/* Information Note */}
          <div className="text-slate-600 text-sm italic bg-slate-50 p-3 rounded border border-slate-200">
            (If you want to keep the data but stop access, click Cancel and use 'Deactivate' instead).
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-slate-700 mb-2">
              Type "DELETE" below to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE here"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
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
              onClick={handleDelete}
              disabled={!isDeleteEnabled}
              className={`flex-1 px-6 py-3 rounded-lg transition-colors ${
                isDeleteEnabled
                  ? "bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              DELETE USER & DATA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
