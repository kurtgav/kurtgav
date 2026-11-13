// Renders the neofetch-style profile card (assets/card-dark.svg, assets/card-light.svg)
// from live GitHub data. Run: GITHUB_TOKEN=... node scripts/card.mjs
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const LOGIN = "kurtgav";

// Philippine-flag sun, generated once as ASCII coverage art (45 x 23).
const SUN = [
  "                      +",
  "                     =@=",
  "                    .%@%.",
  "      .-.           +@@@+           .-.",
  "       -@%+-       .@@@@@.       -+%@-",
  "        :%@@@#=:   #@@@@@#   :=#@@@%:",
  "         :%@@@@@%+.+++++++.+%@@@@@%:",
  "          :%@@@@+.         .+@@@@%:",
  "           .%@+. .=#%@@@%#=. .+@%.",
  "          .:=.  -%@@@@@@@@@%-  .=:.",
  "    :-+*#@@@%  :@@@@@@@@@@@@@:  %@@@#*+-:",
  ":=#@@@@@@@@@%  +@@@@@@@@@@@@@+  %@@@@@@@@@#=:",
  "    :-+*#@@@%  :@@@@@@@@@@@@@:  %@@@#*+-:",
  "          .:=.  -%@@@@@@@@@%-  .=:.",
  "           .%@+. .=#%@@@%#=. .+@%.",
  "          :%@@@@+.         .+@@@@%:",
  "         :%@@@@@%+.+++++++.+%@@@@@%:",
  "        :%@@@#=:   #@@@@@#   :=#@@@%:",
  "       -@%+-       .@@@@@.       -+%@-",
  "      .-.           +@@@+           .-.",
  "                    .%@%.",
  "                     =@=",
  "                      +",
];

const ABOUT = [
  ["OS", "Philippines · UTC+8"],
  ["Role", ["Founding Engineer/CTO", "@Third Code Solutions Inc."]],
  ["Focus", ["Full-stack Software Engineer", "+ AI Engineer"]],
  ["Builds", "AI products for global businesses"],
  ["Markets", "APAC, USA, Europe, Middle East"],
  null,
  ["Languages", "TypeScript, Python, Swift, SQL"],
  ["Architecture", "Event-driven, multi-tenant, edge"],
  ["AI Systems", "Agents, RAG, evals, real-time voice"],
  ["Data", "Postgres, Kafka, vector search"],
  ["Platform", "Next.js, Node.js, React Native"],
  ["Infra", "AWS, Azure, GCP, CI/CD"],
  ["Practice", "Observability, SLOs, AppSec"],
  ["Leadership", "Tech strategy, design reviews, 0→1"],
];

const THEMES = {
  dark: { bg: "#161b22", border: "#30363d", fg: "#e6edf3", muted: "#7d8590", dots: "#484f58", key: "#f2cc60", sunTop: "#f2cc60", sunBottom: "#f0883e" },
  light: { bg: "#f6f8fa", border: "#d0d7de", fg: "#1f2328", muted: "#656d76", dots: "#afb8c1", key: "#9a6700", sunTop: "#bf8700", sunBottom: "#bc4c00" },
};

// Layout (px). Monospace advance is ~0.6em, so logo line height = 2x advance keeps the art square.
const W = 900, PAD_X = 40, PAD_Y = 44;
const LOGO_FONT = 12, LOGO_LH = 14.4;
const TEXT_X = 400, TEXT_FONT = 14, LH = 22;
const KEY_W = 17, RULE = 54;

