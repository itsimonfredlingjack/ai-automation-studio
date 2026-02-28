use std::path::Path;

use tauri::State;

use crate::error::AppError;
use crate::file_ops::sort_rule::{build_sort_preview, FileConflictPolicy, FileSortPreview};
use crate::state::AppState;

#[tauri::command]
pub fn preview_file_sort_rule(
    _state: State<'_, AppState>,
    sample_path: String,
    watch_path: String,
    destination_path: String,
    file_glob: String,
    conflict_policy: String,
) -> Result<FileSortPreview, AppError> {
    let conflict_policy = match conflict_policy.as_str() {
        "keep_both" => FileConflictPolicy::KeepBoth,
        other => return Err(AppError::Engine(format!("unsupported conflict_policy: {other}"))),
    };

    build_sort_preview(
        Path::new(&sample_path),
        Path::new(&watch_path),
        Path::new(&destination_path),
        file_glob.trim(),
        conflict_policy,
    )
    .map_err(AppError::Engine)
}
