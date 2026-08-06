const chicagoFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function isWeekendRefreshWindow(date) {
  const parts = chicagoFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return (values.weekday === "Sat" || values.weekday === "Sun") && values.hour === "03" && values.minute === "00";
}

const shouldRefresh = isWeekendRefreshWindow(new Date());
const output = `should_refresh=${shouldRefresh ? "true" : "false"}\n`;

if (process.env.GITHUB_OUTPUT) {
  require("fs").appendFileSync(process.env.GITHUB_OUTPUT, output);
} else {
  process.stdout.write(output);
}

if (!shouldRefresh) {
  console.log("Outside the 3am America/Chicago refresh window; skipping cache refresh.");
}
