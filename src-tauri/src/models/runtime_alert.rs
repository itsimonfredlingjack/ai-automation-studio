use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeAlertSource {
    WebhookBind,
    WebhookServer,
    WatchRunner,
    ScheduleRunner,
    WatchAutoPause,
    ScheduleAutoPause,
}

impl RuntimeAlertSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::WebhookBind => "webhook_bind",
            Self::WebhookServer => "webhook_server",
            Self::WatchRunner => "watch_runner",
            Self::ScheduleRunner => "schedule_runner",
            Self::WatchAutoPause => "watch_auto_pause",
            Self::ScheduleAutoPause => "schedule_auto_pause",
        }
    }

    pub fn from_str(value: &str) -> rusqlite::Result<Self> {
        match value {
            "webhook_bind" => Ok(Self::WebhookBind),
            "webhook_server" => Ok(Self::WebhookServer),
            "watch_runner" => Ok(Self::WatchRunner),
            "schedule_runner" => Ok(Self::ScheduleRunner),
            "watch_auto_pause" => Ok(Self::WatchAutoPause),
            "schedule_auto_pause" => Ok(Self::ScheduleAutoPause),
            _ => Err(rusqlite::Error::InvalidParameterName(format!(
                "invalid runtime_alert source: {value}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeAlertSeverity {
    Warning,
    Error,
}

impl RuntimeAlertSeverity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }

    pub fn from_str(value: &str) -> rusqlite::Result<Self> {
        match value {
            "warning" => Ok(Self::Warning),
            "error" => Ok(Self::Error),
            _ => Err(rusqlite::Error::InvalidParameterName(format!(
                "invalid runtime_alert severity: {value}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeAlert {
    pub id: String,
    pub source: RuntimeAlertSource,
    pub severity: RuntimeAlertSeverity,
    pub workflow_id: Option<String>,
    pub watch_id: Option<String>,
    pub schedule_id: Option<String>,
    pub message: String,
    pub details_json: serde_json::Value,
    pub created_at: DateTime<Utc>,
}
