import { saveStoreDetails } from "@/app/actions/settings";
import { Field, fieldClass } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { card, CheckField, SectionTitle } from "@/components/admin/ui";
import { StoreLogo } from "@/components/store-logo";
import { requireAdminPage } from "@/lib/admin";
import { getConfig } from "@/lib/config";

export const metadata = { title: "Store details" };

const label = "grid gap-1.5 text-13 text-muted";
const two = "grid grid-cols-2 gap-3.5 max-sm:grid-cols-1";

// Settings → Store details: name, logo, contact details, footer and announcement bar.
export default async function StoreDetailsSettings() {
  await requireAdminPage("/admin/settings");
  const s = await getConfig("store");
  return (
    <ActionForm action={saveStoreDetails} submitLabel="Save store details" className="grid gap-4">
      <div className={card}>
        <SectionTitle hint="Used in page titles, emails and the footer.">Store</SectionTitle>
        <div className="grid gap-3.5">
          <div className={two}>
            <Field label="Store name" name="name" required defaultValue={s.name} />
            <Field label="Tagline (home page title, emails)" name="tagline" defaultValue={s.tagline} />
          </div>
          <Field label="Announcement bar (top of every page; empty = hidden)" name="announcement" defaultValue={s.announcement} />
        </div>
      </div>

      <div className={card}>
        <SectionTitle hint="Upload an image logo, or use a text logo with a red accent part.">Logo</SectionTitle>
        <div className="mb-3.5 flex items-center gap-4 rounded-12 bg-[#f4f6f9] p-4">
          <span className="text-12 text-muted">Current:</span>
          <StoreLogo store={s} className="text-26 tracking-[-1px]" />
        </div>
        <div className="grid gap-3.5">
          <div className={two}>
            <Field label="Logo text" name="logoText" defaultValue={s.logoText} />
            <Field label="Logo accent (shown in red)" name="logoAccent" defaultValue={s.logoAccent} />
          </div>
          <label className={label}>
            <span>Logo image (JPG, PNG or WebP, up to 4 MB; replaces the text logo)</span>
            <input
              type="file"
              name="logo"
              accept="image/jpeg,image/png,image/webp"
              className="text-13 text-ink file:mr-3 file:cursor-pointer file:rounded-pill file:border-0 file:bg-ink file:px-4 file:py-2 file:text-white"
            />
          </label>
          {s.logoUrl && <CheckField name="removeLogo" label="Remove the logo image (use the text logo again)" />}
        </div>
      </div>

      <div className={card}>
        <SectionTitle hint="Shown in the footer and in emails. Leave a field empty to hide it.">Contact</SectionTitle>
        <div className="grid gap-3.5">
          <div className={two}>
            <Field label="Support email" name="supportEmail" type="email" defaultValue={s.supportEmail} />
            <Field label="Sales email" name="salesEmail" type="email" defaultValue={s.salesEmail} />
          </div>
          <Field label="Phone" name="phone" type="tel" defaultValue={s.phone} />
          <label className={label}>
            <span>Address (also shown for local pickup)</span>
            <textarea name="address" rows={3} defaultValue={s.address} className={fieldClass} />
          </label>
        </div>
      </div>

      <div className={card}>
        <SectionTitle hint="Social icons only appear for links you fill in.">Footer & social</SectionTitle>
        <div className="grid gap-3.5">
          <label className={label}>
            <span>About text</span>
            <textarea name="footerAbout" rows={2} defaultValue={s.footerAbout} className={fieldClass} />
          </label>
          <Field label="Copyright line ({year} = current year)" name="copyright" defaultValue={s.copyright} />
          <div className={two}>
            <Field label="LinkedIn URL" name="linkedin" type="url" placeholder="https://linkedin.com/company/…" defaultValue={s.social.linkedin} />
            <Field label="X (Twitter) URL" name="x" type="url" placeholder="https://x.com/…" defaultValue={s.social.x} />
            <Field label="Facebook URL" name="facebook" type="url" placeholder="https://facebook.com/…" defaultValue={s.social.facebook} />
            <Field label="YouTube URL" name="youtube" type="url" placeholder="https://youtube.com/@…" defaultValue={s.social.youtube} />
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
