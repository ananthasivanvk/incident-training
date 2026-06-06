import { X } from "lucide-react";
import { useState } from "react";

interface EditUserModalProps {
  user: {
    name: string;
    role: string;
    status: string;
    id: string;
    email?: string;
  };
  onClose: () => void;
  onSave: (userData: any) => void;
}

export function EditUserModal({ user, onClose, onSave }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    fullName: user.name,
    status: user.status,
    promoteToFaculty: false,
    password: "",
    confirmPassword: ""
  });

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const statuses = ["Active", "Inactive"];

  const passwordRegex = /(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}/;
  const validatePassword = (pwd: string) => passwordRegex.test(pwd);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If user entered a new password, validate it; otherwise skip
    if (formData.password) {
      if (!validatePassword(formData.password)) {
        setPasswordError("Password must be ≥6 chars, include a letter, a number and a special character.");
        return;
      } else {
        setPasswordError(null);
      }

      if (formData.password !== formData.confirmPassword) {
        setConfirmError("Passwords do not match.");
        return;
      } else {
        setConfirmError(null);
      }
    }

    const payload: any = { ...formData, id: user.id };
    // don't send confirmPassword to backend
    delete payload.confirmPassword;
    // if password blank, remove it to indicate no change
    if (!payload.password) delete payload.password;

    onSave(payload);
    onClose();
  };

  const isSubmitDisabled =
    !formData.fullName ||
    !formData.status ||
    (!!formData.password && (!validatePassword(formData.password) || formData.password !== formData.confirmPassword));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-slate-800">Edit User: {user.name} ({user.id})</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Email (Read Only) */}
          <div>
            <p className="text-slate-600">
              Email: <span className="text-slate-800">{user.email || `${user.name.toLowerCase().replace(' ', '.')}@uni.edu`}</span> (Read Only - Linked to M365)
            </p>
          </div>

          {/* Update Details Section */}
          <div>
            <h3 className="text-slate-700 mb-4 border-b border-slate-200 pb-2">
              Update Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-700 mb-2">
                  Full Name:
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-2">
                  Status:
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Role Management Section */}
          {user.role === "Student" && (
            <div>
              <h3 className="text-slate-700 mb-4 border-b border-slate-200 pb-2">
                Role Management
              </h3>
              
              <div className="mb-4">
                <p className="text-slate-600">Current Role: <span className="text-slate-800">{user.role}</span></p>
              </div>

              <label className="flex items-start gap-3 p-4 border border-amber-300 bg-amber-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.promoteToFaculty}
                  onChange={(e) => setFormData({ ...formData, promoteToFaculty: e.target.checked })}
                  className="mt-1 w-5 h-5 text-blue-600"
                />
                <div>
                  <span className="text-slate-700">Promote to Faculty Admin (Caution)</span>
                </div>
              </label>
            </div>
          )}

          {/* Password Section (Optional) */}
          <div>
            <h3 className="text-slate-700 mb-4 border-b border-slate-200 pb-2">
              Change Password
            </h3>

            <div className="space-y-4">
              <p className="text-slate-500 text-sm">Leave blank to keep the current password.</p>

              <div>
                <label className="block text-slate-700 mb-2">
                  New Password:
                </label>
                <input
                  type="password"
                  placeholder="Enter new password (optional)"
                  value={formData.password}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, password: val });
                    if (val && !validatePassword(val)) {
                      setPasswordError("Password must be ≥6 chars, include a letter, a number and a special character.");
                    } else {
                      setPasswordError(null);
                    }
                    if (formData.confirmPassword && val !== formData.confirmPassword) {
                      setConfirmError("Passwords do not match.");
                    } else {
                      setConfirmError(null);
                    }
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {passwordError && <p className="text-red-600 text-sm mt-1">{passwordError}</p>}
              </div>

              <div>
                <label className="block text-slate-700 mb-2">
                  Confirm New Password:
                </label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, confirmPassword: val });
                    if (formData.password && formData.password !== val) {
                      setConfirmError("Passwords do not match.");
                    } else {
                      setConfirmError(null);
                    }
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {confirmError && <p className="text-red-600 text-sm mt-1">{confirmError}</p>}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`px-6 py-3 rounded-lg transition-colors ${isSubmitDisabled ? 'bg-gray-200 text-slate-500 cursor-not-allowed border border-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}