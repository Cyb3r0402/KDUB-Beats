import Link from "next/link";
import type { Metadata } from "next";
import ControlCenterLogin from "@/components/control-center-login";

export const metadata: Metadata = {
  title: "Studio Session",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudioSessionPage() {
  return (
    <>
      <div className="store-topbar">
        <div className="page-shell control-center-links">
          <Link href="/" className="store-backlink">
            Back To Home
          </Link>
          <Link href="/beatsforsale" className="store-backlink">
            Open Store
          </Link>
        </div>
      </div>
      <ControlCenterLogin />
    </>
  );
}
