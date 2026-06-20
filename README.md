# cold-email-agent

AI agent that researches startups, writes personalized cold emails, and sends them automatically.

## How it works

- Scrapes each startup's website and runs a Tavily web search to gather context about what they do and find a contact email
- Makes a single LLM call (Groq / Llama 3.3 70B) to write a personalized email using your profile and a locked template — only the connecting sentence is generated
- Sends the email via Gmail SMTP with your resume attached, using nodemailer

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/cold-email-agent.git
   cd cold-email-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in each key in `.env`:
   - `GROQ_API_KEY` — free at [console.groq.com](https://console.groq.com)
   - `TAVILY_API_KEY` — free at [app.tavily.com](https://app.tavily.com)
   - `GMAIL_USER` — your Gmail address
   - `GMAIL_APP_PASSWORD` — a Gmail App Password (not your account password); generate one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

4. **Add your resume**
   Place your resume as `resume.pdf` in the project root. It will be attached to every email.

5. **Edit your profile**
   Open `profile.txt` and replace the content with your own background. This is injected into the LLM prompt so the agent can write about you accurately.

6. **Customize the email template**
   Open `email-template.txt` to change the subject line or body. The placeholders `[FIRST_NAME]`, `[COMPANY]`, `[CUSTOMIZE]`, `[NAME]`, and `[PHONE]` are filled in automatically.

7. **Add your target companies**
   Edit `src/startups.ts`. Each entry needs at minimum a `name` and `url`. You can optionally pre-fill `email` and `contactFirstName` to skip the search step:
   ```ts
   { name: 'Acme', url: 'https://acme.com' }
   { name: 'Acme', url: 'https://acme.com', email: 'jobs@acme.com', contactFirstName: 'Jane' }
   ```

8. **Run the agent**
   ```bash
   # Preview emails without sending (recommended first)
   DRY_RUN=true npm start

   # Send for real
   DRY_RUN=false npm start
   ```

## File structure

```
cold-email-agent/
├── src/
│   ├── agent.ts        # Main agent loop — orchestrates search, LLM call, and send
│   ├── tools.ts        # searchWeb() and sendEmail() functions
│   └── startups.ts     # List of target companies
├── profile.txt         # Your personal background (injected into the LLM prompt)
├── email-template.txt  # Email subject and body template
├── resume.pdf          # Attached to every email (not committed to git)
├── .env.example        # Environment variable template
└── package.json
```

## Notes

Built as a learning project for AI agents using the [Vercel AI SDK](https://sdk.vercel.ai) with [Groq](https://groq.com) for fast inference and [Tavily](https://tavily.com) for real-time web search.
