import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Cell = [number, number];
type CellSet = Cell[];
type Grid = number[][];

const directions: Cell[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]; // up, down, left, right

console.time("generating coordinate sets");
const coordinateSets: CellSet[][] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
  (n) => generateCoordinateSets(n)
);
console.timeEnd("generating coordinate sets");

/**
 * Generates an n x n grid of empty strings
 * @param n The size of the grid (n x n)
 * @returns A 2D array representing the grid
 */
function generateEmptyGrid(n: number = 6): Grid {
  return Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));
}

export function generateGame(n: number = 6): Grid {
  const grid = generateEmptyGrid(n);
  const availableRows = new Set(Array.from({ length: n }, (_, i) => i));
  const availableCols = new Set(Array.from({ length: n }, (_, i) => i));
  const initialCells: { [key: string]: boolean } = {};
  const markedCells: Cell[] = [];
  const candidateCells = new Set<string>();

  for (let i = 0; i < n; i++) {
    if (availableRows.size === 0 || availableCols.size === 0) break;

    const row =
      Array.from(availableRows)[Math.floor(Math.random() * availableRows.size)];
    const col =
      Array.from(availableCols)[Math.floor(Math.random() * availableCols.size)];

    grid[row][col] = i + 1; // Change to i + 1 to start numbering from 1
    availableRows.delete(row);
    availableCols.delete(col);
    markedCells.push([row, col]);
    initialCells[`${row},${col}`] = true;
  }

  // Add candidate cells
  for (const [row, col] of markedCells) {
    for (const [dx, dy] of directions) {
      const newRow = row + dx;
      const newCol = col + dy;
      if (
        newRow >= 0 &&
        newRow < n &&
        newCol >= 0 &&
        newCol < n &&
        grid[newRow][newCol] === 0
      ) {
        candidateCells.add(`${newRow},${newCol}`);
      }
    }
  }

  // Convert candidate cells back to array of coordinates
  const candidateArray: Cell[] = Array.from(candidateCells).map(
    (coord) => coord.split(",").map(Number) as Cell
  );

  while (candidateArray.length > 0) {
    // Select a random cell from candidateArray
    const randomIndex = Math.floor(Math.random() * candidateArray.length);
    const [row, col] = candidateArray[randomIndex];

    // Find an adjacent cell with a number
    let value;
    for (const [dx, dy] of directions) {
      const adjRow = row + dx;
      const adjCol = col + dy;
      if (
        adjRow >= 0 &&
        adjRow < n &&
        adjCol >= 0 &&
        adjCol < n &&
        grid[adjRow][adjCol] > 0
      ) {
        value = grid[adjRow][adjCol];
        break;
      }
    }

    // Set the value of the selected cell
    if (value) {
      grid[row][col] = value;

      // Remove it from candidateArray
      candidateArray.splice(randomIndex, 1);

      // Add it to markedCells
      markedCells.push([row, col]);

      // Add all adjacent unmarked cells as new candidates
      for (const [dx, dy] of directions) {
        const newRow = row + dx;
        const newCol = col + dy;
        if (
          newRow >= 0 &&
          newRow < n &&
          newCol >= 0 &&
          newCol < n &&
          grid[newRow][newCol] === 0
        ) {
          const newCandidate = `${newRow},${newCol}`;
          if (!candidateCells.has(newCandidate)) {
            candidateCells.add(newCandidate);
            candidateArray.push([newRow, newCol]);
          }
        }
      }
    } else {
      // If no adjacent numbered cell found, remove this candidate
      candidateArray.splice(randomIndex, 1);
    }
  }

  function isCellInList(cell: Cell, list: { [key: string]: boolean }): boolean {
    return list[`${cell[0]},${cell[1]}`];
  }

  function areAllRegionsConnected(grid: Grid) {
    function dfs(
      grid: Grid,
      row: number,
      col: number,
      value: number,
      visited: boolean[][]
    ) {
      if (
        row < 0 ||
        row >= grid.length ||
        col < 0 ||
        col >= grid.length ||
        visited[row][col] ||
        grid[row][col] !== value
      ) {
        return;
      }

      visited[row][col] = true;

      dfs(grid, row - 1, col, value, visited);
      dfs(grid, row + 1, col, value, visited);
      dfs(grid, row, col - 1, value, visited);
      dfs(grid, row, col + 1, value, visited);
    }
    const n = grid.length;
    const visited = Array(n)
      .fill(null)
      .map(() => Array(n).fill(false));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (!visited[i][j]) {
          const value = grid[i][j];
          dfs(grid, i, j, value, visited);

          // Check if all cells with this value are visited
          for (let x = 0; x < n; x++) {
            for (let y = 0; y < n; y++) {
              if (grid[x][y] === value && !visited[x][y]) {
                return false; // Found an unconnected cell with the same value
              }
            }
          }
        }
      }
    }
    return true;
  }

  let possibleSolutions: CellSet[] = findPossibleSolutions(grid);
  console.log("possible solutions: ", possibleSolutions.length);

  let cellChanged = false;

  while (possibleSolutions.length > 1) {
    console.log("while loop");
    for (const possibleSolution of possibleSolutions) {
      console.log("==== possible solution ====");
      if (cellChanged) {
        break;
      }
      for (const cell of possibleSolution) {
        console.log("======== cell =========");
        if (cellChanged) {
          break;
        }
        if (isCellInList(cell, initialCells)) {
          continue;
        }
        const validAdjacentCells = directions
          .map((direction: Cell) => {
            const newCell: Cell = [
              cell[0] + direction[0],
              cell[1] + direction[1],
            ];
            if (
              newCell[0] >= 0 &&
              newCell[0] < n &&
              newCell[1] >= 0 &&
              newCell[1] < n &&
              !isCellInList(newCell, initialCells)
            ) {
              return newCell;
            }
            return null;
          })
          .filter((cell) => cell !== null);

        for (const adjacentCell of validAdjacentCells) {
          console.log("============ adjacentCell =============");
          const originalValue = grid[cell[0]][cell[1]];
          grid[cell[0]][cell[1]] = grid[adjacentCell[0]][adjacentCell[1]];
          if (areAllRegionsConnected(grid)) {
            const newPossibleSolutions = findPossibleSolutions(grid);
            if (
              newPossibleSolutions.length !== 0 &&
              newPossibleSolutions.length < possibleSolutions.length
            ) {
              possibleSolutions = newPossibleSolutions;
              cellChanged = true;
              console.log(
                "cell changed, new possible solutions: ",
                possibleSolutions.length
              );
              break;
            }
          }
          grid[cell[0]][cell[1]] = originalValue;
        }
      }
    }
    if (!cellChanged) {
      break;
    }
    cellChanged = false;
  }
  if (possibleSolutions.length !== 1) {
    console.log("no solution found, lets try again");
    return generateGame(n);
  }
  return [grid, initialCells];
}

