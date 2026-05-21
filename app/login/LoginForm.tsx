"use client";

import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { login } from "../queries/actions";
import { useState } from "react";

export default function LoginForm() {
  const [errorText, setErrorText] = useState("");
  const showError = (errorCode: string) => {
    switch (errorCode) {
      case "invalid_credentials":
        setErrorText("Invalid email or password.");
        break;
      default:
        setErrorText("There was an error signing you in");
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setErrorText("")
    const errorCode = await login(formData);
    if (errorCode) {
      showError(errorCode);
    }
  };
  return (
    <form action={handleSubmit} className="mt-8 space-y-6">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <Input
            id="email"
            className={`${errorText && "border-red-500"}`}
            name="email"
            type="email"
            placeholder="Enter your email"
            required
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <Input
            id="password"
            className={`${errorText && "border-red-500"}`}
            name="password"
            type="password"
            placeholder="Enter your password"
            required
          />
        </div>
        {errorText && <p className="text-red-500 text-sm">{errorText}</p>}
      </div>
      <Button
        type="submit"
        className="w-full bg-red-600 hover:bg-red-700 text-white"
      >
        Log In
      </Button>
      <div className="text-center">
        <p className="text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <a
            href="/signup"
            className="font-medium text-red-600 hover:text-red-500"
          >
            Sign up
          </a>
        </p>
      </div>
    </form>
  );
}
