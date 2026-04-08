import { publish } from "@tanstack/publish-config";

publish({
   branchConfigs: {
      main: {
         prerelease: false,
         previousVersion: false,
      },
      beta: {
         prerelease: true,
         previousVersion: false,
      },
   },
   packages: [
      {
         name: "@montte/cli",
         packageDir: ".",
      },
   ],
   rootDir: "../..",
   branch: process.env["BRANCH"],
   tag: process.env["TAG"],
   ghToken: process.env["GH_TOKEN"],
})
   .then(() => {
      console.log("Successfully published @montte/cli!");
   })
   .catch(console.error);
