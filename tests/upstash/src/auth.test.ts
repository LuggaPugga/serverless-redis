import { beforeEach, describe, expect, it } from "bun:test";
import { Redis } from "@upstash/redis";
import { cleanup } from "../setup";

const token = process.env.SR_TOKEN as string;
const url = process.env.SR_URL as string;

beforeEach(cleanup);

describe("Authentication", () => {
	it("should authenticate with Bearer token", async () => {
		const redis = new Redis({
			url: url,
			token: token,
		});

		const result = await redis.ping();
		expect(result).toBe("PONG");
	});

	it("should authenticate with query parameter", async () => {
		const redisUrl = new URL(url);
		redisUrl.searchParams.set("qstash_token", token);
		console.log(redisUrl.toString());

		const redis = new Redis({
			url: redisUrl.toString(),
			token: token,
		});

		const result = await redis.ping();
		expect(result).toBe("PONG");
	});

	it("should authenticate with query parameter", async () => {
		const redisUrl = new URL(url);
		redisUrl.searchParams.set("_token", token);
		console.log(redisUrl.toString());

		const redis = new Redis({
			url: redisUrl.toString(),
			token: token,
		});

		const result = await redis.ping();
		expect(result).toBe("PONG");
	});

	it("should fail without authentication", async () => {
		const redis = new Redis({
			url: url,
			token: "wrong_token",
		});

		expect(redis.ping()).rejects.toThrow();
	});
});
