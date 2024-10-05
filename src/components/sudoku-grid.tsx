"use client";

import { useState, useRef, useMemo } from "react";
import { X, Crown } from "lucide-react";
import { generateGame } from "../lib/test";

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

export function SudokuGridComponent({ regions }) {
  const regionsGrid = regions;
  console.log(regionsGrid, regions);
  const [grid, setGrid] = useState<CellState[][]>(
    Array(6)
      .fill(null)
      .map(() => Array(6).fill(""))
  );
  const isDragging = useRef(false);

  const cycleState = (row: number, col: number) => {
    setGrid((prevGrid) => {
      const newGrid = [...prevGrid];
      const currentState = newGrid[row][col];
      if (currentState === "") newGrid[row][col] = "x";
      else if (currentState === "x") newGrid[row][col] = "crown";
      else newGrid[row][col] = "";
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
            }`}
            onTouchStart={() => handleTouchStart(rowIndex, colIndex)}
            onTouchMove={(e) => handleTouchMove(e, rowIndex, colIndex)}
            onTouchEnd={handleTouchEnd}
            onClick={() => cycleState(rowIndex, colIndex)}
            data-row={rowIndex}
            data-col={colIndex}
          >
            {cell === "x" && <X className="w-6 h-6" />}
            {cell === "crown" && <Crown className="w-6 h-6" />}
          </div>
        ))
      )}
    </div>
  );
}
