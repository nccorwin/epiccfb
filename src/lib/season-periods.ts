export type SeasonPeriodValue = number | "postseason";

export type SeasonPeriodOption = {
  value: SeasonPeriodValue;
  label: string;
  range: string;
  description: string;
};

export const SEASON_PERIODS: SeasonPeriodOption[] = [
  { value: 0, label: "Week 0", range: "8/19–8/25", description: "Opening weekend" },
  { value: 1, label: "Week 1", range: "8/26–9/1", description: "Opening week" },
  { value: 2, label: "Week 2", range: "9/2–9/8", description: "Early September" },
  { value: 3, label: "Week 3", range: "9/9–9/15", description: "Mid-September" },
  { value: 4, label: "Week 4", range: "9/16–9/22", description: "Late September" },
  { value: 5, label: "Week 5", range: "9/23–9/29", description: "September/October" },
  { value: 6, label: "Week 6", range: "9/30–10/6", description: "October" },
  { value: 7, label: "Week 7", range: "10/7–10/13", description: "October" },
  { value: 8, label: "Week 8", range: "10/14–10/20", description: "October" },
  { value: 9, label: "Week 9", range: "10/21–10/27", description: "Late October" },
  { value: 10, label: "Week 10", range: "10/28–11/3", description: "Early November" },
  { value: 11, label: "Week 11", range: "11/4–11/10", description: "Mid-November" },
  { value: 12, label: "Week 12", range: "11/11–11/17", description: "Late November" },
  { value: 13, label: "Week 13", range: "11/18–11/24", description: "Late November" },
  { value: 14, label: "Week 14", range: "11/25–12/1", description: "FCS 1st Round" },
  { value: 15, label: "Week 15", range: "12/2–12/8", description: "FCS 2nd Round / Conference Championships" },
];

export const POSTSEASON_PERIOD: SeasonPeriodOption = {
  value: "postseason",
  label: "Postseason",
  range: "12/8+",
  description: "Bowls, FCS Playoffs, and CFP",
};

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
