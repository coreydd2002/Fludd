import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Shared shell for every owner-facing email.
 *
 * Inline styles and table-ish layout on purpose: email clients strip <style>
 * blocks, ignore most modern CSS, and Outlook in particular will not honour
 * flex or grid. The palette matches ../styles.css so a report looks like it
 * came from the same company as the website.
 */

export const palette = {
  ink: "#0e1b2c",
  inkSoft: "#4a5b6d",
  inkFaint: "#5f6f81",
  brand: "#0b6bcb",
  brandDark: "#085aa8",
  brandTint: "#eaf3fc",
  brandTint2: "#f2f8fd",
  ground: "#f6fbfe",
  card: "#ffffff",
  line: "#e0eaf1",
  ok: "#1c9c6b",
  okTint: "#e3f5ec",
  okDeep: "#14724d",
  warn: "#b86e00",
  warnTint: "#fdf3e3",
};

// Plus Jakarta Sans is a webfont, and most clients will not load one. The
// stack falls through to whatever the device has rather than rendering Times.
const fontStack =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function EmailLayout({
  preview,
  children,
  signOff,
}: {
  preview: string;
  children: ReactNode;
  signOff: string;
}) {
  return (
    <Html lang="en">
      <Head />
      {/* The snippet shown next to the subject in an inbox list. */}
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: palette.ground,
          fontFamily: fontStack,
          margin: 0,
          padding: "24px 0",
          color: palette.ink,
        }}
      >
        <Container
          style={{
            backgroundColor: palette.card,
            borderRadius: 16,
            border: `1px solid ${palette.line}`,
            maxWidth: 520,
            margin: "0 auto",
            padding: "28px 24px",
          }}
        >
          {children}

          <Hr style={{ borderColor: palette.line, margin: "24px 0 16px" }} />
          <Text
            style={{
              color: palette.inkSoft,
              fontSize: 14,
              lineHeight: "20px",
              margin: 0,
            }}
          >
            {signOff}
          </Text>
        </Container>

        <Section style={{ maxWidth: 520, margin: "0 auto", padding: "16px 24px" }}>
          <Text
            style={{
              color: palette.inkFaint,
              fontSize: 12,
              lineHeight: "18px",
              margin: 0,
              textAlign: "center" as const,
            }}
          >
            Sent by Fludd on behalf of your pool service.
          </Text>
        </Section>
      </Body>
    </Html>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: palette.brand,
        fontSize: 22,
        lineHeight: "28px",
        fontWeight: 800,
        letterSpacing: "-0.02em",
        margin: "0 0 8px",
      }}
    >
      {children}
    </Text>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: palette.ink,
        fontSize: 15,
        lineHeight: "23px",
        margin: "0 0 14px",
      }}
    >
      {children}
    </Text>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: palette.inkSoft,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase" as const,
        margin: "20px 0 6px",
      }}
    >
      {children}
    </Text>
  );
}
