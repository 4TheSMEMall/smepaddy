import { existsSync } from "node:fs";

import { config } from "dotenv";

const candidatePaths = ["apps/backend/.env", ".env"];

for (const path of candidatePaths) {
  if (existsSync(path)) {
    config({ path, override: false });
  }
}
