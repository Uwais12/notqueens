import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import GameGrid from "@/components/GameGrid";
const Home: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center flex-grow py-24 px-4 text-center gap-4">
      <Card className="w-full flex flex-col justify-center md:flex-row">
        <div className="w-full md:w-2/3 aspect-square ">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">
              Daily Challenge
            </CardTitle>
            <CardDescription className="text-lg">
              Complete the daily challenge to earn points and climb the
              leaderboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GameGrid />
          </CardContent>
        </div>
        <div className="h-100 border-l-2 border-gray-200 my-14"></div>
        <div className="w-full md:w-1/3">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Your Stats</CardTitle>
            <CardDescription className="text-lg">
              View your stats and progress towards the next level.
            </CardDescription>
          </CardHeader>
        </div>
      </Card>
    </div>
  );
};

export default Home;
