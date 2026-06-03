export interface WebService {
  name: string;
  url: string;
  description: string;
  tags: string[];
  badge?: 'Free' | 'Popular' | 'No Signup' | 'SMS' | 'Instant';
}

export const TEMP_MAIL_SERVICES: WebService[] = [
  { name: 'Mail.tm', url: 'https://mail.tm/', description: 'Instant disposable inbox with API — great for verification links.', tags: ['Instant', 'API'], badge: 'Popular' },
  { name: 'Temp Mail', url: 'https://temp-mail.org/', description: 'One-click temp address, auto-refreshes inbox.', tags: ['Instant', 'No Signup'], badge: 'Popular' },
  { name: 'Guerrilla Mail', url: 'https://www.guerrillamail.com/', description: 'Classic disposable email — no registration needed.', tags: ['Instant', 'No Signup'], badge: 'Free' },
  { name: '10 Minute Mail', url: 'https://10minutemail.com/', description: 'Inbox expires in 10 minutes — perfect for quick verifications.', tags: ['Instant'], badge: 'Free' },
  { name: 'EmailOnDeck', url: 'https://www.emailondeck.com/', description: 'Fast temp email with extendable timer.', tags: ['Instant'], badge: 'Free' },
  { name: 'TempMailo', url: 'https://tempmailo.com/', description: 'Clean UI temp mail with multiple domains.', tags: ['Instant'], badge: 'Free' },
  { name: 'ThrowAway Mail', url: 'https://www.throwawaymail.com/', description: 'Simple throwaway addresses, no account.', tags: ['No Signup'], badge: 'Free' },
  { name: 'Mohmal', url: 'https://www.mohmal.com/en', description: 'Temporary inbox — multiple languages supported.', tags: ['Instant'], badge: 'Free' },
  { name: 'YOPmail', url: 'https://yopmail.com/', description: 'Disposable inbox you can check anytime with your chosen name.', tags: ['Reuse'], badge: 'Popular' },
  { name: 'Internxt Temp Mail', url: 'https://internxt.com/temporary-email', description: 'Privacy-focused temp email from Internxt.', tags: ['Privacy'], badge: 'Free' },
  { name: 'Dispostable', url: 'https://dispostable.com/', description: 'Quick disposable email — pick any username.', tags: ['Instant'], badge: 'Free' },
  { name: 'Maildrop', url: 'https://maildrop.cc/', description: 'Open inbox — use any name@maildrop.cc instantly.', tags: ['No Signup', 'Instant'], badge: 'Popular' },
  { name: 'Getnada', url: 'https://getnada.com/', description: 'Multiple temp domains, live inbox refresh.', tags: ['Instant'], badge: 'Free' },
  { name: 'Tempail', url: 'https://tempail.com/', description: 'Auto-generated temp email with 1-hour lifespan.', tags: ['Instant'], badge: 'Free' },
  { name: 'Fake Mail Generator', url: 'https://www.fakemailgenerator.com/', description: 'Generate fake emails across several domains.', tags: ['Generator'], badge: 'Free' },
  { name: 'Burner Mail', url: 'https://burnermail.io/', description: 'Browser extension + web — masked forwarding addresses.', tags: ['Extension'], badge: 'Popular' },
  { name: 'TempMail.lol', url: 'https://tempmail.lol/', description: 'Fast disposable inbox with clean modern UI.', tags: ['Instant'], badge: 'Popular' },
  { name: 'MinuteInbox', url: 'https://www.minuteinbox.com/', description: 'Auto-refreshing inbox — great for verification codes.', tags: ['Instant'], badge: 'Free' },
  { name: 'DropMail.me', url: 'https://dropmail.me/', description: 'Multiple domains, no registration, instant inbox.', tags: ['No Signup', 'Instant'], badge: 'Free' },
  { name: 'Inboxes.com', url: 'https://inboxes.com/', description: 'Pick a username or get random — reusable temp mail.', tags: ['Reuse'], badge: 'Popular' },
  { name: 'SmailPro', url: 'https://smailpro.com/', description: 'Temp Gmail-style addresses for signup flows.', tags: ['Gmail-style'], badge: 'Popular' },
  { name: 'EduMail', url: 'https://edumail.icu/', description: 'Temporary edu-style addresses for trials.', tags: ['Edu'], badge: 'Free' },
  { name: 'Mailinator', url: 'https://www.mailinator.com/', description: 'Public inboxes — use any name@mailinator.com.', tags: ['Public', 'Instant'], badge: 'Popular' },
  { name: 'Temp Mail ID', url: 'https://tempmail.id/', description: 'Simple one-page temp email with QR code.', tags: ['Instant'], badge: 'Free' },
  { name: 'EmailFake', url: 'https://emailfake.com/', description: 'Generate fake emails across many domains.', tags: ['Generator'], badge: 'Free' },
  { name: 'Crazy Mailing', url: 'https://www.crazymailing.com/', description: 'Disposable email with extendable timer.', tags: ['Instant'], badge: 'Free' },
  { name: 'LuxusMail', url: 'https://luxusmail.org/', description: 'Anonymous temp mail — multiple TLD options.', tags: ['Privacy'], badge: 'Free' },
  { name: 'MyTempEmail', url: 'https://mytemp.email/', description: 'Quick temp address with copy button.', tags: ['Instant'], badge: 'Free' },
  { name: 'AdGuard Temp Mail', url: 'https://adguard.com/en/adguard-temp-mail/overview.html', description: 'Privacy-focused temp mail from AdGuard.', tags: ['Privacy'], badge: 'Popular' },
];

