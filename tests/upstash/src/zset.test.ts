import { beforeEach, describe, expect, it } from "bun:test";
import { cleanup, redis } from "../setup";

beforeEach(cleanup);

describe("Sorted Set Operations", () => {
	it("should add and update members with zadd", async () => {
		const added = await redis.zadd("zkey", { score: 1, member: "m1" });
		expect(added).toBe(1);

		const nx = await redis.zadd(
			"zkey",
			{ nx: true },
			{ score: 2, member: "m1" },
		);
		expect(nx).toBe(0);

		await redis.zadd("zkey", { gt: true }, { score: 0, member: "m1" });
		const score1 = await redis.zscore("zkey", "m1");
		expect(Number(score1)).toBe(1);

		await redis.zadd("zkey", { gt: true }, { score: 5, member: "m1" });
		const score2 = await redis.zscore("zkey", "m1");
		expect(Number(score2)).toBe(5);
	});

	it("should get cardinality with zcard", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "a" },
			{ score: 2, member: "b" },
		);
		const count = await redis.zcard("zkey");
		expect(count).toBe(2);
	});

	it("should count elements by score range with zcount", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "a" },
			{ score: 5, member: "b" },
			{ score: 10, member: "c" },
		);
		expect(await redis.zcount("zkey", 1, 5)).toBe(2);
		expect(await redis.zcount("zkey", "(1", 10)).toBe(2);
	});

	it("should store difference with zdiffstore", async () => {
		await redis.zadd(
			"k1",
			{ score: 1, member: "a" },
			{ score: 2, member: "b" },
		);
		await redis.zadd("k2", { score: 1, member: "a" });
		const stored = await redis.zdiffstore("dest", 2, "k1", "k2");
		expect(stored).toBe(1);
		const range = await redis.zrange("dest", 0, -1);
		expect(range).toEqual(["b"]);
	});

	it("should increment scores with zincrby", async () => {
		await redis.zadd("zkey", { score: 1, member: "m1" });
		const newScore = await redis.zincrby("zkey", 2, "m1");
		expect(Number(newScore)).toBe(3);
	});

	it("should store intersection with zinterstore", async () => {
		await redis.zadd(
			"k1",
			{ score: 1, member: "a" },
			{ score: 2, member: "b" },
		);
		await redis.zadd(
			"k2",
			{ score: 3, member: "b" },
			{ score: 4, member: "c" },
		);
		await redis.zinterstore("dest", 2, ["k1", "k2"], { weights: [2, 3] });
		const score = await redis.zscore("dest", "b");
		expect(Number(score)).toBe(13);
	});

	it("should count by lexicographical range with zlexcount", async () => {
		await redis.zadd(
			"zkey",
			{ score: 0, member: "a" },
			{ score: 0, member: "b" },
			{ score: 0, member: "c" },
		);
		const count = await redis.zlexcount("zkey", "[a", "(c");
		expect(count).toBe(2);
	});

	it("should get multiple scores with zmscore", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "a" },
			{ score: 2, member: "b" },
		);
		const scores = await redis.zmscore("zkey", ["a", "b", "c"]);
		expect(scores?.[0]).toBe(1);
		expect(scores?.[1]).toBe(2);
		expect(scores?.[2]).toBeNull();
	});

	it("should pop max and min elements", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "a" },
			{ score: 10, member: "z" },
		);
		const max = await redis.zpopmax("zkey");
		expect(max).toEqual(["z", 10]);
		const min = await redis.zpopmin("zkey");
		expect(min).toEqual(["a", 1]);
	});

	it("should fetch ranges with various options in zrange", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "a" },
			{ score: 2, member: "b" },
			{ score: 3, member: "c" },
		);

		const res = await redis.zrange("zkey", 3, 1, {
			byScore: true,
			rev: true,
			withScores: true,
		});
		expect(res).toEqual(["c", 3, "b", 2, "a", 1]);

		const limited = await redis.zrange("zkey", 1, 3, {
			byScore: true,
			count: 1,
			offset: 1,
		});
		expect(limited).toEqual(["b"]);
	});

	it("should return rank and reverse rank", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "a" },
			{ score: 2, member: "b" },
		);
		expect(await redis.zrank("zkey", "b")).toBe(1);
		expect(await redis.zrevrank("zkey", "b")).toBe(0);
	});

	it("should remove members with zrem", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "a" },
			{ score: 2, member: "b" },
		);
		const removed = await redis.zrem("zkey", "a", "b");
		expect(removed).toBe(2);
	});

	it("should remove by lex range with zremrangebylex", async () => {
		await redis.zadd(
			"zkey",
			{ score: 0, member: "alpha" },
			{ score: 0, member: "omega" },
		);
		const removed = await redis.zremrangebylex("zkey", "[alpha", "[apple");
		expect(removed).toBe(1);
	});

	it("should remove by rank with zremrangebyrank", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "a" },
			{ score: 2, member: "b" },
			{ score: 3, member: "c" },
		);
		const removed = await redis.zremrangebyrank("zkey", 0, 1);
		expect(removed).toBe(2);
		expect(await redis.zcard("zkey")).toBe(1);
	});

	it("should remove by score with zremrangebyscore", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "a" },
			{ score: 10, member: "b" },
		);
		const removed = await redis.zremrangebyscore("zkey", 0, 5);
		expect(removed).toBe(1);
	});

	it("should scan set with zscan", async () => {
		await redis.zadd(
			"zkey",
			{ score: 1, member: "abc" },
			{ score: 2, member: "def" },
		);
		const [_, members] = await redis.zscan("zkey", 0, { match: "ab*" });
		expect(members).toContain("abc");
		expect(members).not.toContain("def");
	});

	it("should get single score with zscore", async () => {
		await redis.zadd("zkey", { score: 99, member: "m1" });
		const score = await redis.zscore("zkey", "m1");
		expect(Number(score)).toBe(99);
	});

	it("should store union with zunionstore", async () => {
		await redis.zadd("k1", { score: 1, member: "a" });
		await redis.zadd("k2", { score: 2, member: "b" });
		const count = await redis.zunionstore("dest", 2, ["k1", "k2"]);
		expect(count).toBe(2);
		const results = await redis.zrange("dest", 0, -1);
		expect(results).toContain("a");
		expect(results).toContain("b");
	});
});
