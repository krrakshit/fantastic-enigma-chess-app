import { Elysia, t } from "elysia";
import { createClient } from "redis";
import { Chess } from "chess.js";

const redisClient = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
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
type Type = "start" | "join" | "move" | "create_room" | "join_room" | "resign" | "draw_offer" | "draw_accept" | "draw_decline" | "timeout" | GameOver | Chat;
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
  code?: string;   // room code for join_room
  roomId?: string;  // room ID for resign/draw/timeout
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
  isGuestGame: boolean;  // true if any player is a guest
  drawOfferedBy?: string; // UID of player who offered draw
};
// --- State ---
// Queue to store waiting rooms
const roomQueue: Room[] = [];

// Store active connections with player ID
const playerConnections = new Map<string, WsConnection>();

// Store rooms by roomId
const activeRooms = new Map<string, Room>();

// Store private rooms by human-readable code
const privateRooms = new Map<string, Room>();

// --- Helpers ---
function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/** Generate a human-friendly room code like "KNIGHT42" */
function generateRoomCode(): string {
  const words = ["KNIGHT", "BISHOP", "CASTLE", "QUEEN", "PAWN", "ROOK", "KING", "CHECK", "GAMBIT", "BLITZ"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100-999
  const code = `${word}${num}`;
  // Ensure uniqueness
  if (privateRooms.has(code)) return generateRoomCode();
  return code;
}

function isGuestPlayer(uid: string): boolean {
  return uid.startsWith("guest_");
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

/** Centralized game-ending helper — handles notifications, Redis, analysis, cleanup */
function endGame(
  room: Room,
  winner: string | null,
  runnerup: string | null,
  resultType: string, // checkmate | resign | timeout | draw_agreement | stalemate | ...
) {
  const winnerPoints = winner
    ? room.moves.filter((m) => m.playerID === winner).reduce((s, m) => s + m.points, 0)
    : 0;
  const runnerupPoints = runnerup
    ? room.moves.filter((m) => m.playerID === runnerup).reduce((s, m) => s + m.points, 0)
    : 0;

  console.log(
    `Game over [${resultType}] in room ${room.roomId}: Winner=${winner ?? "none"} (${winnerPoints}pts), Runnerup=${runnerup ?? "none"} (${runnerupPoints}pts)`,
  );

  const payload = {
    winner, runnerup, winnerPoints, runnerupPoints,
    roomId: room.roomId, resultType,
  };
  sendMessage(room.player1Socket, "game_over", payload);
  if (room.player2Socket) sendMessage(room.player2Socket, "game_over", payload);

  // Push to Redis for main backend persistence
  if (!room.isGuestGame) {
    redisClient.lPush("chess", JSON.stringify({
      type: "game_over",
      roomID: room.roomId,
      winner, runnerup, winnerPoints, runnerupPoints, resultType,
    }));
  }

  // Trigger analysis pre-cache (only for decisive registered games)
  if (!room.isGuestGame && winner) {
    setTimeout(() => {
      console.log(`🔬 Triggering analysis pre-cache for room ${room.roomId}...`);
      fetch(`${process.env.MAIN_BACKEND_URL ?? "http://localhost:4000"}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query Analysegame($username: String!, $roomId: String!) {
            analysegame(username: $username, roomId: $roomId) {
              roomID status
              analysis { moveNumber move color score mate bestMove classification }
            }
          }`,
          variables: { username: winner, roomId: room.roomId },
        }),
      })
        .then((res) => res.json())
        .then((data: any) => {
          if (data.errors) console.error(`⚠ Analysis pre-cache failed for room ${room.roomId}:`, data.errors[0]?.message);
          else console.log(`✅ Analysis pre-cached for room ${room.roomId}`);
        })
        .catch((err: any) => console.error(`⚠ Analysis pre-cache request failed:`, err.message));
    }, 2000);
  }

  // Clean up
  activeRooms.delete(room.roomId);
}

// --- Allowed Origins ---
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:5174,http://localhost:5000")
  .split(",")
  .map((o) => o.trim());

function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