export const SMS_RECEIVER_SITES: WebService[] = [
  { name: 'Receive SMS Online', url: 'https://receive-smss.com/', description: 'Free public numbers to read SMS online — multiple countries.', tags: ['Free', 'Public'], badge: 'Popular' },
  { name: 'SMS Receive Free', url: 'https://smsreceivefree.com/', description: 'US numbers listed with live SMS feed.', tags: ['US', 'Free'], badge: 'Free' },
  { name: 'FreePhoneNum', url: 'https://freephonenum.com/', description: 'Temporary phone numbers for OTP verification.', tags: ['OTP', 'Free'], badge: 'Free' },
  { name: 'Receive SMS', url: 'https://www.receivesms.co/', description: 'Collection of virtual numbers for incoming texts.', tags: ['International'], badge: 'Free' },
  { name: 'SMS24', url: 'https://sms24.me/en/', description: 'Receive SMS online — updated number list.', tags: ['Live Feed'], badge: 'Free' },
  { name: 'Quackr', url: 'https://quackr.io/', description: 'Temporary numbers for verification codes worldwide.', tags: ['Global'], badge: 'Popular' },
  { name: 'Temp Number', url: 'https://temp-number.com/', description: 'Free temp phone numbers — SMS shown in browser.', tags: ['Free'], badge: 'Free' },
  { name: 'Receive SMS Online.info', url: 'https://receive-sms-online.info/', description: 'Public inbox numbers for one-time verification.', tags: ['OTP'], badge: 'Free' },
  { name: '7sim.net', url: 'https://7sim.net/', description: 'Virtual numbers from multiple countries for SMS.', tags: ['Global'], badge: 'Popular' },
  { name: 'TextNow', url: 'https://www.textnow.com/', description: 'Free US number with app — works for some verifications.', tags: ['App', 'US'], badge: 'Popular' },
  { name: 'Google Voice', url: 'https://voice.google.com/', description: 'Free US number tied to Google account.', tags: ['US', 'Permanent'], badge: 'Popular' },
  { name: 'OnlineSim', url: 'https://onlinesim.io/', description: 'Virtual numbers from 30+ countries — free tier available.', tags: ['Global'], badge: 'Popular' },
  { name: 'Receive-SMS.cc', url: 'https://receive-sms.cc/', description: 'Free public SMS numbers updated frequently.', tags: ['Free', 'OTP'], badge: 'Free' },
  { name: 'SMSPVA', url: 'https://smspva.com/', description: 'Rent numbers for one-time verifications.', tags: ['Rent', 'OTP'], badge: 'SMS' },
  { name: 'AnonymSMS', url: 'https://anonymsms.com/', description: 'Receive SMS online without registration.', tags: ['No Signup'], badge: 'Free' },
  { name: 'Receive SMS Online.net', url: 'https://receive-sms-online.net/', description: 'Public numbers with live message feed.', tags: ['Free'], badge: 'Free' },
  { name: 'MyTempSMS', url: 'https://mytempsms.com/', description: 'Temporary numbers for verification codes.', tags: ['OTP'], badge: 'Free' },
  { name: 'Grizzly SMS', url: 'https://grizzlysms.com/', description: 'Virtual numbers for app and casino OTP.', tags: ['Verification'], badge: 'SMS' },
  { name: 'Numero eSIM', url: 'https://numeroesim.com/', description: 'Virtual phone numbers via eSIM app.', tags: ['App'], badge: 'Popular' },
];

