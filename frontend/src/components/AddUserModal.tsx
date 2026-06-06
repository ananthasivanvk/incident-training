import { X } from "lucide-react";
import { useState } from "react";

/**
 * Props for the AddUserModal component.
 * @typedef {Object} AddUserModalProps
 * @property {() => void} onClose - Callback function invoked when the modal is closed.
 * @property {(userData: any) => void} onAdd - Callback function invoked when a new user is added, receiving the user data as a parameter.
 */
interface AddUserModalProps {
  onClose: () => void;
  onAdd: (userData: any) => void;
}

/**
 * AddUserModal component for adding new users to the system.
 * 
 * Provides a modal dialog with a form to create new users with the following fields:
 * - Full Name: User's complete name
 * - Email: M365/Microsoft Entra ID email address
 * - Student/Staff ID: Academic or staff identifier
 * - System Role: Selection between Student or Faculty roles
 * - Password: Account password with validation (minimum 6 characters, requires letter, number, and special character)
 * - Confirm Password: Password confirmation field
 * 
 * @component
 * 
 * @param {AddUserModalProps} props - Component props
 * @param {Function} props.onClose - Callback function to close the modal
 * @param {Function} props.onAdd - Callback function invoked with user data on successful form submission
 * 
 * @returns {React.ReactElement} A modal dialog containing the user creation form
 * 
 * @remarks
 * - Password validation requires at least one letter, one number, and one special character
 * - Passwords must match before submission
 * - The submit button is disabled until all fields are valid
 * - Real-time validation feedback is provided for password fields
 */
export function AddUserModal({ onClose, onAdd }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    employeeId: "",
    role: "Student",
    password: "",
    confirmPassword: ""
  });

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const passwordRegex = /(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}/;

  const validatePassword = (pwd: string) => passwordRegex.test(pwd);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password
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

    const payload = {
      fullName: formData.fullName,
      email: formData.email,
      employeeId: formData.employeeId,
      role: formData.role,
      password: formData.password
    };

    onAdd(payload);
    onClose();
  };

  const isSubmitDisabled =
    !formData.fullName ||
    !formData.email ||
    !formData.employeeId ||
    !formData.password ||
    !formData.confirmPassword ||
    !!passwordError ||
    !!confirmError ||
    !validatePassword(formData.password) ||
    formData.password !== formData.confirmPassword;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-slate-800">Add New User</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* User Information Section */}
          <div>
            <h3 className="text-slate-700 mb-4 border-b border-slate-200 pb-2">
              User Information
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-700 mb-2">
                  Full Name:
                </label>
                <input
                  type="text"
                  placeholder="Enter Full Name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-2">
                  Email (M365):
                </label>
                <input
                  type="email"
                  placeholder="Enter School Email Address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-slate-500 text-sm mt-1">
                  *(Must match their Microsoft Entra ID)
                </p>
              </div>
            </div>
          </div>

          {/* Academic Details Section */}
          <div>
            <h3 className="text-slate-700 mb-4 border-b border-slate-200 pb-2">
              Academic Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-700 mb-2">
                  Student/Staff ID:
                </label>
                <input
                  type="text"
                  placeholder="Enter ID (e.g., S-10293)"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* System Role Section */}
          <div>
            <h3 className="text-slate-700 mb-4 border-b border-slate-200 pb-2">
              System Role
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="Student"
                  checked={formData.role === "Student"}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="mt-1 w-5 h-5 text-blue-600"
                />
                <div>
                  <span className="text-slate-700">Student</span>
                  <p className="text-slate-500 text-sm">Can take exams and view own results</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="Faculty"
                  checked={formData.role === "Faculty"}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="mt-1 w-5 h-5 text-blue-600"
                />
                <div>
                  <span className="text-slate-700">Faculty</span>
                  <p className="text-slate-500 text-sm">Can manage users and grade exams</p>
                </div>
              </label>
            </div>
          </div>

          {/* Password Section */}
          <div>
            <h3 className="text-slate-700 mb-4 border-b border-slate-200 pb-2">
              Account Password
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-700 mb-2">
                  Password:
                </label>
                <input
                  type="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, password: val });
                    if (!validatePassword(val)) {
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
                  required
                />
                <p className="text-slate-500 text-sm mt-1">
                  Minimum 6 characters, at least 1 letter, 1 number and 1 special character.
                </p>
                {passwordError && <p className="text-red-600 text-sm mt-1">{passwordError}</p>}
              </div>

              <div>
                <label className="block text-slate-700 mb-2">
                  Confirm Password:
                </label>
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, confirmPassword: val });
                    if (formData.password !== val) {
                      setConfirmError("Passwords do not match.");
                    } else {
                      setConfirmError(null);
                    }
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {confirmError && <p className="text-red-600 text-sm mt-1">{confirmError}</p>}
              </div>
            </div>
          </div>

          {/* Hint shown when form incomplete */}
          {isSubmitDisabled && (
            <div>
              <p className="text-sm text-amber-600">
                Please fill in all fields and ensure the password meets the rules to enable Add User.
              </p>
            </div>
          )}

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
              Add User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}