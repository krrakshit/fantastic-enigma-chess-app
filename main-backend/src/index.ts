import { createClient } from "redis";
let redisClient = createClient({
  url: "redis://localhost:6379",
});
async function initializeRedis() {
  try {
    redisClient.on("error", (err: Error) => {
      console.error("Redis Client Error:", err);
    });

    redisClient.on("connect", () => {
      console.log("✅ Connected to Redis");
    });

    await redisClient.connect();
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error);
  }
}
async function processqueue() {
  while (true) {
    try {
      const result = await redisClient.brPopLPush(
        "chess",
        "chess-processor",
        1,
      );
      console.log(result);
    } catch (error) {
      console.error("error while handling queue" + error);
    }
  }
}
async function main() {
  await initializeRedis();
  await processqueue();
}

main();
