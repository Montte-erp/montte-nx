import { err, ok } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import type { SdkContext } from "../../server";
import type { Result } from "neverthrow";

export function requireTeamId(
   teamId: SdkContext["teamId"],
): Result<string, WebAppError<"FORBIDDEN">> {
   if (!teamId)
      return err(
         new WebAppError("FORBIDDEN", {
            message:
               "Esta operação requer uma chave de API vinculada a um projeto.",
            source: "hyprpay",
         }),
      );
   return ok(teamId);
}
