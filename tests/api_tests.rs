use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use redis::Client;
use serverless_redis::{create_app, models::AppState};
use std::env;
use tower::ServiceExt;

async fn get_redis_conn() -> redis::aio::ConnectionManager {
    let url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into());
    let client = Client::open(url).expect("Invalid REDIS_URL");
    client
        .get_connection_manager()
        .await
        .expect("Failed to connect to Redis")
}

#[tokio::test]
async fn test_ping() {
    let conn = get_redis_conn().await;
    let state = AppState { conn };
    let app = create_app(state, "test_token".to_string());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/ping")
                .header("Authorization", "Bearer test_token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    assert_eq!(&body[..], b"Pong");
}

#[tokio::test]
async fn test_auth_failure() {
    let conn = get_redis_conn().await;
    let state = AppState { conn };
    let app = create_app(state, "secret_token".to_string());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::json!(["GET", "key"]).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_set_get_command() {
    let conn = get_redis_conn().await;
    let state = AppState { conn };
    let app = create_app(state, "test_token".to_string());

    // SET test_key "hello world"
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/")
                .method("POST")
                .header("Authorization", "Bearer test_token")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::json!(["SET", "test_key", "hello world"]).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // GET test_key
    let response = app
        .oneshot(
            Request::builder()
                .uri("/")
                .method("POST")
                .header("Authorization", "Bearer test_token")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::json!(["GET", "test_key"]).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["result"], "hello world");
}

#[tokio::test]
async fn test_pipeline() {
    let conn = get_redis_conn().await;
    let state = AppState { conn };
    let app = create_app(state, "test_token".to_string());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/pipeline")
                .method("POST")
                .header("Authorization", "Bearer test_token")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::json!([["SET", "pipe_key", "pipe_val"], ["GET", "pipe_key"]])
                        .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // For pipeline, if the result is an array of objects (which it is),
    // it's returned directly as the array.
    let results = json.as_array().expect("Expected JSON array response");
    assert_eq!(results.len(), 2);
    assert_eq!(results[1]["result"], "pipe_val");
}
