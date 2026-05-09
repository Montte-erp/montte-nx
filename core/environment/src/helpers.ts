export const isClientProduction = import.meta.env.PROD;
export const isProduction = process.env.NODE_ENV === "production";

export const getDomain = () => {
   if (isProduction) {
      return "https://app.montte.co";
   }

   return "http://localhost:3000";
};
