import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

interface PlayerData {
  name: string;
  nextNumber: number;
  readyForRematch?: boolean;
}

interface PlayersMap {
  [socketId: string]: PlayerData;
}

type GameState = "lobby" | "waiting" | "playing" | "over";

const socket: Socket = io("http://localhost:3001", {
  transports: ["websocket"],
  upgrade: false,
});

function App() {
  const [name, setName] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayersMap>({});
  const [hostId, setHostId] = useState<string>("");
  const [grid, setGrid] = useState<number[]>([]);
  const [gameState, setGameState] = useState<GameState>("lobby");
  const [winner, setWinner] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isRematchRequested, setIsRematchRequested] = useState<boolean>(false);

  useEffect(() => {
    socket.on(
      "room_created",
      ({
        roomId,
        players,
        hostId,
      }: {
        roomId: string;
        players: PlayersMap;
        hostId: string;
      }) => {
        setCurrentRoom(roomId);
        setPlayers(players);
        setHostId(hostId);
        setGameState("waiting");
      }
    );

    socket.on(
      "room_updated",
      ({ players, hostId }: { players: PlayersMap; hostId: string }) => {
        setPlayers(players);
        setHostId(hostId);
      }
    );

    socket.on(
      "game_start",
      ({ grid, players }: { grid: number[]; players: PlayersMap }) => {
        setGrid(grid);
        setPlayers(players);
        setGameState("playing");
        setIsRematchRequested(false);
      }
    );

    socket.on("progress_update", ({ players }: { players: PlayersMap }) => {
      setPlayers(players);
    });

    socket.on("game_over", ({ winnerName }: { winnerName: string }) => {
      setWinner(winnerName);
      setGameState("over");
    });

    socket.on("rematch_waiting", ({ players }: { players: PlayersMap }) => {
      setPlayers(players);
    });

    socket.on("left_room_success", () => {
      setCurrentRoom(null);
      setPlayers({});
      setGrid([]);
      setGameState("lobby");
      setIsRematchRequested(false);
    });

    socket.on("error_message", (msg: string) => {
      setError(msg);
      setTimeout(() => setError(""), 4000);
    });

    return () => {
      socket.off("room_created");
      socket.off("room_updated");
      socket.off("game_start");
      socket.off("progress_update");
      socket.off("game_over");
      socket.off("rematch_waiting");
      socket.off("left_room_success");
      socket.off("error_message");
    };
  }, []);

  const createRoom = (): void => {
    if (!name.trim()) return alert("Enter your name first!");
    socket.emit("create_room", name.trim());
  };

  const joinRoom = (): void => {
    if (!name.trim() || !roomId.trim()) return alert("Enter name and Room ID!");
    socket.emit("join_room", {
      roomId: roomId.trim().toUpperCase(),
      playerName: name.trim(),
    });
    setCurrentRoom(roomId.trim().toUpperCase());
  };

  const handleStartGame = (): void => {
    if (!currentRoom) return;
    socket.emit("start_game", currentRoom);
  };

  const handleTileClick = (num: number): void => {
    if (!currentRoom) return;
    socket.emit("tile_click", { roomId: currentRoom, clickedNumber: num });
  };

  const handlePlayAgain = (): void => {
    if (!currentRoom) return;
    setIsRematchRequested(true);
    socket.emit("play_again", currentRoom);
  };

  const handleLeaveRoom = (): void => {
    if (!currentRoom) return;
    socket.emit("leave_room", currentRoom);
  };

  const socketId = socket.id || "";
  const myProgress = players[socketId]?.nextNumber || 1;
  const isHost = socketId === hostId;

  // Convert the players map into a sorted list for the live leaderboard ranking
  const sortedLeaderboard = Object.entries(players).sort(
    (a, b) => b[1].nextNumber - a[1].nextNumber
  );

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: "550px",
        margin: "40px auto",
        padding: "0 20px",
        textAlign: "center",
      }}
    >
      <h1>⚡ Multi-Speed 1-9 ⚡</h1>

      {error && (
        <div
          style={{
            backgroundColor: "#ffdddd",
            color: "#d9534f",
            padding: "10px",
            borderRadius: "5px",
            margin: "15px 0",
            fontWeight: "bold",
          }}
        >
          {error}
        </div>
      )}

      {gameState !== "lobby" && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#333",
            color: "white",
            padding: "8px 15px",
            borderRadius: "5px",
            marginBottom: "20px",
          }}
        >
          <span>
            Room: <strong style={{ color: "#4FFFB0" }}>{currentRoom}</strong>
          </span>
          <button
            onClick={handleLeaveRoom}
            style={{
              background: "#d9534f",
              color: "white",
              border: "none",
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: "4px",
              fontWeight: "bold",
            }}
          >
            Leave Room
          </button>
        </div>
      )}

      {/* --- LOBBY STATE --- */}
      {gameState === "lobby" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            background: "#f9f9f9",
            padding: "25px",
            borderRadius: "10px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <input
            type="text"
            placeholder="Enter Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "10px",
              fontSize: "16px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
          <button
            onClick={createRoom}
            style={{
              padding: "12px",
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Create Lobby
          </button>
          <div style={{ color: "#aaa", fontSize: "14px" }}>— OR —</div>
          <input
            type="text"
            placeholder="Enter Room Code"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{
              padding: "10px",
              fontSize: "16px",
              borderRadius: "5px",
              border: "1px solid #ccc",
            }}
          />
          <button
            onClick={joinRoom}
            style={{
              padding: "12px",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "5px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Join Lobby
          </button>
        </div>
      )}

      {/* --- WAITING LOBBY STATE --- */}
      {gameState === "waiting" && (
        <div
          style={{
            padding: "25px",
            background: "#f5f5f5",
            borderRadius: "8px",
          }}
        >
          <h2>Players In Room ({Object.keys(players).length})</h2>
          <ul
            style={{
              listStyleType: "none",
              padding: 0,
              margin: "15px 0",
              textAlign: "left",
            }}
          >
            {Object.entries(players).map(([id, p]) => (
              <li
                key={id}
                style={{
                  padding: "8px 12px",
                  marginBottom: "5px",
                  background: "white",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  {p.name} {id === hostId && "👑 (Host)"}
                </span>
                <span style={{ color: "#888" }}>Ready</span>
              </li>
            ))}
          </ul>
          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={Object.keys(players).length < 2}
              style={{
                width: "100%",
                padding: "12px",
                background:
                  Object.keys(players).length < 2 ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "5px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor:
                  Object.keys(players).length < 2 ? "not-allowed" : "pointer",
              }}
            >
              {Object.keys(players).length < 2
                ? "Waiting for Players..."
                : "Start Match Now ⚡"}
            </button>
          ) : (
            <p style={{ color: "#666", fontStyle: "italic" }}>
              Waiting for the host to start the game...
            </p>
          )}
        </div>
      )}

      {/* --- PLAYING STATE --- */}
      {gameState === "playing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Dynamic Multi-player Live Leaderboard */}
          <div
            style={{
              background: "#eef2f3",
              padding: "15px",
              borderRadius: "8px",
              textAlign: "left",
            }}
          >
            <span
              style={{ fontSize: "13px", fontWeight: "bold", color: "#666" }}
            >
              🏆 LIVE RANKINGS
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginTop: "10px",
              }}
            >
              {sortedLeaderboard.map(([id, p], index) => {
                const isMe = id === socketId;
                const percentage = Math.min(
                  ((p.nextNumber - 1) / 9) * 100,
                  100
                );
                return (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ width: "25px", fontWeight: "bold" }}>
                      #{index + 1}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        position: "relative",
                        background: "#ddd",
                        height: "24px",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          background: isMe ? "#2196F3" : "#f0ad4e",
                          height: "100%",
                          transition: "width 0.15s ease",
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          left: "8px",
                          top: "2px",
                          fontSize: "13px",
                          fontWeight: "bold",
                          color: "#111",
                        }}
                      >
                        {p.name} {isMe && "(You)"} — Tile:{" "}
                        {p.nextNumber <= 9 ? p.nextNumber : "Done!"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3x3 Interaction Board */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              margin: "10px auto",
              width: "320px",
            }}
          >
            {grid.map((num, idx) => {
              const isClicked = num < myProgress;
              return (
                <button
                  key={idx}
                  onClick={() => handleTileClick(num)}
                  disabled={isClicked}
                  style={{
                    height: "90px",
                    fontSize: "28px",
                    fontWeight: "bold",
                    cursor: isClicked ? "not-allowed" : "pointer",
                    backgroundColor: isClicked ? "#e0e0e0" : "#4FFFB0",
                    color: isClicked ? "#9e9e9e" : "#111",
                    border: isClicked ? "2px solid #bdbdbd" : "2px solid #222",
                    borderRadius: "10px",
                    boxShadow: isClicked ? "none" : "0 4px 0 #222",
                    transform: isClicked ? "translateY(4px)" : "none",
                    transition: "all 0.05s ease",
                  }}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- OVER STATE --- */}
      {gameState === "over" && (
        <div
          style={{
            padding: "30px",
            background: "#fff",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          }}
        >
          <h2>Match Finished!</h2>
          <h1 style={{ color: "#4CAF50", margin: "15px 0" }}>{winner} Wins!</h1>

          <div
            style={{
              marginTop: "25px",
              padding: "15px",
              background: "#f9f9f9",
              borderRadius: "5px",
            }}
          >
            {isRematchRequested ? (
              <p style={{ fontStyle: "italic", color: "#666", margin: 0 }}>
                Waiting for all players to accept rematch...
              </p>
            ) : (
              <button
                onClick={handlePlayAgain}
                style={{
                  padding: "12px 30px",
                  fontSize: "18px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Vote Rematch
              </button>
            )}

            <div
              style={{ marginTop: "15px", fontSize: "14px", textAlign: "left" }}
            >
              <strong>Rematch Votes:</strong>
              {Object.values(players).map((p, i) => (
                <div
                  key={i}
                  style={{ color: p.readyForRematch ? "#4CAF50" : "#888" }}
                >
                  ● {p.name}:{" "}
                  {p.readyForRematch ? "Ready for round 2!" : "Deciding..."}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
