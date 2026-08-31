export type SeasonPeriodValue = number | "postseason";

export type SeasonPeriodOption = {
  value: SeasonPeriodValue;
  label: string;
  range: string;
  description: string;
};

type SeasonWeekDateRange = {
  week: number;
  startMonthDay: string;
  endMonthDay: string;
};

const SEASON_WEEK_DATE_RANGES: SeasonWeekDateRange[] = [
  { week: 0, startMonthDay: "08-25", endMonthDay: "08-31" },
  { week: 1, startMonthDay: "09-01", endMonthDay: "09-07" },
  { week: 2, startMonthDay: "09-08", endMonthDay: "09-14" },
  { week: 3, startMonthDay: "09-15", endMonthDay: "09-21" },
  { week: 4, startMonthDay: "09-22", endMonthDay: "09-28" },
  { week: 5, startMonthDay: "09-29", endMonthDay: "10-05" },
  { week: 6, startMonthDay: "10-06", endMonthDay: "10-12" },
  { week: 7, startMonthDay: "10-13", endMonthDay: "10-19" },
  { week: 8, startMonthDay: "10-20", endMonthDay: "10-26" },
  { week: 9, startMonthDay: "10-27", endMonthDay: "11-02" },
  { week: 10, startMonthDay: "11-03", endMonthDay: "11-09" },
  { week: 11, startMonthDay: "11-10", endMonthDay: "11-16" },
  { week: 12, startMonthDay: "11-17", endMonthDay: "11-23" },
  { week: 13, startMonthDay: "11-24", endMonthDay: "11-30" },
  { week: 14, startMonthDay: "12-01", endMonthDay: "12-07" },
  { week: 15, startMonthDay: "12-08", endMonthDay: "12-14" },
];

export const SEASON_PERIODS: SeasonPeriodOption[] = [
  { value: 0, label: "Week 0", range: "8/25–8/31", description: "Opening weekend" },
  { value: 1, label: "Week 1", range: "9/1–9/7", description: "Opening week" },
  { value: 2, label: "Week 2", range: "9/8–9/14", description: "Early September" },
  { value: 3, label: "Week 3", range: "9/15–9/21", description: "Mid-September" },
  { value: 4, label: "Week 4", range: "9/22–9/28", description: "Late September" },
  { value: 5, label: "Week 5", range: "9/29–10/5", description: "September/October" },
  { value: 6, label: "Week 6", range: "10/6–10/12", description: "October" },
  { value: 7, label: "Week 7", range: "10/13–10/19", description: "October" },
  { value: 8, label: "Week 8", range: "10/20–10/26", description: "October" },
  { value: 9, label: "Week 9", range: "10/27–11/2", description: "Late October" },
  { value: 10, label: "Week 10", range: "11/3–11/9", description: "Early November" },
  { value: 11, label: "Week 11", range: "11/10–11/16", description: "Mid-November" },
  { value: 12, label: "Week 12", range: "11/17–11/23", description: "Late November" },
  { value: 13, label: "Week 13", range: "11/24–11/30", description: "Late November" },
  { value: 14, label: "Week 14", range: "12/1–12/7", description: "FCS 1st Round" },
  { value: 15, label: "Week 15", range: "12/8–12/14", description: "FCS 2nd Round / Conference Championships" },
];

export const POSTSEASON_PERIOD: SeasonPeriodOption = {
  value: "postseason",
  label: "Postseason",
  range: "12/15+",
  description: "Bowls, FCS Playoffs, and CFP",
};

function getTimeZoneDateKey(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getSeasonWeekDateRanges(season: number) {
  return SEASON_WEEK_DATE_RANGES.map((range) => ({
    week: range.week,
    start: `${season}-${range.startMonthDay}`,
    end: `${season}-${range.endMonthDay}`,
  }));
}

export function getCurrentSeasonPeriod(season: number, now = new Date()): SeasonPeriodValue {
  const currentDateKey = getTimeZoneDateKey(now, "America/Chicago");
  const ranges = getSeasonWeekDateRanges(season);
  const matchingRange = ranges.find((range) => currentDateKey >= range.start && currentDateKey <= range.end);
  if (matchingRange) {
    return matchingRange.week;
  }
  if (currentDateKey < ranges[0].start) {
    return ranges[0].week;
  }
  return "postseason";
}

export function getSeasonPeriodLabel(value: SeasonPeriodValue | string | null | undefined) {
  if (value === "postseason") {
    return POSTSEASON_PERIOD.label;
  }

  const option = SEASON_PERIODS.find((entry) => entry.value === Number(value));
  if (!option) {
    return "Season period";
  }

  return `${option.label} (${option.range})`;
}
