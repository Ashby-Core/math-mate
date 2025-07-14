import React from "react";
import Logo from "../ui/Logo";
import Navlink from "../ui/Navlink";
import Logout from "../ui/Logout";

const UserNavbar = () => {
  return (
    <nav className="bg-red-300 w-full flex justify-between items-center px-6 py-4">
      <div className="flex items-center gap-6">
        <Logo />
        <Navlink text="Settings" />
        <Navlink text="Contact" />
      </div>

      <div className="flex items-center gap-4">
        <Logout />
      </div>
    </nav>
  );
};

export default UserNavbar;
