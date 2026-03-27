import { Elysia, t } from "elysia";
import { createClient } from "redis";
import { Chess } from "chess.js";

const redisClient = createClient({ url: "redis://localhost:6379" });
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
 await initializeRedis();

// --- Types ---
type Type = "start" | "join" | "move" | GameOver | Chat;
type Chat = {
  roomID : string,
  message : string,
  senderID : string
}
type GameOver = {
  Winner: string;
  Runnerup: string;
  roomId: string;
};
type Move = {
  roomID: string;
  playerID: string;
  piece: string;
  from: string;
  to: string;
  time: number;
  points: number;
  promotion?: string;
};

type Message = {
  content: Type;
  uid: string;
  move?: Move;
};

type WsConnection = Pick<
  Bun.ServerWebSocket<unknown>,
  "send" | "subscribe" | "unsubscribe" | "publish"
>;

type Room = {
  roomId: string;
  player1Id: string;
  player1Socket: WsConnection;
  player2Id?: string;
  player2Socket?: WsConnection;
  chess: Chess;
  moves: Move[];
};

// --- State ---
// Queue to store waiting rooms
const roomQueue: Room[] = [];

// Store active connections with player ID
const playerConnections = new Map<string, WsConnection>();

// Store rooms by roomId
const activeRooms = new Map<string, Room>();

// --- Helpers ---
function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function sendMessage(
  ws: WsConnection,
  type: string,
  data: Record<string, any>,
) {
  ws.send(JSON.stringify({ type, ...data }));
}

function getPieceValue(piece: string): number {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return values[piece.toLowerCase()] ?? 0;
}

