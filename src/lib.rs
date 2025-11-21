pub mod handlers;
pub mod models;
pub mod redis_client;
pub mod utils;

use crate::handlers::{post_multi_exec, post_pipeline, post_root};
use crate::models::{AppState, EnvResp};
use crate::utils::write_resp;
use axum::{
    routing::{get, post},
    Router,
};
use tower_http::validate_request::ValidateRequestHeaderLayer;

pub fn create_app(state: AppState, token: String) -> Router {
    Router::new()
        .route(
            "/",
            get(|| async {
                write_resp(
                    EnvResp {
                        status: "ok".into(),
                        result: Some(serde_json::json!("Welcome to HTTP Redis!")),
                        result_list: None,
                        error: None,
                        message: None,
                    },
                    false,
                )
            })
            .post(post_root),
        )
        .route(
            "/ping",
            get(|| async { (axum::http::StatusCode::OK, "Pong") }),
        )
        .route("/pipeline", post(post_pipeline))
        .route("/multi-exec", post(post_multi_exec))
        .with_state(state)
        .layer(ValidateRequestHeaderLayer::bearer(&token))
}
