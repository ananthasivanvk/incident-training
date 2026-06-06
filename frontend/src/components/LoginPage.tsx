import { ShieldCheck } from "lucide-react";
import { SignInButton } from "./SignInButton";

export function LoginPage({
  onSignIn,
}: {
  onSignIn: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-8 md:p-12">
          {/* Logo Section */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-3">
              <ShieldCheck
                className="w-10 h-10 text-blue-600"
                strokeWidth={2}
              />
              <div className="flex flex-col">
                <span className="text-blue-900">
                  Incident Investigation Training
                </span>
              </div>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="text-center mb-8">
            <h1 className="text-slate-800 mb-2">
              Welcome to the Incident Investigation Training &
              Assessment Portal
            </h1>
          </div>

          {/* Sign In Button */}
          <SignInButton onSignIn={onSignIn} />

          {/* Authorization Notice */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-center text-slate-600 text-sm">
              Authorized Access Only.
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-slate-500 text-xs">
          <p>Protected by enterprise security protocols</p>
        </div>
      </div>
    </div>
  );
}