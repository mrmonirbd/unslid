export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-y-auto overflow-x-hidden bg-[linear-gradient(115deg,#b7f3ee_0%,#f9fbff_44%,#d7b6ff_100%)] p-4 font-syne text-slate-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="relative text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shadow-[0_12px_30px_rgba(124,58,237,0.22)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="text-slate-950 font-bold text-xl tracking-tight">Unslid</span>
          </div>
          <p className="text-slate-600 text-sm">AI-powered presentations in seconds</p>
        </div>
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