export const PHONE_TOOL_SITES: WebService[] = [
  { name: 'GetOTP', url: 'https://getotp.dev/', description: 'OTP/SMS verification service aggregator.', tags: ['OTP'], badge: 'Popular' },
  { name: 'SMS Activate', url: 'https://sms-activate.io/', description: 'Paid virtual numbers — wide country coverage.', tags: ['Paid', 'Global'], badge: 'Popular' },
  { name: 'DaisySMS', url: 'https://daisysms.com/', description: 'Rent numbers for one-time verifications.', tags: ['Rent'], badge: 'SMS' },
  { name: 'PVAPins', url: 'https://pvapins.com/', description: 'Virtual numbers for app verification.', tags: ['Verification'], badge: 'SMS' },
  { name: '5SIM', url: 'https://5sim.net/', description: 'Cheap virtual numbers for SMS verification.', tags: ['Paid', 'Global'], badge: 'Popular' },
  { name: 'TextVerified', url: 'https://www.textverified.com/', description: 'US non-VoIP numbers for strict verifications.', tags: ['US', 'Non-VoIP'], badge: 'Popular' },
];

export const CASINO_SIGNUP_TOOLS: WebService[] = [
  { name: 'Have I Been Pwned', url: 'https://haveibeenpwned.com/', description: 'Check if your email was in a data breach before signup.', tags: ['Security'], badge: 'Free' },
  { name: 'Bitwarden Generator', url: 'https://bitwarden.com/password-generator/', description: 'Free secure password generator for casino accounts.', tags: ['Security'], badge: 'Free' },
  { name: 'Proton Pass', url: 'https://proton.me/pass', description: 'Password manager with built-in alias emails.', tags: ['Security'], badge: 'Popular' },
  { name: 'DuckDuckGo Email Protection', url: 'https://duckduckgo.com/email/', description: 'Free @duck.com alias that strips trackers.', tags: ['Privacy'], badge: 'Popular' },
  { name: 'SimpleLogin', url: 'https://simplelogin.io/', description: 'Create unlimited email aliases for signups.', tags: ['Privacy'], badge: 'Popular' },
  { name: 'Firefox Relay', url: 'https://relay.firefox.com/', description: 'Masked email aliases from Mozilla.', tags: ['Privacy'], badge: 'Free' },
  { name: 'NordVPN', url: 'https://nordvpn.com/', description: 'VPN for geo-restricted sweepstakes casinos.', tags: ['VPN'], badge: 'Popular' },
  { name: 'Mullvad VPN', url: 'https://mullvad.net/', description: 'Privacy-focused VPN — no account required.', tags: ['VPN'], badge: 'Popular' },
];

