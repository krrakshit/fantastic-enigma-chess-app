import { Elysia, t } from "elysia";
import { createClient } from "redis";
import { Chess } from "chess.js";
import { createLogger } from "../../logger/index.mjs";

const log = createLogger("ws-elysia-backend");

const redisClient = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
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
 await initializeRedis();

// --- Types ---
type Type = "start" | "join" | "move" | "create_room" | "join_room" | "resign" | "draw_offer" | "draw_accept" | "draw_decline" | "timeout" | "rematch" | "rematch_accept" | "rematch_decline" | GameOver | Chat;
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

// Store recently-ended rooms for rematch — only keep player IDs, not the full Room/Chess state
type EndedRoomInfo = { player1Id: string; player2Id: string; isGuestGame: boolean; rematchOfferedBy?: string };
const endedRooms = new Map<string, EndedRoomInfo>();

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

  log.info(`Game over [${resultType}]`, {
    roomId: room.roomId, winner: winner ?? "none", runnerup: runnerup ?? "none",
    winnerPoints, runnerupPoints, resultType,
  });

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
      log.info(`🔬 Triggering analysis pre-cache`, { roomId: room.roomId });
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
          if (data.errors) log.error(`⚠ Analysis pre-cache failed`, { roomId: room.roomId, error: data.errors[0]?.message });
          else log.info(`✅ Analysis pre-cached`, { roomId: room.roomId });
        })
        .catch((err: any) => log.error(`⚠ Analysis pre-cache request failed`, { error: err.message }));
    }, 2000);
  }

  // Keep lightweight player info for rematch (5 min TTL)
  endedRooms.set(room.roomId, {
    player1Id: room.player1Id,
    player2Id: room.player2Id!,
    isGuestGame: room.isGuestGame,
  });
  setTimeout(() => { endedRooms.delete(room.roomId); }, 5 * 60 * 1000);

  // Clean up from active rooms
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
        log.warn(`🚫 Rejected WebSocket connection`, { origin: origin ?? "none" });
        return new Response("Forbidden: origin not allowed", { status: 403 });
      }
    },
    open(ws) {
      log.ws("open", { message: "Player connected" });
      sendMessage(ws, "connected", {
        status: "connected_to_server",
      });
    },
    message(ws, data) {
      try {
        // Bun's ws gives us the raw data; parse it
        const message: Message =
          typeof data === "string" ? JSON.parse(data) : data;
        log.ws("message", { content: typeof message.content === "string" ? message.content : "object", uid: message.uid });

        if (message.content === "start") {
          log.info(`Player wants to start a game`, { uid: message.uid });

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
            log.info(`Room created`, { roomId, uid: message.uid });

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

            log.info(`Room matched`, { roomId: existingRoom.roomId, player1Id: existingRoom.player1Id, player2Id: existingRoom.player2Id });

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
              log.info(`🎭 Guest game — skipping Redis persistence`, { roomId: existingRoom.roomId });
            }

            log.info(`Match ready`, { roomId: existingRoom.roomId });
          }
        }

        // ── Create private room (play with friend) ────────────────────────
        if (message.content === "create_room") {
          log.info(`Player wants to create a private room`, { uid: message.uid });

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
          log.info(`Private room created`, { roomId, code, uid: message.uid });

          sendMessage(ws, "private_room_created", {
            roomId,
            code,
            status: "waiting_for_friend",
          });
        }

        // ── Join private room (play with friend) ──────────────────────────
        if (message.content === "join_room") {
          const code = (message.code ?? "").toUpperCase().trim();
          log.info(`Player wants to join private room`, { uid: message.uid, code });

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

          log.info(`Private room matched`, { roomId: room.roomId, code, player1Id: room.player1Id, player2Id: room.player2Id });

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
             log.info(`🎭 Guest game — skipping Redis persistence for private room`, { roomId: room.roomId });
          }

          // Clean up from private rooms map (code no longer needed)
          privateRooms.delete(code);
          log.info(`Private match ready`, { roomId: room.roomId });
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
          log.info(`Player resigned`, { uid: loser, roomId: room.roomId });
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
          log.info(`Player offered a draw`, { uid: message.uid, roomId: room.roomId });
        }

        // ── Draw accept ───────────────────────────────────────────────────
        if (message.content === "draw_accept") {
          const room = message.roomId ? activeRooms.get(message.roomId) : undefined;
          if (!room) { sendMessage(ws, "error", { message: "Room not found" }); return; }
          if (!room.drawOfferedBy) { sendMessage(ws, "error", { message: "No draw offer pending" }); return; }
          if (room.drawOfferedBy === message.uid) { sendMessage(ws, "error", { message: "You cannot accept your own draw offer" }); return; }
          log.info(`Draw accepted`, { roomId: room.roomId });
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
          log.info(`Draw declined`, { roomId: room.roomId });
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
          log.info(`Player timed out`, { uid: loser, roomId: room.roomId });
          endGame(room, winner, loser, "timeout");
        }

        // ── Rematch offer ──────────────────────────────────────────────────
        if (message.content === "rematch") {
          const oldRoomId = message.roomId;
          if (!oldRoomId) { sendMessage(ws, "error", { message: "Missing roomId for rematch" }); return; }
          const ended = endedRooms.get(oldRoomId);
          if (!ended) { sendMessage(ws, "error", { message: "Game session expired. Please create a new game." }); return; }
          const isP1 = ended.player1Id === message.uid;
          const isP2 = ended.player2Id === message.uid;
          if (!isP1 && !isP2) { sendMessage(ws, "error", { message: "You were not in that game" }); return; }
          if (ended.rematchOfferedBy) { sendMessage(ws, "error", { message: "A rematch offer is already pending" }); return; }

          ended.rematchOfferedBy = message.uid;
          const opponentId = isP1 ? ended.player2Id : ended.player1Id;
          const opponentSocket = playerConnections.get(opponentId);
          if (opponentSocket) {
            sendMessage(opponentSocket, "rematch_offered", { roomId: oldRoomId, offeredBy: message.uid });
          } else {
            sendMessage(ws, "error", { message: "Opponent is no longer connected." });
            ended.rematchOfferedBy = undefined;
          }
          log.info(`♻ Rematch offered`, { uid: message.uid, oldRoomId });
        }

        // ── Rematch accept ─────────────────────────────────────────────────
        if (message.content === "rematch_accept") {
          const oldRoomId = message.roomId;
          if (!oldRoomId) { sendMessage(ws, "error", { message: "Missing roomId" }); return; }
          const ended = endedRooms.get(oldRoomId);
          if (!ended) { sendMessage(ws, "error", { message: "Game session expired." }); return; }
          if (!ended.rematchOfferedBy) { sendMessage(ws, "error", { message: "No rematch offer pending" }); return; }
          if (ended.rematchOfferedBy === message.uid) { sendMessage(ws, "error", { message: "You cannot accept your own offer" }); return; }

          // Swap colors: old player1 (white) becomes player2 (black) and vice versa
          const newRoomId = generateRoomId();
          const newP1Id = ended.player2Id;   // old black → new white
          const newP2Id = ended.player1Id;    // old white → new black
          const p1Socket = playerConnections.get(newP1Id);
          const p2Socket = playerConnections.get(newP2Id);

          if (!p1Socket || !p2Socket) {
            sendMessage(ws, "error", { message: "Opponent disconnected. Please start a new game." });
            return;
          }

          const newRoom: Room = {
            roomId: newRoomId, player1Id: newP1Id, player1Socket: p1Socket,
            player2Id: newP2Id, player2Socket: p2Socket,
            chess: new Chess(), moves: [], isGuestGame: ended.isGuestGame,
          };
          activeRooms.set(newRoomId, newRoom);
          log.info(`♻ Rematch created`, { newRoomId, oldRoomId, player1Id: newP1Id, player2Id: newP2Id });

          const rematchPayload = { roomId: newRoomId, player1Id: newP1Id, player2Id: newP2Id };
          sendMessage(p1Socket, "rematch_ready", rematchPayload);
          sendMessage(p2Socket, "rematch_ready", rematchPayload);

          if (!newRoom.isGuestGame) {
            redisClient.lPush("chess", JSON.stringify({ type: "start", roomID: newRoomId, player1Id: newP1Id, player2Id: newP2Id }));
          }
          endedRooms.delete(oldRoomId);
        }

        // ── Rematch decline ────────────────────────────────────────────────
        if (message.content === "rematch_decline") {
          const oldRoomId = message.roomId;
          if (!oldRoomId) { sendMessage(ws, "error", { message: "Missing roomId" }); return; }
          const ended = endedRooms.get(oldRoomId);
          if (!ended || !ended.rematchOfferedBy) { return; }
          const offererId = ended.rematchOfferedBy;
          ended.rematchOfferedBy = undefined;
          const offererSocket = playerConnections.get(offererId);
          if (offererSocket) sendMessage(offererSocket, "rematch_declined", { roomId: oldRoomId });
          log.info(`♻ Rematch declined`, { uid: message.uid, oldRoomId });
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

              log.info(`Move`, { from: move.from, to: move.to, promotion: promotionPiece, points, roomId: move.roomID });

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
        log.error("Error parsing message", { error: String(error) });
      }
    },
    close(ws) {
      log.ws("close", { message: "Player disconnected" });
    },
  })
  .listen(Number(process.env.PORT ?? 3000));

log.info(`🦊 WebSocket server is running`, { hostname: app.server?.hostname, port: app.server?.port });
  