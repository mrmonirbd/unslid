import { NextResponse } from "next/server";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  // In SaaS mode (CAN_CHANGE_KEYS=false), the platform admin configures all
  // API keys centrally — users never need to enter their own. Always report
  // that keys are available so the presentation flow proceeds unblocked.
  const canChangeKeys = process.env.CAN_CHANGE_KEYS === "true";
  if (!canChangeKeys) {
    return NextResponse.json({ hasKey: true });
  }

  const userConfigPath = process.env.USER_CONFIG_PATH;

  let keyFromFile = "";
  if (userConfigPath && fs.existsSync(userConfigPath)) {
    try {
      const raw = fs.readFileSync(userConfigPath, "utf-8");
      const cfg = JSON.parse(raw || "{}");
      keyFromFile = cfg?.OPENAI_API_KEY || "";
    } catch {
      // ignore parse errors
    }
  }

  const keyFromEnv = process.env.OPENAI_API_KEY || "";
  const hasKey = Boolean((keyFromFile || keyFromEnv).trim());

  return NextResponse.json({ hasKey });
}
