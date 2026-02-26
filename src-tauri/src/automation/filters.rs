use std::path::Path;
use regex::Regex;

pub fn is_temporary_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };

    let lower = name.to_ascii_lowercase();
    lower.ends_with(".tmp")
        || lower.ends_with(".part")
        || lower.ends_with(".crdownload")
        || lower.starts_with('.')
}

pub fn matches_glob(path: &Path, pattern: &str) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };

    let trimmed = pattern.trim();
    if trimmed.is_empty() || trimmed == "*.*" || trimmed == "*" {
        return true;
    }

    let regex_pattern = format!(
        "^{}$",
        regex::escape(trimmed)
            .replace("\\*", ".*")
            .replace("\\?", ".")
    );

    Regex::new(&regex_pattern)
        .map(|regex| regex.is_match(name))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::{is_temporary_file, matches_glob};
    use std::path::Path;

    #[test]
    fn detects_temporary_download_artifacts() {
        assert!(is_temporary_file(Path::new(
            "/tmp/report.pdf.crdownload"
        )));
        assert!(is_temporary_file(Path::new("/tmp/input.part")));
        assert!(is_temporary_file(Path::new("/tmp/.cache.tmp")));
        assert!(!is_temporary_file(Path::new("/tmp/final-report.pdf")));
    }

    #[test]
    fn applies_watch_glob_pattern_to_filename() {
        assert!(matches_glob(Path::new("/tmp/invoice.pdf"), "*.pdf"));
        assert!(!matches_glob(Path::new("/tmp/invoice.txt"), "*.pdf"));
        assert!(matches_glob(Path::new("/tmp/invoice.txt"), "*.*"));
    }
}
