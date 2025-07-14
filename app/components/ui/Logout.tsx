import { logout } from "@/app/actions/actions";
import { Button } from "@mui/material";
import React from "react";

const Logout = () => {
  return (
    <Button
      className="py-2 px-4 border-red-700 bg-transparent text-sm font-medium text-white transition hover:bg-red-400 hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      onClick={logout}
      variant="outlined"
    >
      Log Out
    </Button>
  );
};

export default Logout;
