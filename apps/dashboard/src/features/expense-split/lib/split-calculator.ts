import type { SplitType } from "@packages/database/schemas/expense-splits";
import {
   allocate,
   formatDecimalCurrency,
   split as moneySplit,
   of,
   toDecimal,
} from "@packages/money";

interface Participant {
   memberId: string;
   name?: string;
   shareValue?: number;
   percentageValue?: number;
   customAmount?: number;
}

interface SplitResult {
   memberId: string;
   allocatedAmount: string;
   shareValue?: string;
   percentageValue?: string;
}

export function calculateSplit(
   totalAmount: number,
   participants: Participant[],
   splitType: SplitType,
): SplitResult[] {
   if (participants.length === 0) {
      return [];
   }

   switch (splitType) {
      case "equal":
         return calculateEqualSplit(totalAmount, participants);
      case "percentage":
         return calculatePercentageSplit(totalAmount, participants);
      case "shares":
         return calculateSharesSplit(totalAmount, participants);
      case "amount":
         return calculateAmountSplit(participants);
      default:
         return [];
   }
}

function calculateEqualSplit(
   totalAmount: number,
   participants: Participant[],
): SplitResult[] {
   const money = of(String(totalAmount), "BRL");
   const allocations = moneySplit(money, participants.length);

   return participants.map((participant, index) => ({
      allocatedAmount: toDecimal(allocations[index] ?? money),
      memberId: participant.memberId,
   }));
}

function calculatePercentageSplit(
   totalAmount: number,
   participants: Participant[],
): SplitResult[] {
   const totalPercentage = participants.reduce(
      (sum, p) => sum + (p.percentageValue || 0),
      0,
   );

   if (totalPercentage === 0) {
      return participants.map((p) => ({
         allocatedAmount: "0.00",
         memberId: p.memberId,
         percentageValue: "0.00",
      }));
   }

   const money = of(String(totalAmount), "BRL");
   const ratios = participants.map((p) => p.percentageValue || 0);
   const allocations = allocate(money, ratios);

   return participants.map((participant, index) => ({
      allocatedAmount: toDecimal(allocations[index] ?? money),
      memberId: participant.memberId,
      percentageValue: (participant.percentageValue || 0).toFixed(2),
   }));
}

function calculateSharesSplit(
   totalAmount: number,
   participants: Participant[],
): SplitResult[] {
   const totalShares = participants.reduce(
      (sum, p) => sum + (p.shareValue || 1),
      0,
   );

   if (totalShares === 0) {
      return participants.map((p) => ({
         allocatedAmount: "0.00",
         memberId: p.memberId,
         shareValue: "0",
      }));
   }

   const money = of(String(totalAmount), "BRL");
   const ratios = participants.map((p) => p.shareValue || 1);
   const allocations = allocate(money, ratios);

   return participants.map((participant, index) => ({
      allocatedAmount: toDecimal(allocations[index] ?? money),
      memberId: participant.memberId,
      shareValue: (participant.shareValue || 1).toString(),
   }));
}

function calculateAmountSplit(participants: Participant[]): SplitResult[] {
   return participants.map((participant) => {
      const money = of(String(participant.customAmount || 0), "BRL");
      return {
         allocatedAmount: toDecimal(money),
         memberId: participant.memberId,
      };
   });
}

/**
 * Format currency amount (accepts both number and string for backwards compatibility)
 */
export function formatCurrency(amount: number | string): string {
   const numAmount =
      typeof amount === "string" ? Number.parseFloat(amount) : amount;
   return formatDecimalCurrency(numAmount);
}

export function validateSplit(
   totalAmount: number,
   participants: SplitResult[],
): { isValid: boolean; message?: string } {
   const allocatedTotal = participants.reduce(
      (sum, p) => sum + Number.parseFloat(p.allocatedAmount),
      0,
   );

   const difference = Math.abs(totalAmount - allocatedTotal);

   if (difference > 0.01) {
      return {
         isValid: false,
         message: `Allocated amounts (${formatDecimalCurrency(allocatedTotal)}) don't match total (${formatDecimalCurrency(totalAmount)})`,
      };
   }

   return { isValid: true };
}
