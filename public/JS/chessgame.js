// Client-side JavaScript

const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let gameId = null;

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";
    board.forEach((row, rowindex) => {
        row.forEach((square, squareindex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add(
                "square",
                (rowindex + squareindex) % 2 === 0 ? "light" : "dark"
            );

            squareElement.dataset.row = rowindex;
            squareElement.dataset.col = squareindex;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add(
                    "piece",
                    (square.color === "w") ? "white" : "black"
                );

                pieceElement.innerHTML = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowindex, col: squareindex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                pieceElement.addEventListener("touchstart", (e) => {
                    if (pieceElement.draggable) {
                        e.preventDefault(); // Prevent default touch behavior
                        draggedPiece = pieceElement;
                        sourceSquare = getSquareFromTouch(e.changedTouches[0]);
                    }
                });
                
                pieceElement.addEventListener("touchend", (e) => {
                    if (draggedPiece) {
                        const touch = e.changedTouches[0];
                        const targetSquare = getSquareFromTouch(touch);
                        if (targetSquare) {
                            handleMove(sourceSquare, targetSquare);
                        }
                        draggedPiece = null;
                        sourceSquare = null;
                    }
                });
                
                pieceElement.addEventListener("touchmove", (e) => {
                    e.preventDefault(); // Prevent default touch behavior
                });
                
                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };

                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    if (playerRole === "b") {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }
};

const getSquareFromTouch = (touch) => {
    const rect = boardElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const boardWidth = rect.width;
    const boardHeight = rect.height;

    // Calculate the size of each square
    const squareSize = Math.min(boardWidth, boardHeight) / 8;

    // Calculate column and row based on touch coordinates
    let col = Math.floor(x / squareSize);
    let row = Math.floor(y / squareSize);

    // Adjust row if the board is flipped
    if (playerRole === 'b') {
        row = 7 - row; // Reverse the row index for black pieces
    }
    if (playerRole === 'b') {
        col = 7 - col; // Reverse the row index for black pieces
    }

    // Ensure that the calculated coordinates are within the board's bounds
    const validCol = Math.max(0, Math.min(7, col));
    const validRow = Math.max(0, Math.min(7, row));

    console.log(`Touch coordinates: (${touch.clientX}, ${touch.clientY}), Board square: (${validRow}, ${validCol})`);

    return { row: validRow, col: validCol };
};





const handleMove = (source, target) => {
    if (!source || !target) {
        console.error("Source or target is null");
        return;
    }

    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q',
    };

    console.log("Sending move:", move);

    socket.emit("move", { move, gameId });
};


const getPieceUnicode = (piece) => {
    const unicodePieces = {
        p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
        P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
    };

    return unicodePieces[piece.type] || "";
};

socket.on("playerRole", (data) => {
    playerRole = data.color;
    gameId = data.gameId;
    renderBoard();
});

socket.on("spectatorRole", () => {
    playerRole = null;
    renderBoard();
});

socket.on("boardState", (fen) => {
    chess.load(fen);
    renderBoard();
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
});

socket.on("invalidMove", (move) => {
    console.error("Invalid move received:", move);
    renderBoard();
});

socket.on("waiting", (message) => {
    console.log(message); 
});

socket.on("opponentDisconnected", () => {
    console.log("Opponent disconnected");
    chess.reset();
    playerRole = null;
    gameId = null;
    renderBoard();
});

renderBoard();
