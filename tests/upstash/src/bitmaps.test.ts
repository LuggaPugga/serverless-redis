import { beforeEach, describe, expect, it } from "bun:test";
import { cleanup, redis } from "../setup";

beforeEach(cleanup);

describe("Bitmaps", () => {
	it("should set and get bit", async () => {
		await redis.del("bitmap");
		const oldValue = await redis.setbit("bitmap", 7, 1);
		expect(oldValue).toBe(0);
		const bit = await redis.getbit("bitmap", 7);
		expect(bit).toBe(1);
	});

	it("should count set bits", async () => {
		await redis.del("bitmap");
		await redis.setbit("bitmap", 0, 1);
		await redis.setbit("bitmap", 1, 1);
		await redis.setbit("bitmap", 2, 1);
		const count = await redis.bitcount("bitmap", 0, -1);
		expect(count).toBe(3);
	});

	it("should count set bits in range", async () => {
		await redis.del("bitmap");
		await redis.setbit("bitmap", 0, 1);
		await redis.setbit("bitmap", 8, 1);
		await redis.setbit("bitmap", 16, 1);
		const count = await redis.bitcount("bitmap", 0, 1);
		expect(count).toBe(2);
	});

	it("should find first set bit", async () => {
		await redis.del("bitmap");
		await redis.setbit("bitmap", 5, 1);
		const pos = await redis.bitpos("bitmap", 1);
		expect(pos).toBe(5);
	});

	it("should find first clear bit", async () => {
		await redis.del("bitmap");
		await redis.setbit("bitmap", 0, 1);
		await redis.setbit("bitmap", 1, 1);
		const pos = await redis.bitpos("bitmap", 0);
		expect(pos).toBe(2);
	});

	it("should find bit position in range", async () => {
		await redis.del("bitmap");
		await redis.setbit("bitmap", 10, 1);
		const pos = await redis.bitpos("bitmap", 1, 1, 2);
		expect(pos).toBe(10);
	});

	it("should perform bitwise and", async () => {
		await redis.del("bitmap1", "bitmap2", "bitmap:and");
		await redis.setbit("bitmap1", 0, 1);
		await redis.setbit("bitmap1", 1, 1);
		await redis.setbit("bitmap2", 1, 1);
		await redis.setbit("bitmap2", 2, 1);
		const result = await redis.bitop("and", "bitmap:and", "bitmap1", "bitmap2");
		expect(result).toBeGreaterThan(0);
		const count = await redis.bitcount("bitmap:and", 0, -1);
		expect(count).toBe(1);
	});

	it("should perform bitwise or", async () => {
		await redis.del("bitmap1", "bitmap2", "bitmap:or");
		await redis.setbit("bitmap1", 0, 1);
		await redis.setbit("bitmap2", 2, 1);
		const result = await redis.bitop("or", "bitmap:or", "bitmap1", "bitmap2");
		expect(result).toBeGreaterThan(0);
		const count = await redis.bitcount("bitmap:or", 0, -1);
		expect(count).toBe(2);
	});

	it("should perform bitwise xor", async () => {
		await redis.del("bitmap1", "bitmap2", "bitmap:xor");
		await redis.setbit("bitmap1", 0, 1);
		await redis.setbit("bitmap1", 1, 1);
		await redis.setbit("bitmap2", 1, 1);
		const result = await redis.bitop("xor", "bitmap:xor", "bitmap1", "bitmap2");
		expect(result).toBeGreaterThan(0);
		const count = await redis.bitcount("bitmap:xor", 0, -1);
		expect(count).toBe(1);
	});

	it("should perform bitwise not", async () => {
		await redis.del("bitmap", "bitmap:not");
		await redis.setbit("bitmap", 0, 1);
		const result = await redis.bitop("not", "bitmap:not", "bitmap");
		expect(result).toBeGreaterThan(0);
		const bit0 = await redis.getbit("bitmap:not", 0);
		expect(bit0).toBe(0);
	});
});
