export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-5 px-8 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300">
        RushLab
      </p>
      <h1 className="text-5xl font-semibold tracking-tight">
        Architecture-ready hackathon workspace
      </h1>
      <p className="max-w-2xl text-lg leading-8 text-slate-300">
        The shared contracts, research, task plan, and verification commands are
        ready. Product features begin after the architecture is approved.
      </p>
      <p className="text-sm text-slate-500">
        See docs/TASKS.md for the first implementation tasks.
      </p>
    </main>
  );
}
