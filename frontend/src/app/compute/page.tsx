import GoalForm from "@/components/GoalForm";

export default function ComputePage() {
  return (
    <main className="min-h-screen bg-terminal-bg">
      {/* Top bar */}
      <div className="border-b border-terminal-border px-6 py-3 flex items-center justify-between">
        <a href="/" className="text-terminal-white font-bold tracking-widest text-sm hover:text-terminal-muted transition-colors">
          GOALBUILDER
        </a>
        <span className="text-terminal-muted text-[11px]">
          Free & open source · Educational use only
        </span>
      </div>

      <GoalForm />
    </main>
  );
}
