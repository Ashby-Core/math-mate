import Dropdown from "../components/ui/Dropdown";
import FormButton from "../components/ui/FormButton";
import TextInput from "../components/ui/TextInput";
import { signup } from "./actions";

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
        <form className="mt-8 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <TextInput
                labelText="First Name"
                name="first-name"
                type="text"
                placeholder="Enter your first name"
              />
              <TextInput
                labelText="Last Name"
                name="last-name"
                type="text"
                placeholder="Enter your last name"
              />
            </div>
            <TextInput
              labelText="Email"
              name="email"
              type="email"
              placeholder="Enter your email"
            />
            <TextInput
              labelText="Username"
              name="username"
              type="text"
              placeholder="Enter your username"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                I am a
              </label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    id="student"
                    name="role"
                    type="radio"
                    value="student"
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                    required
                  />
                  <label
                    htmlFor="student"
                    className="ml-2 text-sm text-gray-900"
                  >
                    Student
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="teacher"
                    name="role"
                    type="radio"
                    value="teacher"
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                    required
                  />
                  <label
                    htmlFor="teacher"
                    className="ml-2 text-sm text-gray-900"
                  >
                    Teacher
                  </label>
                </div>
              </div>
            </div>
            <Dropdown
              labelText="Demographic"
              name="demographic"
              options={[
                "white",
                "black/african american",
                "asian/pacific islander",
                "hispanic or latino",
                "american indian or alaska native",
                "two or more races",
                "other/prefer not to say",
              ]}
            />
            <TextInput
              labelText="Password"
              name="password"
              type="password"
              placeholder="Enter your password"
            />
            <TextInput
              labelText="Confirm password"
              name="confirm-password"
              type="password"
              placeholder="Confirm your password"
            />
          </div>
          <FormButton text="Sign Up" formAction={signup} />
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
