import { PrismaClient } from "@prisma/client";
import { DEFAULT_PROMPTS } from "../src/lib/prompts";

const db = new PrismaClient();

async function main() {
  for (const [genre, promptText] of Object.entries(DEFAULT_PROMPTS)) {
    await db.systemPrompt.upsert({
      where: { genre },
      create: { genre, promptText },
      update: { promptText },
    });
  }
  console.log(`Seeded ${Object.keys(DEFAULT_PROMPTS).length} system prompts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
