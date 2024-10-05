import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
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
  const [isInteracting, setIsInteracting] = useState(false);
  const lastInteractionTimeRef = useRef(0);
  const lastInteractedCellRef = useRef<[number, number] | null>(null);

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

      if (queensCount !== GRID_SIZE) {
        setSolved(false);
        return;
      }

      const hasConflicts = newGrid.some((row, rowIndex) =>
        row.some(
          (cell, colIndex) =>
            cell === "crown" && conflictingQueens[rowIndex][colIndex]
        )
      );

      setSolved(!hasConflicts);
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

  const handleInteraction = useCallback(
    (row: number, col: number) => {
      const now = Date.now();
      if (
        now - lastInteractionTimeRef.current > 50 && // Reduce debounce time
        (lastInteractedCellRef.current?.[0] !== row ||
          lastInteractedCellRef.current?.[1] !== col)
      ) {
        updateGrid(row, col);
        lastInteractionTimeRef.current = now;
        lastInteractedCellRef.current = [row, col];
      }
    },
    [updateGrid]
  );

  const startInteraction = useCallback(
    (row: number, col: number, e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsInteracting(true);
      handleInteraction(row, col);
    },
    [handleInteraction]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isInteracting) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const element = document.elementFromPoint(
        clientX,
        clientY
      ) as HTMLElement;
      const cellRow = element?.dataset.row;
      const cellCol = element?.dataset.col;

      if (cellRow !== undefined && cellCol !== undefined) {
        const r = parseInt(cellRow);
        const c = parseInt(cellCol);
        handleInteraction(r, c);
      }
    },
    [isInteracting, handleInteraction]
  );

  const stopInteraction = useCallback(() => {
    setIsInteracting(false);
    lastInteractedCellRef.current = null;
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", stopInteraction);
    document.addEventListener("touchend", stopInteraction);
    return () => {
      document.removeEventListener("mouseup", stopInteraction);
      document.removeEventListener("touchend", stopInteraction);
    };
  }, [stopInteraction]);

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

  const cellRenderer = useCallback(
    (rowIndex: number, colIndex: number) => {
      const cell = grid[rowIndex][colIndex];
      return (
        <div
          key={`${rowIndex}-${colIndex}`}
          className={getCellClassName(rowIndex, colIndex, cell)}
          onMouseDown={(e) => startInteraction(rowIndex, colIndex, e)}
          onTouchStart={(e) => startInteraction(rowIndex, colIndex, e)}
          data-row={rowIndex}
          data-col={colIndex}
        >
          {renderCell(cell, rowIndex, colIndex)}
        </div>
      );
    },
    [grid, getCellClassName, renderCell, startInteraction]
  );

  return (
    <div
      className="grid grid-cols-6 gap-1 w-full max-w-md mx-auto"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {grid.map((row, rowIndex) =>
        row.map((_, colIndex) => cellRenderer(rowIndex, colIndex))
      )}
    </div>
  );
}
