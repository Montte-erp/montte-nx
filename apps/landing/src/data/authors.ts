import type { ImageMetadata } from "astro";
import manoelNeto from "../assets/authors/manoel-neto.jpg";

export interface Author {
   name: string;
   avatar: ImageMetadata;
}

export const authors: Record<string, Author> = {
   "Manoel Neto": { name: "Manoel Neto", avatar: manoelNeto },
};

export function getAuthor(name: string): Author | undefined {
   return authors[name];
}

export function getInitials(name: string): string {
   return name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
}
