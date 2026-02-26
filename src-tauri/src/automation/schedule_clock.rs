use chrono::{DateTime, Datelike, Days, TimeZone, Utc, Weekday};
use std::collections::HashSet;

pub fn next_run_at(
    now_utc: DateTime<Utc>,
    cadence: &str,
    hourly_interval: i64,
    weekly_days: &[String],
    hour: i64,
    minute: i64,
) -> Result<DateTime<Utc>, String> {
    match cadence {
        "hourly" => next_hourly_run(now_utc, hourly_interval),
        "weekly" => next_weekly_run(now_utc, weekly_days, hour, minute),
        _ => Err(format!("Unsupported cadence: {}", cadence)),
    }
}

fn next_hourly_run(
    now_utc: DateTime<Utc>,
    hourly_interval: i64,
) -> Result<DateTime<Utc>, String> {
    if hourly_interval <= 0 {
        return Err("hourly_interval must be greater than zero".to_string());
    }
    Ok(now_utc + chrono::Duration::hours(hourly_interval))
}

fn next_weekly_run(
    now_utc: DateTime<Utc>,
    weekly_days: &[String],
    hour: i64,
    minute: i64,
) -> Result<DateTime<Utc>, String> {
    if !(0..=23).contains(&hour) {
        return Err("hour must be between 0 and 23".to_string());
    }
    if !(0..=59).contains(&minute) {
        return Err("minute must be between 0 and 59".to_string());
    }
    let day_set = parse_days(weekly_days)?;
    if day_set.is_empty() {
        return Err("weekly_days cannot be empty".to_string());
    }

    let start_date = now_utc.date_naive();
    for offset in 0..14 {
        let Some(date) = start_date.checked_add_days(Days::new(offset)) else {
            continue;
        };
        if !day_set.contains(&date.weekday()) {
            continue;
        }

        let Some(naive) = date.and_hms_opt(hour as u32, minute as u32, 0) else {
            continue;
        };
        let candidate = Utc.from_utc_datetime(&naive);
        if candidate > now_utc {
            return Ok(candidate);
        }
    }

    Err("could not compute weekly next run".to_string())
}

fn parse_days(days: &[String]) -> Result<HashSet<Weekday>, String> {
    days.iter()
        .map(|day| match day.trim().to_ascii_lowercase().as_str() {
            "mon" | "monday" => Ok(Weekday::Mon),
            "tue" | "tues" | "tuesday" => Ok(Weekday::Tue),
            "wed" | "wednesday" => Ok(Weekday::Wed),
            "thu" | "thurs" | "thursday" => Ok(Weekday::Thu),
            "fri" | "friday" => Ok(Weekday::Fri),
            "sat" | "saturday" => Ok(Weekday::Sat),
            "sun" | "sunday" => Ok(Weekday::Sun),
            value => Err(format!("Invalid weekly day: {}", value)),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::next_run_at;
    use chrono::{TimeZone, Utc};

    #[test]
    fn computes_next_hourly_run() {
        let now = Utc.with_ymd_and_hms(2026, 2, 26, 10, 0, 0).unwrap();
        let next = next_run_at(now, "hourly", 2, &[], 0, 0).unwrap();
        assert_eq!(next, Utc.with_ymd_and_hms(2026, 2, 26, 12, 0, 0).unwrap());
    }

    #[test]
    fn computes_next_weekly_run() {
        let now = Utc.with_ymd_and_hms(2026, 2, 26, 22, 30, 0).unwrap();
        let next = next_run_at(
            now,
            "weekly",
            0,
            &vec!["fri".to_string(), "sun".to_string()],
            9,
            15,
        )
        .unwrap();
        assert_eq!(next, Utc.with_ymd_and_hms(2026, 2, 27, 9, 15, 0).unwrap());
    }
}
