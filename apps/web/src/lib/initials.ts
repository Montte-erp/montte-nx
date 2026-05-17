export function getInitials(name: string, email?: string) {
   if (name) {
      const segments = name
         .trim()
         .split(/\s+/)
         .filter((segment) => segment.length > 0);

      const initials = segments
         .map((segment) => segment[0])
         .filter((char) => char !== undefined)
         .join("")
         .toUpperCase()
         .slice(0, 2);

      if (initials.length > 0) return initials;
   }

   return email ? email.slice(0, 2).toUpperCase() : "?";
}
