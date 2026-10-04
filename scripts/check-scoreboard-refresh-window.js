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

const WINDOW_TOLERANCE_MINUTES = 10;

function parseTimeParts(date) {
  const parts = chicagoFormatter.formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function toMinutes(hour, minute) {
  return Number(hour) * 60 + Number(minute);
}

function isScheduledRefreshWindow(date) {
  const values = parseTimeParts(date);
  const nowMinutes = toMinutes(values.hour, values.minute);

  const matchedWindow = REFRESH_WINDOWS.find((window) => {
    if (values.weekday !== window.weekday) {
      return false;
    }

    const windowMinutes = toMinutes(window.hour, window.minute);
    const delta = nowMinutes - windowMinutes;
    return delta >= 0 && delta <= WINDOW_TOLERANCE_MINUTES;
  });

  return {
    shouldRefresh: Boolean(matchedWindow),
    matchedWindow,
    current: values,
  };
}

const evaluation = isScheduledRefreshWindow(new Date());
const output = [
  `should_refresh=${evaluation.shouldRefresh ? "true" : "false"}`,
  `current_ct=${evaluation.current.weekday} ${evaluation.current.hour}:${evaluation.current.minute}`,
  `window_tolerance_minutes=${WINDOW_TOLERANCE_MINUTES}`,
].join("\n") + "\n";

if (process.env.GITHUB_OUTPUT) {
  require("fs").appendFileSync(process.env.GITHUB_OUTPUT, output);
} else {
  process.stdout.write(output);
}

if (!evaluation.shouldRefresh) {
  console.log("Outside configured America/Chicago refresh windows (with tolerance); skipping cache refresh.");
} else if (evaluation.matchedWindow) {
  console.log(
    `Matched refresh window ${evaluation.matchedWindow.weekday} ${evaluation.matchedWindow.hour}:${evaluation.matchedWindow.minute} CT.`,
  );
}
