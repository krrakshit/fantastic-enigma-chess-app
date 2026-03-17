import "dotenv/config";
import { createClient } from "redis";
import { prisma } from "./db";

// Import routes so the GraphQL server starts alongside the queue processor
import "./routes";

const redisClient = createClient({
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
          console.log(
            `Game started: ${data.roomID} - Player1: ${data.player1Id}, Player2: ${data.player2Id}`,
          );
          await prisma.game.create({
            data: {
              roomID: data.roomID,
              player1ID: data.player1Id,
              player2ID: data.player2Id,
            },
          });
          console.log("Game created in DB");
        } else if (data.type === "move") {
          console.log(
            `Move made in room ${data.roomID}: ${data.from} -> ${data.to}${data.promotion ? ` (promotion: ${data.promotion})` : ""}`,
          );
          await prisma.move.create({
            data: {
              roomID: data.roomID,
              playerID: data.playerID,
              piece: data.piece,
              from: data.from,
              to: data.to,
              time: data.time ?? 0,
              points: data.points ?? 0,
              promotion: data.promotion ?? null,
            },
          });
          console.log("Move stored in DB");
        } else if (data.type === "game_over") {
          console.log("Game end for room id: " + data.roomID);
          await prisma.game.update({
            where: {
              roomID: data.roomID,
            },
            data: {
              status: "finished",
              winner: data.winner,
              runnerup: data.runnerup,
              winnerPoints: data.winnerPoints ?? 0,
              runnerupPoints: data.runnerupPoints ?? 0,
            },
          });
          console.log(
            `Game over stored: Winner=${data.winner} (${data.winnerPoints}pts), Runnerup=${data.runnerup} (${data.runnerupPoints}pts)`,
          );
        }
      }
    } catch (error) {
      console.error("error while handling queue" + error);
    }
  }
}

async function main() {
  await initializeRedis();
  // Run queue processor in the background (non-blocking)
  processqueue().catch(console.error);
}

main().catch(console.error);
