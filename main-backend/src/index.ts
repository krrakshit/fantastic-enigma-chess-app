import { createClient } from "redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
})
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
      const result: string | null = await redisClient.brPopLPush(
        "chess",
        "chess-processor",
        1,
      );
      if (result) {
        const data = JSON.parse(result);
        console.log("Processing data:", data);

        if (data.type === "start") {
          // Create game when players are matched
          console.log(
            `Game started: ${data.roomID} - Player1: ${data.player1Id}, Player2: ${data.player2Id}`,
          );
          await prisma.game.create({
            data: {
              roomID: data.roomID,
              player1id: data.player1Id,
              player2id: data.player2Id,
            },
          });
          console.log("Game created in DB");
        } else if (data.type === "move") {
          // Create move in database
          console.log(
            `Move made in room ${data.roomID}: ${data.from} -> ${data.to}`,
          );
          await prisma.move.create({
            data: {
              roomID: data.roomID,
              playerID: data.playerID,
              piece: data.piece,
              from: data.from,
              to: data.to,
            },
          });
          console.log("Move stored in DB");
        } else if (data.type === "game_over") {
          console.log("Game end fo room id" + data.roomID ) ;
          await prisma.game.update({
            where : {
             roomID : data.roomID
            }, 
            data : {
              status : "finished",
            }
          })
        }
      }
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
