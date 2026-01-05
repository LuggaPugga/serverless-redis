pub mod handlers;
pub mod models;
pub mod redis_client;
pub mod utils;

use crate::handlers::{post_multi_exec, post_pipeline, post_root};
use crate::models::{AppState, EnvResp};
use crate::utils::write_resp;
use axum::{
    http::{Request, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use tower_http::validate_request::{ValidateRequest, ValidateRequestHeaderLayer};

#[derive(Clone)]
struct BearerTokenValidator {
    token: String,
}

impl<B> ValidateRequest<B> for BearerTokenValidator {
    type ResponseBody = axum::body::Body;

    fn validate(
        &mut self,
        request: &mut Request<B>,
    ) -> Result<(), axum::response::Response<Self::ResponseBody>> {
        let valid = request
            .headers()
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.strip_prefix("Bearer "))
            .is_some_and(|t| t == self.token)
            || request.uri().query().is_some_and(|q| {
                q.split('&').any(|p| {
                    p.split_once('=').is_some_and(|(k, v)| {
                        (k == "_token" || k == "qstash_token")
                            && urlencoding::decode(v).is_ok_and(|d| d == self.token)
                    })
                })
            });

        if valid {
            Ok(())
        } else {
            Err(StatusCode::UNAUTHORIZED.into_response())
        }
    }
}
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
        .layer(ValidateRequestHeaderLayer::custom(BearerTokenValidator {
            token,
        }))
}
