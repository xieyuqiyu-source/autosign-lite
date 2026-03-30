use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fmt::Write as _;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const LOGIN_URL: &str = "https://jiegehao.cn/api/policy/password";
const CAPTCHA_URL: &str = "https://jiegehao.cn/api/captcha";
const PHONE_CODE_URL: &str = "https://jiegehao.cn/api/policy/code";
const PHONE_LOGIN_URL: &str = "https://jiegehao.cn/api/policy/identity";
const PIT_URL: &str = "https://jiegehao.cn/api/lease/pit";
const RENT_URL: &str = "https://jiegehao.cn/api/lease/rent";
const GPT_CODE_URL: &str = "https://jiegehao.cn/api/lease/gpt/code";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AccountRecord {
    account: String,
    password: String,
    #[serde(default = "default_login_type")]
    login_type: String,
    #[serde(default)]
    last_login: String,
    #[serde(default)]
    token: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct AccountStore {
    #[serde(default)]
    accounts: Vec<AccountRecord>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginResult {
    account: String,
    login_type: String,
    token: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CaptchaResult {
    captcha_id: String,
    pic_path: String,
    captcha_length: i64,
    open_captcha: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct PitRecord {
    pit: String,
    seat_id: i64,
    logo: String,
    name: String,
    duration: i64,
    bus_no: i64,
    seat_no: i64,
    account: String,
    password: String,
    start_at: String,
    expire: String,
    status: i64,
}

fn default_login_type() -> String {
    String::from("password")
}

fn now_text() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => format!("{}", duration.as_secs()),
        Err(_) => String::from("0"),
    }
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法读取应用目录: {e}"))?;
    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| format!("无法创建数据目录: {e}"))?;
    }
    Ok(base.join("accounts.json"))
}

fn load_store(app: &AppHandle) -> Result<AccountStore, String> {
    let path = store_path(app)?;
    if !path.exists() {
        return Ok(AccountStore::default());
    }

    let raw = fs::read_to_string(&path).map_err(|e| format!("读取账号文件失败: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("账号文件格式错误: {e}"))
}

fn save_store(app: &AppHandle, store: &AccountStore) -> Result<(), String> {
    let path = store_path(app)?;
    let raw = serde_json::to_string_pretty(store).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(path, raw).map_err(|e| format!("写入账号文件失败: {e}"))
}

fn sort_accounts(accounts: &mut [AccountRecord]) {
    accounts.sort_by(|a, b| b.last_login.cmp(&a.last_login));
}

fn upsert_account(
    store: &mut AccountStore,
    account: String,
    password: String,
    login_type: String,
    token: String,
    update_last_login: bool,
) {
    match store.accounts.iter_mut().find(|item| item.account == account) {
        Some(item) => {
            item.password = password;
            item.login_type = login_type;
            if !token.is_empty() {
                item.token = token;
            }
            if update_last_login {
                item.last_login = now_text();
            }
        }
        None => store.accounts.push(AccountRecord {
            account,
            password,
            login_type,
            token,
            last_login: if update_last_login {
                now_text()
            } else {
                String::new()
            },
        }),
    }
}

fn csv_escape(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

#[tauri::command]
fn load_accounts(app: AppHandle) -> Result<Vec<AccountRecord>, String> {
    let mut store = load_store(&app)?;
    sort_accounts(&mut store.accounts);
    Ok(store.accounts)
}

#[tauri::command]
fn save_account(
    app: AppHandle,
    account: String,
    password: String,
    login_type: Option<String>,
) -> Result<(), String> {
    let mut store = load_store(&app)?;
    upsert_account(
        &mut store,
        account,
        password,
        login_type.unwrap_or_else(default_login_type),
        String::new(),
        false,
    );

    sort_accounts(&mut store.accounts);
    save_store(&app, &store)
}

#[tauri::command]
async fn login(app: AppHandle, account: String, password: String) -> Result<LoginResult, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(LOGIN_URL)
        .header(CONTENT_TYPE, "application/json")
        .json(&json!({ "account": account, "password": password }))
        .send()
        .await
        .map_err(|e| format!("登录请求失败: {e}"))?;

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("登录响应解析失败: {e}"))?;

    if body.get("code").and_then(Value::as_i64).unwrap_or(-1) != 0 {
        return Err(
            body.get("msg")
                .and_then(Value::as_str)
                .unwrap_or("登录失败")
                .to_string(),
        );
    }

    let data = body
        .get("data")
        .ok_or_else(|| String::from("登录返回缺少 data"))?;
    let token = data
        .get("token")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let email = data
        .get("email")
        .and_then(Value::as_str)
        .unwrap_or(&account)
        .to_string();

    let mut store = load_store(&app)?;
    upsert_account(
        &mut store,
        account.clone(),
        password.clone(),
        String::from("password"),
        token.clone(),
        true,
    );
    sort_accounts(&mut store.accounts);
    save_store(&app, &store)?;

    Ok(LoginResult {
        account: email,
        login_type: String::from("password"),
        token,
    })
}

#[tauri::command]
async fn fetch_phone_captcha() -> Result<CaptchaResult, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(CAPTCHA_URL)
        .send()
        .await
        .map_err(|e| format!("图形验证码请求失败: {e}"))?;

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("图形验证码响应解析失败: {e}"))?;

    if body.get("code").and_then(Value::as_i64).unwrap_or(-1) != 0 {
        return Err(
            body.get("msg")
                .and_then(Value::as_str)
                .unwrap_or("图形验证码获取失败")
                .to_string(),
        );
    }

    let data = body
        .get("data")
        .cloned()
        .ok_or_else(|| String::from("图形验证码返回缺少 data"))?;

    let captcha_id = data
        .get("captchaId")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let pic_path = data
        .get("picPath")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let captcha_length = data
        .get("captchaLength")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    let open_captcha = data
        .get("openCaptcha")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    Ok(CaptchaResult {
        captcha_id,
        pic_path,
        captcha_length,
        open_captcha,
    })
}