export const EXTRA_TOOLS: WebService[] = [
  { name: 'Proton Mail', url: 'https://proton.me/mail', description: 'Free encrypted email — good permanent signup address.', tags: ['Permanent', 'Privacy'], badge: 'Popular' },
  { name: 'Tutanota', url: 'https://tutanota.com/', description: 'Free secure email with no phone required.', tags: ['Permanent'], badge: 'Free' },
  { name: 'Password Generator', url: 'https://1password.com/password-generator/', description: 'Strong random passwords for casino accounts.', tags: ['Security'], badge: 'Free' },
  { name: 'Random.org Passwords', url: 'https://www.random.org/passwords/', description: 'Cryptographic random password batches.', tags: ['Security'], badge: 'Free' },
  { name: 'VPN Comparison', url: 'https://www.pcmag.com/picks/the-best-vpn-services', description: 'Research VPNs for geo-restricted casinos.', tags: ['VPN'], badge: 'Popular' },
  { name: 'Sweepstakes Reddit', url: 'https://www.reddit.com/r/sweepstakes/', description: 'Community tips on new sweepstakes casinos.', tags: ['Community'], badge: 'Popular' },
  { name: 'Sweepstakes Casino Wiki', url: 'https://www.reddit.com/r/sweepstakecasinos/', description: 'Active subreddit for sweeps casino reviews.', tags: ['Community'], badge: 'Popular' },
];

/** Format-only generators — NOT real inboxes or phone lines. Use temp-mail/SMS sites for real numbers. */
export const GENERATOR_DISCLAIMER =
  'Format only — NOT real email inboxes or phone lines. Use the temp-mail and SMS sites below for working addresses.';

export const BROWSER_TOOLS: WebService[] = [
  { name: 'Opera GX', url: 'https://www.opera.com/gx', description: 'Gaming browser with built-in ad blocker and RAM limiter — great for multi-account casino signups.', tags: ['Browser', 'Gaming'], badge: 'Popular' },
  { name: 'Microsoft Edge', url: 'https://www.microsoft.com/edge', description: 'Chromium browser with profiles, collections, and built-in VPN (where available).', tags: ['Browser', 'Profiles'], badge: 'Popular' },
  { name: 'Google Chrome', url: 'https://www.google.com/chrome/', description: 'Most compatible browser — use separate profiles per casino account.', tags: ['Browser', 'Profiles'], badge: 'Popular' },
  { name: 'Brave Browser', url: 'https://brave.com/', description: 'Privacy-focused Chromium browser with shields and optional rewards.', tags: ['Browser', 'Privacy'], badge: 'Popular' },
  { name: 'Mozilla Firefox', url: 'https://www.mozilla.org/firefox/', description: 'Independent browser with strong privacy controls and container tabs.', tags: ['Browser', 'Privacy'], badge: 'Free' },
];

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const EMAIL_PREFIXES = [
  'method', 'sweep', 'play', 'spin', 'luck', 'win', 'casino', 'free', 'gold', 'coin',
  'slot', 'bonus', 'vip', 'pro', 'elite', 'alpha', 'nova', 'apex', 'prime', 'core',
];

export const EMAIL_DOMAINS = [
  'gmail.com', 'outlook.com', 'yahoo.com', 'proton.me', 'icloud.com',
  'hotmail.com', 'live.com', 'mail.com', 'zoho.com', 'aol.com',
];

export function generateEmail(domain?: string): string {
  // Format only — NOT a real inbox. Pair with a temp-mail service for actual mail.
  const prefix = EMAIL_PREFIXES[randomInt(0, EMAIL_PREFIXES.length - 1)];
  const suffix = randomInt(100, 99999);
  const sep = Math.random() > 0.5 ? '.' : '';
  const extra = Math.random() > 0.6 ? EMAIL_PREFIXES[randomInt(0, EMAIL_PREFIXES.length - 1)] : '';
  const user = `${prefix}${sep}${extra}${suffix}`.replace('..', '.').toLowerCase();
  const chosenDomain = domain || EMAIL_DOMAINS[randomInt(0, EMAIL_DOMAINS.length - 1)];
  return `${user}@${chosenDomain}`;
}

export function generateEmails(count: number, domain?: string): string[] {
  const set = new Set<string>();
  while (set.size < count) set.add(generateEmail(domain));
  return [...set];
}

