import { initDb } from "../lib/db";

initDb()
  .then(() => {
    console.log("Schema applied.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
