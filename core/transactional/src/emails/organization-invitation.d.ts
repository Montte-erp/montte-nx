interface OrganizationInvitationEmailProps {
   invitedByUsername: string;
   invitedByEmail: string;
   teamName: string;
   inviteLink: string;
}
declare function OrganizationInvitationEmail({
   invitedByUsername,
   invitedByEmail,
   teamName,
   inviteLink,
}: OrganizationInvitationEmailProps): import("react/jsx-runtime").JSX.Element;
export default OrganizationInvitationEmail;
declare namespace OrganizationInvitationEmail {
   var PreviewProps: {
      invitedByEmail: string;
      invitedByUsername: string;
      inviteLink: string;
      teamName: string;
   };
}
//# sourceMappingURL=organization-invitation.d.ts.map
