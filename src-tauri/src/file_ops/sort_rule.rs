use std::ffi::OsString;
use std::path::{Path, PathBuf};

use crate::automation::filters::matches_glob;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileConflictPolicy {
    KeepBoth,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct FileSortPreview {
    pub matches: bool,
    pub source_path: String,
    pub destination_dir: String,
    pub proposed_path: String,
    pub final_path: String,
    pub action: &'static str,
    pub conflict_resolution: &'static str,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SortExecutionResult {
    pub source_path: PathBuf,
    pub destination_dir: PathBuf,
    pub final_path: PathBuf,
    pub conflict_resolution: &'static str,
    pub summary: String,
}

pub fn validate_destination_path(
    watch_path: &Path,
    destination_path: &Path,
) -> Result<(), String> {
    let watch_path = std::fs::canonicalize(watch_path).map_err(|err| err.to_string())?;
    let destination_path =
        std::fs::canonicalize(destination_path).map_err(|err| err.to_string())?;

    if watch_path == destination_path || destination_path.starts_with(&watch_path) {
        return Err("destination cannot be inside the watched folder".to_string());
    }

    Ok(())
}

pub fn plan_sort_destination(
    source_path: &Path,
    destination_dir: &Path,
    conflict_policy: FileConflictPolicy,
) -> Result<PathBuf, String> {
    let file_name = source_path
        .file_name()
        .ok_or_else(|| "source file has no file name".to_string())?;
    let proposed_path = destination_dir.join(file_name);

    if !proposed_path.exists() {
        return Ok(proposed_path);
    }

    match conflict_policy {
        FileConflictPolicy::KeepBoth => Ok(next_available_path(destination_dir, file_name)),
    }
}

pub fn execute_sort_rule(
    watch_path: &Path,
    source_path: &Path,
    destination_dir: &Path,
    conflict_policy: FileConflictPolicy,
) -> Result<SortExecutionResult, String> {
    validate_destination_path(watch_path, destination_dir)?;
    std::fs::create_dir_all(destination_dir).map_err(|err| err.to_string())?;

    let final_path = plan_sort_destination(source_path, destination_dir, conflict_policy)?;
    let conflict_resolution = if final_path.file_name() == source_path.file_name() {
        "none"
    } else {
        "keep_both"
    };

    if let Err(rename_error) = std::fs::rename(source_path, &final_path) {
        if try_copy_and_delete(source_path, &final_path).is_err() {
            return Err(rename_error.to_string());
        }
    }

    let source_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "source file has no file name".to_string())?;

    Ok(SortExecutionResult {
        source_path: source_path.to_path_buf(),
        destination_dir: destination_dir.to_path_buf(),
        final_path: final_path.clone(),
        conflict_resolution,
        summary: format!("Moved {source_name} to {}", final_path.display()),
    })
}

pub fn build_sort_preview(
    sample_path: &Path,
    watch_path: &Path,
    destination_dir: &Path,
    file_glob: &str,
    conflict_policy: FileConflictPolicy,
) -> Result<FileSortPreview, String> {
    if !sample_path.exists() || sample_path.is_dir() {
        return Err("sample file does not exist".to_string());
    }
    validate_destination_path(watch_path, destination_dir)?;
    std::fs::create_dir_all(destination_dir).map_err(|err| err.to_string())?;

    let proposed_path = destination_dir.join(
        sample_path
            .file_name()
            .ok_or_else(|| "sample file has no file name".to_string())?,
    );
    let matches = matches_glob(sample_path, file_glob);
    let final_path = if matches {
        plan_sort_destination(sample_path, destination_dir, conflict_policy)?
    } else {
        proposed_path.clone()
    };

    let conflict_resolution = if matches && final_path != proposed_path {
        "keep_both"
    } else {
        "none"
    };

    Ok(FileSortPreview {
        matches,
        source_path: sample_path.display().to_string(),
        destination_dir: destination_dir.display().to_string(),
        proposed_path: proposed_path.display().to_string(),
        final_path: final_path.display().to_string(),
        action: "move",
        conflict_resolution,
        reason: if matches {
            None
        } else {
            Some("File does not match this rule.".to_string())
        },
    })
}

fn next_available_path(destination_dir: &Path, file_name: &std::ffi::OsStr) -> PathBuf {
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .map(OsString::from)
        .unwrap_or_else(|| file_name.to_os_string());
    let extension = path.extension().map(OsString::from);

    let mut index = 1usize;
    loop {
        let mut next_name = stem.clone();
        next_name.push(format!(" ({index})"));
        if let Some(ext) = &extension {
            next_name.push(".");
            next_name.push(ext);
        }

        let candidate = destination_dir.join(&next_name);
        if !candidate.exists() {
            return candidate;
        }

        index += 1;
    }
}

fn try_copy_and_delete(source_path: &Path, final_path: &Path) -> Result<(), String> {
    std::fs::copy(source_path, final_path).map_err(|err| err.to_string())?;
    std::fs::remove_file(source_path).map_err(|err| err.to_string())?;
    Ok(())
}
