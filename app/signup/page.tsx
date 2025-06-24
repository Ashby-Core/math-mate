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
                type="text"
                placeholder="Enter your first name"
              />
              <TextInput
                labelText="Last Name"
                type="text"
                placeholder="Enter your last name"
              />
            </div>
            <TextInput
              labelText="Email"
              type="email"
              placeholder="Enter your email"
            />
            <TextInput
              labelText="Username"
              type="text"
              placeholder="Enter your username"
            />
            <Dropdown
              labelText="Demographic"
              name="demographic"
              options={[
                "White",
                "Black/African American",
                "Asian/Pacific Islander",
                "Hispanic or Latino",
                "American Indian or Alaska Native",
                "Two or more races",
                "Other/Prefer Not to Say",
              ]}
            />
            <TextInput
              labelText="Password"
              type="password"
              placeholder="Enter your password"
            />
            <TextInput
              labelText="Confirm password"
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
