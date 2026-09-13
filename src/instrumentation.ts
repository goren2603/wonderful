export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    await startScheduler().catch((err) => {
      console.error("Scheduler failed to start:", err);
    });
  }
}
