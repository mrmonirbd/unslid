import Link from "next/link";
import CommonFooter from "@/components/CommonFooter";
import DashboardSidebar from "@/app/(presentation-generator)/(dashboard)/Components/DashboardSidebar";

type LegalSection = {
  title: string;
  body: string;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
};

const LegalPage = ({ eyebrow, title, description, sections }: LegalPageProps) => {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#fbf9ff] text-slate-950 md:flex-row">
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_32%),linear-gradient(180deg,#fbf9ff_0%,#ffffff_48%,#f8fafc_100%)] md:h-screen">
        <div className="mx-auto max-w-4xl px-4 py-10 font-syne sm:px-6 md:px-8 md:py-14">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-violet-50 hover:text-violet-700"
          >
            Back to dashboard
          </Link>

          <header className="pt-8 pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">{description}</p>
          </header>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
            {sections.map((section, index) => (
              <section
                key={section.title}
                className={index === 0 ? "p-5 md:p-6" : "border-t border-slate-200 p-5 md:p-6"}
              >
                <h2 className="text-base font-bold text-slate-900">{section.title}</h2>
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
