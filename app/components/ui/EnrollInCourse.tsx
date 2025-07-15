"use client";

import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
} from "@mui/material";
import React, { useState } from "react";

interface EnrollInCourseProps {
  enrollAction: (formData: FormData) => Promise<
    | {
        error: string;
        success?: undefined;
      }
    | {
        success: boolean;
        error?: undefined;
      }
  >;
}

const EnrollInCourse = ({ enrollAction }: EnrollInCourseProps) => {
  const [enrollModalOpen, setModalOpen] = useState(false);

  const handleOpen = () => {
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const isSuccess = await enrollAction(formData);

    if (isSuccess.error) {
      alert("Course not found");
    }

    handleClose();
  };

  return (
    <div>
      <Button variant="outlined" onClick={handleOpen}>
        + Enroll in a Course
      </Button>
      <Dialog open={enrollModalOpen} onClose={handleClose}>
        <DialogTitle>Enroll in a Course</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <TextField
              autoFocus
              required
              margin="dense"
              id="code"
              name="code"
              label="Course code"
              type="text"
              fullWidth
              variant="standard"
            ></TextField>
            <DialogActions>
              <Button onClick={handleClose}>Cancel</Button>
              <Button type="submit">Enroll</Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnrollInCourse;
