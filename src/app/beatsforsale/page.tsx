import Link from "next/link";
import Storefront from "@/components/storefront";

export default function BeatsForSalePage() {
  return (
    <>
      <div className="store-topbar">
        <div className="page-shell control-center-links">
          <Link href="/" className="store-backlink">
            Back To Home
          </Link>
          <Link href="/mixing-mastering" className="store-backlink">
            Mixing & Mastering
          </Link>
        </div>
      </div>
      <Storefront />
    </>
  );
}
