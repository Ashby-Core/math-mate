import React from "react";
import Logo from "../ui/Logo";
import Navlink from "../ui/Navlink";
import { Button } from "@mui/material";

const LandingPageNavbar = () => {
  return (
    <nav className="bg-red-200 w-full flex justify-between items-center px-6 py-4">
      <div className="flex items-center gap-6">
        <Logo />
        <Navlink text="About Us" />
        <Navlink text="Contact" />
      </div>

      <div className="flex items-center gap-4">
        <Button
          className="py-2 px-4 bg-orange-50 text-sm font-lg text-orange-700 transition hover:bg-orange-700 hover:text-orange-50 hover:cursor-pointer"
          href="/login"
        >
          Log In
        </Button>
        <Button
          className="py-2 px-4 bg-orange-50 text-sm font-lg text-orange-700 transition hover:bg-orange-700 hover:text-orange-50 hover:cursor-pointer"
          href="/signup"
        >
          Sign Up
        </Button>
      </div>
    </nav>
  );
};

export default LandingPageNavbar;
