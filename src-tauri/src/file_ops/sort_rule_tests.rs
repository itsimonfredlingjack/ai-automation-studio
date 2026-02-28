use crate::file_ops::sort_rule::{
    build_sort_preview, execute_sort_rule, plan_sort_destination, validate_destination_path,
    FileConflictPolicy,
};
use std::path::Path;
use uuid::Uuid;

fn test_root() -> std::path::PathBuf {
    std::env::temp_dir().join(format!("synapse-file-sort-{}", Uuid::new_v4()))
}

#[test]
fn plans_destination_without_conflict() {
    let root = test_root();
    let destination = root.join("sorted");
    let source = root.join("incoming").join("report.pdf");
    std::fs::create_dir_all(&destination).unwrap();

    let planned = plan_sort_destination(
        &source,
        &destination,
        FileConflictPolicy::KeepBoth,
    )
    .unwrap();

    assert_eq!(planned, destination.join("report.pdf"));
}

#[test]
fn adds_suffix_when_destination_exists() {
    let root = test_root();
    let destination = root.join("sorted");
    let source = root.join("incoming").join("report.pdf");
    std::fs::create_dir_all(&destination).unwrap();
    std::fs::write(destination.join("report.pdf"), "existing").unwrap();

    let planned = plan_sort_destination(
        &source,
        &destination,
        FileConflictPolicy::KeepBoth,
    )
    .unwrap();

    assert_eq!(planned, destination.join("report (1).pdf"));
}

#[test]
fn rejects_destination_inside_watch_path() {
    let root = test_root();
    let watch_path = root.join("incoming");
    let destination = watch_path.join("sorted");
    std::fs::create_dir_all(&destination).unwrap();

    let error = validate_destination_path(Path::new(&watch_path), Path::new(&destination))
        .unwrap_err();

    assert!(error.contains("inside the watched folder"));
}

#[test]
fn moves_file_and_returns_summary() {
    let root = test_root();
    let watch_path = root.join("incoming");
    let destination = root.join("sorted");
    let source = watch_path.join("report.pdf");
    std::fs::create_dir_all(&watch_path).unwrap();
    std::fs::create_dir_all(&destination).unwrap();
    std::fs::write(&source, "hello").unwrap();

    let result = execute_sort_rule(
        Path::new(&watch_path),
        Path::new(&source),
        Path::new(&destination),
        FileConflictPolicy::KeepBoth,
    )
    .unwrap();

    assert_eq!(result.final_path, destination.join("report.pdf"));
    assert!(result.summary.contains("Moved report.pdf"));
    assert!(!source.exists());
    assert!(destination.join("report.pdf").exists());
}

#[test]
fn preview_reports_non_matching_files_without_moving() {
    let root = test_root();
    let watch_path = root.join("incoming");
    let destination = root.join("sorted");
    let source = watch_path.join("notes.txt");
    std::fs::create_dir_all(&watch_path).unwrap();
    std::fs::create_dir_all(&destination).unwrap();
    std::fs::write(&source, "hello").unwrap();

    let preview = build_sort_preview(
        Path::new(&source),
        Path::new(&watch_path),
        Path::new(&destination),
        "*.pdf",
        FileConflictPolicy::KeepBoth,
    )
    .unwrap();

    assert!(!preview.matches);
    assert_eq!(preview.reason.as_deref(), Some("File does not match this rule."));
    assert!(source.exists());
}
