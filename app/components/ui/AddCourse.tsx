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
      <Button
        className="text-orange-400 border border-orange-200 px-3 font-semibold hover:bg-orange-50 rounded-xl shadow-xs"
        onClick={handleOpen}
      >
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
              color="error"
              type="text"
              fullWidth
              variant="standard"
            ></TextField>
            <DialogActions>
              <Button color="error" onClick={handleClose}>Cancel</Button>
              <Button color="error" type="submit">Create course</Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddCourse;
