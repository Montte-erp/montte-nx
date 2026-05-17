import { createMiddleware, createStart } from "@tanstack/react-start";
import { evlogErrorHandler } from "evlog/nitro/v3";

const evlogErrors = createMiddleware().server(({ next }) =>
   evlogErrorHandler(next),
);

export const startInstance = createStart(() => ({
   requestMiddleware: [evlogErrors],
}));
