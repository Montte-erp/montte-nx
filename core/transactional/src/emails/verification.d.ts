interface VerificationEmailProps {
   verificationUrl: string;
   type: "email-verification" | "change-email";
}
declare function VerificationEmail({
   verificationUrl,
   type,
}: VerificationEmailProps): import("react/jsx-runtime").JSX.Element;
export default VerificationEmail;
declare namespace VerificationEmail {
   var PreviewProps: {
      verificationUrl: string;
      type: "email-verification";
   };
}
//# sourceMappingURL=verification.d.ts.map
