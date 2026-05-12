import { api, BillingStatus } from "@/lib/api";

export async function checkPresentationGenerationLimit(): Promise<{
  allowed: boolean;
  message?: string;
}> {
  try {
    const status = await api.get<BillingStatus>("/api/v1/billing/status");
    const limit = status.usage.monthly_limit;
    const used = status.usage.presentations_this_month ?? 0;

    if (typeof limit === "number" && limit >= 0 && used >= limit) {
      return {
        allowed: false,
        message: `${status.plan.toUpperCase()} package limit reached. You have generated ${used} presentations this month; your package limit is ${limit}.`,
      };
    }
  } catch (error) {
    console.warn("Could not check presentation generation limit before submit", error);
  }

  return { allowed: true };
}
