// Admin settings (Phase 11): section shapes and defaults. Safe for server and client.
// Stored in StoreConfig as one JSON document per section; missing or invalid values fall back to these defaults,
// so the store works before anything is saved and after a setting is added in a later version.

export type StoreDetails = {
  name: string;
  /** Wordmark when there is no logo image: logoText + logoAccent (in the accent colour) */
  logoText: string;
  logoAccent: string;
  /** Uploaded logo (/uploads/…), replaces the wordmark */
  logoUrl: string | null;
  tagline: string;
  announcement: string;
  supportEmail: string;
  salesEmail: string;
  phone: string;
  address: string;
  footerAbout: string;
  copyright: string;
  social: { linkedin: string; x: string; facebook: string; youtube: string };
};

export type CheckoutSettings = {
  guestCheckout: boolean;
  /** Minimum order (discounted subtotal), 0 = none */
  minOrder: number;
  requirePhone: boolean;
  showNotes: boolean;
  defaultCountry: string;
};

export type PaymentOption = { enabled: boolean; label: string; instructions: string };
export type PaymentSettings = { card: PaymentOption; purchaseOrder: PaymentOption; bankTransfer: PaymentOption };

export type EmailTemplateKey = "orderConfirmation" | "orderStatus" | "verifyEmail" | "resetPassword" | "cartReminder";
export type EmailTemplate = { subject: string; intro: string };
export type EmailSettings = {
  senderName: string;
  /** Empty = EMAIL_FROM from the environment */
  senderEmail: string;
  replyTo: string;
  templates: Record<EmailTemplateKey, EmailTemplate>;
};

export type InventorySettings = { lowStockAt: number };

export type ReviewSettings = {
  /** Customers can write reviews (signed in) */
  enabled: boolean;
  /** New and edited reviews wait in Admin → Reviews until approved */
  requireApproval: boolean;
  /** Only customers who ordered the product can review it */
  buyersOnly: boolean;
};

export type ConfigSections = {
  store: StoreDetails;
  checkout: CheckoutSettings;
  payments: PaymentSettings;
  email: EmailSettings;
  inventory: InventorySettings;
  reviews: ReviewSettings;
};
export type ConfigSection = keyof ConfigSections;

export const DEFAULT_CONFIG: ConfigSections = {
  store: {
    name: "Nexora IT",
    logoText: "NEXORA",
    logoAccent: ".IT",
    logoUrl: null,
    tagline: "Hardware & Solutions",
    announcement: "🚚 Free shipping on orders over $500",
    supportEmail: "fed@example.com",
    salesEmail: "marketing@example.com",
    phone: "",
    address: "",
    footerAbout: "Business-grade IT hardware and solutions, sourced and supported by people who care.",
    copyright: "© {year} Nexora IT. Sample design for reference.",
    social: { linkedin: "", x: "", facebook: "", youtube: "" },
  },
  checkout: { guestCheckout: true, minOrder: 0, requirePhone: false, showNotes: true, defaultCountry: "US" },
  payments: {
    card: { enabled: true, label: "Credit card", instructions: "You'll enter your card on Stripe's secure payment page." },
    purchaseOrder: { enabled: true, label: "Purchase order", instructions: "We'll confirm your order and send an invoice against your purchase order." },
    bankTransfer: { enabled: true, label: "Bank transfer", instructions: "We'll email bank transfer details; the order ships once payment arrives." },
  },
  email: {
    senderName: "Nexora IT",
    senderEmail: "",
    replyTo: "",
    templates: {
      orderConfirmation: { subject: "Order {order} received", intro: "Thank you, {name}! We've received your order {order}." },
      orderStatus: { subject: "Order {order}: {status}", intro: "" },
      verifyEmail: { subject: "Confirm your email address", intro: "Welcome, {name}! Please confirm that this is your email address." },
      resetPassword: { subject: "Reset your password", intro: "Hi {name}, someone (hopefully you) asked to reset the password for this account." },
      cartReminder: { subject: "You left something in your cart", intro: "Still thinking it over, {name}? Your cart is saved." },
    },
  },
  inventory: { lowStockAt: 10 },
  reviews: { enabled: true, requireApproval: true, buyersOnly: false },
};

export const EMAIL_TEMPLATE_INFO: Record<EmailTemplateKey, { label: string; when: string; placeholders: string }> = {
  orderConfirmation: { label: "Order received", when: "Sent when an order is placed (card orders: when paid).", placeholders: "{name} {order} {store}" },
  orderStatus: {
    label: "Order status update",
    when: "Sent when you change an order's status. Leave the intro empty to use the built-in text for each status.",
    placeholders: "{name} {order} {status} {store}",
  },
  verifyEmail: { label: "Confirm email", when: "Sent after registering.", placeholders: "{name} {store}" },
  resetPassword: { label: "Reset password", when: "Sent from “Forgot password?”.", placeholders: "{name} {store}" },
  cartReminder: { label: "Abandoned cart", when: "Sent once for a cart left alone (confirmed emails only).", placeholders: "{name} {store}" },
};

/** Replaces {placeholders}; unknown ones are left as they are. */
export const fillTemplate = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? values[key] : m));

// ---------- merging stored values over defaults ----------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Deep-merges `stored` into `defaults`, keeping only keys and value types the defaults know. */
export function mergeDefaults<T>(defaults: T, stored: unknown): T {
  if (!isObj(defaults) || !isObj(stored)) return defaults;
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, def] of Object.entries(defaults)) {
    const v = stored[k];
    if (v === undefined) continue;
    if (isObj(def)) out[k] = mergeDefaults(def, v);
    else if (def === null) out[k] = typeof v === "string" ? v : null; // nullable strings (logoUrl)
    else if (typeof v === typeof def) out[k] = v;
  }
  return out as T;
}
