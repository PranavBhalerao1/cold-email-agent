import { tavily } from '@tavily/core';
import nodemailer from 'nodemailer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export async function searchWeb(query: string) {
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
  const result = await client.search(query, { maxResults: 5 });
  return result.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  if (process.env.DRY_RUN === 'true') {
    console.log('\n[DRY RUN] Would send email:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:\n', body);
    console.log('Attachment: Pranav_Bhalerao_Resume.pdf');
    return { success: true, messageId: 'dry-run', dryRun: true };
  }

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
}
