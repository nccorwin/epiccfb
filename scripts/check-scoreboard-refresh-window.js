const chicagoFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const REFRESH_WINDOWS = [
  { weekday: "Wed", hour: "00", minute: "00" },
  { weekday: "Thu", hour: "21", minute: "00" },
  { weekday: "Fri", hour: "01", minute: "00" },
  { weekday: "Sat", hour: "14", minute: "30" },
  { weekday: "Sat", hour: "18", minute: "30" },
  { weekday: "Sat", hour: "23", minute: "00" },
  { weekday: "Sun", hour: "03", minute: "00" },
];

function isScheduledRefreshWindow(date) {
  const parts = chicagoFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return REFRESH_WINDOWS.some(
    (window) =>
      values.weekday === window.weekday &&
      values.hour === window.hour &&
      values.minute === window.minute,
  );
}

const shouldRefresh = isScheduledRefreshWindow(new Date());
const output = `should_refresh=${shouldRefresh ? "true" : "false"}\n`;

if (process.env.GITHUB_OUTPUT) {
  require("fs").appendFileSync(process.env.GITHUB_OUTPUT, output);
} else {
  process.stdout.write(output);
}

if (!shouldRefresh) {
  console.log("Outside configured America/Chicago refresh windows; skipping cache refresh.");
}
