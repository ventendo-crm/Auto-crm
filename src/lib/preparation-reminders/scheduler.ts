import { runPreparationReminders } from "@/lib/services/preparation-reminders";

const TICK_MS = 5 * 60 * 1000;
const FIRST_TICK_MS = 20_000;

const globalState = globalThis as typeof globalThis & {
  __preparationReminderScheduler?: boolean;
};

export function startPreparationReminderScheduler(): void {
  if (process.env.PREPARATION_REMINDERS_DISABLED === "1") return;
  if (globalState.__preparationReminderScheduler) return;
  globalState.__preparationReminderScheduler = true;

  const tick = () => {
    void runPreparationReminders().catch((error) => {
      console.error("[preparation-reminders] tick failed:", error);
    });
  };

  setTimeout(tick, FIRST_TICK_MS);
  setInterval(tick, TICK_MS);
}
