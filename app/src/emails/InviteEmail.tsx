import { Button, Section } from "@react-email/components";

import { EmailLayout, H1, P, palette } from "./Layout";

export type InviteEmailProps = {
  businessName: string;
  invitedBy: string;
  url: string;
};

export function inviteEmailSubject(businessName: string) {
  return `Join ${businessName} on Fludd`;
}

/**
 * The only email Fludd sends to a colleague rather than a pool owner.
 *
 * It says who invited them and which company, because an unexpected invitation
 * from an unfamiliar product is otherwise indistinguishable from phishing —
 * and the one thing it asks the reader to do is click a link and sign up.
 *
 * It does not say what their role will be. That can change before they accept,
 * and a promise in an email that the roster later contradicts is worse than
 * saying nothing.
 */
export function InviteEmail({ businessName, invitedBy, url }: InviteEmailProps) {
  return (
    <EmailLayout
      preview={`${invitedBy} invited you to join ${businessName} on Fludd`}
      signOff={`— ${invitedBy}, ${businessName}`}
    >
      <H1>Join {businessName} on Fludd</H1>

      <P>
        {invitedBy} invited you to {businessName}&apos;s pool service account. Fludd is where the
        team sees which pools are due each day and sends service reports to customers.
      </P>

      <Section style={{ margin: "28px 0 8px" }}>
        <Button
          href={url}
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
          Accept the invitation
        </Button>
      </Section>

      <P>
        Sign up with this email address — the invitation only works for the address it was sent to.
        It expires in seven days.
      </P>
    </EmailLayout>
  );
}

/** Sample for the /dev/emails preview, which never sends. */
export const inviteEmailSample: InviteEmailProps = {
  businessName: "Blue Horizon Pools",
  invitedBy: "Marcus",
  url: "https://app.fludd.work/invite/sample-token",
};