// --- Server ---
// TODO: can be done using subscribe, unsubscribe and publish
const app = new Elysia()
  .ws("/ws", {
    open(ws) {
      console.log("Player connected:");
      sendMessage(ws, "connected", {
        status: "connected_to_server",
      });
    },
    message(ws, data) {
      try {
        // Bun's ws gives us the raw data; parse it
        const message: Message =
          typeof data === "string" ? JSON.parse(data) : data;
        console.log("Received message:", message);

        if (message.content === "start") {
          console.log(`Player ${message.uid} wants to start a game`);

          // Store connection mapping
          playerConnections.set(message.uid, ws);

          if (roomQueue.length === 0) {
            // Queue is empty ─ create new room with player 1
            const roomId = generateRoomId();
            const newRoom: Room = {
              roomId,
              player1Id: message.uid,
              player1Socket: ws,
              chess: new Chess(),
              moves: [],
            };
            roomQueue.push(newRoom);
            activeRooms.set(roomId, newRoom);
            console.log(`Room created: ${roomId} for player ${message.uid}`);

            // Send acknowledgment to player 1
            sendMessage(ws, "room_created", {
              roomId,
              status: "waiting_for_opponent",
            });
          } else {
            // Queue has waiting room ─ match with player 2
            const existingRoom = roomQueue.pop() as Room;
            existingRoom.player2Id = message.uid;
            existingRoom.player2Socket = ws;

            console.log(
              `Room ${existingRoom.roomId} matched: Player1=${existingRoom.player1Id}, Player2=${existingRoom.player2Id}`,
            );

            // Send room details to player 2
            sendMessage(ws, "room_matched", {
              roomId: existingRoom.roomId,
              player1Id: existingRoom.player1Id,
              player2Id: existingRoom.player2Id,
            });

            // Notify player 1 about the match
            sendMessage(existingRoom.player1Socket, "opponent_joined", {
              roomId: existingRoom.roomId,
              player2Id: existingRoom.player2Id,
            });

            // Push game start to Redis
            redisClient.lPush(
              "chess",
              JSON.stringify({
                type: "start",
                roomID: existingRoom.roomId,
                player1Id: existingRoom.player1Id,
                player2Id: existingRoom.player2Id,
              }),
            );

            console.log(`Match ready: ${existingRoom.roomId}`);
          }
        }

        if (message.content === "move") {
          const move = message.move!;
          const room = activeRooms.get(move.roomID);
          if (!room) {
            sendMessage(ws, "error", { message: "Room not found" });
            return;
          }

          const isPlayer1 = room.player1Id === move.playerID;
          const isPlayer2 = room.player2Id === move.playerID;
          if (!isPlayer1 && !isPlayer2) {
            sendMessage(ws, "error", { message: "Player not in room" });
            return;
          }

          const playerColor = isPlayer1 ? "w" : "b";
          if (room.chess.turn() !== playerColor) {
            sendMessage(ws, "error", { message: "Not your turn" });
            return;
          }

          try {
            // Determine if this move is a pawn promotion
            const piece = room.chess.get(move.from as any);
            const toRank = parseInt(move.to[1]);
            const isPawnPromotion =
              piece?.type === "p" &&
              ((piece.color === "w" && toRank === 8) ||
                (piece.color === "b" && toRank === 1));

            const validPromotions = ["q", "r", "b", "n"];
            // Only apply promotion field when it's actually a promotion move
            const promotionPiece =
              isPawnPromotion && validPromotions.includes(move.promotion ?? "")
                ? move.promotion
                : isPawnPromotion
                  ? "q" // default to queen if no valid promotion sent
                  : undefined;

            const moveResult = room.chess.move({
              from: move.from,
              to: move.to,
              ...(promotionPiece ? { promotion: promotionPiece } : {}),
            });

            if (moveResult) {
              // Calculate points server-side from the actual captured piece
              const points = moveResult.captured
                ? getPieceValue(moveResult.captured)
                : 0;

              // Build the final move payload — include promotion so opponent
              // can call chess.move({ from, to, promotion }) correctly
              const moveWithPoints: Move = {
                ...move,
                points,
                promotion: promotionPiece, // undefined for non-promotion moves
              };
              room.moves.push(moveWithPoints);

              console.log(
                `Move: ${move.from}->${move.to}${promotionPiece ? `=${promotionPiece}` : ""} | pts=${points}`,
              );

              // Relay to opponent (with promotion field so they can apply the move)
              const opponentSocket = isPlayer1
                ? room.player2Socket
                : room.player1Socket;
              if (opponentSocket) {
                sendMessage(opponentSocket, "move", { move: moveWithPoints });
              }

              // Push to Redis for main backend persistence (includes promotion)
              redisClient.lPush(
                "chess",
                JSON.stringify({
                  type: "move",
                  ...moveWithPoints,
                }),
              );
            } else {
              sendMessage(ws, "error", { message: "Invalid move" });
            }
          } catch (error) {
            sendMessage(ws, "error", { message: "Invalid move" });
          }
        }

        // ── Chat message relay ──────────────────────────────────────────
        if (
          typeof message.content === "object" &&
          message.content !== null &&
          "message" in (message.content as object)
        ) {
          const chat = message.content as Chat;
          const room = activeRooms.get(chat.roomID);
          if (!room) {
            sendMessage(ws, "error", { message: "Room not found" });
            return;
          }

          const isPlayer1 = room.player1Id === chat.senderID;
          const isPlayer2 = room.player2Id === chat.senderID;
          if (!isPlayer1 && !isPlayer2) {
            sendMessage(ws, "error", { message: "Player not in room" });
            return;
          }

          // Relay to the opponent
          const opponentSocket = isPlayer1
            ? room.player2Socket
            : room.player1Socket;
          if (opponentSocket) {
            sendMessage(opponentSocket, "chat", {
              roomID: chat.roomID,
              senderID: chat.senderID,
              message: chat.message,
            });
          }
        }

        if (
          typeof message.content === "object" &&
          message.content !== null &&
          "Winner" in (message.content as object)
        ) {
          const gameOver = message.content as GameOver;
          const room = activeRooms.get(gameOver.roomId);
          if (!room) {
            sendMessage(ws, "error", { message: "Room not found" });
            return;
          }

          // Tally total points per player from stored moves
          const winnerPoints = room.moves
            .filter((m) => m.playerID === gameOver.Winner)
            .reduce((sum, m) => sum + m.points, 0);
          const runnerupPoints = room.moves
            .filter((m) => m.playerID === gameOver.Runnerup)
            .reduce((sum, m) => sum + m.points, 0);

          console.log(
            `Game over in room ${gameOver.roomId}: Winner=${gameOver.Winner} (${winnerPoints}pts), Runnerup=${gameOver.Runnerup} (${runnerupPoints}pts)`,
          );

          // Notify both players
          const gameOverPayload = {
            winner: gameOver.Winner,
            runnerup: gameOver.Runnerup,
            winnerPoints,
            runnerupPoints,
            roomId: gameOver.roomId,
          };
          sendMessage(room.player1Socket, "game_over", gameOverPayload);
          if (room.player2Socket) {
            sendMessage(room.player2Socket, "game_over", gameOverPayload);
          }

          // Push to Redis for main backend
          redisClient.lPush(
            "chess",
            JSON.stringify({
              type: "game_over",
              roomID: gameOver.roomId,
              winner: gameOver.Winner,
              runnerup: gameOver.Runnerup,
              winnerPoints,
              runnerupPoints,
            }),
          );

          // 🔬 Fire-and-forget: trigger analysis caching
          // Small delay to let main-backend persist the game_over via Redis worker
          setTimeout(() => {
            console.log(`🔬 Triggering analysis pre-cache for room ${gameOver.roomId}...`);
            fetch("http://localhost:4000/graphql", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: `query Analysegame($username: String!, $roomId: String!) {
                  analysegame(username: $username, roomId: $roomId) {
                    roomID status
                    analysis { moveNumber move color score mate bestMove classification }
                  }
                }`,
                variables: {
                  username: gameOver.Winner,
                  roomId: gameOver.roomId,
                },
              }),
            })
              .then((res) => res.json())
              .then((data: any) => {
                if (data.errors) {
                  console.error(`⚠ Analysis pre-cache failed for room ${gameOver.roomId}:`, data.errors[0]?.message);
                } else {
                  console.log(`✅ Analysis pre-cached for room ${gameOver.roomId}`);
                }
              })
              .catch((err: any) => {
                console.error(`⚠ Analysis pre-cache request failed for room ${gameOver.roomId}:`, err.message);
              });
          }, 2000); // 2s delay for Redis persistence

          // Clean up the room
          activeRooms.delete(gameOver.roomId);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    },
    close(ws) {
      console.log("Player disconnected");
    },
  })
  .listen(3000);

console.log(
  `🦊 WebSocket server is running at ${app.server?.hostname}:${app.server?.port}`,
);
  