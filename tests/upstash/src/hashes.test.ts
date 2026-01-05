import { beforeEach, describe, expect, it } from "bun:test";
import { cleanup, redis } from "../setup";

beforeEach(cleanup);

describe("Hash Operations", () => {
	it("should set and get hash fields", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1", field2: "value2" });
		const hashValue = await redis.hget("myhash", "field1");
		expect(hashValue).toBe("value1");
	});

	it("should get all hash fields and values", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", {
			name: "Alice",
			age: 30,
			email: "alice@example.com",
		});
		const all = await redis.hgetall("myhash");
		expect(all).toEqual({ name: "Alice", age: 30, email: "alice@example.com" });
	});

	it("should get multiple hash fields", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", {
			field1: "value1",
			field2: "value2",
			field3: "value3",
		});
		const values = await redis.hmget("myhash", "field1", "field2");
		expect(values).toEqual({ field1: "value1", field2: "value2" });
	});

	it("should check if hash field exists", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		const exists1 = await redis.hexists("myhash", "field1");
		const exists2 = await redis.hexists("myhash", "field2");
		expect(exists1).toBe(1);
		expect(exists2).toBe(0);
	});

	it("should delete hash fields", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", {
			field1: "value1",
			field2: "value2",
			field3: "value3",
		});
		const deleted = await redis.hdel("myhash", "field1", "field2");
		expect(deleted).toBeGreaterThanOrEqual(1);
		const all = await redis.hgetall("myhash");
		expect(all).toEqual({ field3: "value3" });
	});

	it("should get all hash keys", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1", field2: "value2" });
		const keys = await redis.hkeys("myhash");
		expect((keys as string[]).sort()).toEqual(["field1", "field2"]);
	});

	it("should get all hash values", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1", field2: "value2" });
		const values = await redis.hvals("myhash");
		expect((values as string[]).sort()).toEqual(["value1", "value2"]);
	});

	it("should get hash length", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", {
			field1: "value1",
			field2: "value2",
			field3: "value3",
		});
		const length = await redis.hlen("myhash");
		expect(length).toBe(3);
	});

	it("should increment hash field", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { counter: "10" });
		const newValue = await redis.hincrby("myhash", "counter", 5);
		expect(newValue).toBe(15);
	});

	it("should increment hash field by float", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { balance: "10.5" });
		const newValue = await redis.hincrbyfloat("myhash", "balance", 2.3);
		const numValue =
			typeof newValue === "string" ? parseFloat(newValue) : newValue;
		expect(numValue).toBeCloseTo(12.8, 1);
	});

	it("should get hash field string length", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field: "Hello World" });
		const length = await redis.hstrlen("myhash", "field");
		expect(length).toBe(11);
	});

	it("should set hash field only if not exists", async () => {
		await redis.del("myhash");
		const set1 = await redis.hsetnx("myhash", "field1", "value1");
		expect(set1).toBe(1);
		const set2 = await redis.hsetnx("myhash", "field1", "value2");
		expect(set2).toBe(0);
		const value = await redis.hget("myhash", "field1");
		expect(value).toBe("value1");
	});

	it("should get random hash field", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", {
			field1: "value1",
			field2: "value2",
			field3: "value3",
		});
		const randomField = await redis.hrandfield("myhash");
		expect(["field1", "field2", "field3"]).toContain(randomField as string);
	});

	it("should get multiple random hash fields", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", {
			field1: "value1",
			field2: "value2",
			field3: "value3",
		});
		const randomFields = await redis.hrandfield("myhash", 2);
		expect(Array.isArray(randomFields)).toBe(true);
		expect((randomFields as string[]).length).toBeLessThanOrEqual(2);
	});

	it("should get random hash fields with values", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", {
			field1: "value1",
			field2: "value2",
			field3: "value3",
		});
		const randomFields = await redis.hrandfield("myhash", 2, true);
		expect(
			typeof randomFields === "object" && !Array.isArray(randomFields),
		).toBe(true);
	});

	it("should scan hash fields", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", {
			field1: "value1",
			field2: "value2",
			field3: "value3",
		});
		const [cursor, fields] = await redis.hscan("myhash", 0);
		expect(typeof cursor).toBe("string");
		expect(Array.isArray(fields)).toBe(true);
		expect(fields.length).toBeGreaterThan(0);
	});

	it("should scan hash fields with match", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", {
			field1: "value1",
			field2: "value2",
			name: "test",
		});
		const [cursor, fields] = await redis.hscan("myhash", 0, {
			match: "field*",
		});
		expect(typeof cursor).toBe("string");
		expect(Array.isArray(fields)).toBe(true);
	});

	it("should set hash field expiration", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		const result = await redis.hexpire("myhash", "field1", 100);
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBe(1);
	});

	it("should set hash field expiration at timestamp", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		const futureTimestamp = Math.floor(Date.now() / 1000) + 100;
		const result = await redis.hexpireat("myhash", "field1", futureTimestamp);
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBe(1);
	});

	it("should get hash field expiration time", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		const futureTimestamp = Math.floor(Date.now() / 1000) + 100;
		await redis.hexpireat("myhash", "field1", futureTimestamp);
		const result = await redis.hexpiretime("myhash", "field1");
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBeGreaterThan(0);
	});

	it("should get hash field TTL in seconds", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		await redis.hexpire("myhash", "field1", 100);
		const result = await redis.httl("myhash", "field1");
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBeGreaterThan(0);
		expect(result[0]).toBeLessThanOrEqual(100);
	});

	it("should set hash field expiration in milliseconds", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		const result = await redis.hpexpire("myhash", "field1", 10000);
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBe(1);
	});

	it("should set hash field expiration at timestamp in milliseconds", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		const futureTimestamp = Date.now() + 10000;
		const result = await redis.hpexpireat("myhash", "field1", futureTimestamp);
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBe(1);
	});

	it("should get hash field expiration time in milliseconds", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		const futureTimestamp = Date.now() + 10000;
		await redis.hpexpireat("myhash", "field1", futureTimestamp);
		const result = await redis.hpexpiretime("myhash", "field1");
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBeGreaterThan(0);
	});

	it("should get hash field TTL in milliseconds", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		await redis.hpexpire("myhash", "field1", 10000);
		const result = await redis.hpttl("myhash", "field1");
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBeGreaterThan(0);
		expect(result[0]).toBeLessThanOrEqual(10000);
	});

	it("should remove hash field expiration", async () => {
		await redis.del("myhash");
		await redis.hset("myhash", { field1: "value1" });
		await redis.hexpire("myhash", "field1", 100);
		const result = await redis.hpersist("myhash", "field1");
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBe(1);
		const ttl = await redis.httl("myhash", "field1");
		expect(ttl[0]).toBe(-1);
	});
});
