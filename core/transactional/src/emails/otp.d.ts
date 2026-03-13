interface OTPEmailProps {
   otp: string;
   type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}
declare function OTPEmail({
   otp,
   type,
}: OTPEmailProps): import("react/jsx-runtime").JSX.Element;
export default OTPEmail;
declare namespace OTPEmail {
   var PreviewProps: {
      otp: string;
      type: "email-verification";
   };
}
//# sourceMappingURL=otp.d.ts.map
