import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { signup } from "../actions/actions";

const demographicOptions = [
  "white",
  "black/african american",
  "asian/pacific islander",
  "hispanic or latino",
  "american indian or alaska native",
  "two or more races",
  "other/prefer not to say",
];

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Let&apos;s get started!
          </h2>
          <p className="mt-2 text-sm text-gray-600">Create a new account</p>
        </div>
        <form action={signup} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between gap-4">
              <div className="flex-1">
                <label
                  htmlFor="first-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  First Name
                </label>
                <Input
                  id="first-name"
                  name="first-name"
                  type="text"
                  placeholder="Enter your first name"
                  required
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="last-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Last Name
                </label>
                <Input
                  id="last-name"
                  name="last-name"
                  type="text"
                  placeholder="Enter your last name"
                  required
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                I am a
              </label>
              <RadioGroup name="role" required>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="student" value="student" />
                  <label htmlFor="student" className="text-sm text-gray-900">
                    Student
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="teacher" value="teacher" />
                  <label htmlFor="teacher" className="text-sm text-gray-900">
                    Teacher
                  </label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Demographic
              </label>
              <Combobox name="demographic">
                <ComboboxInput
                  placeholder="Select demographic..."
                  className="w-full"
                />
                <ComboboxContent>
                  <ComboboxList>
                    {demographicOptions.map((option) => (
                      <ComboboxItem key={option} value={option}>
                        {option}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                  <ComboboxEmpty>No results found.</ComboboxEmpty>
                </ComboboxContent>
              </Combobox>
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
                name="password"
                type="password"
                placeholder="Enter your password"
                required
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm password
              </label>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                placeholder="Confirm your password"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            Sign Up
          </Button>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <a
                href="/login"
                className="font-medium text-red-600 hover:text-red-500"
              >
                Log in
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
