import * as Stepperize from "@stepperize/react";
import * as React from "react";
declare const defineStepper: <const Steps extends Stepperize.Step[]>(
   ...steps: Steps
) => Stepper.DefineProps<Steps>;
declare namespace Stepper {
   type StepperVariant = "horizontal" | "vertical" | "circle" | "line";
   type StepperLabelOrientation = "horizontal" | "vertical";
   type ConfigProps = {
      variant?: StepperVariant;
      labelOrientation?: StepperLabelOrientation;
      tracking?: boolean;
   };
   type DefineProps<Steps extends Stepperize.Step[]> = Omit<
      Stepperize.StepperReturn<Steps>,
      "Scoped" | "Stepper"
   > & {
      Stepper: {
         Provider: (
            props: Omit<Stepperize.ScopedProps<Steps>, "children"> &
               Omit<React.ComponentProps<"div">, "children"> &
               Stepper.ConfigProps & {
                  children:
                     | React.ReactNode
                     | ((props: {
                          methods: Stepperize.Stepper<Steps>;
                       }) => React.ReactNode);
               },
         ) => React.ReactElement;
         Navigation: (
            props: React.ComponentProps<"nav">,
         ) => React.ReactElement | null;
         Step: (
            props: React.ComponentProps<"button"> & {
               of: Stepperize.Get.Id<Steps>;
               icon?: React.ReactNode;
            },
         ) => React.ReactElement;
         Title: (props: AsChildProps<"h4">) => React.ReactElement;
         Description: (props: AsChildProps<"p">) => React.ReactElement;
         Panel: (props: AsChildProps<"div">) => React.ReactElement;
         Controls: (props: AsChildProps<"div">) => React.ReactElement;
      };
   };
   type CircleStepIndicatorProps = {
      currentStep: number;
      totalSteps: number;
      size?: number;
      strokeWidth?: number;
   };
}
type AsChildProps<T extends React.ElementType> = React.ComponentProps<T> & {
   asChild?: boolean;
};
export { defineStepper };
//# sourceMappingURL=stepper.d.ts.map
