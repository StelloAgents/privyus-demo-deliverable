# Privyus demo

## What this is

This is an interactive demo of the Privyus political-intelligence platform. It runs in a web browser and has no backend, no database, and no real login. The data comes from public records, retrieved in October 2026, and the demo labels it as demo data.

Stello built this demo for Privyus. You (Mo and Max) own the demo and the code. You can copy it into your own accounts at any time. This guide tells you how to put it online under your own account and your own domain name.

**Total time:** about 30 minutes of work, plus up to 48 hours of waiting for a new domain name to start to work.

## What you need

- **A GitHub account.** GitHub keeps the code. Sign up free at [github.com/signup](https://github.com/signup).
- **A Vercel account.** Vercel puts the demo online. You sign up with your GitHub account in Step 1.
  - The free **Hobby** plan is enough to show a demo.
  - Vercel's terms limit the Hobby plan to personal, non-commercial use. If you use the demo for commercial work (for example, to sell to customers), you may need the **Pro** plan (from $20 per user each month). Read [Vercel's Hobby plan page](https://vercel.com/docs/plans/hobby) and the [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage) to decide.
- **A domain name (optional).** An example is `privyus.com`. You can buy one from a registrar such as Namecheap, Cloudflare, GoDaddy, or Squarespace Domains. You can also buy one inside Vercel. If you buy it at Vercel, Vercel connects it automatically and you can skip most of Step 2.

## Step 1: Copy the demo and put it online (about 10 minutes)

The code is public on GitHub: https://github.com/StelloAgents/privyus-demo-deliverable. You do not need anything from Stello. One button makes your own copy of the code in your GitHub account and puts it online with Vercel.

1. Click this button:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FStelloAgents%2Fprivyus-demo-deliverable&project-name=privyus-demo&repository-name=privyus-demo)

2. Vercel asks you to sign in. Click **Continue with GitHub** and sign in with your GitHub account. If you do not have a Vercel account, Vercel makes one now. Choose the **Hobby** plan (or **Pro**, see "What you need").
3. Vercel shows **Create Git Repository**.
   - Under **Git Scope**, choose your personal GitHub account.
   - Keep the repository name `privyus-demo`, or type a different name.
   - Select **Create private Git Repository** if you do not want other people to see the code.
4. Click **Create**. Vercel copies the code into a new repository in your GitHub account.
5. Vercel starts the deployment. Do not change any settings. You do not need environment variables.
6. Wait about 2 minutes. Vercel shows the build progress on screen.
7. When the build is complete, Vercel shows a preview image of the demo. Click **Continue to Dashboard**, then click **Visit**. The demo opens at an address such as `privyus-demo.vercel.app`.

You now own a full copy of the code in your GitHub account. Your copy does not change when Stello changes the original. You can share the `.vercel.app` link now. Step 2 replaces it with your own domain name.

### If the button does not work

You can do the same steps by hand:

1. Open https://github.com/StelloAgents/privyus-demo-deliverable and sign in to GitHub.
2. Click **Fork**, then click **Create fork**. GitHub copies the code into your account.
3. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
4. Find your copy of the repository in the list and click **Import**.
5. Do not change the settings. **Framework Preset** shows **Next.js**.
6. Click **Deploy** and wait about 2 minutes.

### Personal account or organization?

Put your copy in your **personal** GitHub account if you use the free Vercel Hobby plan. The Hobby plan cannot deploy a **private** repository that belongs to a GitHub **organization**. If you want the repository in an organization, use the Vercel Pro plan, or make the repository public.

## Step 2: Connect your domain (about 15 minutes, plus waiting time)

Skip this step if you do not have a domain name. If you bought the domain at Vercel, do only the part "Add the domain in Vercel". Vercel sets the DNS records for you.

### Choose the address

- **Apex domain:** the domain name alone, for example `example.com`.
- **Subdomain:** a name in front of the domain, for example `demo.example.com`.

Use a subdomain (for example `demo.privyus.com`) if your main website already uses `privyus.com`. A subdomain does not change your main website or your email.

### Add the domain in Vercel

