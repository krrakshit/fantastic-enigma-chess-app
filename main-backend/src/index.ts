import "dotenv/config";
import { createClient } from "redis";
import { prisma } from "./db";
import { createLogger } from "../../logger/index.mjs";

const log = createLogger("main-backend");

// Import routes so the GraphQL server starts alongside the queue processor
import "./routes";

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

async function initializeRedis() {
  try {
    redisClient.on("error", (err: Error) => {
      log.error("Redis Client Error", { error: err.message });
    });

    redisClient.on("connect", () => {
      log.info("✅ Connected to Redis");
    });

    await redisClient.connect();
  } catch (error) {
    log.error("❌ Failed to connect to Redis", { error: String(error) });
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
        log.info("Processing queue data", { type: data.type, roomID: data.roomID });

        if (data.type === "start") {
          log.info("Game started", { roomID: data.roomID, player1Id: data.player1Id, player2Id: data.player2Id });
          await prisma.game.create({
            data: {
              roomID: data.roomID,
              player1ID: data.player1Id,
              player2ID: data.player2Id,
            },
          });
          log.info("Game created in DB", { roomID: data.roomID });
        } else if (data.type === "move") {
          log.info("Move made", { roomID: data.roomID, from: data.from, to: data.to, promotion: data.promotion ?? null });
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
          log.info("Move stored in DB", { roomID: data.roomID });
        } else if (data.type === "game_over") {
          log.info("Game ended", { roomID: data.roomID, resultType: data.resultType ?? "unknown" });

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

          log.info("Game over stored", {
            roomID: data.roomID, isDraw, winner: data.winner, runnerup: data.runnerup,
            winnerPoints: data.winnerPoints, runnerupPoints: data.runnerupPoints, resultType: data.resultType ?? "unknown",
          });
        }
      }
    } catch (error) {
      log.error("Error while handling queue", { error: String(error) });
    }
  }
}

async function main() {
  await initializeRedis();
  // Run queue processor in the background (non-blocking)
  processqueue().catch(console.error);
}

main().catch(console.error);
