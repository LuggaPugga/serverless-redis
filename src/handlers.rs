use crate::models::{AppState, EnvResp};
use crate::redis_client::{do_call, execute_pipeline};
use crate::utils::write_resp;
use axum::{extract::State, http::HeaderMap, response::Response, Json};

pub async fn post_root(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> Response {
    let enc = headers
        .get("upstash-encoding")
        .and_then(|v| v.to_str().ok())
        == Some("base64");

    let arr = match body.as_array() {
        Some(a) => a,
        None => {
            return write_resp(
                EnvResp {
                    status: "malformed_data".into(),
                    result: None,
                    result_list: None,
                    error: Some("Invalid command array.".into()),
                    message: None,
                },
                enc,
            );
        }
    };

    if let Some(first) = arr.first() {
        if first.is_array() {
            return post_pipeline(State(state), headers, Json(body)).await;
        }
    }

    let mut cmd = Vec::with_capacity(arr.len());
    for v in arr {
        let arg = match v {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "null".to_string(),
            serde_json::Value::Array(_) | serde_json::Value::Object(_) => v.to_string(),
        };
        cmd.push(arg);
    }

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
    let enc = headers
        .get("upstash-encoding")
        .and_then(|v| v.to_str().ok())
        == Some("base64");

    let outer = match body.as_array() {
        Some(a) => a,
        None => {
            return write_resp(
                EnvResp {
                    status: "malformed_data".into(),
                    result: None,
                    result_list: None,
                    error: Some("Expected an array of string arrays.".into()),
                    message: None,
                },
                enc,
            );
        }
    };

    let mut cmds = Vec::with_capacity(outer.len());
    for item in outer {
        let arr = match item.as_array() {
            Some(a) => a,
            None => {
                return write_resp(
                    EnvResp {
                        status: "malformed_data".into(),
                        result: None,
                        result_list: None,
                        error: Some("Expected an array of string arrays.".into()),
                        message: None,
                    },
                    enc,
                );
            }
        };
        let mut cmd = Vec::with_capacity(arr.len());
        for v in arr {
            let arg = match v {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => "null".to_string(),
                serde_json::Value::Array(_) | serde_json::Value::Object(_) => v.to_string(),
            };
            cmd.push(arg);
        }
        cmds.push(cmd);
    }

    let mut conn = state.conn.clone();
    match execute_pipeline(&mut conn, cmds).await {
        Ok(results) => {
            let out: Vec<serde_json::Value> = results
                .into_iter()
                .map(|v| serde_json::json!({"status": "ok", "result": v}))
                .collect();
            write_resp(
                EnvResp {
                    status: "ok".into(),
                    result: Some(serde_json::Value::Array(out)),
                    result_list: None,
                    error: None,
                    message: None,
                },
                enc,
            )
        }
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
