import { beforeEach, describe, expect, it } from "bun:test";
import { cleanup, redis } from "../setup";

beforeEach(cleanup);

describe("Geospatial Operations", () => {
	it("should add and get coordinates", async () => {
		await redis.geoadd("locations", {
			longitude: 13.361389,
			latitude: 38.115556,
			member: "Palermo",
		});
		await redis.geoadd("locations", {
			longitude: 15.087269,
			latitude: 37.502669,
			member: "Catania",
		});

		const pos = await redis.geopos("locations", "Palermo", "Catania");

		expect(pos[0]).toBeDefined();
		expect(pos[0]?.lng).toBeCloseTo(13.361389, 4);
		expect(pos[0]?.lat).toBeCloseTo(38.115556, 4);

		expect(pos[1]).toBeDefined();
		expect(pos[1]?.lng).toBeCloseTo(15.087269, 4);
		expect(pos[1]?.lat).toBeCloseTo(37.502669, 4);
	});

	it("should calculate distance between members", async () => {
		await redis.geoadd(
			"locations",
			{ longitude: 13.361389, latitude: 38.115556, member: "Palermo" },
			{ longitude: 15.087269, latitude: 37.502669, member: "Catania" },
		);

		const dist = await redis.geodist("locations", "Palermo", "Catania", "KM");
		expect(Number(dist)).toBeGreaterThan(160);
		expect(Number(dist)).toBeLessThan(170);
	});

	it("should get geohash", async () => {
		await redis.geoadd("locations", {
			longitude: 13.361389,
			latitude: 38.115556,
			member: "Palermo",
		});
		const hashes = await redis.geohash("locations", "Palermo");
		expect(hashes[0]).toBe("sqc8b49rny0");
	});

	it("should search radius", async () => {
		await redis.geoadd(
			"locations",
			{ longitude: 13.361389, latitude: 38.115556, member: "Palermo" },
			{ longitude: 15.087269, latitude: 37.502669, member: "Catania" },
		);

		const members = await redis.geosearch(
			"locations",
			{ type: "frommember", member: "Palermo" },
			{ type: "byradius", radius: 200, radiusType: "KM" },
			"asc",
			{ withDist: true },
		);

		expect(Array.isArray(members)).toBe(true);
		expect(members.some((m) => m.member === "Catania")).toBe(true);
	});

	it("should search and store results", async () => {
		await redis.geoadd(
			"locations",
			{ longitude: 13.361389, latitude: 38.115556, member: "Palermo" },
			{ longitude: 15.087269, latitude: 37.502669, member: "Catania" },
		);

		await redis.geosearchstore(
			"dest_key",
			"locations",
			{
				type: "fromlonlat",
				coordinate: { lon: 15, lat: 37 },
			},
			{
				type: "byradius",
				radius: 100,
				radiusType: "KM",
			},
			"asc",
		);

		const type = await redis.type("dest_key");
		expect(type).toBe("zset");
	});
});
