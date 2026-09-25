import { saveEmailSettings, sendTestEmail } from "@/app/actions/settings";
import { Field, fieldClass } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { card, SectionTitle, select } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import { EMAIL_TEMPLATE_INFO, type EmailTemplateKey } from "@/lib/config-shared";
import { emailTransport } from "@/lib/email";

export const metadata = { title: "Email" };

const keys = Object.keys(EMAIL_TEMPLATE_INFO) as EmailTemplateKey[];

// Settings → Email: sender, reply-to, and the subject + intro of every email the store sends.
export default async function EmailSettingsPage() {
  const admin = await requireAdminPage("/admin/settings/email", "settings.view");
  const ro = !can(admin, "settings.edit");
  const e = await getConfig("email");
  const envFrom = process.env.EMAIL_FROM ?? "orders@nexora.test";
  return (
    <div className="grid gap-4">
      <ActionForm readOnly={ro} action={saveEmailSettings} submitLabel="Save email settings" className="grid gap-4">
        <div className={card}>
          <SectionTitle
            hint={`Sending through: ${emailTransport === "resend" ? "Resend" : emailTransport === "mailpit" ? "Mailpit (development inbox, localhost:8025)" : "not configured"}. With Resend, the sender email must use your verified domain.`}
          >
            Sender
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
            <Field label="Sender name" name="senderName" defaultValue={e.senderName} />
            <Field label={`Sender email (empty = ${envFrom})`} name="senderEmail" type="email" defaultValue={e.senderEmail} />
            <Field label="Reply-to email (optional, where customer replies go)" name="replyTo" type="email" defaultValue={e.replyTo} />
          </div>
        </div>
        {keys.map((k) => (
          <div key={k} className={card}>
            <SectionTitle hint={`${EMAIL_TEMPLATE_INFO[k].when} Placeholders: ${EMAIL_TEMPLATE_INFO[k].placeholders}`}>{EMAIL_TEMPLATE_INFO[k].label}</SectionTitle>
            <div className="grid gap-3.5">
              <Field label="Subject" name={`${k}.subject`} defaultValue={e.templates[k].subject} />
              <label className="grid gap-1.5 text-13 text-muted">
                <span>Intro text</span>
                <textarea name={`${k}.intro`} rows={2} defaultValue={e.templates[k].intro} className={fieldClass} />
              </label>
            </div>
          </div>
        ))}
      </ActionForm>

      <div className={card}>
        <SectionTitle hint={`Sends the saved version with sample values to ${admin.email}.`}>Send a test email</SectionTitle>
        <ActionForm readOnly={ro} action={sendTestEmail} submitLabel="Send test email" className="flex flex-wrap items-start gap-3">
          <select name="template" aria-label="Email" className={select}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {EMAIL_TEMPLATE_INFO[k].label}
              </option>
            ))}
          </select>
        </ActionForm>
      </div>
    </div>
  );
}
