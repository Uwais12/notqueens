import React from "react";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import { Analytics } from "@vercel/analytics/react";

const App: React.FC = () => {
  return (
    <>
      <Layout>
        <Home />
      </Layout>
      <Analytics />
    </>
  );
};

export default App;
