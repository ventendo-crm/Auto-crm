import { z } from "zod";
import { DASHBOARD_WIDGET_IDS } from "@/lib/dashboard/widgets";

export const dashboardLayoutItemSchema = z.object({
  id: z.enum(DASHBOARD_WIDGET_IDS),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
});

export const saveDashboardLayoutSchema = z.object({
  layout: z.array(dashboardLayoutItemSchema).min(1).max(50),
});

export type SaveDashboardLayoutInput = z.infer<typeof saveDashboardLayoutSchema>;
