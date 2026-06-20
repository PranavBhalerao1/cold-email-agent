import 'dotenv/config';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { startups, type Startup } from './startups.js';
import { searchWeb, sendEmail } from './tools.js';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

const SUBJECT = 'Quick note from an incoming Stanford freshman';

async function scrapeUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
  } catch {
    return '';
  }
}

async function buildContext(startup: Startup): Promise<{ snippet: string; resolvedEmail?: string }> {
  const parts: string[] = [];

  // Always scrape the startup's own website
  console.log(`  [scrape] Fetching ${startup.url}...`);
  const scraped = await scrapeUrl(startup.url);
  if (scraped) parts.push(`Website (${startup.url}):\n${scraped}`);

  // Only run Tavily search if we still need an email or name
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

  return { snippet: parts.join('\n\n===\n\n') };
}

async function processStartup(startup: Startup): Promise<void> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Targeting: ${startup.name}`);
  console.log('='.repeat(50));

  const hasAllInfo = !!startup.email && !!startup.contactFirstName;

  let snippet = '';
  if (!hasAllInfo) {
    const ctx = await buildContext(startup);
    snippet = ctx.snippet;
  } else {
    // Still scrape website for context to write a good connecting sentence
    console.log(`  [scrape] Fetching ${startup.url}...`);
    const scraped = await scrapeUrl(startup.url);
    snippet = scraped ? `Website (${startup.url}):\n${scraped}` : '';
  }

  const emailInstruction = startup.email
    ? `The recipient email is already known: ${startup.email}. Use this exactly — do not change it.`
    : `Find the best contact or careers email address for ${startup.name} from the context above. Prioritize emails found directly on the website over search results. You MUST provide a real email — do not leave it blank.`;

  const nameInstruction = startup.contactFirstName
    ? `The contact's first name is already known: ${startup.contactFirstName}. Use this exactly.`
    : `Find the contact's first name from the context above. NEVER use "there" as a first name. If no real person's name is found, use the company name (e.g. "Hi ${startup.name},").`;

  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `You are helping send a cold email on behalf of Pranav Bhalerao (incoming Stanford freshman, co-first author on an ASR paper analyzing architectural inductive bias across 24 models, accepted to ACL 2026 / revised for EMNLP 2026).

Context for "${startup.name}":
${snippet || '(no additional context available)'}

Instructions:
- ${emailInstruction}
- ${nameInstruction}
- Write the email body following the EXACT template below. The ONLY part you write is [CUSTOMIZE] — every other word is locked.

RULES FOR [CUSTOMIZE]:
- Write ONE sentence in FIRST PERSON — you ARE Pranav writing this email, not describing him
- NEVER refer to Pranav in third person (never "Pranav's work", "Pranav appreciates", etc.)
- Connect something from Pranav's background to something specific and real about what ${startup.name} does
- Background to draw from: Stanford CS/Math, ASR research (transformers vs conformers across 24 models), YC Startup School 2026, SIG quant finance discovery day, full-stack dev (Next.js, Supabase, Swift)
- Pick the most relevant angle — do NOT force ASR if it doesn't fit
- Do NOT start with "I"
- Do NOT use the word "particularly"
- Be specific and factual, no hype or filler words
- NEVER output bracket placeholders in the final email

EXAMPLE:
Good: "My full-stack work with Next.js and Supabase maps directly to the kind of infrastructure ${startup.name} needs to scale its product."
Bad: "Having developed full-stack applications, Pranav appreciates how ${startup.name} streamlines its core offering."

EMAIL TEMPLATE — reproduce EXACTLY, only replacing [CUSTOMIZE]:

PARAGRAPH 1 (LOCKED — copy word for word):
I'm an incoming freshman at Stanford and a co-first author on an ASR paper (https://arxiv.org/pdf/2601.06972) initially accepted to ACL 2026, now revised for EMNLP 2026. The paper analyzes how architectural inductive bias shapes hierarchical speech feature learning across 24 models (Transformers vs. Conformers), so I've spent serious time thinking about exactly the kinds of problems ${startup.name} works on.

PARAGRAPH 2 (ONE sentence only, first person, you write this):
[CUSTOMIZE]

PARAGRAPH 3 (LOCKED — copy word for word):
I'd love to contribute this summer and am happy to work on whatever's most useful to the team, even if there isn't a formal role. Would you be open to a quick call?

SIGNATURE (LOCKED):
Pranav Bhalerao
8482478482

The final emailBody must be:
Hi [FIRST NAME],\n\n[PARAGRAPH 1]\n\n[CUSTOMIZE sentence]\n\n[PARAGRAPH 3]\n\nPranav Bhalerao\n8482478482

OUTPUT: Return ONLY valid JSON, no markdown, no explanation:
{"to":"<email>","contactFirstName":"<first name or company name>","emailBody":"<full email body with paragraphs separated by \\n\\n>"}`,
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