// Current streak counts back from today, or from yesterday if today has no contributions yet.
export function streaks(days) {
  let longest = 0, run = 0;
  for (const n of days) { run = n > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = days.length - 1, current = 0;
  if (days[i] === 0) i--;
  while (i >= 0 && days[i] > 0) { current++; i--; }
  return { current, longest };
}
assert.deepEqual(streaks([1, 1, 0, 2, 3, 0]), { current: 2, longest: 2 });
assert.deepEqual(streaks([0, 4, 4, 4, 1]), { current: 4, longest: 4 });
assert.deepEqual(streaks([0, 0]), { current: 0, longest: 0 });

async function fetchStats() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const query = `query($login: String!) { user(login: $login) {
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) { totalCount }
    contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } } }
  } }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": LOGIN },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const { data, errors } = await res.json();
  if (errors?.length || !data?.user) throw new Error(`GitHub API error: ${JSON.stringify(errors)}`);
  const cal = data.user.contributionsCollection.contributionCalendar;
  const days = cal.weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount));
  return { repos: data.user.repositories.totalCount, contributions: cal.totalContributions, ...streaks(days) };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const n = (x) => x.toLocaleString("en-US");
const plural = (x, word) => `${n(x)} ${word}${x === 1 ? "" : "s"}`;
// One card line per value part; extra parts wrap under the value column.
const kv = ([k, v]) => [v].flat().map((part, i) => i === 0
  ? `<tspan class="k">${esc(k)}</tspan><tspan class="d"> ${".".repeat(KEY_W - k.length)} </tspan>${esc(part)}`
  : `${" ".repeat(KEY_W + 2)}${esc(part)}`);
const section = (title) => `<tspan class="m">— </tspan><tspan class="k">${title}</tspan><tspan class="m"> ${"─".repeat(RULE - title.length - 3)}</tspan>`;

function render(t, stats, updated) {
  const lines = [
    `<tspan class="a b">kurt</tspan><tspan class="m">@</tspan><tspan class="a b">gavin</tspan>`,
    `<tspan class="m">${"─".repeat(RULE)}</tspan>`,
    ...ABOUT.flatMap((row) => (row ? kv(row) : [""])),
    "",
    section("GitHub"),
    ...kv(["Contributions", `${n(stats.contributions)} in the past year`]),
    ...kv(["Current streak", plural(stats.current, "day")]),
    ...kv(["Longest streak", plural(stats.longest, "day")]),
    ...kv(["Public repos", n(stats.repos)]),
    "",
    `<tspan class="a">kurt@gavin</tspan><tspan class="m">:~$ </tspan><tspan class="cur">█</tspan>`,
  ];
  const H = PAD_Y * 2 + lines.length * LH;
  const logoTop = (H - SUN.length * LOGO_LH) / 2;
  const sun = SUN.map((row, i) => `<tspan x="${PAD_X}" y="${(logoTop + (i + 0.8) * LOGO_LH).toFixed(1)}">${row}</tspan>`).join("");
  const text = lines
    .map((l, i) => (l ? `<text x="${TEXT_X}" y="${PAD_Y + (i + 0.75) * LH}" class="ln" style="animation-delay:${i * 45}ms">${l}</text>` : ""))
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title" xml:space="preserve" font-family="ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace">
  <title id="title">Kurt Gavin: Founding Engineer and CTO at Third Code Solutions Inc., full-stack software engineer and AI engineer from the Philippines. ${n(stats.contributions)} contributions in the past year.</title>
  <style>
    text { white-space: pre; font-size: ${TEXT_FONT}px; fill: ${t.fg}; }
    .k { fill: ${t.key}; } .d { fill: ${t.dots}; } .m { fill: ${t.muted}; } .a { fill: ${t.key}; } .b { font-weight: 700; }
    .sun { font-size: ${LOGO_FONT}px; font-weight: 700; }
    .ln { animation: in .5s cubic-bezier(.2,.7,.2,1) both; }
    .cur { fill: ${t.key}; animation: blink 1.1s steps(1) infinite; }
    @keyframes in { from { opacity: 0; transform: translateX(-6px); } }
    @keyframes blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .ln, .cur { animation: none; } }
  </style>
  <defs><linearGradient id="sunFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.sunTop}"/><stop offset="1" stop-color="${t.sunBottom}"/></linearGradient></defs>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
  <text class="sun" fill="url(#sunFill)" style="fill:url(#sunFill)">${sun}</text>
  ${text}
  <text x="${W - PAD_X}" y="${PAD_Y + (lines.length - 0.25) * LH}" text-anchor="end" class="m" style="font-size:11px">updated ${updated}</text>
</svg>
`;
}

const stats = await fetchStats();
const updated = new Date().toISOString().slice(0, 10);
mkdirSync("assets", { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) writeFileSync(`assets/card-${name}.svg`, render(theme, stats, updated));
console.log(`card: ${JSON.stringify(stats)}`);
