import { render } from "@react-email/components";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FinishEmail, finishEmailSample } from "@/emails/FinishEmail";
import { StartEmail, startEmailSample } from "@/emails/StartEmail";
import {
  UrgentAlertEmail,
  urgentAlertSample,
  urgentAlertSubject,
} from "@/emails/UrgentAlertEmail";

import { TestSendForm } from "./TestSendForm";

export const metadata = { title: "Email preview" };

/**
 * Renders the owner-facing templates without sending anything.
 *
 * Gated to non-production: it exposes nothing sensitive, but a public page on
 * app.fludd.com showing fake service reports would be confusing at best.
 */
const TEMPLATES = {
  start: {
    name: "On my way",
    subject: "Marcus is on the way to service your pool",
    element: StartEmail(startEmailSample),
  },
  finish: {
    name: "Service complete",
    subject: "Your pool service is complete",
    element: FinishEmail(finishEmailSample),
  },
  urgent: {
    name: "Urgent alert",
    subject: urgentAlertSubject(urgentAlertSample.customerName),
    element: UrgentAlertEmail(urgentAlertSample),
  },
} as const;

type TemplateKey = keyof typeof TEMPLATES;

export default async function EmailPreviewPage({
  searchParams,
}: PageProps<"/dev/emails">) {
  if (process.env.NODE_ENV === "production") notFound();

  const { t } = await searchParams;
  const key: TemplateKey =
    t === "finish" || t === "urgent" ? t : "start";
  const template = TEMPLATES[key];
  const html = await render(template.element);

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-8">
      <h1 className="text-2xl">Email preview</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Sample data, nothing sent. Resize the window to check it on a phone.
      </p>

      <nav className="mt-5 flex gap-2">
        {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
          <Link
            key={k}
            href={`/dev/emails?t=${k}`}
            className={`inline-flex min-h-tap items-center rounded-pill px-4 text-sm font-bold ${
              k === key
                ? "bg-brand text-white"
                : "bg-card text-ink ring-1 ring-line"
            }`}
          >
            {TEMPLATES[k].name}
          </Link>
        ))}
      </nav>

      <p className="mt-5 rounded-sm bg-brand-tint-2 px-3 py-2 text-sm">
        <span className="font-bold">Subject: </span>
        {template.subject}
      </p>

      <TestSendForm
        template={key}
        defaultTo={process.env.DEV_EMAIL_OVERRIDE ?? ""}
      />

      {/* An iframe so the email's own styles cannot inherit from the app's. */}
      <iframe
        title={`${template.name} email preview`}
        srcDoc={html}
        className="mt-4 h-[900px] w-full rounded-card bg-white ring-1 ring-line"
      />
    </main>
  );
}
