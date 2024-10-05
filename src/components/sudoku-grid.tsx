import { useState, useRef } from "react";
import { X, Crown } from "lucide-react";

type CellState = "" | "x" | "crown";
const nineColours = [
  "bg-red-200",
  "bg-blue-200",
  "bg-green-200",
  "bg-yellow-200",
  "bg-purple-200",
  "bg-orange-200",
  "bg-pink-200",
  "bg-brown-200",
  "bg-gray-200",
];

export function SudokuGridComponent({
  regions,
  solution,
}: {
  regions: number[][];
  solution: number[][];
}) {
  const regionsGrid = regions;
  console.log(regionsGrid, regions);
  const [grid, setGrid] = useState<CellState[][]>(
    Array(6)
      .fill(null)
      .map(() => Array(6).fill(""))
  );
  const isDragging = useRef(false);
  const [touchingQueens, setTouchingQueens] = useState<boolean[][]>(
    Array(6)
      .fill(null)
      .map(() => Array(6).fill(false))
  );
  const [conflictingQueens, setConflictingQueens] = useState<boolean[][]>(
    Array(6)
      .fill(null)
      .map(() => Array(6).fill(false))
  );
  const [solved, setSolved] = useState(false);

  const checkTouchingQueens = (newGrid: CellState[][]) => {
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    const newTouchingQueens = Array(6)
      .fill(null)
      .map(() => Array(6).fill(false));

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        if (newGrid[row][col] === "crown") {
          for (const [dx, dy] of directions) {
            const newRow = row + dx;
            const newCol = col + dy;
            if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 6) {
              if (newGrid[newRow][newCol] === "crown") {
                newTouchingQueens[row][col] = true;
                newTouchingQueens[newRow][newCol] = true;
              }
            }
          }
        }
      }
    }

    setTouchingQueens(newTouchingQueens);
  };

  const checkConflictingQueens = (newGrid: CellState[][]) => {
    const newConflictingQueens = Array(6)
      .fill(null)
      .map(() => Array(6).fill(false));

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        if (newGrid[row][col] === "crown") {
          // Check row
          for (let c = 0; c < 6; c++) {
            if (c !== col && newGrid[row][c] === "crown") {
              newConflictingQueens[row][col] = true;
              newConflictingQueens[row][c] = true;
            }
          }
          // Check column
          for (let r = 0; r < 6; r++) {
            if (r !== row && newGrid[r][col] === "crown") {
              newConflictingQueens[row][col] = true;
              newConflictingQueens[r][col] = true;
            }
          }
        }
      }
    }

    setConflictingQueens(newConflictingQueens);
  };

  const checkSolution = (newGrid: CellState[][]) => {
    //check if num of queens is correct
    const queensCount = newGrid
      .flat()
      .filter((cell) => cell === "crown").length;
    if (queensCount !== 6) return; // Only check when there are 6 queens

    // set solved to true, check for conflicting queens, if conflicting queens, set solved to false
    let correct = true;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        if (newGrid[row][col] === "crown" && conflictingQueens[row][col]) {
          correct = false;
        }
      }
    }
    setSolved(correct);
  };

  const cycleState = (row: number, col: number) => {
    setGrid((prevGrid) => {
      const newGrid = [...prevGrid];
      const currentState = newGrid[row][col];
      if (currentState === "") newGrid[row][col] = "x";
      else if (currentState === "x") newGrid[row][col] = "crown";
      else newGrid[row][col] = "";

      // Check for touching queens and conflicting queens after updating the grid
      checkTouchingQueens(newGrid);
      checkConflictingQueens(newGrid);
      checkSolution(newGrid);

      return newGrid;
    });
  };

  const handleTouchStart = (row: number, col: number) => {
    isDragging.current = true;
    cycleState(row, col);
  };

  const handleTouchMove = (e: React.TouchEvent, row: number, col: number) => {
    if (!isDragging.current) return;

    const touch = e.touches[0];
    const element = document.elementFromPoint(
      touch.clientX,
      touch.clientY
    ) as HTMLElement;
    const cellRow = element.dataset.row;
    const cellCol = element.dataset.col;

    if (cellRow !== undefined && cellCol !== undefined) {
      const r = parseInt(cellRow);
      const c = parseInt(cellCol);
      if (grid[r][c] === "") {
        setGrid((prevGrid) => {
          const newGrid = [...prevGrid];
          newGrid[r][c] = "x";
          return newGrid;
        });
      }
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const findRegionFromCell = (row: number, col: number) => {
    return regionsGrid[row][col];
  };

  return (
    <div className="grid grid-cols-6 gap-1 w-full max-w-md mx-auto">
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className={`aspect-square border border-gray-300 flex items-center justify-center text-2xl font-bold cursor-pointer touch-none ${
              nineColours[findRegionFromCell(rowIndex, colIndex)]
            } ${
              touchingQueens[rowIndex][colIndex] ||
              conflictingQueens[rowIndex][colIndex]
                ? "bg-red-500"
                : solved && cell === "crown"
                ? "bg-green-500"
                : ""
            }`}
            onTouchStart={() => handleTouchStart(rowIndex, colIndex)}
            onTouchMove={(e) => handleTouchMove(e, rowIndex, colIndex)}
            onTouchEnd={handleTouchEnd}
            onClick={() => cycleState(rowIndex, colIndex)}
            data-row={rowIndex}
            data-col={colIndex}
          >
            {cell === "x" && <X className="w-6 h-6" />}
            {cell === "crown" && (
              <Crown
                className={`w-6 h-6 ${
                  touchingQueens[rowIndex][colIndex] ||
                  conflictingQueens[rowIndex][colIndex] ||
                  (solved && cell === "crown")
                    ? "text-white"
                    : ""
                }`}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}
