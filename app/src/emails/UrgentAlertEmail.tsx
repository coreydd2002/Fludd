import { Section, Text } from "@react-email/components";

import { EmailLayout, Eyebrow, H1, P, palette } from "./Layout";

export type UrgentAlertProps = {
  techName: string;
  customerName: string;
  servicedAt: string;
  message: string;
  rating: number | null;
  inboxUrl: string;
};

export function urgentAlertSubject(customerName: string) {
  return `Urgent: ${customerName} reported an issue`;
}

/**
 * Goes to the pool service, not the customer, the moment someone ticks
 * "this is urgent". Green water and a leaking pump are time-sensitive in a way
 * a star rating is not, so this does not wait to be noticed in an inbox screen.
 */
export function UrgentAlertEmail({
  techName,
  customerName,
  servicedAt,
  message,
  rating,
  inboxUrl,
}: UrgentAlertProps) {
  return (
    <EmailLayout
      preview={`${customerName} reported an urgent issue`}
      signOff="Fludd"
    >
      <H1>{customerName} reported an urgent issue</H1>

      <P>
        Serviced {servicedAt}
        {rating ? ` · rated ${rating} out of 5` : ""}.
      </P>

      <Eyebrow>What they said</Eyebrow>
      <Section
        style={{
          backgroundColor: palette.warnTint,
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: palette.ink,
            fontSize: 15,
            lineHeight: "23px",
            margin: 0,
            whiteSpace: "pre-wrap" as const,
          }}
        >
          {message}
        </Text>
      </Section>

      <P>
        Hi {techName} — this is waiting in your feedback inbox at {inboxUrl}, and
        it will show at the top of this pool&apos;s next visit.
      </P>
    </EmailLayout>
  );
}

export const urgentAlertSample: UrgentAlertProps = {
  techName: "Marcus",
  customerName: "Dana Henderson",
  servicedAt: "Friday, September 4 at 9:42 AM",
  message: "The water has gone cloudy green since yesterday and the pump is making a grinding noise.",
  rating: 2,
  inboxUrl: "https://app.fludd.com/inbox",
};