1. Open the [Vercel dashboard](https://vercel.com/dashboard).
2. Click your Privyus project.
3. Click **Settings** in the sidebar.
4. Click **Domains**.
5. Click **Add Domain**.
6. Type your domain (for example `demo.privyus.com` or `privyus.com`) and confirm.
7. If you typed an apex domain, Vercel asks if you also want to add `www`. Accept the recommended option. Vercel then sends visitors from one address to the other.
8. Vercel now shows the DNS records that you must add. Keep this page open.

### Add the DNS records at your registrar

DNS records tell the internet where your domain points.

1. Sign in to the website where you bought the domain (your registrar).
2. Open the DNS settings for the domain. Registrars use names such as "DNS", "Manage DNS", or "Advanced DNS".
3. Add the records that Vercel shows:
   - **Apex domain** (`example.com`): an **A** record. The name (or "host") is usually `@`.
   - **Subdomain** (`demo.example.com`): a **CNAME** record. The name (or "host") is the part in front of the domain, for example `demo`.
   - **`www`** (if you added it): a **CNAME** record with the name `www`.
4. Copy the values exactly as Vercel shows them on screen. Vercel can give a value that is specific to your project. Do not copy values from another website or guide.
5. Delete old A, AAAA, or CNAME records that use the same name. Old records can block the new ones.
6. Save the changes.

### Alternative: let Vercel manage all DNS

You can change your domain's nameservers to the Vercel nameservers. Vercel then manages all DNS records for the domain. Vercel shows the nameserver values on the Domains page.

Do this only if you know which other records the domain uses. If your email uses this domain, copy the email records (MX and TXT) to Vercel first. If you do not, your email can stop.

### How long it takes and how to know it worked

- DNS changes usually start to work after a few minutes to a few hours. They can take up to 48 hours.
- Go back to **Settings > Domains** in Vercel. When the domain works, it shows **Valid Configuration** with a check mark.
- Open your domain in a browser. You see the demo.
- Vercel adds the HTTPS certificate (the lock icon in the browser) automatically. You do not need to do anything.

### If it does not work

- **Wrong record type.** Use an A record for an apex domain. Use a CNAME record for a subdomain.
- **Old records are still present.** Delete other A, AAAA, or CNAME records with the same name.
- **Wrong value.** Compare each value at your registrar with the value on the Vercel Domains page, character by character.
- **Wrong name format.** Most registrars want `@` for the apex and `demo` (not `demo.privyus.com`) for a subdomain.
- **Not enough time.** Wait some hours, then examine it again. Some registrars are slow.
- **`www` works but the apex does not (or the opposite).** Add both addresses in **Settings > Domains**. Set one to redirect to the other.
- **Domain used by another Vercel account.** Vercel asks you to add a **TXT** record to prove that you own the domain. Add the TXT record that Vercel shows.

For more help, read Vercel's guide: [Adding a custom domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

## Step 3: Make changes later

Vercel watches your GitHub repository. Each time a change goes into the `main` branch, Vercel builds the demo again and puts the new version online. This takes about 2 minutes.

### Small text changes

You can make small text changes on the GitHub website. You do not need special software.

1. Open your repository on github.com.
2. Open the folder `src/data/`. Most of the demo text and data is in this folder:
   - `src/data/dashboard.ts`: the text and numbers on the Home screen.
   - `src/data/script.ts`: the chat questions and answers on the Explore screen.
   - `src/data/tour.ts`: the step titles and speaker notes for presenter mode.
   - `src/data/sources.ts`: the source records that the demo cites.
3. Click the file that you want to change.
4. Click the pencil icon (**Edit this file**).
5. Change only the text between quotation marks. Do not delete quotation marks, commas, or brackets.
6. Click **Commit changes**, then click **Commit changes** again in the window that opens.
7. Wait about 2 minutes. Open the demo and look at your change.

If the demo does not update, open the project in Vercel and click **Deployments**. A failed build shows an "Error" status. The live demo stays on the last good version. To undo your change, edit the file again and put back the old text.

Do not change the facts in `src/data/sources.ts` or `src/data/records/`. A checker script compares the demo with the public records, and a changed fact makes the check fail.

### Larger changes

Larger changes (new screens, new data, new features, changes to the facts) need a developer. Give the developer this repository. The section "For developers" at the end of this file explains how the code works.

## How to present the demo

### Presenter mode

Presenter mode walks through the demo story step by step: Home, then one investigation that starts with a question typed into the ask bar on Home and continues in Explore. The main story is a chain of four links: a member acts (the S. 5025 cosponsors, then Wicker's record), who contacted him (the June 9 FARA contact and its source), who else the same firm contacted, and their records in common on the same bills (S. 5025 cosponsors and H.R. 5334 yes votes). The deeper layers follow on the same graph: the time window, the June 9, 2024 contact date that Wicker and Rep. Mike Turner share, the defense PACs that gave to Wicker, and Sen. Blumenthal's public statements. Then you save the investigation as a checkpoint.

| Action | Key or button |
|---|---|
| Start presenter mode | Click **Present** in the top bar, or press `P` |
| Next step | `→` (Right arrow), `Space`, `Enter`, or `Page Down` |
| Previous step | `←` (Left arrow), `Backspace`, or `Page Up` |
| Show or hide the speaker notes | `N` |
| Go to the first step | `Home` |
| Go to the last step | `End` |
| Stop presenter mode | `Esc` |

A presentation clicker also works, because it sends `Page Up` and `Page Down`.

### Main screens

| Address | Screen |
|---|---|
| `/` | **Home**: the main dashboard. |
| `/search` | **Search**: search across the demo's people, bills, organizations, and records. |
| `/explore` | **Explore**: the relationship graph and the AI chat. People and records are nodes of one graph: people connect through the record they share (a bill, a delegation list, a FARA registrant, a PAC, or a date on which the firm lists a contact with each of them). The node in focus and its direct neighbors are full; people two steps out are faint until you select them. The old `/people` address opens Explore. |
| `/technical` | **Technical**: the technical architecture, with a "Private deployment" section for a self-hosted install. |
| `/login` | **Sign-in screen**: a sample sign-in page. **Continue** goes back to the dashboard. |

### Public statements

When a member is in focus in Explore, a **Public statements** block shows under the chat answer: verbatim quotes from public sources (Senate press releases and news reports that quote the member), each with its date, its source site, and a sentiment label. The same items show in the Home activity feed. Sentiment is an AI reading of the statement text. It does not predict votes. The statements are never a source, and they never change the graph.

## About the data

- **Sources.** The people, bills, organizations, and records come from public sources: senate.gov, clerk.house.gov, congress.gov and govinfo.gov bill status, FEC bulk data, FARA filings, and Senate press releases.
- **Date.** Stello retrieved the records in October 2026. The demo does not update them.
- **Completeness.** The records may be incomplete.
- **Connections.** A connection shows records in common. It does not imply wrongdoing.
- **Illustrative numbers.** The dashboard counts and trends (KPI tiles, radar counters, and sparklines) are illustrative. They are not real measurements.
- **Fact base.** The verified records are in `src/data/records/real-records.json`. Each source in `src/data/sources.ts` points at one of these records by `recordId`, with the record's URL, date, and excerpt word for word.
- **FARA network.** The Moran Global Strategies network (every contact row for The Ministry for Strategic Industries of Ukraine, and the contributions by James P. Moran that the same filing lists) comes from the filing PDF through `scripts/extract-fara-7255.ts`. House members' party and state come from the House Clerk's member data (clerk.house.gov). Each date on which the firm lists two or more of these people is one record node on the graph ("FARA contacts · Jun 9, 2024"). A shared date means only that the firm reported a contact with each person on that date.
- **Checker.** A checker script compares the demo with the fact base. A developer can run it (see "Tests and checks" below).

---

## For developers

This is a standard Next.js project. The data is static, in `src/data/`. There is no API, no database, and no environment variable.

### Run it locally

You need Node.js 20 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

To run the production build:

```bash
npm run build
npm start
```

### Project layout

| Folder | Contents |
|---|---|
| `src/app/` | Next.js App Router pages (`/`, `/explore`, `/search`, `/login`, `/technical`, and dev-only pages under `/dev`; `/people` redirects to `/explore` in `next.config.ts`) |
| `src/features/` | Screen-level features (dashboard, explore, feeds, search, presenter, technical) |
| `src/components/` | Shared UI components (the presenter host is `src/components/ui/TourProvider.tsx`) |
| `src/data/` | Demo fixtures, the chat script, and the tour steps |
| `src/data/records/` | The fact base (`real-records.json`), its normalizer (`facts.ts`), and the text of the FARA filing pages used (`fara-7255-pages.txt`) |
| `src/lib/` | Store, graph, script, and tour engines (`src/lib/tour/`) |
| `src/styles/` | Design tokens and global styles |
| `e2e/` | Playwright test of the full presenter tour |
| `scripts/` | Fact check, layout check, and screenshot helpers |

### Tests and checks

```bash
npx tsx scripts/extract-fara-7255.ts <7255.pdf>   # rebuild the FARA network records (needs pdftotext)
npx tsx scripts/check-real-records.ts   # demo data matches the fact base and the FARA page text, word for word
npx tsx src/data/check.ts               # structural data validator
npm run check:layout                    # graph positions do not depend on history
npm run lint                            # ESLint
```

End-to-end test of the presenter tour:

```bash
npx playwright install chromium
NEXT_DIST_DIR=.next-e2e npm run build
npm run e2e:tour:baseline   # write the golden screenshots (machine specific)
npm run e2e:tour
```

The tests start `next start` on port 3100 unless a server already runs there. Set `PORT` to test on another port. `tsx` is not a project dependency, so `npx` downloads it on the first run.

### Deploy

The project deploys to Vercel with the default settings (see Step 1). Each push to `main` makes a production deployment. Each push to another branch makes a preview deployment.

### Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, React Flow, d3-force, and Three.js.
