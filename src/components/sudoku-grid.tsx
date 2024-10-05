import React, { useState, useRef, useCallback, useMemo } from "react";
import { X, Crown } from "lucide-react";

type CellState = "" | "x" | "crown";
type Grid<T> = T[][];

interface SudokuGridComponentProps {
  regions: number[][];
  solution: number[][];
}

const GRID_SIZE = 6;
const COLORS = [
  "bg-red-200",
  "bg-blue-200",
  "bg-green-200",
  "bg-yellow-200",
  "bg-purple-200",
  "bg-orange-200",
  "bg-pink-200",
  "bg-brown-200",
  "bg-gray-200",
] as const;

const createGrid = <T,>(size: number, defaultValue: T): Grid<T> =>
  Array.from({ length: size }, () => Array(size).fill(defaultValue));

const directions = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export function SudokuGridComponent({
  regions,
  solution,
}: SudokuGridComponentProps) {
  const [grid, setGrid] = useState<Grid<CellState>>(() =>
    createGrid(GRID_SIZE, "")
  );
  const [touchingQueens, setTouchingQueens] = useState<Grid<boolean>>(() =>
    createGrid(GRID_SIZE, false)
  );
  const [conflictingQueens, setConflictingQueens] = useState<Grid<boolean>>(
    () => createGrid(GRID_SIZE, false)
  );
  const [solved, setSolved] = useState(false);
  const isDragging = useRef(false);

  const checkTouchingQueens = useCallback((newGrid: Grid<CellState>) => {
    const newTouchingQueens = createGrid(GRID_SIZE, false);

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (newGrid[row][col] === "crown") {
          for (const [dx, dy] of directions) {
            const newRow = row + dx;
            const newCol = col + dy;
            if (
              newRow >= 0 &&
              newRow < GRID_SIZE &&
              newCol >= 0 &&
              newCol < GRID_SIZE
            ) {
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
  }, []);

  const checkConflictingQueens = useCallback((newGrid: Grid<CellState>) => {
    const newConflictingQueens = createGrid(GRID_SIZE, false);

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (newGrid[row][col] === "crown") {
          // Check row and column
          for (let i = 0; i < GRID_SIZE; i++) {
            if (i !== col && newGrid[row][i] === "crown") {
              newConflictingQueens[row][col] = newConflictingQueens[row][i] =
                true;
            }
            if (i !== row && newGrid[i][col] === "crown") {
              newConflictingQueens[row][col] = newConflictingQueens[i][col] =
                true;
            }
          }
        }
      }
    }

    setConflictingQueens(newConflictingQueens);
  }, []);

  const checkSolution = useCallback(
    (newGrid: Grid<CellState>) => {
      const queensCount = newGrid
        .flat()
        .filter((cell) => cell === "crown").length;
      if (queensCount !== GRID_SIZE) return;

      const correct = !newGrid.some((row, rowIndex) =>
        row.some(
          (cell, colIndex) =>
            cell === "crown" && conflictingQueens[rowIndex][colIndex]
        )
      );

      setSolved(correct);
    },
    [conflictingQueens]
  );

  const updateGrid = useCallback(
    (row: number, col: number) => {
      setGrid((prevGrid) => {
        const newGrid = prevGrid.map((r) => [...r]);
        const currentState = newGrid[row][col];
        newGrid[row][col] =
          currentState === "" ? "x" : currentState === "x" ? "crown" : "";

        checkTouchingQueens(newGrid);
        checkConflictingQueens(newGrid);
        checkSolution(newGrid);

        return newGrid;
      });
    },
    [checkTouchingQueens, checkConflictingQueens, checkSolution]
  );

  const handleTouchStart = useCallback(
    (row: number, col: number) => {
      isDragging.current = true;
      updateGrid(row, col);
    },
    [updateGrid]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
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
          updateGrid(r, c);
        }
      }
    },
    [grid, updateGrid]
  );

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  const getCellClassName = useCallback(
    (rowIndex: number, colIndex: number, cellState: CellState) => {
      const baseClasses =
        "aspect-square border border-gray-300 flex items-center justify-center text-2xl font-bold cursor-pointer touch-none";
      const colorClass = COLORS[regions[rowIndex][colIndex]];
      const stateClass =
        touchingQueens[rowIndex][colIndex] ||
        conflictingQueens[rowIndex][colIndex]
          ? "bg-red-500"
          : solved && cellState === "crown"
          ? "bg-green-500"
          : "";

      return `${baseClasses} ${colorClass} ${stateClass}`;
    },
    [regions, touchingQueens, conflictingQueens, solved]
  );

  const renderCell = useCallback(
    (cellState: CellState, rowIndex: number, colIndex: number) => {
      if (cellState === "x") return <X className="w-6 h-6" />;
      if (cellState === "crown") {
        const crownClass =
          touchingQueens[rowIndex][colIndex] ||
          conflictingQueens[rowIndex][colIndex] ||
          (solved && cellState === "crown")
            ? "text-white"
            : "";
        return <Crown className={`w-6 h-6 ${crownClass}`} />;
      }
      return null;
    },
    [touchingQueens, conflictingQueens, solved]
  );

  return (
    <div className="grid grid-cols-6 gap-1 w-full max-w-md mx-auto">
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className={getCellClassName(rowIndex, colIndex, cell)}
            onTouchStart={() => handleTouchStart(rowIndex, colIndex)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => updateGrid(rowIndex, colIndex)}
            data-row={rowIndex}
            data-col={colIndex}
          >
            {renderCell(cell, rowIndex, colIndex)}
          </div>
        ))
      )}
    </div>
  );
}
