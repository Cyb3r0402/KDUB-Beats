import { Suspense } from "react";
import Link from "next/link";
import ServiceTierCheckout from "@/components/service-tier-checkout";

export default function MixingMasteringPage() {
  return (
    <>
      <div className="store-topbar">
        <div className="page-shell control-center-links">
          <Link href="/" className="store-backlink">
            Back To Home
          </Link>
          <Link href="/beatsforsale" className="store-backlink">
            Back To Beat Store
          </Link>
        </div>
      </div>
      <Suspense
        fallback={
          <main className="page-shell services-page">
            <section className="panel store-empty-state">
              <p className="eyebrow">Loading Service Checkout</p>
              <h3>Preparing your mixing and mastering tiers.</h3>
              <p>The service options and checkout panel are loading now.</p>
            </section>
          </main>
        }
      >
        <ServiceTierCheckout />
      </Suspense>
    </>
  );
}
