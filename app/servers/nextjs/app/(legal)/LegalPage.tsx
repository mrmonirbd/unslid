import Link from "next/link";
import CommonFooter from "@/components/CommonFooter";
import DashboardSidebar from "@/app/(presentation-generator)/(dashboard)/Components/DashboardSidebar";
import { ArrowLeft, CalendarDays, FileText, ShieldCheck } from "lucide-react";

type LegalSection = {
  title: string;
  body: string;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt?: string;
  sections: LegalSection[];
};

const LegalPage = ({ eyebrow, title, description, updatedAt, sections }: LegalPageProps) => {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#fbf9ff] text-slate-950 md:flex-row">
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_32%),linear-gradient(180deg,#fbf9ff_0%,#ffffff_48%,#f8fafc_100%)] md:h-screen">
        <div className="min-h-full px-4 pb-8 font-syne sm:px-6 md:px-8 md:pb-12">
          <header className="pt-8 pb-6">
            <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">{eyebrow}</p>
                <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
              </div>

              <Link
                href="/dashboard"
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 sm:px-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </div>

            <div className="mt-6 grid max-w-2xl grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 sm:gap-4">
              <div className="rounded-xl border border-violet-100 bg-white/95 px-4 py-3 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-500" />
                  <span className="text-xs font-medium text-slate-500">Sections</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{sections.length}</p>
                <p className="mt-0.5 text-xs text-slate-400">policy items</p>
              </div>

              {updatedAt && (
                <div className="rounded-xl border border-violet-100 bg-white/95 px-4 py-3 shadow-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-medium text-slate-500">Updated</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{updatedAt}</p>
                  <p className="mt-0.5 text-xs text-slate-400">latest version</p>
                </div>
              )}

              <div className="rounded-xl border border-violet-100 bg-white/95 px-4 py-3 shadow-sm min-[420px]:col-span-2 sm:col-span-1">
                <div className="mb-1 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-violet-500" />
                  <span className="text-xs font-medium text-slate-500">Status</span>
                </div>
                <p className="text-lg font-bold text-slate-900">Active</p>
                <p className="mt-0.5 text-xs text-slate-400">applies to account use</p>
              </div>
            </div>
          </header>

          <div className="mb-6 border-t border-slate-200" />

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Policy details</h2>
            <span className="text-xs text-slate-400">{sections.length} total</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-sm">
            {sections.map((section, index) => (
              <section
                key={section.title}
                className={index === 0 ? "p-4 sm:p-5" : "border-t border-slate-200 p-4 sm:p-5"}
              >
                <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
        <CommonFooter />
      </main>
      <DashboardSidebar />
    </div>
  );
};

export default LegalPage;
