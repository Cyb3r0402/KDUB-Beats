import { StoreProduct, StoreSettings, StoreSiteElement } from "@/types/store";

export const defaultStoreProducts: StoreProduct[] = [
  {
    id: "service-mix-session",
    slug: "mix-session",
    name: "Precision Mix",
    category: "service",
    description: "A focused single-song mix built for artists who want clarity, bounce, and a cleaner final record.",
    price: 149,
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
    price: 249,
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
    price: 399,
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
  storeTitle: "Preview beats and buy the right sound from one polished store.",
  storeDescription:
    "Hear protected beat previews, choose the track that fits, and checkout cleanly without exposing the full beat before purchase.",
  contactEmail: "KDUBinthemix1@gmail.com",
  instagramUrl: "https://instagram.com/",
  siteElements: [
    {
      id: "element-beat-licensing",
      placement: "homepage-feature",
      label: "Beat Licensing Card",
      eyebrow: "Beat Store",
      title: "Beat Licensing",
      description: "Sell beats with protected preview playback, branded cover art, and direct payment flow.",
      visible: true,
    },
    {
      id: "element-tier-checkout",
      placement: "homepage-feature",
      label: "Mixing & Mastering Card",
      eyebrow: "Tier Checkout",
      title: "Mixing & Mastering",
      description: "Guide artists into sleek tier selection with a dedicated checkout page for studio work.",
      visible: true,
    },
    {
      id: "element-artist-brand",
      placement: "homepage-feature",
      label: "Professional Presence Card",
      eyebrow: "Artist Brand",
      title: "Professional Presence",
      description: "Build trust with sharp visuals, premium wording, and a smoother buying experience.",
      visible: true,
    },
    {
      id: "element-choose-offer",
      placement: "homepage-workflow",
      label: "Workflow Step 1",
      eyebrow: "01",
      title: "Choose The Right Offer",
      description: "Artists preview beats or compare mixing and mastering tiers based on where the song is headed.",
      visible: true,
    },
    {
      id: "element-checkout-cleanly",
      placement: "homepage-workflow",
      label: "Workflow Step 2",
      eyebrow: "02",
      title: "Checkout Cleanly",
      description: "Stripe handles the payment flow so the site feels polished and trustworthy from the jump.",
      visible: true,
    },
    {
      id: "element-finish-record",
      placement: "homepage-workflow",
      label: "Workflow Step 3",
      eyebrow: "03",
      title: "Finish The Record",
      description: "Follow up with files, references, and next steps so the song moves fast from payment to delivery.",
      visible: true,
    },
  ],
};

export function getDefaultSiteElements(): StoreSiteElement[] {
  return (defaultStoreSettings.siteElements || []).map((element) => ({ ...element }));
}
