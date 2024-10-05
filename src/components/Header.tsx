import React from "react";

const Header: React.FC = () => {
  return (
    <header className="bg-primary text-primary-foreground p-4">
      <div className="container mx-auto flex justify-between items-center">
        notqueens
        <nav>Home</nav>
      </div>
    </header>
  );
};

export default Header;
