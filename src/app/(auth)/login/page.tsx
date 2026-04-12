import { LoginForm } from "@/components/auth/login-form";
import { DashboardFooter } from "@/components/dashboard/footer";
import { Logo } from "@/components/logo";

export default async function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8 flex-grow flex flex-col justify-center">
        <div className="flex justify-center mb-1.5">
          <Logo className="w-[200px] h-[100px]" />
        </div>
        <LoginForm />
      </div>
      <div className="w-full">
         <DashboardFooter />
      </div>
    </main>
  );
}
