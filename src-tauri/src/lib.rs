use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// 사이드바 트리에서 무시할 디렉터리 이름
const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", "build", "__pycache__"];
/// 너무 깊은 폴더를 열었을 때 멈추지 않도록 제한
const MAX_DEPTH: usize = 12;
const MAX_ENTRIES: usize = 20_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<TreeNode>,
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_ascii_lowercase().as_str(), "md" | "markdown" | "mdown" | "mkd"))
        .unwrap_or(false)
}

fn build_tree(dir: &Path, depth: usize, budget: &mut usize) -> Vec<TreeNode> {
    if depth > MAX_DEPTH || *budget == 0 {
        return Vec::new();
    }
    let Ok(read) = fs::read_dir(dir) else {
        return Vec::new();
    };

    let mut dirs = Vec::new();
    let mut files = Vec::new();
    for entry in read.flatten() {
        if *budget == 0 {
            break;
        }
        *budget -= 1;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() {
            if SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            let children = build_tree(&path, depth + 1, budget);
            // .md 파일이 하나도 없는 폴더는 표시하지 않는다.
            if !children.is_empty() {
                dirs.push(TreeNode { name, path: path.to_string_lossy().into_owned(), is_dir: true, children });
            }
        } else if is_markdown(&path) {
            files.push(TreeNode { name, path: path.to_string_lossy().into_owned(), is_dir: false, children: Vec::new() });
        }
    }

    let by_name = |a: &TreeNode, b: &TreeNode| a.name.to_lowercase().cmp(&b.name.to_lowercase());
    dirs.sort_by(by_name);
    files.sort_by(by_name);
    dirs.extend(files);
    dirs
}

/// 폴더 안의 .md 파일 트리를 반환한다.
#[tauri::command]
fn list_md_tree(root: String) -> Result<TreeNode, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("폴더가 아닙니다: {root}"));
    }
    let name = root_path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| root.clone());
    let mut budget = MAX_ENTRIES;
    let children = build_tree(&root_path, 0, &mut budget);
    Ok(TreeNode { name, path: root, is_dir: true, children })
}

/// 텍스트 파일을 읽는다. UTF-8 BOM 은 제거하고, UTF-8 이 아니면 손실 변환한다.
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("파일을 읽을 수 없습니다 ({path}): {e}"))?;
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(&bytes);
    Ok(match std::str::from_utf8(bytes) {
        Ok(s) => s.to_owned(),
        Err(_) => String::from_utf8_lossy(bytes).into_owned(),
    })
}

/// 파일을 저장한다. 임시 파일에 먼저 쓴 뒤 교체해서 저장 도중 실패해도 원본이 깨지지 않게 한다.
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    let file_name = target
        .file_name()
        .ok_or_else(|| format!("잘못된 경로입니다: {path}"))?
        .to_string_lossy()
        .into_owned();
    let tmp = target.with_file_name(format!(".{file_name}.geuldam-tmp"));
    let result = fs::write(&tmp, content.as_bytes()).and_then(|_| fs::rename(&tmp, &target));
    if let Err(e) = result {
        let _ = fs::remove_file(&tmp);
        // rename 이 막힌 환경(네트워크 드라이브 등)에서는 직접 쓰기로 재시도
        fs::write(&target, content.as_bytes()).map_err(|_| format!("파일을 저장할 수 없습니다 ({path}): {e}"))?;
    }
    Ok(())
}

/// 탐색기에서 .md 파일을 더블클릭해 실행했을 때 넘어온 파일 경로
#[tauri::command]
fn get_startup_file() -> Option<String> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|p| p.is_file())
        .and_then(|p| fs::canonicalize(&p).ok().or(Some(p)))
        .map(|p| strip_verbatim(p.to_string_lossy().into_owned()))
}

/// Windows 의 canonicalize 가 붙이는 `\\?\` 접두사를 제거한다.
fn strip_verbatim(p: String) -> String {
    match p.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with("UNC\\") => rest.to_owned(),
        _ => p,
    }
}

/// 내보내기용: 바이너리 파일을 base64 로 받아 저장한다. (docx, png 등)
#[tauri::command]
fn write_binary(path: String, data: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|e| format!("잘못된 데이터입니다: {e}"))?;
    fs::write(&path, bytes).map_err(|e| format!("파일을 저장할 수 없습니다 ({path}): {e}"))
}

/// 내보내기용: 파일(주로 이미지)을 base64 로 읽는다.
#[tauri::command]
fn read_binary(path: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = fs::read(&path).map_err(|e| format!("파일을 읽을 수 없습니다 ({path}): {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

/// 현재 화면을 인쇄용(@media print) 모양 그대로 PDF 로 저장한다. (WebView2 PrintToPdf)
#[tauri::command]
async fn export_pdf(window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::sync::mpsc;
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_7;
        use webview2_com::PrintToPdfCompletedHandler;
        use windows::core::{Interface, HSTRING};

        let (tx, rx) = mpsc::channel::<Result<(), String>>();
        let fail = tx.clone();
        window
            .with_webview(move |webview| {
                let started = (|| -> windows::core::Result<()> {
                    let core = unsafe { webview.controller().CoreWebView2()? };
                    let core7: ICoreWebView2_7 = core.cast()?;
                    let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, ok| {
                        let _ = tx.send(match result {
                            Ok(()) if ok => Ok(()),
                            Ok(()) => Err("PDF 를 저장하지 못했습니다.".to_string()),
                            Err(e) => Err(format!("PDF 를 저장하지 못했습니다: {e}")),
                        });
                        Ok(())
                    }));
                    unsafe { core7.PrintToPdf(&HSTRING::from(path.as_str()), None, &handler) }
                })();
                if let Err(e) = started {
                    let _ = fail.send(Err(format!("PDF 를 저장하지 못했습니다: {e}")));
                }
            })
            .map_err(|e| e.to_string())?;
        tauri::async_runtime::spawn_blocking(move || {
            rx.recv_timeout(std::time::Duration::from_secs(120))
                .unwrap_or_else(|_| Err("PDF 저장 시간이 초과되었습니다.".to_string()))
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = (window, path);
        Err("PDF 내보내기는 Windows 에서만 지원합니다.".to_string())
    }
}

/// 편집기(웹뷰)에 포커스가 있으면 Alt+F 같은 메뉴 단축키가 창 메뉴줄로 가지 않으므로
/// 창에 메뉴 키 메시지를 직접 보내 메뉴를 연다. key 가 비어 있으면 메뉴줄만 활성화한다.
#[tauri::command]
fn open_menu(window: tauri::WebviewWindow, key: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::{LPARAM, WPARAM};
        use windows::Win32::UI::WindowsAndMessaging::{PostMessageW, SC_KEYMENU, WM_SYSCOMMAND};
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        let ch = key.chars().next().map(|c| c.to_ascii_lowercase() as isize).unwrap_or(0);
        unsafe { PostMessageW(Some(hwnd), WM_SYSCOMMAND, WPARAM(SC_KEYMENU as usize), LPARAM(ch)) }
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    let _ = (window, key);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![list_md_tree, read_file, write_file, get_startup_file, open_menu, write_binary, read_binary, export_pdf])
        .run(tauri::generate_context!())
        .expect("글담 실행 중 오류가 발생했습니다");
}
