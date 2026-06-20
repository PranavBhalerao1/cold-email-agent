import 'dotenv/config';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { startups } from './startups.js';
import { searchWeb, sendEmail } from './tools.js';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

const SUBJECT = 'Quick note from an incoming Stanford freshman';

async function processStartup(startupName: string): Promise<void> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Targeting: ${startupName}`);
  console.log('='.repeat(50));

  // Step 1: search directly in code
  console.log('  [search] Fetching web results...');
  const results = await searchWeb(`${startupName} startup contact email careers`);
  const snippet = results
    .map((r) => `${r.title}\n${r.url}\n${r.content.slice(0, 800)}`)
    .join('\n\n---\n\n')
    .slice(0, 3000);

  // Step 2: single LLM call — output JSON only
  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `You are helping send a cold email on behalf of Pranav Bhalerao (incoming Stanford freshman, co-first author on an ASR paper analyzing architectural inductive bias across 24 models, accepted to ACL 2026 / revised for EMNLP 2026).

Search results for "${startupName}":
${snippet}

From the search results above:
1. Find the best contact or careers email address for ${startupName}.
2. Extract the contact's first name (use "there" if unknown).
3. Identify one specific, concrete thing ${startupName} does that connects to ASR, speech, audio, or AI architecture.
4. Write the email body following the EXACT template below — the only sentence you may write yourself is [CUSTOMIZE].

EMAIL TEMPLATE (reproduce exactly, replacing [CUSTOMIZE] and [COMPANY] with ${startupName}):
Hi [FIRST NAME],

I'm an incoming freshman at Stanford and a co-first author on an ASR paper (https://arxiv.org/pdf/2601.06972) initially accepted to ACL 2026, now revised for EMNLP 2026. The paper analyzes how architectural inductive bias shapes hierarchical speech feature learning across 24 models (Transformers vs. Conformers), so I've spent serious time thinking about exactly the kinds of problems ${startupName} works on.

[CUSTOMIZE: one sentence connecting Pranav's ASR/architecture work to something specific and real about what ${startupName} does. Do not start with "I". Factual and grounded, no hype.]

I'd love to contribute this summer and am happy to work on whatever's most useful to the team, even if there isn't a formal role. Would you be open to a quick call?

Pranav Bhalerao
8482478482

OUTPUT: Return ONLY valid JSON, no markdown, no explanation:
{"to":"<email>","contactFirstName":"<first name>","emailBody":"<full email body with paragraphs separated by \\n\\n>"}`,
  });

  // Step 3: parse JSON and send directly in code
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('  [error] LLM did not return valid JSON:', text);
    return;
  }

  const { to, contactFirstName, emailBody } = JSON.parse(jsonMatch[0]) as {
    to: string;
    contactFirstName: string;
    emailBody: string;
  };

  const body = emailBody
    .split('\n')
    .map((line) => line.trimStart())
    .join('\n');

  console.log(`  [email] To: ${to} (${contactFirstName})`);

  const result = await sendEmail({ to, subject: SUBJECT, body });
  console.log(`  [sent] ${JSON.stringify(result)}`);
}

async function main(): Promise<void> {
  console.log(`${process.env.DRY_RUN === 'true' ? '[DRY RUN] ' : ''}Cold Email Agent starting...`);
  console.log(`Targeting ${startups.length} startups: ${startups.join(', ')}\n`);

  for (const startup of startups) {
    try {
      await processStartup(startup);
    } catch (err) {
      console.error(`Error processing ${startup}:`, err);
    }
  }

  console.log('\nDone. All startups processed.');
}

main().catch(console.error);
