export type Diff = [number, string][];
export type LineDiff = {
   type: "add" | "remove" | "context" | "modify";
   lineNumber?: number;
   content: string;
   oldContent?: string;
   inlineChanges?: Array<{
      type: "add" | "remove" | "unchanged";
      text: string;
   }>;
}[];
export declare function createDiff(text1: string, text2: string): Diff;
export declare function createLineDiff(
   text1: string,
   text2: string,
   contextLines?: number,
): LineDiff;
//# sourceMappingURL=diff.d.ts.map
