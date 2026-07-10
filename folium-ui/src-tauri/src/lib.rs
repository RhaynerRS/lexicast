use std::collections::HashMap;
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const SETTINGS_FILE: &str = "llm_settings.json";

/// LLM provider settings entered by the user in the frontend's Settings
/// screen. Mirrors the env vars folium-api/app/config.py reads
/// (LLM_PROVIDER/API_KEY/BASE_URL/MODEL) — persisted to disk here and
/// re-applied as env vars whenever the sidecar is (re)spawned.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct LlmSettings {
    provider: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    model: Option<String>,
}

struct ApiSidecar(Arc<Mutex<Option<CommandChild>>>);
struct ApiPort(Arc<Mutex<u16>>);

/// Picks a free localhost port by binding to :0 and releasing it right away.
/// There's a small window before the sidecar itself binds it where another
/// process could steal it — acceptable for a local desktop app.
fn pick_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind an ephemeral port");
    listener
        .local_addr()
        .expect("failed to read the ephemeral port's local address")
        .port()
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(SETTINGS_FILE))
}

fn load_settings(app: &AppHandle) -> Option<LlmSettings> {
    let path = settings_path(app).ok()?;
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn save_settings(app: &AppHandle, settings: &LlmSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

/// Builds the env map passed to the folium-api sidecar: the port it should
/// bind, a writable data dir inside this app's own data directory (not next
/// to the read-only installed binary), and whichever LLM settings are set.
fn sidecar_env(app: &AppHandle, port: u16, settings: Option<&LlmSettings>) -> HashMap<String, String> {
    let mut env = HashMap::new();
    env.insert("PORT".to_string(), port.to_string());

    if let Ok(data_dir) = app.path().app_data_dir() {
        env.insert(
            "STORAGE_DIR".to_string(),
            data_dir.join("data").to_string_lossy().into_owned(),
        );
    }

    if let Some(s) = settings {
        if !s.provider.is_empty() {
            env.insert("LLM_PROVIDER".to_string(), s.provider.clone());
        }
        if let Some(v) = s.api_key.as_deref().filter(|v| !v.is_empty()) {
            env.insert("API_KEY".to_string(), v.to_string());
        }
        if let Some(v) = s.base_url.as_deref().filter(|v| !v.is_empty()) {
            env.insert("BASE_URL".to_string(), v.to_string());
        }
        if let Some(v) = s.model.as_deref().filter(|v| !v.is_empty()) {
            env.insert("MODEL".to_string(), v.to_string());
        }
    }

    env
}

/// Spawns the folium-api sidecar on `port` and forwards its stdout/stderr
/// into this process' own log.
fn spawn_sidecar(app: &AppHandle, port: u16, settings: Option<&LlmSettings>) -> CommandChild {
    let (mut rx, child) = app
        .shell()
        .sidecar("folium-api")
        .expect("failed to create folium-api sidecar command")
        .envs(sidecar_env(app, port, settings))
        .spawn()
        .expect("failed to spawn folium-api sidecar");

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    print!("[folium-api] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprint!("[folium-api] {}", String::from_utf8_lossy(&line));
                }
                _ => {}
            }
        }
    });

    child
}

