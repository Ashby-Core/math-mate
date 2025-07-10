"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { UUID } from "crypto";
import React, { useState } from "react";

interface AddAssignmentProps {
  courseId: UUID;
  createAssignmentAction: (formData: FormData, courseId: UUID) => Promise<
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

const AddAssignment = ({ courseId, createAssignmentAction }: AddAssignmentProps) => {
  const [createAssignmentModalOpen, setCreateAssignmentModalOpen] =
    useState(false);

  const handleOpen = () => {
    setCreateAssignmentModalOpen(true);
  };

  const handleClose = () => {
    setCreateAssignmentModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    createAssignmentAction(formData, courseId);

    handleClose();
  };

  return (
    <div>
      <Button variant="outlined" onClick={handleOpen}>
        + Add Assignment
      </Button>
      <Dialog open={createAssignmentModalOpen} onClose={handleClose}>
        <DialogTitle>Add New Assignment</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <TextField
              autoFocus
              required
              margin="dense"
              id="title"
              name="title"
              label="Title"
              type="text"
              fullWidth
              variant="standard"
            ></TextField>
            <TextField
              autoFocus
              required
              margin="dense"
              id="topics"
              name="topics"
              label="Topic(s) (separate topics with ',')"
              type="text"
              fullWidth
              variant="standard"
            ></TextField>
            <TextField
              autoFocus
              required
              margin="dense"
              id="dueDate"
              name="dueDate"
              label="Due Date"
              type="date"
              fullWidth
              variant="standard"
            ></TextField>
            <label htmlFor="minQuestions">Min Questions</label>
            <input id="minQuestions" name="minQuestions" type="number" />
            <label htmlFor="maxQuestions">Max Questions</label>
            <input id="maxQuestions" name="maxQuestions" type="number" />
            <DialogActions>
              <Button onClick={handleClose}>Cancel</Button>
              <Button type="submit">Create assignment</Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddAssignment;
