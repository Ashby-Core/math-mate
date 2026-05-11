"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface AddCourseProps {
  createCourseAction: (formData: FormData) => Promise<void>;
}

const AddCourse = ({ createCourseAction }: AddCourseProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="text-orange-400 border-orange-200 font-semibold hover:bg-orange-50 rounded-xl shadow-xs"
        >
          + Add Course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Course</DialogTitle>
        </DialogHeader>
        <form action={createCourseAction}>
          <div className="mb-4">
            <label
              htmlFor="courseName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Course Name
            </label>
            <Input
              autoFocus
              id="courseName"
              name="courseName"
              type="text"
              placeholder="New course name"
              required
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Create Course
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCourse;
