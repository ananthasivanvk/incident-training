import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

export function ProfileCompletionPage({ onComplete }: { onComplete: (role: string) => void }) {
  const [formData, setFormData] = useState({
    studentId: "",
    department: "",
    role: "Student"
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const departments = [
    "Select Department",
    "Engineering",
    "Computer Science",
    "Education",
    "Safety & Security"
  ];

  const roles = ["Student", "Faculty"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!formData.studentId.trim()) {
      newErrors.studentId = "Student/Employee ID is required";
    }

    if (!formData.department || formData.department === "Select Department") {
      newErrors.department = "Department selection is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Success - navigate to next page based on role
    onComplete(formData.role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header with Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <ShieldCheck className="w-8 h-8 text-blue-600" strokeWidth={2} />
          <div className="flex flex-col">
            <span className="text-blue-900">Incident Investigation Training</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-8 md:p-10">
          <h1 className="text-slate-800 mb-8">Complete Your Profile</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field (Locked) */}
            <div>
              <label className="block text-slate-700 mb-2">
                Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value="John Doe (Imported from M365)"
                  disabled
                  className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              </div>
            </div>

            {/* Email Field (Locked) */}
            <div>
              <label className="block text-slate-700 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value="john.d@university.edu"
                  disabled
                  className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              </div>
            </div>

            {/* Student/Employee ID (Required) */}
            <div>
              <label className="block text-slate-700 mb-2">
                Student / Employee ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter ID Number"
                value={formData.studentId}
                onChange={(e) => {
                  setFormData({ ...formData, studentId: e.target.value });
                  setErrors({ ...errors, studentId: "" });
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.studentId ? "border-red-500" : "border-slate-300"
                }`}
              />
              {errors.studentId && (
                <p className="text-red-500 text-sm mt-1">{errors.studentId}</p>
              )}
            </div>

            {/* Department Dropdown (Required) */}
            <div>
              <label className="block text-slate-700 mb-2">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => {
                  setFormData({ ...formData, department: e.target.value });
                  setErrors({ ...errors, department: "" });
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.department ? "border-red-500" : "border-slate-300"
                }`}
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              {errors.department && (
                <p className="text-red-500 text-sm mt-1">{errors.department}</p>
              )}
            </div>

            {/* Role Dropdown */}
            <div>
              <label className="block text-slate-700 mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <p className="text-slate-500 text-sm mt-1">
                Role may be preloaded from your account
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Save & Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