/// Finds the PID of whatever process is listening on `port` on localhost, by
/// scanning `/proc/net/tcp{,6}` for the matching LISTEN socket and then
/// `/proc/*/fd` for whichever process holds that socket's inode open.
#[cfg(target_os = "linux")]
fn find_pid_listening_on(port: u16) -> Option<i32> {
    const LISTEN_STATE: &str = "0A";
    let hex_port = format!("{:04X}", port);

    for tcp_file in ["/proc/net/tcp", "/proc/net/tcp6"] {
        let Ok(contents) = fs::read_to_string(tcp_file) else {
            continue;
        };
        for line in contents.lines().skip(1) {
            let fields: Vec<&str> = line.split_whitespace().collect();
            let (Some(local_addr), Some(state), Some(inode)) =
                (fields.get(1), fields.get(3), fields.get(9))
            else {
                continue;
            };
            if !state.eq_ignore_ascii_case(LISTEN_STATE) {
                continue;
            }
            let Some((_, port_hex)) = local_addr.split_once(':') else {
                continue;
            };
            if !port_hex.eq_ignore_ascii_case(&hex_port) {
                continue;
            }
            if let Some(pid) = find_pid_owning_socket_inode(inode) {
                return Some(pid);
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn find_pid_owning_socket_inode(inode: &str) -> Option<i32> {
    let target_link = format!("socket:[{inode}]");
    for entry in fs::read_dir("/proc").ok()?.flatten() {
        let pid: i32 = match entry.file_name().to_str().and_then(|s| s.parse().ok()) {
            Some(pid) => pid,
            None => continue,
        };
        let Ok(fds) = fs::read_dir(entry.path().join("fd")) else {
            continue;
        };
        for fd in fds.flatten() {
            if let Ok(link) = fs::read_link(fd.path()) {
                if link.to_string_lossy() == target_link {
                    return Some(pid);
                }
            }
        }
    }
    None
}

/// Stops the folium-api sidecar.
///
/// The PyInstaller `--onefile` bootloader extracts itself, forks/execs the
/// real Python process, and then **exits almost immediately** — by the time
/// this runs, `child.pid()` (the bootloader) is usually already gone, so
/// signaling it does nothing and the real process survives as an orphan,
/// still holding `port`. On Linux we instead find and signal whatever is
/// actually listening on `port`; SIGTERM first (so uvicorn shuts down
/// cleanly), then a SIGKILL if it's still around shortly after. Windows'
/// PyInstaller bootloader doesn't detach the same way, so the plugin's own
/// (forceful) kill is fine there.
fn stop_sidecar(child: CommandChild, port: u16) {
    #[cfg(target_os = "linux")]
    {
        unsafe {
            libc::kill(child.pid() as i32, libc::SIGTERM);
        }
        if let Some(pid) = find_pid_listening_on(port) {
            unsafe {
                libc::kill(pid, libc::SIGTERM);
            }
        }
        std::thread::sleep(Duration::from_millis(400));
        if let Some(pid) = find_pid_listening_on(port) {
            unsafe {
                libc::kill(pid, libc::SIGKILL);
            }
        }
    }
    #[cfg(all(unix, not(target_os = "linux")))]
    unsafe {
        libc::kill(child.pid() as i32, libc::SIGTERM);
    }
    #[cfg(not(unix))]
    {
        let _ = child.kill();
    }
}

#[tauri::command]
fn get_api_port(state: State<ApiPort>) -> u16 {
    *state.0.lock().unwrap()
}

#[tauri::command]
fn get_llm_settings(app: AppHandle) -> Option<LlmSettings> {
    load_settings(&app)
}

/// Persists the given LLM settings and restarts the sidecar with them applied
/// (folium-api reads these purely from its process env at startup, so
/// changing them at runtime means respawning it). Returns the new port the
/// restarted sidecar is listening on.
#[tauri::command]
async fn save_llm_settings(
    app: AppHandle,
    sidecar: State<'_, ApiSidecar>,
    port_state: State<'_, ApiPort>,
    settings: LlmSettings,
) -> Result<u16, String> {
    save_settings(&app, &settings)?;

    let old_port = *port_state.0.lock().unwrap();
    if let Some(old_child) = sidecar.0.lock().unwrap().take() {
        stop_sidecar(old_child, old_port);
    }

    let new_port = pick_free_port();
    let new_child = spawn_sidecar(&app, new_port, Some(&settings));
    *sidecar.0.lock().unwrap() = Some(new_child);
    *port_state.0.lock().unwrap() = new_port;

    Ok(new_port)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_api_port,
            get_llm_settings,
            save_llm_settings
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = load_settings(&handle);
            let port = pick_free_port();
            let child = spawn_sidecar(&handle, port, settings.as_ref());

            let child = Arc::new(Mutex::new(Some(child)));
            let port_arc = Arc::new(Mutex::new(port));
            app.manage(ApiSidecar(child.clone()));
            app.manage(ApiPort(port_arc.clone()));

            // RunEvent::ExitRequested below only fires when the app quits
            // through its own window/menu; a SIGTERM/SIGINT (killed from a
            // terminal, session logout, etc.) bypasses that entirely and
            // would otherwise leave the sidecar running and holding the port.
            let signal_child = child.clone();
            let signal_port = port_arc.clone();
            ctrlc::set_handler(move || {
                if let Some(child) = signal_child.lock().unwrap().take() {
                    stop_sidecar(child, *signal_port.lock().unwrap());
                }
                std::process::exit(0);
            })
            .expect("failed to register signal handler for sidecar cleanup");

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let (Some(sidecar), Some(port_state)) = (
                    app_handle.try_state::<ApiSidecar>(),
                    app_handle.try_state::<ApiPort>(),
                ) {
                    if let Some(child) = sidecar.0.lock().unwrap().take() {
                        stop_sidecar(child, *port_state.0.lock().unwrap());
                    }
                }
            }
        });
}
