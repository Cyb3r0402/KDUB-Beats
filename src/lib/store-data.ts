import { StoreProduct, StoreSettings } from "@/types/store";

export const defaultStoreProducts: StoreProduct[] = [
  {
    id: "service-mix-session",
    slug: "mix-session",
    name: "Precision Mix",
    category: "service",
    description: "A focused single-song mix built for artists who want clarity, bounce, and a cleaner final record.",
    price: 89,
    badge: "Starter Tier",
    deliverables: [
      "Full stereo mix for one song",
      "Up to 20 stems",
      "2 revision rounds",
    ],
  },
  {
    id: "service-mix-master",
    slug: "mix-master",
    name: "Mix + Master",
    category: "service",
    description: "The balanced all-in tier for artists who want one clean checkout and a release-ready final song.",
    price: 179,
    badge: "Most Popular",
    deliverables: [
      "Detailed stereo mix",
      "Final master for release platforms",
      "3 revision rounds",
    ],
  },
  {
    id: "service-artist-finish-pack",
    slug: "artist-finish-pack",
    name: "Release Priority",
    category: "service",
    description: "A premium finishing tier with extra attention, stronger polish, and priority handling for serious releases.",
    price: 279,
    badge: "Premium Tier",
    deliverables: [
      "Advanced mix detail and automation",
      "Release master with priority turnaround",
      "Priority support and 4 revision rounds",
    ],
  },
];

export const defaultStoreSettings: StoreSettings = {
  brandName: "KDUB Beats",
  heroTitle: "Beats, mixes, and masters built for records that need to hit clean and hard.",
  heroDescription:
    "KDUB Beats blends FL Studio production with Logic Pro mixing and mastering to help artists move from raw idea to release-ready record. The site is built to sell beats, compare service tiers, and checkout cleanly through Stripe.",
  storeTitle: "Preview beats and lock in your session from one polished store.",
  storeDescription:
    "Hear protected beat previews, then move into sleek tier-based mixing and mastering checkout when it is time to finish the record.",
  contactEmail: "bookings@kdubbeats.com",
  instagramUrl: "https://instagram.com/",
};
