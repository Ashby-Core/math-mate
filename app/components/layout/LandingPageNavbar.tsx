import React from "react";
import Logo from "../ui/Logo";
import Navlink from "../ui/Navlink";
import { Button } from "@mui/material";

const LandingPageNavbar = () => {
  return (
    <nav className="bg-red-300 w-full flex justify-between items-center px-6 py-4">
      <div className="flex items-center gap-6">
        <Logo />
        <Navlink text="About Us" />
        <Navlink text="Contact" />
      </div>

      <div className="flex items-center gap-4">
        <Button
          className="py-2 px-4 border-red-700 bg-transparent text-sm font-medium text-white transition hover:bg-red-400 hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          variant="outlined"
          href="/login"
        >
          Login
        </Button>
        <Button
          className="py-2 px-4 border-red-700 bg-transparent text-sm font-medium text-white transition hover:bg-red-400 hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          variant="outlined"
          href="/signup"
        >
          Sign Up
        </Button>
      </div>
    </nav>
  );
};

export default LandingPageNavbar;
