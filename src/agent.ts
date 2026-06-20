import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { startups, type Startup } from './startups.js';
import { searchWeb, sendEmail } from './tools.js';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profile = readFileSync(resolve(root, 'profile.txt'), 'utf-8').trim();
const emailTemplate = readFileSync(resolve(root, 'email-template.txt'), 'utf-8').trim();

const subjectMatch = emailTemplate.match(/^SUBJECT:\s*(.+)$/m);
const SUBJECT = subjectMatch ? subjectMatch[1].trim() : 'Quick note';

const bodyMatch = emailTemplate.match(/^BODY:\s*\n([\s\S]+)$/m);
const BODY_TEMPLATE = bodyMatch ? bodyMatch[1].trim() : emailTemplate;

async function scrapeUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
  } catch {
    return '';
  }
}

async function buildContext(startup: Startup): Promise<string> {
  const parts: string[] = [];

  console.log(`  [scrape] Fetching ${startup.url}...`);
  const scraped = await scrapeUrl(startup.url);
  if (scraped) parts.push(`Website (${startup.url}):\n${scraped}`);

  const needsSearch = !startup.email || !startup.contactFirstName;
  if (needsSearch) {
    console.log('  [search] Running Tavily search...');
    const results = await searchWeb(`${startup.name} startup contact email careers`);
    const tavilySnippet = results
      .map((r) => `${r.title}\n${r.url}\n${r.content.slice(0, 800)}`)
      .join('\n\n---\n\n')
      .slice(0, 2000);
    if (tavilySnippet) parts.push(`Search results:\n${tavilySnippet}`);
  }

  return parts.join('\n\n===\n\n');
}

async function processStartup(startup: Startup): Promise<void> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Targeting: ${startup.name}`);
  console.log('='.repeat(50));

  const snippet = await buildContext(startup);

  const emailInstruction = startup.email
    ? `The recipient email is already known: ${startup.email}. Use this exactly — do not change it.`
    : `Find the best contact or careers email address for ${startup.name} from the context above. Prioritize emails found directly on the website over search results. You MUST provide a real email — do not leave it blank.`;

  const nameInstruction = startup.contactFirstName
    ? `The contact's first name is already known: ${startup.contactFirstName}. Use this exactly.`
    : `Find the contact's first name from the context above. NEVER use "there" as a first name. If no real person's name is found, use the company name (e.g. "Hi ${startup.name},").`;

  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `You are helping send a cold email on behalf of the sender described below.

Sender profile:
${profile}

Context for "${startup.name}":
${snippet || '(no additional context available)'}

Instructions:
- ${emailInstruction}
- ${nameInstruction}
- Write the email body following the EXACT template below. The ONLY part you write is [CUSTOMIZE] — every other word is locked.

RULES FOR [CUSTOMIZE]:
- Write ONE sentence in FIRST PERSON — you ARE the sender writing this email, not describing them
- NEVER refer to the sender in third person
- Connect something from the sender's background to something specific and real about what ${startup.name} does
- Pick the most relevant angle from the profile — do NOT force the ASR angle if it doesn't fit
- Do NOT start with "I"
- Do NOT use the word "particularly"
- Be specific and factual, no hype or filler words
- NEVER output bracket placeholders in the final email

EXAMPLE:
Good: "My full-stack work with Next.js and Supabase maps directly to the kind of infrastructure ${startup.name} needs to scale its product."
Bad: "Having developed full-stack applications, the sender appreciates how ${startup.name} streamlines its core offering."

EMAIL TEMPLATE — reproduce EXACTLY, only replacing [CUSTOMIZE], [FIRST_NAME], [COMPANY], [NAME], and [PHONE]:

${BODY_TEMPLATE}

Where:
- [FIRST_NAME] = the contact's first name (or company name if unknown)
- [COMPANY] = ${startup.name}
- [CUSTOMIZE] = your one first-person connecting sentence
- [NAME] = the sender's name from the profile
- [PHONE] = the sender's phone from the profile

PARAGRAPH 1 (LOCKED — copy word for word, only replace [COMPANY]):
The paragraph starting with "I'm an incoming freshman..."

PARAGRAPH 2 (ONE sentence only, first person, you write this):
[CUSTOMIZE]

PARAGRAPH 3 (LOCKED — copy word for word):
The paragraph starting with "I'd love to contribute..."

SIGNATURE (LOCKED — use [NAME] and [PHONE] from profile):
[NAME]
[PHONE]

The final emailBody must have paragraphs separated by \\n\\n and no leading whitespace on any line.

OUTPUT: Return ONLY valid JSON, no markdown, no explanation:
{"to":"<email>","contactFirstName":"<first name or company name>","emailBody":"<full email body>"}`,
  });

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
  console.log(`Targeting ${startups.length} startups: ${startups.map((s) => s.name).join(', ')}\n`);

  for (const startup of startups) {
    try {
      await processStartup(startup);
    } catch (err) {
      console.error(`Error processing ${startup.name}:`, err);
    }
  }

  console.log('\nDone. All startups processed.');
}

main().catch(console.error);
