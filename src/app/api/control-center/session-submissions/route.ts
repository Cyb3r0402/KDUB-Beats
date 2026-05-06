import { NextRequest, NextResponse } from "next/server";
import {
  CONTROL_CENTER_COOKIE_NAME,
  isAuthorizedControlCenterSession,
} from "@/lib/control-center-auth";
import {
  getSessionUploadSystemStatus,
  listRecentSessionSubmissions,
} from "@/lib/session-submissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(CONTROL_CENTER_COOKIE_NAME)?.value;

  if (!isAuthorizedControlCenterSession(token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const [submissions, systemStatus] = await Promise.all([
      listRecentSessionSubmissions(),
      Promise.resolve(getSessionUploadSystemStatus()),
    ]);

    return NextResponse.json({
      submissions,
      systemStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load recent session uploads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
