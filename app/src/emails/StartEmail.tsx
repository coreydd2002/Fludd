import { Section, Text } from "@react-email/components";

import { EmailLayout, Eyebrow, H1, P, palette } from "./Layout";

export type StartEmailProps = {
  ownerFirstName: string;
  techName: string;
  businessName: string;
  estMinutes: number;
  services: string[];
};

export function startEmailSubject(techName: string) {
  return `${techName} is on the way to service your pool`;
}

/**
 * Sent when the tech taps "On my way". Its whole job is to stop the "when are
 * you coming?" phone call, so it leads with the fact and the time estimate and
 * says nothing else of consequence.
 */
export function StartEmail({
  ownerFirstName,
  techName,
  businessName,
  estMinutes,
  services,
}: StartEmailProps) {
  return (
    <EmailLayout
      preview={`${techName} is on the way — about ${estMinutes} minutes`}
      signOff={`— ${techName}, ${businessName}`}
    >
      <H1>{techName} is on the way</H1>

      <P>
        Hi {ownerFirstName}, {techName} is heading to your pool now. The service
        usually takes about {estMinutes} minutes.
      </P>

      {services.length > 0 ? (
        <>
          <Eyebrow>Today&apos;s services</Eyebrow>
          <Section
            style={{
              backgroundColor: palette.brandTint2,
              borderRadius: 10,
              padding: "12px 16px",
            }}
          >
            {services.map((service) => (
              <Text
                key={service}
                style={{
                  color: palette.ink,
                  fontSize: 15,
                  lineHeight: "24px",
                  margin: 0,
                }}
              >
                • {service}
              </Text>
            ))}
          </Section>
        </>
      ) : null}

      <P>
        You&apos;ll get a full report with photos once the service is finished.
      </P>
    </EmailLayout>
  );
}

// Rendered by the dev preview route at /dev/emails.
export const startEmailSample: StartEmailProps = {
  ownerFirstName: "Dana",
  techName: "Marcus",
  businessName: "Blue Water Pools",
  estMinutes: 45,
  services: [
    "Skim surface",
    "Brush walls",
    "Vacuum",
    "Test & balance chemicals",
    "Empty baskets",
  ],
};
