import React from "react";
import { SudokuGridComponent } from "./sudoku-grid";
import { generateGame } from "@/lib/gameFunctions";

function GameGrid() {
  const gridSize = 6;
  //   const regionSizes = getRegionSizes(gridSize);
  //   const regions = fillRegionsNew(regionSizes);
  const [regions, initialCells] = generateGame(gridSize);
  console.log(regions);
  console.log("SOLUTION: ", initialCells);
  return (
    <div className="w-100 aspect-square">
      <SudokuGridComponent
        regions={regions}
        solution={Object.keys(initialCells).map((key) =>
          key.split(",").map((num) => parseInt(num))
        )}
      />
    </div>
  );
}

export default GameGrid;
// initialCells: {
//   "1,0": true,
//   "2,3": true,
//   "0,4": true,
//   "4,2": true,
//   "5,1": true,
//   "3,5": true
// }
// solution: [
//   [1, 0],
//   [2, 3],
//   [0, 4],
//   [4, 2],
//   [5, 1],
//   [3, 5]
// ]