#[tauri::command]
async fn request_phone_code(phone: String, captcha: String, captcha_id: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .post(PHONE_CODE_URL)
        .header(CONTENT_TYPE, "application/json")
        .json(&json!({
            "phone": phone,
            "bi": 1,
            "captcha": captcha,
            "captchaId": captcha_id
        }))
        .send()
        .await
        .map_err(|e| format!("短信验证码请求失败: {e}"))?;

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("短信验证码响应解析失败: {e}"))?;

    if body.get("code").and_then(Value::as_i64).unwrap_or(-1) != 0 {
        return Err(
            body.get("msg")
                .and_then(Value::as_str)
                .unwrap_or("短信验证码获取失败")
                .to_string(),
        );
    }

    Ok(())
}

#[tauri::command]
async fn login_by_phone(app: AppHandle, phone: String, code: String) -> Result<LoginResult, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(PHONE_LOGIN_URL)
        .header(CONTENT_TYPE, "application/json")
        .json(&json!({ "phone": phone, "code": code }))
        .send()
        .await
        .map_err(|e| format!("手机号登录请求失败: {e}"))?;

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("手机号登录响应解析失败: {e}"))?;

    if body.get("code").and_then(Value::as_i64).unwrap_or(-1) != 0 {
        return Err(
            body.get("msg")
                .and_then(Value::as_str)
                .unwrap_or("手机号登录失败")
                .to_string(),
        );
    }

    let data = body
        .get("data")
        .ok_or_else(|| String::from("手机号登录返回缺少 data"))?;
    let token = data
        .get("token")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let account = data
        .get("phone")
        .and_then(Value::as_str)
        .unwrap_or(&phone)
        .to_string();

    let mut store = load_store(&app)?;
    upsert_account(
        &mut store,
        account.clone(),
        String::new(),
        String::from("phone"),
        token.clone(),
        true,
    );
    sort_accounts(&mut store.accounts);
    save_store(&app, &store)?;

    Ok(LoginResult {
        account,
        login_type: String::from("phone"),
        token,
    })
}

#[tauri::command]
async fn fetch_pits(token: String) -> Result<Vec<PitRecord>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(PIT_URL)
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("pit 请求失败: {e}"))?;

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("pit 响应解析失败: {e}"))?;

    if body.get("code").and_then(Value::as_i64).unwrap_or(-1) != 0 {
        return Err(
            body.get("msg")
                .and_then(Value::as_str)
                .unwrap_or("pit 获取失败")
                .to_string(),
        );
    }

    serde_json::from_value(body.get("data").cloned().unwrap_or_else(|| json!([])))
        .map_err(|e| format!("pit 数据解析失败: {e}"))
}

#[tauri::command]
async fn rent_chatgpt(token: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .post(RENT_URL)
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .header(CONTENT_TYPE, "application/json")
        .json(&json!({
            "platform_id": 3,
            "duration": 3,
            "cost_points": 180
        }))
        .send()
        .await
        .map_err(|e| format!("租借请求失败: {e}"))?;

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("租借响应解析失败: {e}"))?;

    if body.get("code").and_then(Value::as_i64).unwrap_or(-1) != 0 {
        let msg = body
            .get("msg")
            .and_then(Value::as_str)
            .unwrap_or_default();

        if msg.contains("已租借") || msg.contains("无空") {
            return Err(String::from("已租借或无空栏位"));
        }

        return Err(if msg.is_empty() {
            String::from("已租借或无空栏位")
        } else {
            msg.to_string()
        });
    }

    Ok(())
}

#[tauri::command]
async fn fetch_verification_code(
    token: String,
    user_name: String,
    bus_seat_id: i64,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let seat_id = bus_seat_id.to_string();
    let encoded_user_name = urlencoding::encode(&user_name).into_owned();
    let url = format!("{GPT_CODE_URL}?user_name={encoded_user_name}&bus_seat_id={seat_id}");
    let response = client
        .get(url)
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("验证码请求失败: {e}"))?;

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("验证码响应解析失败: {e}"))?;

    if body.get("code").and_then(Value::as_i64).unwrap_or(-1) != 0 {
        return Err(
            body.get("msg")
                .and_then(Value::as_str)
                .unwrap_or("验证码获取失败")
                .to_string(),
        );
    }

    Ok(body
        .get("data")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string())
}

#[tauri::command]
fn export_accounts(app: AppHandle) -> Result<String, String> {
    let mut store = load_store(&app)?;
    sort_accounts(&mut store.accounts);

    let base_dir = app
        .path()
        .desktop_dir()
        .or_else(|_| app.path().download_dir())
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| format!("无法定位导出目录: {e}"))?;

    if !base_dir.exists() {
        fs::create_dir_all(&base_dir).map_err(|e| format!("无法创建导出目录: {e}"))?;
    }

    let file_name = format!("autosign_accounts_{}.csv", now_text());
    let path = base_dir.join(file_name);

    let mut csv = String::from("account,password,login_type,last_login,token\n");
    for item in store.accounts {
        let _ = writeln!(
            csv,
            "{},{},{},{},{}",
            csv_escape(&item.account),
            csv_escape(&item.password),
            csv_escape(&item.login_type),
            csv_escape(&item.last_login),
            csv_escape(&item.token),
        );
    }

    fs::write(&path, csv).map_err(|e| format!("导出失败: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_accounts,
            save_account,
            login,
            fetch_phone_captcha,
            request_phone_code,
            login_by_phone,
            fetch_pits,
            rent_chatgpt,
            fetch_verification_code,
            export_accounts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
