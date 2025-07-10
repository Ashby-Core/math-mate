import FormButton from "../components/ui/FormButton";
import TextInput from "../components/ui/TextInput";
import { login } from "../actions/actions";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome back!</h2>
          <p className="mt-2 text-sm text-gray-600">Log in to your account</p>
        </div>
        <form className="mt-8 space-y-6">
          <div className="space-y-4">
            <TextInput
              labelText="Email"
              name="email"
              type="email"
              placeholder="Enter your email"
            />
            <TextInput
              labelText="Password"
              name="password"
              type="password"
              placeholder="Enter your password"
            />
          </div>
          <FormButton text="Log In" formAction={login} />
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
      </div>
    </div>
  );
}
