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
          console.log(`Game end for room id: ${data.roomID} [${data.resultType ?? "unknown"}]`);

          const isDraw = !data.winner;
          const ratingChange = 10; // fixed for now, could be ELO formula

          if (!isDraw && data.winner && data.runnerup) {
            // Update ratings for decisive games
            await prisma.user.update({
              where: { username: data.winner },
              data: { rating: { increment: ratingChange } },
            });
            await prisma.user.update({
              where: { username: data.runnerup },
              data: { rating: { decrement: ratingChange } },
            });
          }

          // Update game status
          await prisma.game.update({
            where: { roomID: data.roomID },
            data: {
              status: "finished",
              winner: data.winner ?? null,
              runnerup: data.runnerup ?? null,
              winnerPoints: data.winnerPoints ?? 0,
              runnerupPoints: data.runnerupPoints ?? 0,
              result: data.resultType ?? null,
            },
          });

          // Create rating history entries for player profiles
          if (!isDraw && data.winner && data.runnerup) {
            const game = await prisma.game.findUnique({
              where: { roomID: data.roomID },
              select: { id: true },
            });
            if (game) {
              const winnerUser = await prisma.user.findUnique({ where: { username: data.winner }, select: { id: true, rating: true } });
              const runnerupUser = await prisma.user.findUnique({ where: { username: data.runnerup }, select: { id: true, rating: true } });
              if (winnerUser) {
                await prisma.ratingHistory.create({
                  data: { userId: winnerUser.id, rating: winnerUser.rating, change: ratingChange, gameId: game.id },
                });
              }
              if (runnerupUser) {
                await prisma.ratingHistory.create({
                  data: { userId: runnerupUser.id, rating: runnerupUser.rating, change: -ratingChange, gameId: game.id },
                });
              }
            }
          }

          console.log(
            `Game over stored: ${isDraw ? "Draw" : `Winner=${data.winner} (${data.winnerPoints}pts), Runnerup=${data.runnerup} (${data.runnerupPoints}pts)`} [${data.resultType ?? "unknown"}]`,
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
