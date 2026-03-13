interface BudgetAlertEmailProps {
   categoryName: string;
   spentAmount: string;
   limitAmount: string;
   percentUsed: number;
   alertThreshold: number;
   month: string;
}
declare function BudgetAlertEmail({
   categoryName,
   spentAmount,
   limitAmount,
   percentUsed,
   alertThreshold,
   month,
}: BudgetAlertEmailProps): import("react/jsx-runtime").JSX.Element;
export default BudgetAlertEmail;
declare namespace BudgetAlertEmail {
   var PreviewProps: {
      categoryName: string;
      spentAmount: string;
      limitAmount: string;
      percentUsed: number;
      alertThreshold: number;
      month: string;
   };
}
//# sourceMappingURL=budget-alert.d.ts.map
