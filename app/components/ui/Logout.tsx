import { logout } from "@/app/actions/actions";
import { Button } from "@mui/material";
import React from "react";

const Logout = () => {
  return (
    <Button onClick={logout} variant="outlined">
      Log Out
    </Button>
  );
};

export default Logout;
