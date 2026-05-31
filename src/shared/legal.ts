/** Single source of truth for Terms, Rules, and Privacy — used by dashboard and Discord bot. */

export const LEGAL_LAST_UPDATED = 'May 31, 2026';
export const LEGAL_VERSION = '1.2';

export interface LegalSection {
  id: string;
  title: string;
  body: string;
  bullets: string[];
}

export interface LegalFaqItem {
  q: string;
  a: string;
}

export interface RuleItem {
  title: string;
  body: string;
  do: string[];
  dont: string[];
}

export interface RuleCategory {
  id: string;
  label: string;
  rules: RuleItem[];
}

export interface ConsequenceLevel {
  level: string;
  desc: string;
}

export const TERMS_TOC: { id: string; label: string }[] = [
  { id: 'acceptance', label: 'Acceptance' },
  { id: 'service', label: 'Service' },
  { id: 'disclaimer', label: 'Disclaimers' },
  { id: 'responsibilities', label: 'Your Duties' },
  { id: 'data', label: 'Data & Admin' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'tools', label: 'Tools' },
  { id: 'blocked', label: 'Blocklist' },
  { id: 'ip', label: 'IP & Content' },
  { id: 'liability', label: 'Liability' },
  { id: 'faq', label: 'FAQ' },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    body: 'By accessing The Method Casinos dashboard, Discord bot, discovery engine, or generator tools, you agree to these Terms of Service and our Community Rules. If you do not agree, discontinue use immediately.',
    bullets: [
      'Applies to all users — members and admins alike',
      'Using Discord commands constitutes acceptance',
      'Continued use after updates means you accept revised terms',
    ],
  },
  {
    id: 'service',
    title: '2. Service Description',
    body: 'The Method is a research and organization platform for sweepstakes and social casinos. We curate metadata — ratings, VPN status, trackables, features — and provide tools to find and sign up safely.',
    bullets: [
      'We do not operate, host, or endorse any listed casino unless marked verified',
      'Discovery scans find publicly available sites; we do not guarantee completeness',
      'Trackables (cash-out limits, min redeem) are community-sourced estimates',
      'Generator tools link to third-party temp-mail and SMS services',
    ],
  },
  {
    id: 'disclaimer',
    title: '3. Disclaimers & No Guarantees',
    body: 'All information is provided "as is" for research and educational purposes only. The Method is not a gambling operator, financial advisor, or legal counsel.',
    bullets: [
      'No guarantee of winnings, redemptions, bonus availability, or site uptime',
      'Sweepstakes rules, eligibility, and legality vary by platform and jurisdiction',
      'VPN and geo-restriction tags reflect community knowledge and may change without notice',
      'Verified status indicates manual review — not a financial or legal endorsement',
    ],
  },
  {
    id: 'responsibilities',
    title: '4. User Responsibilities',
    body: 'You are solely responsible for your activity on third-party casino sites and for complying with all applicable laws.',
    bullets: [
      "Must meet each casino's age requirements (typically 18+ or 21+ where required)",
      "Follow each platform's terms of service and one-account policies",
      'Do not use The Method to facilitate fraud, money laundering, or identity theft',
      'Report suspicious sites via the Blocklist — do not share scam links in Discord',
    ],
  },
  {
    id: 'data',
    title: '5. Data, Admin Access & Accuracy',
    body: 'Authorized admins may add, edit, remove casino entries, manage the blocklist, and run discovery scans. All users should contribute accurate data when permitted.',
    bullets: [
      'False or malicious entries may be removed without notice',
      'Admin access is personal — never share credentials or session tokens',
      'We may revoke dashboard or Discord bot access for abuse or TOS violations',
      'Discovery and API endpoints must not be spammed or automated without permission',
    ],
  },
  {
    id: 'privacy',
    title: '6. Privacy & Discord OAuth',
    body: 'Dashboard login uses Discord OAuth for identity verification only. We do not sell user data.',
    bullets: [
      "Session data is stored locally on the operator's server instance",
      'Discord username, avatar, and ID are used for auth and admin role checks',
      'No payment information is collected — The Method is free to use',
      'Third-party casino sites have their own privacy policies',
    ],
  },
  {
    id: 'tools',
    title: '7. Generator & Research Tools',
    body: 'Email, phone, and password generators are convenience tools for legitimate signup research on sweepstakes platforms.',
    bullets: [
      'Misuse — fraud, spam, harassment, ban evasion on prohibited platforms — is forbidden',
      'Temp-mail and SMS sites are third-party; we are not responsible for their availability',
      'Generated credentials should be stored securely (password manager recommended)',
      'URL Checker and blocklist are advisory — always use your own judgment',
    ],
  },
  {
    id: 'blocked',
    title: '8. Blocklist Policy',
    body: 'Dangerous, scam, and phishing URLs are maintained on a blocklist. Discovery and manual adds reject blocked domains automatically.',
    bullets: [
      'Blocklist entries include reason, severity, and description',
      'Admins may block sites and optionally remove matching casino entries',
      'Community reports should include evidence when possible',
      'False positives can be corrected by admins — contact an admin in Discord',
    ],
  },
  {
    id: 'ip',
    title: '9. Intellectual Property',
    body: 'The Method name, logo, dashboard design, and bot embeds are property of the project operators.',
    bullets: [
      'Casino names, logos, and URLs belong to their respective owners',
      'Do not rebrand or resell The Method tools without permission',
      'Community data (trackables, ratings) is for internal hub use',
    ],
  },
  {
    id: 'liability',
    title: '10. Limitation of Liability',
    body: 'To the fullest extent permitted by law, The Method and its operators shall not be liable for any indirect, incidental, or consequential damages.',
    bullets: [
      'Account bans, missed redemptions, VPN blocks, or lost funds on third-party sites',
      'Malware, phishing, or fraud encountered via external links',
      'Inaccurate trackables, ratings, or feature tags',
      'Service downtime, data loss, or unauthorized access to self-hosted instances',
    ],
  },
];

