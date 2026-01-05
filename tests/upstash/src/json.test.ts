import { beforeEach, describe, expect, it } from "bun:test";
import { cleanup, redis } from "../setup";

beforeEach(cleanup);

describe("JSON", () => {
	describe("set and get", () => {
		it("should set and get a simple value", async () => {
			await redis.json.set("key", "$", { name: "John", age: 30 });
			const value = await redis.json.get("key", "$");
			expect(value).toEqual({ name: "John", age: 30 });
		});

		it("should set and get at nested path", async () => {
			await redis.json.set("key", "$", {
				user: { name: "John", age: 30 },
			});
			const name = await redis.json.get("key", "$.user.name");
			expect(name).toBe("John");
		});

		it("should set with NX option", async () => {
			await redis.json.set("key", "$", { value: 1 }, { nx: true });
			const exists = await redis.json.set(
				"key",
				"$",
				{ value: 2 },
				{
					nx: true,
				},
			);
			expect(exists).toBeNull();
		});

		it("should set with XX option", async () => {
			await redis.json.set("key", "$", { value: 1 });
			const result = await redis.json.set(
				"key",
				"$",
				{ value: 2 },
				{
					xx: true,
				},
			);
			expect(result).toBe("OK");
		});

		it("should get with formatting options", async () => {
			await redis.json.set("key", "$", { a: 1, b: 2 });
			const value = await redis.json.get(
				"key",
				{
					indent: "  ",
					newline: "\n",
					space: " ",
				},
				"$",
			);
			expect(typeof value).toBe("string");
		});
	});

	describe("array operations", () => {
		beforeEach(async () => {
			await redis.json.set("key", "$", {
				items: ["a", "b", "c"],
			});
		});

		it("should get array length", async () => {
			const length = await redis.json.arrlen("key", "$.items");
			expect(length).toEqual([3]);
		});

		it("should append to array", async () => {
			const length = await redis.json.arrappend("key", "$.items", "d", "e");
			expect(length).toEqual([5]);
		});

		it("should find index of value", async () => {
			const index = await redis.json.arrindex("key", "$.items", "b");
			expect(index).toEqual([1]);
		});

		it("should find index not found", async () => {
			const index = await redis.json.arrindex("key", "$.items", "z");
			expect(index).toEqual([-1]);
		});

		it("should insert at index", async () => {
			const length = await redis.json.arrinsert("key", "$.items", 1, "x", "y");
			expect(length).toEqual([5]);
			const items = await redis.json.get("key", "$.items");
			expect(items).toEqual(["a", "x", "y", "b", "c"]);
		});

		it("should pop from array", async () => {
			const popped = await redis.json.arrpop("key", "$.items");
			expect(popped).toEqual(["c"]);
		});

		it("should pop from specific index", async () => {
			const popped = await redis.json.arrpop("key", "$.items", 0);
			expect(popped).toEqual(["a"]);
		});

		it("should trim array", async () => {
			const length = await redis.json.arrtrim("key", "$.items", 0, 1);
			expect(length).toEqual([2]);
			const items = await redis.json.get("key", "$.items");
			expect(items).toEqual(["a", "b"]);
		});
	});

	describe("string operations", () => {
		beforeEach(async () => {
			await redis.json.set("key", "$", {
				text: "Hello",
			});
		});

		it("should append to string", async () => {
			const length = await redis.json.strappend("key", "$.text", " World");
			expect(length).toEqual([11]);
		});

		it("should get string length", async () => {
			const length = await redis.json.strlen("key", "$.text");
			expect(length).toEqual([5]);
		});

		it("should get string length after append", async () => {
			await redis.json.strappend("key", "$.text", "!");
			const length = await redis.json.strlen("key", "$.text");
			expect(length).toEqual([6]);
		});
	});

	describe("numeric operations", () => {
		beforeEach(async () => {
			await redis.json.set("key", "$", {
				counter: 10,
				multiplier: 5,
			});
		});

		it("should increment number", async () => {
			const value = await redis.json.numincrby("key", "$.counter", 5);
			expect(value).toEqual([15]);
		});

		it("should decrement number", async () => {
			const value = await redis.json.numincrby("key", "$.counter", -3);
			expect(value).toEqual([7]);
		});

		it("should multiply number", async () => {
			const value = await redis.json.nummultby("key", "$.multiplier", 2);
			expect(value).toEqual([10]);
		});

		it("should multiply by decimal", async () => {
			const value = await redis.json.nummultby("key", "$.multiplier", 0.5);
			expect(value).toEqual([2.5]);
		});
	});

	describe("object operations", () => {
		beforeEach(async () => {
			await redis.json.set("key", "$", {
				user: {
					name: "John",
					age: 30,
					email: "john@example.com",
				},
			});
		});

		it("should get object keys", async () => {
			const keys = await redis.json.objkeys("key", "$.user");
			expect(keys).toEqual([["name", "age", "email"]]);
		});

		it("should get object length", async () => {
			const length = await redis.json.objlen("key", "$.user");
			expect(length).toEqual([3]);
		});
	});

	describe("boolean operations", () => {
		beforeEach(async () => {
			await redis.json.set("key", "$", {
				active: true,
			});
		});

		it("should toggle boolean", async () => {
			const value = await redis.json.toggle("key", "$.active");
			expect(value).toEqual([0]);
		});

		it("should toggle back", async () => {
			await redis.json.toggle("key", "$.active");
			const value = await redis.json.toggle("key", "$.active");
			expect(value).toEqual([1]);
		});
	});

	describe("type operations", () => {
		beforeEach(async () => {
			await redis.json.set("key", "$", {
				string: "text",
				number: 42,
				array: [1, 2, 3],
				object: { key: "value" },
				bool: true,
				nil: null,
			});
		});

		it("should get string type", async () => {
			const type = await redis.json.type("key", "$.string");
			expect(type).toEqual(["string"]);
		});

		it("should get number type", async () => {
			const type = await redis.json.type("key", "$.number");
			expect(type).toEqual(["integer"]);
		});

		it("should get array type", async () => {
			const type = await redis.json.type("key", "$.array");
			expect(type).toEqual(["array"]);
		});

		it("should get object type", async () => {
			const type = await redis.json.type("key", "$.object");
			expect(type).toEqual(["object"]);
		});

		it("should get boolean type", async () => {
			const type = await redis.json.type("key", "$.bool");
			expect(type).toEqual(["true"]);
		});

		it("should get null for non-existent path", async () => {
			const type = await redis.json.type("key", "$.nonexistent");
			expect(type).toEqual([null as unknown as string]);
		});
	});

	describe("delete and clear operations", () => {
		it("should delete a path", async () => {
			await redis.json.set("key", "$", {
				a: 1,
				b: 2,
				c: 3,
			});
			const deleted = await redis.json.del("key", "$.b");
			expect(deleted).toBe(1);
		});

		it("should forget a path", async () => {
			await redis.json.set("key", "$", {
				a: 1,
				b: 2,
			});
			const forgotten = await redis.json.forget("key", "$.a");
			expect(forgotten).toBe(1);
		});

		it("should clear array", async () => {
			await redis.json.set("key", "$", {
				items: [1, 2, 3],
			});
			const cleared = await redis.json.clear("key", "$.items");
			expect(cleared).toBe(1);
			const items = await redis.json.get("key", "$.items");
			expect(items).toEqual([[]]);
		});

		it("should clear object", async () => {
			await redis.json.set("key", "$", {
				user: { name: "John", age: 30 },
			});
			const cleared = await redis.json.clear("key", "$.user");
			expect(cleared).toBe(1);
			const user = await redis.json.get("key", "$.user");
			expect(user).toEqual([{}]);
		});

		it("should clear numeric value to 0", async () => {
			await redis.json.set("key", "$", {
				count: 42,
			});
			const cleared = await redis.json.clear("key", "$.count");
			expect(cleared).toBe(1);
			const count = await redis.json.get("key", "$.count");
			expect(count).toEqual([0]);
		});
	});

	describe("merge operations", () => {
		beforeEach(async () => {
			await redis.json.set("key", "$", {
				user: {
					name: "John",
					age: 30,
				},
			});
		});

		it("should merge object", async () => {
			const result = await redis.json.merge("key", "$.user", {
				email: "john@example.com",
			});
			expect(result).toBe("OK");
		});

		it("should have merged values", async () => {
			await redis.json.merge("key", "$.user", {
				email: "john@example.com",
			});
			const user = await redis.json.get("key", "$.user");
			const typed = user as Record<string, unknown>;
			expect(typed.name).toBe("John");
			expect(typed.age).toBe(30);
			expect(typed.email).toBe("john@example.com");
		});

		it("should overwrite on merge", async () => {
			await redis.json.merge("key", "$.user", {
				age: 31,
			});
			const user = await redis.json.get("key", "$.user");
			const typed = user as Record<string, unknown>;
			expect(typed.name).toBe("John");
			expect(typed.age).toBe(31);
		});
	});

	describe("multi operations", () => {
		beforeEach(async () => {
			await redis.json.set("key1", "$", { value: "first" });
			await redis.json.set("key2", "$", { value: "second" });
			await redis.json.set("key3", "$", { value: "third" });
		});

		it("should mget from multiple keys", async () => {
			const values = await redis.json.mget(["key1", "key2", "key3"], "$.value");
			expect(values).toEqual(["first", "second", "third"]);
		});

		it("should mset multiple values", async () => {
			const result = await redis.json.mset([
				{ key: "key1", path: "$.new", value: "a" },
				{ key: "key2", path: "$.new", value: "b" },
				{ key: "key3", path: "$.new", value: "c" },
			] as unknown as Parameters<typeof redis.json.mset>[0]);
			expect(result).toBe("OK");
		});

		it("should verify mset results", async () => {
			await redis.json.mset([
				{ key: "key1", path: "$.status", value: "active" },
				{ key: "key2", path: "$.status", value: "inactive" },
			] as unknown as Parameters<typeof redis.json.mset>[0]);
			const values = await redis.json.mget(["key1", "key2"], "$.status");
			expect(values).toEqual(["active", "inactive"]);
		});
	});

	describe("complex scenarios", () => {
		it("should handle nested structures", async () => {
			await redis.json.set("user:1", "$", {
				id: 1,
				name: "John",
				profile: {
					bio: "Developer",
					tags: ["typescript", "redis"],
					stats: {
						followers: 100,
						following: 50,
					},
				},
			});

			const name = await redis.json.get("user:1", "$.name");
			expect(name).toBe("John");

			const bio = await redis.json.get("user:1", "$.profile.bio");
			expect(bio).toBe("Developer");

			const followers = await redis.json.get(
				"user:1",
				"$.profile.stats.followers",
			);
			expect(followers).toBe(100);
		});

		it("should handle array of objects", async () => {
			await redis.json.set("posts", "$", {
				items: [
					{ id: 1, title: "Post 1", likes: 10 },
					{ id: 2, title: "Post 2", likes: 20 },
					{ id: 3, title: "Post 3", likes: 15 },
				],
			});

			const length = await redis.json.arrlen("posts", "$.items");
			expect(length).toEqual([3]);

			await redis.json.arrappend("posts", "$.items", {
				id: 4,
				title: "Post 4",
				likes: 5,
			});

			const newLength = await redis.json.arrlen("posts", "$.items");
			expect(newLength).toEqual([4]);
		});

		it("should chain multiple operations", async () => {
			await redis.json.set("counter", "$", { value: 0 });

			await redis.json.numincrby("counter", "$.value", 10);
			let value = await redis.json.get("counter", "$.value");
			expect(value).toBe(10);

			await redis.json.nummultby("counter", "$.value", 2);
			value = await redis.json.get("counter", "$.value");
			expect(value).toBe(20);

			await redis.json.numincrby("counter", "$.value", 5);
			value = await redis.json.get("counter", "$.value");
			expect(value).toBe(25);
		});

		it("should manage document structure", async () => {
			const doc = {
				title: "My Document",
				metadata: {
					created: "2024-01-05",
					author: "Luca",
					tags: [] as string[],
				},
				content: "Initial content",
			};

			await redis.json.set("doc", "$", doc);

			await redis.json.strappend("doc", "$.content", " - Updated");
			await redis.json.arrappend(
				"doc",
				"$.metadata.tags",
				"important",
				"review",
			);
			await redis.json.merge("doc", "$.metadata", {
				updated: "2024-01-05",
			});

			const updated = await redis.json.get("doc", "$");
			const typedDoc = updated as Record<string, unknown>;
			const metadata = typedDoc.metadata as Record<string, unknown>;
			const tags = metadata.tags as string[];
			expect(tags).toContain("important");
			expect(metadata.updated).toBe("2024-01-05");
			const content = typedDoc.content as string;
			expect(content).toContain("Updated");
		});
	});
});
