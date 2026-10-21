export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerAutomation } = await import("@/lib/automation");
    registerAutomation();
    const { startAutomationScheduler, startAssistantScheduler } = await import("@/lib/scheduler");
    startAutomationScheduler();
    startAssistantScheduler();
  }
}
