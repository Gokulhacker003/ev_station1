import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Zap, Mail, Lock, User, Phone } from "lucide-react";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(1, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^[+()\-\s\d]+$/, "Invalid phone number"),
});

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;

export function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { signIn, signUp } = useAuth();

  const form = useForm<SignupValues>({
    resolver: zodResolver(isSignUp ? signupSchema : loginSchema),
    defaultValues: { email: "", password: "", fullName: "", phone: "" },
  });

  const onSubmit = async (values: SignupValues) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (isSignUp) {
        await signUp(values.email, values.password, values.fullName, values.phone);
        setSuccess("Check your email to confirm your account!");
        form.reset();
      } else {
        await signIn(values.email, values.password);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto w-full max-w-md"
    >
      <div className="glass rounded-3xl border border-border/70 p-6 shadow-2xl shadow-primary/10 sm:p-8">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/35">
            <Zap className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignUp ? "Create your EV Charge profile in seconds" : "Sign in to continue your charging journey"}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-muted p-1">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(""); setSuccess(""); form.reset(); }}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              !isSignUp ? "bg-background text-foreground shadow" : "text-muted-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(""); setSuccess(""); form.reset(); }}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              isSignUp ? "bg-background text-foreground shadow" : "text-muted-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isSignUp && (
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="John Doe" className="h-11 rounded-xl pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isSignUp && (
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="tel" placeholder="+1 555 123 4567" className="h-11 rounded-xl pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" placeholder="you@example.com" className="h-11 rounded-xl pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="password" placeholder="••••••••" className="h-11 rounded-xl pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-destructive text-center bg-destructive/10 rounded-lg p-2"
              >
                {error}
              </motion.p>
            )}

            {success && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-primary text-center bg-accent rounded-lg p-2"
              >
                {success}
              </motion.p>
            )}

            <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
              {loading ? (
                <motion.div
                  className="flex items-center gap-2"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Zap className="h-4 w-4" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </motion.div>
              ) : (
                <>{isSignUp ? "Sign Up" : "Sign In"}</>
              )}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); setSuccess(""); form.reset(); }}
            className="font-medium text-primary hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </motion.div>
  );
}
