import Link from "next/link";
import type { Metadata } from "next";
import ControlCenter from "@/components/control-center";
import {
  getStripeDashboardUrl,
  getStripeMode,
  isStripeConfigured,
  type StripeMode,
} from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Studio Control",
  robots: {
    index: false,
    follow: false,
  },
};

export interface StripeAdminStatus {
  configured: boolean;
  mode: StripeMode;
  dashboardUrl: string;
}

export default function ControlCenterPage() {
  const stripeStatus: StripeAdminStatus = {
    configured: isStripeConfigured(),
    mode: getStripeMode(),
    dashboardUrl: getStripeDashboardUrl(),
  };

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
      <ControlCenter stripeStatus={stripeStatus} />
    </>
  );
}
