import { useState } from "react";

export function SignInButton({ onSignIn }: { onSignIn: () => void }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = () => {
    setIsLoading(true);
    // Simulate sign-in process
    setTimeout(() => {
      setIsLoading(false);
      onSignIn();
    }, 1000);
  };

  return (
    <button
      onClick={handleSignIn}
      disabled={isLoading}
      className="w-full bg-white border-2 border-slate-300 hover:border-blue-500 hover:bg-slate-50 rounded-lg p-4 flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      {/* Microsoft Icon */}
      <div className="flex-shrink-0">
        <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="10" height="10" fill="#F25022"/>
          <rect x="11" width="10" height="10" fill="#7FBA00"/>
          <rect y="11" width="10" height="10" fill="#00A4EF"/>
          <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
        </svg>
      </div>
      
      {/* Button Text */}
      <span className="text-slate-700 group-hover:text-slate-900">
        {isLoading ? "Signing in..." : "Sign in with School Account"}
      </span>
    </button>
  );
}