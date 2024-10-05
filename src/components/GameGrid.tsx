import React from "react";
import { SudokuGridComponent } from "./sudoku-grid";
import { generateGame } from "@/lib/gameFunctions";

function GameGrid() {
  const gridSize = 6;
  //   const regionSizes = getRegionSizes(gridSize);
  //   const regions = fillRegionsNew(regionSizes);
  const regions = generateGame(gridSize);
  console.log(regions);
  return (
    <div className="w-100 aspect-square">
      <SudokuGridComponent regions={regions} />
    </div>
  );
}

export default GameGrid;
