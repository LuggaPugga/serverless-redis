use crate::models::{AppState, EnvResp};
use crate::redis_client::{do_call, execute_pipeline};
use crate::utils::write_resp;
use axum::{extract::State, http::HeaderMap, response::Response, Json};

fn get_encoding(headers: &HeaderMap) -> bool {
    headers
        .get("upstash-encoding")
        .and_then(|v| v.to_str().ok())
        == Some("base64")
}

fn json_to_string(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        serde_json::Value::Null => Some(String::new()),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => None,
    }
}

fn error_resp(msg: &str, enc: bool) -> Response {
    write_resp(
        EnvResp {
            status: "malformed_data".into(),
            result: None,
            result_list: None,
            error: Some(msg.into()),
            message: None,
        },
        enc,
    )
}

fn sanitize_lua_code(code: &str) -> String {
    code.trim().to_string()
}

fn parse_cmd(arr: &[serde_json::Value], enc: bool) -> Result<Vec<String>, Box<Response>> {
    arr.iter()
        .enumerate()
        .map(|(idx, v)| {
            let s = json_to_string(v).ok_or_else(|| {
                Box::new(error_resp(
                    "Invalid command array. Expected strings, numbers, or booleans.",
                    enc,
                ))
            })?;

            if idx == 3 {
                Ok(sanitize_lua_code(&s))
            } else {
                Ok(s)
            }
        })
        .collect()
}

pub async fn post_root(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> Response {
    let enc = get_encoding(&headers);
    let arr = match body.as_array() {
        Some(a) => a,
        None => return error_resp("Invalid command array.", enc),
    };

    if arr.first().is_some_and(|v| v.is_array()) {
        return post_pipeline(State(state), headers, Json(body)).await;
    }

    let cmd = match parse_cmd(arr, enc) {
        Ok(c) => c,
        Err(e) => return *e,
    };

    let mut conn = state.conn.clone();
    match do_call(&mut conn, cmd).await {
        Ok(v) => write_resp(
            EnvResp {
                status: "ok".into(),
                result: Some(v),
                result_list: None,
                error: None,
                message: None,
            },
            enc,
        ),
        Err(e) => write_resp(
            EnvResp {
                status: "error".into(),
                result: None,
                result_list: None,
                error: Some(e.to_string()),
                message: None,
            },
            enc,
        ),
    }
}

pub async fn post_pipeline(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> Response {
    let enc = get_encoding(&headers);
    let outer = match body.as_array() {
        Some(a) => a,
        None => return error_resp("Expected an array of string arrays.", enc),
    };

    let mut cmds = Vec::with_capacity(outer.len());
    for item in outer {
        let arr = match item.as_array() {
            Some(a) => a,
            None => return error_resp("Expected an array of string arrays.", enc),
        };
        match parse_cmd(arr, enc) {
            Ok(cmd) => cmds.push(cmd),
            Err(e) => return *e,
        }
    }

    let mut conn = state.conn.clone();
    match execute_pipeline(&mut conn, cmds).await {
        Ok(results) => write_resp(
            EnvResp {
                status: "ok".into(),
                result: Some(serde_json::Value::Array(
                    results
                        .into_iter()
                        .map(|v| serde_json::json!({"status": "ok", "result": v}))
                        .collect(),
                )),
                result_list: None,
                error: None,
                message: None,
            },
            enc,
        ),
        Err(e) => write_resp(
            EnvResp {
                status: "error".into(),
                result: None,
                result_list: None,
                error: Some(e.to_string()),
                message: None,
            },
            enc,
        ),
    }
}

pub async fn post_multi_exec(
    state: State<AppState>,
    headers: HeaderMap,
    body: Json<serde_json::Value>,
) -> Response {
    post_pipeline(state, headers, body).await
}
