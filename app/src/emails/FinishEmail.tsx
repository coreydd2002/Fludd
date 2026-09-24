import { Button, Section, Text } from "@react-email/components";

import { EmailLayout, Eyebrow, H1, P, palette } from "./Layout";

export type FinishEmailProps = {
  ownerFirstName: string;
  techName: string;
  businessName: string;
  /** Already formatted in the company's timezone by the caller. */
  finishedAt: string;
  readingsSummary: string | null;
  allHealthy: boolean;
  completed: string[];
  skipped: string[];
  techNotes: string | null;
  photoCount: number;
  reportUrl: string;
};

export const FINISH_EMAIL_SUBJECT = "Your pool service is complete";

/**
 * Sent on Finish. Deliberately short: the readings, photos and full checklist
 * live on the report page, and the one action here is the button that opens it.
 *
 * Photos are linked rather than attached — a handful of phone photos would
 * blow past attachment limits, and the report page is where the owner can also
 * leave feedback.
 */
export function FinishEmail({
  ownerFirstName,
  techName,
  businessName,
  finishedAt,
  readingsSummary,
  allHealthy,
  completed,
  skipped,
  techNotes,
  photoCount,
  reportUrl,
}: FinishEmailProps) {
  return (
    <EmailLayout
      preview={readingsSummary ?? `Your pool was serviced on ${finishedAt}`}
      signOff={`— ${techName}, ${businessName}`}
    >
      <H1>Your pool was serviced</H1>

      <P>
        Hi {ownerFirstName}, {techName} finished at your pool on {finishedAt}.
      </P>

      {readingsSummary ? (
        <Section
          style={{
            backgroundColor: allHealthy ? palette.okTint : palette.warnTint,
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: allHealthy ? palette.okDeep : palette.warn,
              fontSize: 15,
              fontWeight: 700,
              lineHeight: "22px",
              margin: 0,
            }}
          >
            {allHealthy ? `✓ ${readingsSummary}` : readingsSummary}
          </Text>
        </Section>
      ) : null}

      {completed.length > 0 ? (
        <>
          <Eyebrow>Completed</Eyebrow>
          {completed.map((service) => (
            <Text
              key={service}
              style={{
                color: palette.ink,
                fontSize: 15,
                lineHeight: "24px",
                margin: 0,
              }}
            >
              ✓ {service}
            </Text>
          ))}
        </>
      ) : null}

      {skipped.length > 0 ? (
        <>
          <Eyebrow>Not done today</Eyebrow>
          {skipped.map((service) => (
            <Text
              key={service}
              style={{
                color: palette.inkFaint,
                fontSize: 15,
                lineHeight: "24px",
                margin: 0,
              }}
            >
              — {service}
            </Text>
          ))}
        </>
      ) : null}

      {techNotes ? (
        <>
          <Eyebrow>Notes from {techName}</Eyebrow>
          <Text
            style={{
              color: palette.ink,
              fontSize: 15,
              lineHeight: "23px",
              margin: 0,
              whiteSpace: "pre-wrap" as const,
            }}
          >
            {techNotes}
          </Text>
        </>
      ) : null}

      <Section style={{ margin: "28px 0 8px" }}>
        <Button
          href={reportUrl}
          style={{
            backgroundColor: palette.brand,
            borderRadius: 999,
            color: "#ffffff",
            display: "block",
            fontSize: 16,
            fontWeight: 700,
            padding: "14px 24px",
            textAlign: "center" as const,
            textDecoration: "none",
          }}
        >
          View your report
        </Button>
      </Section>

      <Text
        style={{
          color: palette.inkFaint,
          fontSize: 13,
          lineHeight: "19px",
          margin: "0 0 4px",
          textAlign: "center" as const,
        }}
      >
        {photoCount > 0
          ? `See ${photoCount} photo${photoCount === 1 ? "" : "s"} from today and leave a note for your next visit.`
          : "Leave a rating or a note for your next visit."}
      </Text>
    </EmailLayout>
  );
}

// Rendered by the dev preview route at /dev/emails.
export const finishEmailSample: FinishEmailProps = {
  ownerFirstName: "Dana",
  techName: "Marcus",
  businessName: "Blue Water Pools",
  finishedAt: "Fri, Sep 4 at 9:42 AM",
  readingsSummary: "All readings in the healthy range",
  allHealthy: true,
  completed: ["Skim surface", "Brush walls", "Vacuum", "Empty baskets"],
  skipped: ["Test & balance chemicals"],
  techNotes: "Water level was a little low — worth topping up before Friday.",
  photoCount: 3,
  reportUrl: "https://app.fludd.com/r/sample-token",
};