export const TERMS_FAQ: LegalFaqItem[] = [
  {
    q: 'Is The Method a casino?',
    a: 'No. We are a database and tool hub. We never handle your money or casino logins.',
  },
  {
    q: 'Can I get banned for using temp-mail?',
    a: "Some casinos prohibit disposable emails. Check each site's terms. We provide tools — you choose how to sign up.",
  },
  {
    q: 'Who can edit the database?',
    a: 'Admins manage entries via the dashboard. Members can browse, use tools, and run Discord commands.',
  },
  {
    q: 'What if a casino scams me?',
    a: 'Block the URL in our system, report in Discord, and warn the community. We are not responsible for third-party site behavior.',
  },
  {
    q: 'Are discovery scans legal?',
    a: 'Scans fetch publicly available web pages and search results. Do not use discovery to attack or overload sites.',
  },
];

export const RULES_CATEGORIES: RuleCategory[] = [
  {
    id: 'standards',
    label: 'Core Standards',
    rules: [
      {
        title: 'Respect the Database',
        body: 'Do not spam discovery scans, flood the API, or run automated bulk requests. Quick scans ~3 min, deep scans ~12 min — let them finish.',
        do: ['Run one scan at a time', 'Wait for results before re-scanning'],
        dont: ['Hammer /api/discover repeatedly', 'Script bulk casino adds without admin approval'],
      },
      {
        title: 'Accurate Trackables',
        body: "When adding or editing casinos, fill in Cash Out Before Blocked, min redeem, and custom trackables honestly. Bad data wastes everyone's time.",
        do: ['Update trackables when limits change', 'Use clear labels like "Min Redeem"'],
        dont: ['Guess or copy from other casinos', 'Inflate ratings without reason'],
      },
      {
        title: 'No Scam Links — Ever',
        body: 'Only legitimate sweepstakes/social casinos belong in the database. Use the Blocklist for phishing, clones, and malware sites.',
        do: ['Report scams via Block Site', 'Use URL Checker before unknown links'],
        dont: ['Add referral spam or fake login pages', 'Share blocked URLs in Discord'],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin & Access',
    rules: [
      {
        title: 'Admin Commands Stay Admin',
        body: '/discover, /block, dashboard edits, and discovery scans are admin-only. Never share admin Discord IDs, tokens, or dashboard sessions.',
        do: ['Rotate bot token if exposed', 'Use Discord OAuth only on trusted machines'],
        dont: ['Give admin role casually', 'Post .env contents anywhere'],
      },
      {
        title: 'Blocklist Responsibility',
        body: 'Admins blocking sites should include a clear reason and description. Use "remove from database" when blocking a listed casino.',
        do: ['Set severity appropriately (critical for phishing)', 'Document clone/impersonation details'],
        dont: ['Block competitors out of spite', 'Block without a reason'],
      },
    ],
  },
  {
    id: 'tags',
    label: 'Tags & Features',
    rules: [
      {
        title: 'VPN & Geo Tags',
        body: 'Mark VPN Allowed, VPN Blocked, and Geo Restricted based on real experience. If unknown, leave untagged — do not guess.',
        do: ['Test with and without VPN when possible', 'Note state restrictions in description'],
        dont: ['Tag every casino VPN Allowed by default', 'Copy tags from a different casino'],
      },
      {
        title: 'Feature Tags',
        body: 'Use feature tags that accurately reflect what the casino offers — slots, fish games, redeem methods, apps, etc.',
        do: ['Refer to the feature categories on the dashboard', 'Add new redeem methods when confirmed'],
        dont: ['Tag slots if only sports exist', 'Over-tag for search visibility'],
      },
    ],
  },
  {
    id: 'community',
    label: 'Community & Discord',
    rules: [
      {
        title: 'Discord Conduct',
        body: 'Use bot commands in designated channels. Keep discussions helpful — share trackables, warn about scams, help newcomers.',
        do: ['Use /check before debating if a URL is safe', 'Share verified casino tips'],
        dont: ['Harass members or admins', 'Sell access or "methods" for profit', 'Share stolen credentials'],
      },
      {
        title: 'Generator Tools',
        body: 'Email, phone, and password tools are for legitimate sweepstakes signup research. One unique password per casino.',
        do: ['Use temp-mail for signups', 'Store passwords in a manager'],
        dont: ['Use tools for fraud or harassment', 'Reuse passwords across casinos'],
      },
      {
        title: 'One Account Policy',
        body: "Follow each casino's terms. The Method helps you find options — you are responsible for compliance, age requirements, and regional laws.",
        do: ["Read each site's sweeps rules", 'Keep one account per person per casino'],
        dont: ['Multi-account unless the casino allows it', 'Use VPN where explicitly blocked'],
      },
    ],
  },
];

export const RULES_DO_SUMMARY = [
  'Report scams to the blocklist',
  'Fill trackables with real numbers',
  'Use URL Checker on unknown links',
  'Run discovery responsibly',
  'Help newcomers in Discord',
];

export const RULES_DONT_SUMMARY = [
  'Add phishing or clone sites',
  'Spam API or discovery scans',
  'Share admin tokens or sessions',
  'Reuse passwords across casinos',
  'Sell access to the hub',
];

export const RULES_CONSEQUENCES: ConsequenceLevel[] = [
  {
    level: 'Warning',
    desc: 'First-time minor issues — inaccurate tag, spammy command use',
  },
  {
    level: 'Access Revoked',
    desc: 'Repeated abuse, sharing admin access, or adding scam links',
  },
  {
    level: 'Permanent Ban',
    desc: 'Fraud, harassment, malware distribution, or deliberate database sabotage',
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'overview',
    title: 'Privacy Overview',
    body: 'The Method Casinos collects minimal data to operate the dashboard and Discord bot. We do not sell personal information.',
    bullets: [
      'Free service — no payment or billing data',
      'Operator-hosted instances control where data is stored',
      'Third-party casinos have separate privacy policies',
    ],
  },
  {
    id: 'discord-oauth',
    title: 'Discord OAuth (Dashboard Login)',
    body: 'Signing into the dashboard uses Discord OAuth with the identify scope only.',
    bullets: [
      'We receive: Discord user ID, username, avatar hash',
      'Used for: session auth, admin role checks, display in the UI',
      'We do not request message content, guilds, or email via OAuth',
    ],
  },
  {
    id: 'sessions',
    title: 'Sessions & Cookies',
    body: 'The Express API stores session cookies for authenticated dashboard users.',
    bullets: [
      'Session secret must be set in production (SESSION_SECRET)',
      'Cookies are httpOnly; secure flag enabled when NODE_ENV=production',
      'Logging out destroys the server-side session',
    ],
  },
  {
    id: 'bot',
    title: 'Discord Bot Interactions',
    body: 'Slash commands process your inputs to query the casino database and return embeds.',
    bullets: [
      'Command usage is visible to Discord per their policies',
      'We do not store chat logs in The Method database by default',
      'Admin actions (block, discover) may be logged by server operators',
    ],
  },
  {
    id: 'retention',
    title: 'Data Retention & Deletion',
    body: 'Casino and blocklist data is stored in SQLite on the operator server.',
    bullets: [
      'Self-hosted operators control backups and retention',
      'Request session revocation by logging out of the dashboard',
      'Contact server admins for account or data questions',
    ],
  },
];

export const WEBSITE_FEATURES = [
  { name: 'Casino Database', path: '/casinos', desc: 'Search, filter, and manage sweepstakes casinos' },
  { name: 'Similar Casinos', path: '/similar', desc: 'Find casinos like ones you already enjoy' },
  { name: 'Discovery', path: '/discovery', desc: 'Scan the web for new casino sites (admin)' },
  { name: 'Blocked Sites', path: '/blocked', desc: 'Scam, phishing, and dangerous URL list' },
  { name: 'Tools Hub', path: '/tools', desc: 'Email gen, SMS sites, browsers, URL checker' },
  { name: 'Guides', path: '/guides', desc: 'Step-by-step signup workflows' },
];

export const TOOLS_PATHS = [
  { name: 'Tools Hub', path: '/tools' },
  { name: 'Email Generator', path: '/tools/email' },
  { name: 'Phone / SMS Tools', path: '/tools/phone' },
  { name: 'Password Generator', path: '/tools/password' },
  { name: 'URL Checker', path: '/tools/checker' },
];
