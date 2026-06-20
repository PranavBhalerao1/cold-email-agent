import 'dotenv/config';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { startups } from './startups.js';
import { searchWeb, writeEmail, sendEmail } from './tools.js';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

async function processStartup(startupName: string): Promise<void> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Targeting: ${startupName}`);
  console.log('='.repeat(50));

  const { text, steps } = await generateText({
    model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
    tools: { searchWeb, writeEmail, sendEmail },
    maxSteps: 10,
    system: `You are a cold email agent sending outreach emails on behalf of Pranav Bhalerao.

About Pranav:
- Incoming Stanford freshman, studying Math + CS
- Co-first author on an ASR paper at Stanford Computational Linguistics Lab
  - Paper: https://arxiv.org/pdf/2601.06972
  - Initially accepted to ACL 2026, now revised for EMNLP 2026
  - Analyzes how architectural inductive bias shapes hierarchical speech feature learning across 24 ASR models (Transformers vs. Conformers)
- Selected for YC Startup School 2026 (30k+ applicants)
- Invited to SIG High School Discovery Day (quantitative trading)
- National Merit Scholarship Finalist
- Email: pranavrbhalerao@gmail.com
- Phone: 8482478482

For each startup you receive, follow these steps IN ORDER:
1. Use searchWeb to research what the startup does — find one specific, concrete thing they work on (especially related to speech, audio, or AI) AND find a contact or careers email address. Search multiple times if needed.
2. Use writeEmail with: the startup name, the contact's first name (or "there" if unknown), a one-liner about what specifically they do that connects to Pranav's ASR/architecture work, and the contact email.
3. Use sendEmail with the subject, body, and recipient returned by writeEmail.

Do not stop until sendEmail has been called and returned successfully.`,
    prompt: `Research ${startupName} and send a cold email from Pranav Bhalerao to their contact or careers email. Run multiple searches if needed to find both a real contact email and a specific detail about their work.`,
  });

  console.log(`\nSteps taken: ${steps.length}`);
  for (const step of steps) {
    for (const tc of step.toolCalls ?? []) {
      console.log(`  [tool] ${tc.toolName}`);
    }
    for (const tr of step.toolResults ?? []) {
      if (tr.toolName === 'sendEmail') {
        console.log(`  [sent] ${JSON.stringify(tr.result)}`);
      }
    }
  }
  console.log(`\nAgent final response: ${text}`);
}

async function main(): Promise<void> {
  console.log('Cold Email Agent starting...');
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
