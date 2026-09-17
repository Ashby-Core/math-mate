import LoginForm from "./LoginForm";
import { AuthPageChrome } from "@/app/components/auth-page-chrome";

export default function LoginPage() {
  return (
    <AuthPageChrome heading="Welcome back!" subheading="Log in to your account">
      <LoginForm />
    </AuthPageChrome>
  );
}