function findPossibleSolutions(grid: number[][]) {
  const possibleSolutions = coordinateSets[grid.length];
  const validSolutions: CellSet[] = [];

  for (const solution of possibleSolutions) {
    const regionsused: { [key: string]: boolean } = {};
    let valid = true;
    for (const cell of solution) {
      const [row, col] = cell;
      const value = grid[row][col];
      if (regionsused[value + "s"]) {
        valid = false;
        break;
      }
      regionsused[value + "s"] = true;
    }
    if (valid) {
      validSolutions.push(solution);
    }
  }
  return validSolutions;
}

function generateCoordinateSets(n = 6) {
  const results = [];

  function isValid(set, coord) {
    const [row, col] = coord;
    for (const [r, c] of set) {
      if (r === row || c === col) return false;
      if (Math.abs(r - row) === 1 && Math.abs(c - col) === 1) return false;
    }
    return true;
  }

  function backtrackPruned(set, row, validCols) {
    if (set.length === n) {
      results.push([...set]); // Add a copy of the valid set
      return;
    }

    for (let col = 0; col < n; col++) {
      if (validCols[col]) {
        // Prune invalid branches early
        const coord = [row, col];
        if (isValid(set, coord)) {
          set.push(coord);
          validCols[col] = false; // Mark this column as used
          backtrackPruned(set, row + 1, validCols);
          set.pop();
          validCols[col] = true; // Unmark the column
        }
      }
    }
  }

  const validCols = Array(n).fill(true); // Initialize with all columns valid
  backtrackPruned([], 0, validCols);
  return results;
}
