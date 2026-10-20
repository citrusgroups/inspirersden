export type Data = Record<string, string | number | boolean | string[]>;
export type Entry = {
  id: string;
  kind: string;
  slug: string | null;
  data: Data;
  created: string;
  updated: string;
  version: number;
};
export type Member = {
  id: string;
  email: string;
  name: string;
  role: string;
  influencer_id: string | null;
  influencer_niche?: string;
  active: number;
  created: string;
};
export type Activity = {
  id: string;
  actor: string;
  action: string;
  record_id: string;
  created: string;
};
export type Click = {
  id: string;
  influencer_id: string;
  platform: string;
  campaign: string;
  created: string;
};
export type FileInfo = {
  id: string;
  record_id: string;
  name: string;
  mime: string;
  size: number;
  created: string;
};
export type Connection = {
  id: string;
  influencer_id: string;
  platform: string;
  status: string;
  username: string;
  avatar: string;
  connected: string;
  synced: string;
  expires: string;
};
export type State = {
  user: Member;
  records: Entry[];
  members: Member[];
  audit: Activity[];
  clicks: Click[];
  files: FileInfo[];
  connections: Connection[];
  settings: Data;
  authConfigured: boolean;
  integrationReady: Record<string, boolean>;
};
export const navigation = [
  "Overview",
  "Influencers",
  "Leads & Inquiries",
  "Agent Inbox",
  "Social Connections",
  "Packages",
  "Media Kits",
  "Campaigns",
  "Tracking Links",
  "Contacts",
  "Team Members",
  "Reports",
  "Activity Log",
  "Settings",
];
export const slugs = [
  "overview",
  "influencers",
  "leads",
  "agent-inbox",
  "social",
  "packages",
  "media-kits",
  "campaigns",
  "tracking",
  "contacts",
  "team",
  "reports",
  "activity",
  "settings",
];
export const stages = [
  "New",
  "Contacted",
  "Qualified",
  "Package Suggested",
  "Negotiation",
  "Confirmed",
  "Closed",
  "Lost",
];
export const categories = [
  "Fashion",
  "Food",
  "Travel",
  "Lifestyle",
  "Recipes",
  "Entertainment",
];
export const platforms = ["Instagram", "Facebook", "TikTok", "Gmail"];
export type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
};
export const definitions: Record<string, Field[]> = {
  influencer: [
    { key: "name", label: "Full name", required: true },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone number", type: "tel" },
    { key: "niche", label: "Category", options: categories },
    { key: "location", label: "Location" },
    {
      key: "status",
      label: "Status",
      options: ["Active", "Pending", "Inactive"],
    },
    {
      key: "platform",
      label: "Primary platform",
      options: platforms.slice(0, 3),
    },
    { key: "handle", label: "Social handle" },
    { key: "instagram", label: "Instagram profile URL", type: "url" },
    { key: "facebook", label: "Facebook profile URL", type: "url" },
    { key: "tiktok", label: "TikTok profile URL", type: "url" },
    { key: "followers", label: "Followers", type: "number" },
    { key: "engagement", label: "Engagement rate (%)", type: "number" },
    { key: "rate", label: "Starting rate", type: "number" },
    {
      key: "currency",
      label: "Currency",
      options: ["PKR", "USD", "AED", "SAR"],
    },
    { key: "deliverables", label: "Deliverables", type: "textarea" },
    { key: "bio", label: "Biography", type: "textarea" },
    { key: "tags", label: "Tags (comma separated)" },
    { key: "notes", label: "Internal notes", type: "textarea" },
    { key: "assigned", label: "Assigned manager email", type: "email" },
  ],
  lead: [
    { key: "name", label: "Brand name", required: true },
    { key: "contact", label: "Contact person", required: true },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone", type: "tel" },
    { key: "social", label: "Social profile URL", type: "url" },
    { key: "requirement", label: "Campaign requirement", type: "textarea" },
    { key: "budget", label: "Budget", type: "number" },
    {
      key: "currency",
      label: "Currency",
      options: ["PKR", "USD", "AED", "SAR"],
    },
    { key: "influencerId", label: "Interested influencer", type: "influencer" },
    {
      key: "source",
      label: "Inquiry source",
      options: [
        "Website",
        "WhatsApp",
        "Referral",
        "Instagram",
        "Facebook",
        "TikTok",
        "Other",
      ],
    },
    {
      key: "platform",
      label: "Source platform",
      options: [
        "Website",
        "WhatsApp",
        "Instagram",
        "Facebook",
        "TikTok",
        "Other",
      ],
    },
    { key: "reference", label: "WhatsApp tracking reference" },
    { key: "assigned", label: "Assigned manager email", type: "email" },
    { key: "status", label: "Stage", options: stages },
    { key: "followup", label: "Follow-up date", type: "date" },
    { key: "packageSent", label: "Package manually sent on", type: "date" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  package: [
    { key: "name", label: "Package name", required: true },
    { key: "price", label: "Price", type: "number", required: true },
    {
      key: "currency",
      label: "Currency",
      options: ["PKR", "USD", "AED", "SAR"],
    },
    {
      key: "deliverables",
      label: "Deliverables",
      type: "textarea",
      required: true,
    },
    {
      key: "influencerIds",
      label: "Assigned influencers",
      type: "multi-influencer",
    },
    { key: "niche", label: "Category", options: ["All", ...categories] },
    { key: "status", label: "Status", options: ["Active", "Inactive"] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  campaign: [
    { key: "name", label: "Campaign name", required: true },
    { key: "brand", label: "Brand", required: true },
    {
      key: "influencerIds",
      label: "Selected influencers",
      type: "multi-influencer",
    },
    { key: "budget", label: "Budget", type: "number" },
    {
      key: "currency",
      label: "Currency",
      options: ["PKR", "USD", "AED", "SAR"],
    },
    { key: "deliverables", label: "Deliverables", type: "textarea" },
    { key: "start", label: "Start date", type: "date" },
    { key: "end", label: "End date", type: "date" },
    { key: "deadline", label: "Content deadline", type: "date" },
    {
      key: "status",
      label: "Status",
      options: ["Planning", "Active", "Completed", "On Hold", "Cancelled"],
    },
    {
      key: "approval",
      label: "Content approval",
      options: ["Pending", "Changes Required", "Approved"],
    },
    {
      key: "payment",
      label: "Payment status",
      options: ["Unpaid", "Partial", "Paid"],
    },
    { key: "assigned", label: "Assigned manager email", type: "email" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  contact: [
    { key: "name", label: "Full name", required: true },
    { key: "company", label: "Company" },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "phone", label: "Phone", type: "tel" },
    {
      key: "type",
      label: "Contact type",
      options: ["Brand", "Influencer", "Partner", "General"],
    },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
};