// --- Server ---
// TODO: can be done using subscribe, unsubscribe and publish
const app = new Elysia()
  .ws("/ws", {
    beforeHandle({ request }) {
      const origin = request.headers.get("origin");
      if (!isOriginAllowed(origin)) {
        console.log(`🚫 Rejected WebSocket connection from origin: ${origin ?? "none"}`);
        return new Response("Forbidden: origin not allowed", { status: 403 });
      }
    },
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
              isGuestGame: isGuestPlayer(message.uid),
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

            // Mark as guest game if either player is a guest
            if (isGuestPlayer(message.uid)) {
              existingRoom.isGuestGame = true;
            }

            // Push game start to Redis only for registered players
            if (!existingRoom.isGuestGame) {
              redisClient.lPush(
                "chess",
                JSON.stringify({
                  type: "start",
                  roomID: existingRoom.roomId,
                  player1Id: existingRoom.player1Id,
                  player2Id: existingRoom.player2Id,
                }),
              );
            } else {
              console.log(`🎭 Guest game — skipping Redis persistence for room ${existingRoom.roomId}`);
            }

            console.log(`Match ready: ${existingRoom.roomId}`);
          }
        }

        // ── Create private room (play with friend) ────────────────────────
        if (message.content === "create_room") {
          console.log(`Player ${message.uid} wants to create a private room`);

          playerConnections.set(message.uid, ws);

          const roomId = generateRoomId();
          const code = generateRoomCode();
          const newRoom: Room = {
            roomId,
            player1Id: message.uid,
            player1Socket: ws,
            chess: new Chess(),
            moves: [],
            isGuestGame: isGuestPlayer(message.uid),
          };
          activeRooms.set(roomId, newRoom);
          privateRooms.set(code, newRoom);
          console.log(`Private room created: ${roomId} (code: ${code}) for player ${message.uid}`);

          sendMessage(ws, "private_room_created", {
            roomId,
            code,
            status: "waiting_for_friend",
          });
        }

        // ── Join private room (play with friend) ──────────────────────────
        if (message.content === "join_room") {
          const code = (message.code ?? "").toUpperCase().trim();
          console.log(`Player ${message.uid} wants to join private room with code: ${code}`);

          if (!code) {
            sendMessage(ws, "error", { message: "Room code is required" });
            return;
          }

          const room = privateRooms.get(code);
          if (!room) {
            sendMessage(ws, "error", { message: "Invalid room code. No room found." });
            return;
          }

          if (room.player2Id) {
            sendMessage(ws, "error", { message: "Room is already full." });
            return;
          }

          if (room.player1Id === message.uid) {
            sendMessage(ws, "error", { message: "You cannot join your own room." });
            return;
          }

          playerConnections.set(message.uid, ws);
          room.player2Id = message.uid;
          room.player2Socket = ws;

          // Mark as guest game if either player is a guest
          if (isGuestPlayer(message.uid)) {
            room.isGuestGame = true;
          }

          console.log(
            `Private room ${room.roomId} (code: ${code}) matched: Player1=${room.player1Id}, Player2=${room.player2Id}`,
          );

          // Notify player 2 (joiner)
          sendMessage(ws, "room_matched", {
            roomId: room.roomId,
            player1Id: room.player1Id,
            player2Id: room.player2Id,
          });

          // Notify player 1 (creator)
          sendMessage(room.player1Socket, "opponent_joined", {
            roomId: room.roomId,
            player2Id: room.player2Id,
          });

          // Push game start to Redis only for registered players
          if (!room.isGuestGame) {
            redisClient.lPush(
              "chess",
              JSON.stringify({
                type: "start",
                roomID: room.roomId,
                player1Id: room.player1Id,
                player2Id: room.player2Id,
              }),
            );
          } else {
            console.log(`🎭 Guest game — skipping Redis persistence for private room ${room.roomId}`);
          }

          // Clean up from private rooms map (code no longer needed)
          privateRooms.delete(code);
          console.log(`Private match ready: ${room.roomId}`);
        }

        // ── Resign ────────────────────────────────────────────────────────
        if (message.content === "resign") {
          const room = message.roomId ? activeRooms.get(message.roomId) : undefined;
          if (!room) { sendMessage(ws, "error", { message: "Room not found" }); return; }
          const isP1 = room.player1Id === message.uid;
          const isP2 = room.player2Id === message.uid;
          if (!isP1 && !isP2) { sendMessage(ws, "error", { message: "Player not in room" }); return; }
          const winner = isP1 ? room.player2Id! : room.player1Id;
          const loser = message.uid;
          console.log(`Player ${loser} resigned in room ${room.roomId}`);
          endGame(room, winner, loser, "resign");
        }

        // ── Draw offer ────────────────────────────────────────────────────
        if (message.content === "draw_offer") {
          const room = message.roomId ? activeRooms.get(message.roomId) : undefined;
          if (!room) { sendMessage(ws, "error", { message: "Room not found" }); return; }
          const isP1 = room.player1Id === message.uid;
          const isP2 = room.player2Id === message.uid;
          if (!isP1 && !isP2) { sendMessage(ws, "error", { message: "Player not in room" }); return; }
          if (room.drawOfferedBy) { sendMessage(ws, "error", { message: "A draw offer is already pending" }); return; }
          room.drawOfferedBy = message.uid;
          const opponentSocket = isP1 ? room.player2Socket : room.player1Socket;
          if (opponentSocket) sendMessage(opponentSocket, "draw_offered", { roomId: room.roomId, offeredBy: message.uid });
          console.log(`Player ${message.uid} offered a draw in room ${room.roomId}`);
        }

        // ── Draw accept ───────────────────────────────────────────────────
        if (message.content === "draw_accept") {
          const room = message.roomId ? activeRooms.get(message.roomId) : undefined;
          if (!room) { sendMessage(ws, "error", { message: "Room not found" }); return; }
          if (!room.drawOfferedBy) { sendMessage(ws, "error", { message: "No draw offer pending" }); return; }
          if (room.drawOfferedBy === message.uid) { sendMessage(ws, "error", { message: "You cannot accept your own draw offer" }); return; }
          console.log(`Draw accepted in room ${room.roomId}`);
          endGame(room, null, null, "draw_agreement");
        }

        // ── Draw decline ──────────────────────────────────────────────────
        if (message.content === "draw_decline") {
          const room = message.roomId ? activeRooms.get(message.roomId) : undefined;
          if (!room) { sendMessage(ws, "error", { message: "Room not found" }); return; }
          if (!room.drawOfferedBy) { sendMessage(ws, "error", { message: "No draw offer pending" }); return; }
          const offerer = room.drawOfferedBy;
          room.drawOfferedBy = undefined;
          const offererSocket = room.player1Id === offerer ? room.player1Socket : room.player2Socket;
          if (offererSocket) sendMessage(offererSocket, "draw_declined", { roomId: room.roomId });
          console.log(`Draw declined in room ${room.roomId}`);
        }

        // ── Timeout ───────────────────────────────────────────────────────
        if (message.content === "timeout") {
          const room = message.roomId ? activeRooms.get(message.roomId) : undefined;
          if (!room) { sendMessage(ws, "error", { message: "Room not found" }); return; }
          const isP1 = room.player1Id === message.uid;
          const isP2 = room.player2Id === message.uid;
          if (!isP1 && !isP2) { sendMessage(ws, "error", { message: "Player not in room" }); return; }
          // The player who reports timeout is saying the OPPONENT ran out of time
          // So the reporter is the winner
          const winner = message.uid;
          const loser = isP1 ? room.player2Id! : room.player1Id;
          console.log(`Player ${loser} timed out in room ${room.roomId}`);
          endGame(room, winner, loser, "timeout");
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

              // Push to Redis for main backend persistence (only for registered games)
              if (!room.isGuestGame) {
                redisClient.lPush(
                  "chess",
                  JSON.stringify({
                    type: "move",
                    ...moveWithPoints,
                  }),
                );
              }
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
          endGame(room, gameOver.Winner, gameOver.Runnerup, "checkmate");
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    },
    close(ws) {
      console.log("Player disconnected");
    },
  })
  .listen(Number(process.env.PORT ?? 3000));

console.log(
  `🦊 WebSocket server is running at ${app.server?.hostname}:${app.server?.port}`,
);
  