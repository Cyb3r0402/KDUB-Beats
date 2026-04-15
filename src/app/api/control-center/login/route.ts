import { NextRequest, NextResponse } from "next/server";
import {
  CONTROL_CENTER_COOKIE_NAME,
  getControlCenterCredentials,
  isControlCenterConfigured,
  isValidControlCenterLogin,
} from "@/lib/control-center-auth";

export async function POST(request: NextRequest) {
  if (!isControlCenterConfigured()) {
    return NextResponse.json(
      {
        error:
          "Control center auth is not configured. Add CONTROL_CENTER_USERNAME, CONTROL_CENTER_PASSWORD, and CONTROL_CENTER_ACCESS_TOKEN to your environment variables.",
      },
      { status: 500 }
    );
  }

  try {
    const { username, password } = await request.json();

    if (!isValidControlCenterLogin(String(username || ""), String(password || ""))) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    const { accessToken } = getControlCenterCredentials();

    response.cookies.set({
      name: CONTROL_CENTER_COOKIE_NAME,
      value: accessToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in." }, { status: 400 });
  }
}