export function generateUSPhone(format: 'national' | 'e164' | 'digits' = 'national'): string {
  // Format only — NOT a real SMS line. Use SMS receiver sites for actual OTP.
  const area = randomInt(201, 989);
  let exchange = randomInt(200, 999);
  while (exchange === 555) exchange = randomInt(200, 999);
  const line = randomInt(1000, 9999);
  if (format === 'digits') return `1${area}${exchange}${line}`;
  if (format === 'e164') return `+1${area}${exchange}${line}`;
  return `(${area}) ${exchange}-${line}`;
}

export function generatePhones(count: number, format: 'national' | 'e164' | 'digits' = 'national'): string[] {
  const set = new Set<string>();
  while (set.size < count) set.add(generateUSPhone(format));
  return [...set];
}

export function generatePassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  return Array.from({ length }, () => chars[randomInt(0, chars.length - 1)]).join('');
}

export function generateUsername(): string {
  const adj = ['swift', 'lucky', 'golden', 'silent', 'rapid', 'shadow', 'neon', 'iron'];
  const noun = ['spin', 'jackpot', 'player', 'ace', 'wolf', 'fox', 'king', 'star'];
  return `${adj[randomInt(0, adj.length - 1)]}${noun[randomInt(0, noun.length - 1)]}${randomInt(10, 9999)}`;
}

export function generateSecurePassword(options: {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
} = {}): string {
  const length = options.length ?? 16;
  const useUpper = options.uppercase !== false;
  const useLower = options.lowercase !== false;
  const useNumbers = options.numbers !== false;
  const useSymbols = options.symbols !== false;

  let pool = '';
  if (useLower) pool += 'abcdefghijklmnopqrstuvwxyz';
  if (useUpper) pool += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (useNumbers) pool += '0123456789';
  if (useSymbols) pool += '!@#$%^&*-_=+';
  if (!pool) pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  return Array.from({ length }, () => pool[randomInt(0, pool.length - 1)]).join('');
}

export function passwordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'text-red-400' };
  if (score <= 3) return { score, label: 'Fair', color: 'text-amber-400' };
  if (score <= 4) return { score, label: 'Strong', color: 'text-emerald-400' };
  return { score, label: 'Very Strong', color: 'text-glow' };
}

export const SWEEPS_RESEARCH: WebService[] = [
  { name: 'Sweepstakes Casino Reddit', url: 'https://www.reddit.com/r/sweepstakecasinos/', description: 'Reviews, scam warnings, and new site alerts from the community.', tags: ['Community'], badge: 'Popular' },
  { name: 'Casino.org Sweeps Guide', url: 'https://www.casino.org/news/sweepstakes-casinos/', description: 'Industry overview of legal sweepstakes casinos in the US.', tags: ['Guide'], badge: 'Popular' },
  { name: 'Trustpilot', url: 'https://www.trustpilot.com/', description: 'Check casino reviews before signing up — watch for payout complaints.', tags: ['Reviews'], badge: 'Free' },
  { name: 'Scam Adviser', url: 'https://www.scamadviser.com/', description: 'Check if a casino domain looks trustworthy before visiting.', tags: ['Safety'], badge: 'Free' },
  { name: 'WHOIS Lookup', url: 'https://lookup.icann.org/', description: 'See when a domain was registered — brand-new domains are suspicious.', tags: ['Safety'], badge: 'Free' },
  { name: 'VirusTotal URL Scan', url: 'https://www.virustotal.com/', description: 'Scan suspicious casino URLs for malware before clicking.', tags: ['Safety'], badge: 'Free' },
];

export const SCAM_WARNING_SIGNS = [
  'Asks for upfront payment or "verification deposit" to redeem',
  'Promises guaranteed wins or unlimited free sweeps coins',
  'URL doesn\'t match the official casino domain (clone/phishing)',
  'Requires downloading an APK or exe from a random site',
  'No clear terms, no sweeps rules, or copied legal text',
  'Brand new domain with no reviews or community mentions',
  'Pushes crypto-only deposits on a "sweepstakes" site',
  'Support only reachable via Telegram/WhatsApp DMs',
];
