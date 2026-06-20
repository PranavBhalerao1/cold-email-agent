import { tool, generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { tavily } from '@tavily/core';
import nodemailer from 'nodemailer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

export const searchWeb = tool({
  description:
    'Search the web to find information about a startup and locate a contact or careers email address',
  parameters: z.object({
    query: z.string().describe('The search query to run'),
  }),
  execute: async ({ query }) => {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
    const result = await client.search(query, { maxResults: 5 });
    return result.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    }));
  },
});

export const writeEmail = tool({
  description:
    'Draft a personalized cold email from Pranav Bhalerao to a startup, given details about what they do and a contact email',
  parameters: z.object({
    startupName: z.string().describe('Name of the startup'),
    contactFirstName: z
      .string()
      .describe('First name of the contact person, or "there" if unknown'),
    startupOneLiner: z
      .string()
      .describe(
        'One specific, real thing the startup does that relates to speech, audio, or AI — used in the connecting sentence only'
      ),
    contactEmail: z
      .string()
      .describe('Email address to send the cold email to'),
  }),
  execute: async ({ contactFirstName, startupName, startupOneLiner, contactEmail }) => {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: `You are writing a cold email on behalf of Pranav Bhalerao. Follow the template below EXACTLY. The only sentence you may change is the one labeled [CUSTOMIZE]. Everything else must stay word-for-word identical.

TEMPLATE:
---
Hi ${contactFirstName},

I'm an incoming freshman at Stanford and a co-first author on an ASR paper (https://arxiv.org/pdf/2601.06972) initially accepted to ACL 2026, now revised for EMNLP 2026. The paper analyzes how architectural inductive bias shapes hierarchical speech feature learning across 24 models (Transformers vs. Conformers), so I've spent serious time thinking about exactly the kinds of problems [COMPANY] works on.

[CUSTOMIZE: Write exactly one sentence connecting Pranav's ASR/architecture work to something specific and real about what ${startupName} does, based on this context: ${startupOneLiner}. Do not start with "I". Keep it factual and grounded, no hype.]

I'd love to contribute this summer and am happy to work on whatever's most useful to the team, even if there isn't a formal role. Would you be open to a quick call?

Pranav Bhalerao
8482478482
---

Output format — return ONLY this, nothing else:
SUBJECT: Quick note from an incoming Stanford freshman
BODY:
<the email body exactly as templated, with [CUSTOMIZE] replaced by your one sentence and [COMPANY] replaced by ${startupName}>`,
    });

    const lines = text.split('\n');
    const subjectLine =
      lines
        .find((l) => l.startsWith('SUBJECT:'))
        ?.replace('SUBJECT:', '')
        .trim() ?? `Quick note from an incoming Stanford freshman`;
    const bodyStart = lines.findIndex((l) => l.startsWith('BODY:'));
    const body =
      bodyStart >= 0
        ? lines
            .slice(bodyStart + 1)
            .join('\n')
            .trim()
        : text.trim();

    return { subject: subjectLine, body, to: contactEmail };
  },
});

export const sendEmail = tool({
  description: 'Send an email via Gmail SMTP using nodemailer',
  parameters: z.object({
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Plain-text email body'),
  }),
  execute: async ({ to, subject, body }) => {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER!,
        pass: process.env.GMAIL_APP_PASSWORD!,
      },
    });

    const resumePath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'resume.pdf'
    );

    const info = await transporter.sendMail({
      from: `Pranav Bhalerao <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: body,
      attachments: [
        {
          filename: 'Pranav_Bhalerao_Resume.pdf',
          path: resumePath,
        },
      ],
    });

    return { success: true, messageId: info.messageId, sentTo: to };
  },
});
