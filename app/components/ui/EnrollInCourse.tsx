"use client";

import React, { useState } from "react";
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

interface EnrollInCourseProps {
  enrollAction: (formData: FormData) => Promise<
    | { error: string; success?: undefined }
    | { success: boolean; error?: undefined }
  >;
}

const EnrollInCourse = ({ enrollAction }: EnrollInCourseProps) => {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const result = await enrollAction(formData);

    if (result.error) {
      alert("Course not found");
    }

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="text-orange-400 border-orange-200 font-semibold hover:bg-orange-50 rounded-xl shadow-xs"
        >
          + Enroll in a Course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll in a Course</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Course Code
            </label>
            <Input
              autoFocus
              id="code"
              name="code"
              type="text"
              placeholder="Enter course code"
              required
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Enroll
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EnrollInCourse;
