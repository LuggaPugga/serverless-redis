use crate::models::EnvResp;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};

pub fn is_object(v: &serde_json::Value) -> bool {
    v.is_object()
}

pub fn is_result_array(v: &serde_json::Value) -> bool {
    if let Some(a) = v.as_array() {
        if a.is_empty() {
            return false;
        }
        return a.iter().all(|e| e.is_object());
    }
    false
}

fn encode_result_value(v: serde_json::Value) -> serde_json::Value {
    match v {
        serde_json::Value::String(s) => serde_json::Value::String(B64.encode(s.as_bytes())),
        serde_json::Value::Array(a) => {
            serde_json::Value::Array(a.into_iter().map(encode_result).collect())
        }
        x => x,
    }
}

fn encode_result(v: serde_json::Value) -> serde_json::Value {
    if v.is_null() {
        return v;
    }
    if is_object(&v) {
        let mut m = v.as_object().unwrap().clone();
        if let Some(r) = m.get("result").cloned() {
            m.insert("result".to_string(), encode_result_value(r));
            return serde_json::Value::Object(m);
        }
        return serde_json::Value::Object(m);
    }
    encode_result_value(v)
}

fn encode_response_list(l: Vec<serde_json::Value>) -> Vec<serde_json::Value> {
    l.into_iter()
        .map(|entry| {
            if let Some(obj) = entry.as_object() {
                if let Some(r) = obj.get("result") {
                    let mut m = obj.clone();
                    m.insert("result".into(), encode_result_value(r.clone()));
                    return serde_json::Value::Object(m);
                }
                if obj.get("error").is_some() {
                    return serde_json::Value::Object(obj.clone());
                }
            }
            entry
        })
        .collect()
}

fn encode_response(mut resp: EnvResp) -> EnvResp {
    if resp.status != "ok" {
        return resp;
    }
    if let Some(list) = resp.result_list.take() {
        EnvResp {
            status: "ok".into(),
            result: None,
            result_list: Some(encode_response_list(list)),
            error: None,
            message: None,
        }
    } else if let Some(r) = resp.result.take() {
        EnvResp {
            status: "ok".into(),
            result: Some(encode_result_value(r)),
            result_list: None,
            error: None,
            message: None,
        }
    } else {
        resp
    }
}

pub fn write_resp(resp: EnvResp, encoding: bool) -> Response {
    let mut r = resp;
    let status = match r.status.as_str() {
        "ok" => StatusCode::OK,
        "not_found" => StatusCode::NOT_FOUND,
        "malformed_data" => StatusCode::BAD_REQUEST,
        "redis_error" | "error" => StatusCode::BAD_REQUEST,
        "not_authorized" => StatusCode::UNAUTHORIZED,
        "connection_error" => StatusCode::INTERNAL_SERVER_ERROR,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    if r.status == "ok" && encoding {
        r = encode_response(r);
    }
    if r.status == "ok" {
        if let Some(list) = r.result_list.take() {
            return (status, Json(serde_json::Value::Array(list))).into_response();
        }
        if let Some(res) = r.result.take() {
            if is_result_array(&res) {
                return (status, Json(res)).into_response();
            }
            return (status, Json(serde_json::json!({"result": res}))).into_response();
        }
        return (
            status,
            Json(serde_json::json!({"result": serde_json::Value::Null})),
        )
            .into_response();
    }
    let payload = serde_json::json!({"error": r.error.unwrap_or_else(|| "SRH: An error occurred internally".into())});
    (status, Json(payload)).into_response()
}
