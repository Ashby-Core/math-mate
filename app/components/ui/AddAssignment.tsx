"use client";

import { Button } from "@mui/material";
import React from "react";
import { useRouter, usePathname } from "next/navigation";

const AddAssignment = () => {
  const router = useRouter();
  const pathname = usePathname();

  const handleAppendSegment = () => {
    router.push(`${pathname}/assignments/create`);
  };

  return (
    <div>
      <Button variant="outlined" onClick={handleAppendSegment}>
        + Add Assignment
      </Button>
    </div>
  );
};

export default AddAssignment;
