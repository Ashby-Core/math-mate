"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import React, { useState } from "react";

interface AddCourseProps {
  createCourseAction: (formData: FormData) => Promise<
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

const AddCourse = ({ createCourseAction }: AddCourseProps) => {
  const [createCourseModalOpen, setCreateCourseModalOpen] = useState(false);

  const handleOpen = () => {
    setCreateCourseModalOpen(true);
  };

  const handleClose = () => {
    setCreateCourseModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    createCourseAction(formData);

    handleClose();
  };

  return (
    <div>
      <Button variant="outlined" onClick={handleOpen}>
        + Add Course
      </Button>
      <Dialog open={createCourseModalOpen} onClose={handleClose}>
        <DialogTitle>Add New Course</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <TextField
              autoFocus
              required
              margin="dense"
              id="courseName"
              name="courseName"
              label="New course name"
              type="text"
              fullWidth
              variant="standard"
            ></TextField>
            <DialogActions>
              <Button onClick={handleClose}>Cancel</Button>
              <Button type="submit">Create course</Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddCourse;
