// Seeds the database only if it's empty — safe to run on every container
// start (e.g. after a deploy) without wiping data on restarts where a
// persistent volume already has real state.
const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");

async function main() {
  const db = new PrismaClient();
  try {
    const count = (await db.candidate.count()) + (await db.prospect.count()) + (await db.company.count()) + (await db.agentRun.count());
    if (count === 0) {
      console.log("Database is empty — running seed...");
      execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
    } else {
      console.log(`Database already has ${count} candidates — skipping seed.`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1); // fail visibly instead of serving a broken or partially seeded app
});
